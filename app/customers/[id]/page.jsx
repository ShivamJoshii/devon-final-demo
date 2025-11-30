"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { exportOrderPDF } from "@/lib/exportPdf";
import Insights from "./Insights";

export default function CustomerPage() {
  const params = useParams();
  const customerId = params.id;

  const [customer, setCustomer] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]); // all orders for this customer
  const [items, setItems] = useState([]);   // all order_items for those orders

  // New order state
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [orderDate, setOrderDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [newQuantities, setNewQuantities] = useState({}); // { productId: "3" }
  const [submitting, setSubmitting] = useState(false);

  // ---------------- LOAD DATA ----------------

  useEffect(() => {
    if (!customerId) return;

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function loadData() {
    // customer
    const { data: cust } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();
    setCustomer(cust || null);

    // products
    const { data: prods } = await supabase
      .from("products")
      .select("*")
      .order("item_code");
    setProducts(prods || []);

    // orders
    const { data: ords } = await supabase
      .from("orders")
      .select("*")
      .eq("customer_id", customerId)
      .order("order_date", { ascending: true });

    const allOrders = ords || [];
    setOrders(allOrders);

    if (allOrders.length > 0) {
      const orderIds = allOrders.map((o) => o.id);
      const { data: its } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);
      setItems(its || []);
    } else {
      setItems([]);
    }
  }

  // ---------------- HISTORY GRID ----------------

  // latest 3 orders only
  const latestOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];

    return orders.slice(-3); // last 3 (orders are already sorted)
  }, [orders]);

  const historyGrid = useMemo(() => {
    const lookup = {};
    products.forEach((p) => {
      lookup[p.id] = {};
    });
    items.forEach((it) => {
      const order = orders.find((o) => o.id === it.order_id);
      if (!order) return;
      const d = order.order_date;
      if (!lookup[it.product_id]) lookup[it.product_id] = {};
      lookup[it.product_id][d] = it.quantity;
    });
    return lookup;
  }, [products, orders, items]);

  // ---------------- NEW ORDER HELPERS ----------------

  function handleQtyChange(productId, value) {
    const val = value.replace(/[^\d]/g, ""); // only digits
    setNewQuantities((prev) => ({
      ...prev,
      [productId]: val,
    }));
  }

  const newOrderTotals = useMemo(
    () =>
      products.reduce(
        (acc, p) => {
          const qty = Number(newQuantities[p.id] || 0);
          const unit = Number(p.unit_price || 0);
          acc.units += qty;
          acc.amount += qty * unit;
          return acc;
        },
        { units: 0, amount: 0 }
      ),
    [products, newQuantities]
  );

  async function submitNewOrder(e) {
    e.preventDefault();

    if (!orderDate) return;

    // build payload from non-zero quantities
    const payloadItems = products
      .map((p) => {
        const qty = Number(newQuantities[p.id] || 0);
        return qty > 0
          ? { product_id: p.id, quantity: qty }
          : null;
      })
      .filter(Boolean);

    if (payloadItems.length === 0) return; // nothing to save

    try {
      setSubmitting(true);

      // find or create order for this date
      let order = orders.find((o) => o.order_date === orderDate);
      if (!order) {
        const { data, error } = await supabase
          .from("orders")
          .insert({
            customer_id: customerId,
            order_date: orderDate,
          })
          .select()
          .single();
        if (error) throw error;
        order = data;
      }

      // simple approach: delete existing items for that order, then insert fresh
      const { error: delError } = await supabase
        .from("order_items")
        .delete()
        .eq("order_id", order.id);
      if (delError) throw delError;

      const itemsPayload = payloadItems.map((it) => ({
        order_id: order.id,
        product_id: it.product_id,
        quantity: it.quantity,
      }));

      const { error: insError } = await supabase
        .from("order_items")
        .insert(itemsPayload);
      if (insError) throw insError;

      // reload orders + items for history (history is hidden in create mode anyway)
      await loadData();

      // Export PDF
      const orderItems = payloadItems.map((it) => ({
        product_id: it.product_id,
        quantity: it.quantity,
      }));
      exportOrderPDF(customer, products, orderItems, orderDate);

      // clear the form & exit create mode
      setNewQuantities({});
      setShowNewOrder(false);
      setOrderDate(new Date().toISOString().slice(0, 10));
    } catch (err) {
      console.error("Submit order error", err);
    } finally {
      setSubmitting(false);
    }
  }

  function cancelNewOrder() {
    setNewQuantities({});
    setShowNewOrder(false);
    setOrderDate(new Date().toISOString().slice(0, 10));
  }

  // optional: delete an order (entire date column)
  async function deleteOrder(orderId) {
    if (!confirm("Delete this entire order (all items for that date)?")) return;
    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("id", orderId);
    if (!error) {
      await loadData();
    }
  }

  if (!customer) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-4 space-y-4">
      {/* Header + controls */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {customer.customer_name} – Orders
        </h1>

        <div className="flex items-center gap-2">
          {showNewOrder && (
            <>
              <label className="text-sm">Order date:</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="border border-input px-2 py-1 rounded text-sm bg-background text-foreground"
              />
            </>
          )}

          {!showNewOrder ? (
            <button
              type="button"
              onClick={() => setShowNewOrder(true)}
              className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm hover:opacity-90"
            >
              Create new order
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={submitNewOrder}
                disabled={submitting}
                className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm disabled:opacity-60 hover:opacity-90"
              >
                {submitting ? "Saving..." : "Submit"}
              </button>
              <button
                type="button"
                onClick={cancelNewOrder}
                className="px-4 py-2 rounded border border-border text-sm hover:bg-muted"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Customer Insights */}
      <Insights
        customer={customer}
        orders={orders}
        items={items}
        products={products}
      />

      {/* Info about history */}
      {!showNewOrder && (
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>Showing full product list + latest 3 orders by date.</span>
          {orders.length > 3 && (
            <span>There are {orders.length} total orders (only last 3 shown).</span>
          )}
        </div>
      )}

      {/* Main table: products + either history OR order/total */}
      <div className="border border-border rounded overflow-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-muted">
            <tr>
              {/* Static product columns */}
              <th className="border border-border px-2 py-1">Item Code</th>
              <th className="border border-border px-2 py-1">Description</th>
              <th className="border border-border px-2 py-1">Grade</th>
              <th className="border border-border px-2 py-1">mL</th>
              <th className="border border-border px-2 py-1">Unit Price</th>
              <th className="border border-border px-2 py-1">Units/Case</th>
              <th className="border border-border px-2 py-1">Case Price</th>
              {/* Always show past 3 dates */}
              {latestOrders.map((o) => (
                <th key={o.id} className="border border-border px-2 py-1 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <span>{o.order_date}</span>
                    <button
                      type="button"
                      className="text-[10px] border px-1 py-0.5 rounded hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => deleteOrder(o.id)}
                    >
                      ✕
                    </button>
                  </div>
                </th>
              ))}
              {/* Append New Order columns only in create mode */}
              {showNewOrder && (
                <>
                  <th className="border border-border px-2 py-1 text-center">Order</th>
                  <th className="border border-border px-2 py-1 text-right">Total</th>
                </>
              )}
            </tr>
          </thead>

          <tbody>
            {products.map((p) => {
              const qty = Number(newQuantities[p.id] || 0);
              const lineTotal = qty * Number(p.unit_price || 0);

              return (
                <tr key={p.id} className="hover:bg-muted/50">
                  {/* FIXED PRODUCT COLUMNS */}
                  <td className="border border-border px-2 py-1">{p.item_code}</td>
                  <td className="border border-border px-2 py-1">{p.description}</td>
                  <td className="border border-border px-2 py-1">{p.grade}</td>
                  <td className="border border-border px-2 py-1">{p.ml}</td>
                  <td className="border border-border px-2 py-1 text-right">
                    {Number(p.unit_price).toFixed(2)}
                  </td>
                  <td className="border border-border px-2 py-1 text-right">
                    {p.units_per_case}
                  </td>
                  <td className="border border-border px-2 py-1 text-right">
                    {Number(p.case_price).toFixed(2)}
                  </td>
                  {/* ALWAYS SHOW HISTORY FIRST → MATCHES THEAD */}
                  {latestOrders.map((o) => {
                    const q = historyGrid[p.id]?.[o.order_date] ?? "";
                    return (
                      <td
                        key={o.id}
                        className="border border-border px-2 py-1 text-center align-middle"
                      >
                        {q}
                      </td>
                    );
                  })}
                  {/* ONLY THEN SHOW NEW ORDER COLUMNS */}
                  {showNewOrder && (
                    <>
                      <td className="border border-border px-2 py-1 text-center">
                        <input
                          className="w-16 border border-input rounded px-1 py-0.5 text-center bg-background text-foreground"
                          value={newQuantities[p.id] || ""}
                          onChange={(e) => handleQtyChange(p.id, e.target.value)}
                        />
                      </td>
                      <td className="border border-border px-2 py-1 text-right">
                        {lineTotal > 0 ? lineTotal.toFixed(2) : ""}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>

          {/* Totals row only in create-order mode */}
          {showNewOrder && (
            <tfoot className="bg-muted/50">
              <tr>
                <td
                  colSpan={7}
                  className="border border-border px-2 py-1 text-right font-semibold"
                >
                  Totals:
                </td>
                <td className="border border-border px-2 py-1 text-center font-semibold">
                  {newOrderTotals.units}
                </td>
                <td className="border border-border px-2 py-1 text-right font-semibold">
                  {newOrderTotals.amount.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
