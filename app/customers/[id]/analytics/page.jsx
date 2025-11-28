"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import {
  calculateCustomerTotals,
  getCustomerOrderFrequency,
  getNextOrderPrediction,
  getCustomerTopProducts,
  getMonthlyRevenue,
  getCustomerBuyingPatterns,
} from "@/lib/analytics";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend
);

export default function CustomerAnalyticsPage() {
  const params = useParams();
  const customerId = params.id;

  const [customer, setCustomer] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) return;

    (async () => {
      setLoading(true);

      const [{ data: cust }, { data: prods }, { data: ords }] =
        await Promise.all([
          supabase
            .from("customers")
            .select("*")
            .eq("id", customerId)
            .single(),
          supabase.from("products").select("*"),
          supabase
            .from("orders")
            .select("*")
            .eq("customer_id", customerId)
            .order("order_date", { ascending: true }),
        ]);

      setCustomer(cust || null);
      setProducts(prods || []);
      setOrders(ords || []);

      if (ords && ords.length > 0) {
        const orderIds = ords.map((o) => o.id);
        const { data: its } = await supabase
          .from("order_items")
          .select("*")
          .in("order_id", orderIds);
        setItems(its || []);
      } else {
        setItems([]);
      }

      setLoading(false);
    })();
  }, [customerId]);

  // ---------- METRICS ----------

  const totals = useMemo(() => {
    if (!products.length) return { totalAmount: 0, totalUnits: 0, orderCount: 0 };
    return calculateCustomerTotals(orders, items, products);
  }, [orders, items, products]);

  const avgGapDays = useMemo(
    () => getCustomerOrderFrequency(orders),
    [orders]
  );

  const predictedNextOrderDate = useMemo(
    () => getNextOrderPrediction(orders),
    [orders]
  );

  const topProducts = useMemo(
    () => getCustomerTopProducts(items, products, 5),
    [items, products]
  );

  const monthlyRevenue = useMemo(
    () => getMonthlyRevenue(orders, items, products),
    [orders, items, products]
  );

  const monthlyRevenueChart = useMemo(() => {
    const keys = Object.keys(monthlyRevenue).sort(); // YYYY-MM
    return {
      labels: keys,
      datasets: [
        {
          label: "Revenue",
          data: keys.map((k) => monthlyRevenue[k]),
          tension: 0.3,
        },
      ],
    };
  }, [monthlyRevenue]);

  const patterns = useMemo(
    () => getCustomerBuyingPatterns(orders, items, products),
    [orders, items, products]
  );

  if (loading || !customer) {
    return <div className="p-6">Loading customer analytics...</div>;
  }

  const lastOrder = orders[orders.length - 1] || null;
  const now = new Date();
  const daysSinceLastOrder = lastOrder
    ? Math.floor(
        (now - new Date(lastOrder.order_date)) / (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {customer.customer_name} – Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Deep dive into this customer&apos;s buying behavior and value.
          </p>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border border-border rounded p-4 flex flex-col justify-between bg-card">
          <div className="text-xs uppercase text-muted-foreground">
            Lifetime Revenue
          </div>
          <div className="text-2xl font-semibold mt-2">
            ${totals.totalAmount.toFixed(2)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {totals.orderCount} orders · {totals.totalUnits} units
          </div>
        </div>

        <div className="border border-border rounded p-4 flex flex-col justify-between bg-card">
          <div className="text-xs uppercase text-muted-foreground">
            Avg Order Value
          </div>
          <div className="text-2xl font-semibold mt-2">
            {totals.orderCount > 0
              ? `$${(totals.totalAmount / totals.orderCount).toFixed(2)}`
              : "-"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Revenue / order
          </div>
        </div>

        <div className="border border-border rounded p-4 flex flex-col justify-between bg-card">
          <div className="text-xs uppercase text-muted-foreground">
            Order Frequency
          </div>
          <div className="text-2xl font-semibold mt-2">
            {avgGapDays ? `${avgGapDays} days` : "-"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Avg gap between orders
          </div>
        </div>

        <div className="border border-border rounded p-4 flex flex-col justify-between bg-card">
          <div className="text-xs uppercase text-muted-foreground">
            Next Order (Estimate)
          </div>
          <div className="text-lg font-semibold mt-2">
            {predictedNextOrderDate || "-"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {daysSinceLastOrder != null && (
              <>Last order {daysSinceLastOrder} days ago</>
            )}
          </div>
        </div>
      </div>

      {/* REVENUE TREND + TOP PRODUCTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue trend */}
        <div className="border border-border rounded p-4 bg-card">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold">Revenue over time</h2>
            <span className="text-[11px] text-muted-foreground">by month</span>
          </div>
          {Object.keys(monthlyRevenue).length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No orders yet. Place orders to see trends.
            </div>
          ) : (
            <Line
              data={monthlyRevenueChart}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false },
                  tooltip: { mode: "index", intersect: false },
                },
                scales: {
                  x: { ticks: { font: { size: 10 } } },
                  y: { ticks: { font: { size: 10 } } },
                },
              }}
            />
          )}
        </div>

        {/* Top products */}
        <div className="border border-border rounded p-4 bg-card">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold">
              Top products for this customer
            </h2>
            <span className="text-[11px] text-muted-foreground">
              by units ordered
            </span>
          </div>
          {topProducts.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No product orders yet for this customer.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="border border-border px-2 py-1 text-left">Product</th>
                  <th className="border border-border px-2 py-1 text-right">Units</th>
                  <th className="border border-border px-2 py-1 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((row) => {
                  const p = row.product;
                  const revenue =
                    row.quantity * Number(p?.unit_price || 0);

                  return (
                    <tr key={p?.id || Math.random()} className="hover:bg-muted/50">
                      <td className="border border-border px-2 py-1">
                        {p?.item_code} – {p?.description}
                      </td>
                      <td className="border border-border px-2 py-1 text-right">
                        {row.quantity}
                      </td>
                      <td className="border border-border px-2 py-1 text-right">
                        ${revenue.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* BUYING PATTERNS */}
      <div className="border border-border rounded p-4 space-y-3 bg-card">
        <h2 className="text-sm font-semibold">Buying patterns (last 3 orders)</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <div className="font-semibold mb-1 text-primary">
              Always buys
            </div>
            {patterns.alwaysBuys && patterns.alwaysBuys.length > 0 ? (
              <ul className="space-y-1">
                {patterns.alwaysBuys.map((p) => (
                  <li key={p.id} className="border border-border rounded px-2 py-1 bg-muted/50">
                    {p.item_code} – {p.description}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-muted-foreground">
                No products in every one of the last 3 orders.
              </div>
            )}
          </div>

          <div>
            <div className="font-semibold mb-1 text-secondary">
              Sometimes buys
            </div>
            {patterns.sometimesBuys && patterns.sometimesBuys.length > 0 ? (
              <ul className="space-y-1">
                {patterns.sometimesBuys.map((p) => (
                  <li key={p.id} className="border border-border rounded px-2 py-1 bg-muted/50">
                    {p.item_code} – {p.description}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-muted-foreground">
                No partial-repeat items in last 3 orders.
              </div>
            )}
          </div>

          <div>
            <div className="font-semibold mb-1 text-destructive">
              Not bought in last 3 orders
            </div>
            {patterns.stoppedBuying && patterns.stoppedBuying.length > 0 ? (
              <ul className="space-y-1 max-h-40 overflow-auto">
                {patterns.stoppedBuying.map((p) => (
                  <li key={p.id} className="border border-border rounded px-2 py-1 bg-muted/50">
                    {p.item_code} – {p.description}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-muted-foreground">
                All products appear in at least one of the last 3 orders.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

