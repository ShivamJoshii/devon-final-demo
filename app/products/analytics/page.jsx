"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import { getProductTotals, getMonthlyRevenue } from "@/lib/analytics";

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

export default function ProductAnalyticsPage() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      
      const [
        { data: prods },
        { data: custs },
        { data: ords },
        { data: its }
      ] = await Promise.all([
        supabase.from("products").select("*"),
        supabase.from("customers").select("*"),
        supabase.from("orders").select("*").order("order_date", { ascending: true }),
        supabase.from("order_items").select("*"),
      ]);

      setProducts(prods || []);
      setCustomers(custs || []);
      setOrders(ords || []);
      setItems(its || []);

      setLoading(false);
    })();
  }, []);

  // -------------------------
  // PRODUCT TOTALS
  // -------------------------

  const productTotals = useMemo(() => {
    return getProductTotals(items, products);
  }, [items, products]);

  const topProducts = productTotals.slice(0, 5);

  const topProductsChartData = useMemo(() => {
    return {
      labels: topProducts.map((p) => p.product?.item_code),
      datasets: [
        {
          label: "Revenue",
          data: topProducts.map((p) => p.revenue),
          backgroundColor: "#4f46e5",
        },
      ],
    };
  }, [topProducts]);

  // -------------------------
  // TREND CHART FOR ALL PRODUCTS (stacked monthly)
  // -------------------------

  const monthlyRevenue = useMemo(() => {
    return getMonthlyRevenue(orders, items, products);
  }, [orders, items, products]);

  const monthlyChart = useMemo(() => {
    const keys = Object.keys(monthlyRevenue).sort();

    return {
      labels: keys,
      datasets: [
        {
          label: "Total Revenue",
          data: keys.map((k) => monthlyRevenue[k]),
          tension: 0.3,
        },
      ],
    };
  }, [monthlyRevenue]);

  // -------------------------
  // SPARKLINES (MINI CHARTS PER PRODUCT)
  // -------------------------

  function getProductSparkline(productId) {
    const grouped = {};

    items.forEach((it) => {
      if (it.product_id !== productId) return;
      const order = orders.find((o) => o.id === it.order_id);
      if (!order) return;

      const month = order.order_date.slice(0, 7);
      const p = products.find((p) => p.id === it.product_id);

      if (!grouped[month]) grouped[month] = 0;
      grouped[month] += it.quantity * Number(p.unit_price);
    });

    const keys = Object.keys(grouped).sort();

    return {
      labels: keys,
      datasets: [
        {
          data: keys.map((k) => grouped[k]),
          borderColor: "#6366f1",
          pointRadius: 0,
          tension: 0.3,
        },
      ],
    };
  }

  if (loading) return <div className="p-6">Loading product analytics...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Product Analytics</h1>
      <p className="text-sm text-muted-foreground">
        Deep performance insights for every product.
      </p>

      {/* TOP PRODUCTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart */}
        <div className="border border-border rounded p-4 bg-card">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold">Top products by revenue</h2>
            <span className="text-[11px] text-muted-foreground">Top 5</span>
          </div>
          {topProducts.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No product data yet.
            </div>
          ) : (
            <Bar
              data={topProductsChartData}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { font: { size: 10 } } },
                  y: { ticks: { font: { size: 10 } } },
                },
              }}
            />
          )}
        </div>

        {/* Overall revenue trend */}
        <div className="border border-border rounded p-4 bg-card">
          <h2 className="text-sm font-semibold mb-2">
            Total revenue trend (all products)
          </h2>
          {Object.keys(monthlyRevenue).length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No trends yet. Add orders to see data.
            </div>
          ) : (
            <Line
              data={monthlyChart}
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                  x: { ticks: { font: { size: 10 } } },
                  y: { ticks: { font: { size: 10 } } },
                },
              }}
            />
          )}
        </div>
      </div>

      {/* PRODUCT TABLE WITH SPARKLINES */}
      <div className="border border-border rounded p-4 bg-card">
        <h2 className="text-sm font-semibold mb-3">
          Product sales performance
        </h2>

        <table className="w-full text-xs">
          <thead className="bg-muted">
            <tr>
              <th className="border border-border px-2 py-1 text-left">Product</th>
              <th className="border border-border px-2 py-1 text-right">Units Sold</th>
              <th className="border border-border px-2 py-1 text-right">Revenue</th>
              <th className="border border-border px-2 py-1 text-center">Trend</th>
            </tr>
          </thead>
          <tbody>
            {productTotals.map((p) => (
              <tr key={p.product.id} className="hover:bg-muted/50">
                <td className="border border-border px-2 py-1">
                  {p.product.item_code} – {p.product.description}
                </td>
                <td className="border border-border px-2 py-1 text-right">
                  {p.units}
                </td>
                <td className="border border-border px-2 py-1 text-right">
                  ${p.revenue.toFixed(2)}
                </td>
                <td className="border border-border px-2 py-1">
                  <div style={{ height: 40 }}>
                    <Line
                      data={getProductSparkline(p.product.id)}
                      options={{
                        responsive: true,
                        plugins: { legend: { display: false } },
                        scales: {
                          x: { display: false },
                          y: { display: false },
                        },
                        elements: {
                          point: { radius: 0 },
                        },
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

