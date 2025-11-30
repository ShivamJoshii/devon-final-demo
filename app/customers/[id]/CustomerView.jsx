"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import Insights from "./Insights";
import { exportOrderPDF } from "@/lib/exportPdf";

export default function CustomerView({ customerId }) {
  const [customer, setCustomer] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [creating, setCreating] = useState(false);
  const [tempOrder, setTempOrder] = useState({});
  const [loading, setLoading] = useState(true);

  // =====================
  // FETCH DATA
  // =====================
  useEffect(() => {
    (async () => {
      setLoading(true);

      const [{ data: cust }, { data: prods }, { data: ords }, { data: its }] =
        await Promise.all([
          supabase.from("customers").select("*").eq("id", customerId).single(),
          supabase.from("products").select("*"),
          supabase
            .from("orders")
            .select("*")
            .eq("customer_id", customerId)
            .order("order_date", { ascending: true }),
          supabase.from("order_items").select("*"),
        ]);

      setCustomer(cust);
      setProducts(prods || []);
      setOrders(ords || []);
      setItems(its || []);
      setLoading(false);
    })();
  }, [customerId]);

  // =====================
  // LAST 3 ORDERS
  // =====================
  const lastThreeOrders = useMemo(() => orders.slice(-3), [orders]);

  // =====================
  // UPDATE QTY
  // =====================
  function updateQuantity(productId, qty) {
    setTempOrder((prev) => ({ ...prev, [productId]: Number(qty) }));
  }

  // =====================
  // SUBMIT ORDER
  // =====================
  async function submitOrder() {
    const today = new Date().toISOString().slice(0, 10);

    const { data: order } = await supabase
      .from("orders")
      .insert({ customer_id: customerId, order_date: today })
      .select()
      .single();

    const rows = Object.entries(tempOrder)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => ({
        order_id: order.id,
        product_id: productId,
        quantity: qty,
      }));

    if (rows.length > 0) {
      await supabase.from("order_items").insert(rows);
    }

    exportOrderPDF(customer, products, rows, today);

    setCreating(false);
    setTempOrder({});
    window.location.reload();
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (!customer) return <div className="p-6">Customer not found.</div>;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">{customer.customer_name}</h1>

        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Create New Order
          </button>
        )}
      </div>

      {/* INSIGHTS */}
      <Insights
        customer={customer}
        orders={orders}
        items={items}
        products={products}
      />

      {/* PRODUCT TABLE (unchanged) */}
      <div className="border rounded p-4">
        <h2 className="text-sm font-semibold mb-3">Products & Order History</h2>

        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="border px-2 py-1">Item Code</th>
              <th className="border px-2 py-1">Description</th>
              <th className="border px-2 py-1">Grade</th>
              <th className="border px-2 py-1">mL</th>
              <th className="border px-2 py-1">Price</th>
              <th className="border px-2 py-1">Units/Case</th>
              <th className="border px-2 py-1">Case Price</th>

              {lastThreeOrders.map((o) => (
                <th key={o.id} className="border px-2 py-1 text-center">
                  {o.order_date}
                </th>
              ))}

              {creating && (
                <>
                  <th className="border px-2 py-1 text-center bg-green-50">Order</th>
                  <th className="border px-2 py-1 text-center bg-green-50">Total</th>
                </>
              )}
            </tr>
          </thead>

          <tbody>
            {products.map((p) => {
              const pastValues = lastThreeOrders.map((o) => {
                const item = items.find(
                  (it) => it.order_id === o.id && it.product_id === p.id
                );
                return item ? item.quantity : "";
              });

              const qty = tempOrder[p.id] || 0;
              const total = qty * Number(p.unit_price);

              return (
                <tr key={p.id}>
                  <td className="border px-2 py-1">{p.item_code}</td>
                  <td className="border px-2 py-1">{p.description}</td>
                  <td className="border px-2 py-1">{p.grade}</td>
                  <td className="border px-2 py-1">{p.ml}</td>
                  <td className="border px-2 py-1">${p.unit_price}</td>
                  <td className="border px-2 py-1">{p.units_per_case}</td>
                  <td className="border px-2 py-1">${p.case_price}</td>

                  {pastValues.map((v, i) => (
                    <td key={i} className="border px-2 py-1 text-center">
                      {v}
                    </td>
                  ))}

                  {creating && (
                    <>
                      <td className="border px-2 py-1 bg-green-50 text-center">
                        <input
                          type="number"
                          min="0"
                          value={qty}
                          onChange={(e) =>
                            updateQuantity(p.id, e.target.value)
                          }
                          className="w-16 border px-1 py-1 text-center"
                        />
                      </td>

                      <td className="border px-2 py-1 bg-green-50 text-center">
                        {qty > 0 ? `$${total.toFixed(2)}` : ""}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {creating && (
          <div className="flex gap-3 mt-4">
            <button
              onClick={submitOrder}
              className="px-4 py-2 bg-green-600 text-white rounded"
            >
              Submit Order
            </button>

            <button
              onClick={() => {
                setCreating(false);
                setTempOrder({});
              }}
              className="px-4 py-2 bg-gray-300 text-black rounded"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

