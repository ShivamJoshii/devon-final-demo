"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  calculateCustomerTotals,
  getMonthlyRevenue,
  getProductTotals,
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

export default function DashboardPage() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCustomer, setNewCustomer] = useState({
    customer_name: "",
    email: "",
    phone: "",
  });
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [customerError, setCustomerError] = useState(null);

  // ---------- LOAD ALL DATA ----------

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: prods }, { data: custs }, { data: ords }, { data: its }] =
        await Promise.all([
          supabase.from("products").select("*"),
          supabase.from("customers").select("*"),
          supabase.from("orders").select("*").order("order_date", {
            ascending: true,
          }),
          supabase.from("order_items").select("*"),
        ]);

      setProducts(prods || []);
      setCustomers(custs || []);
      setOrders(ords || []);
      setItems(its || []);
      setLoading(false);
    })();
  }, []);

  // ---------- BASIC METRICS ----------

  const basicTotals = useMemo(() => {
    if (!products.length) return { totalAmount: 0, totalUnits: 0, orderCount: 0 };
    return calculateCustomerTotals(orders, items, products);
  }, [orders, items, products]);

  const activeCustomers = useMemo(() => {
    if (!orders.length) return [];

    const latestByCustomer = {};

    orders.forEach((o) => {
      if (
        !latestByCustomer[o.customer_id] ||
        new Date(o.order_date) > new Date(latestByCustomer[o.customer_id])
      ) {
        latestByCustomer[o.customer_id] = o.order_date;
      }
    });

    const now = new Date();
    const activeIds = Object.entries(latestByCustomer)
      .filter(([_, dateStr]) => {
        const d = new Date(dateStr);
        const diffDays = (now - d) / (1000 * 60 * 60 * 24);
        return diffDays <= 90; // active in last 90 days
      })
      .map(([cid]) => cid);

    return customers.filter((c) => activeIds.includes(c.id));
  }, [orders, customers]);

  // ---------- PER-CUSTOMER REVENUE ----------

  const customerRevenue = useMemo(() => {
    if (!orders.length || !items.length || !products.length) return [];

    const prodMap = Object.fromEntries(products.map((p) => [p.id, p]));
    const orderMap = Object.fromEntries(orders.map((o) => [o.id, o]));
    const custMap = Object.fromEntries(customers.map((c) => [c.id, c]));

    const bucket = {}; // customer_id -> { revenue, units }

    items.forEach((it) => {
      const order = orderMap[it.order_id];
      if (!order) return;

      const p = prodMap[it.product_id];
      if (!p) return;

      if (!bucket[order.customer_id]) {
        bucket[order.customer_id] = { revenue: 0, units: 0 };
      }
      bucket[order.customer_id].revenue +=
        it.quantity * Number(p.unit_price || 0);
      bucket[order.customer_id].units += it.quantity;
    });

    const arr = Object.entries(bucket).map(([customer_id, stats]) => ({
      customer: custMap[customer_id] || { customer_name: "Unknown" },
      revenue: stats.revenue,
      units: stats.units,
    }));

    return arr.sort((a, b) => b.revenue - a.revenue);
  }, [orders, items, products, customers]);

  // ---------- MONTHLY REVENUE (FOR LINE CHART) ----------

  const monthlyRevenue = useMemo(() => {
    if (!products.length || !orders.length || !items.length) return {};
    return getMonthlyRevenue(orders, items, products);
  }, [orders, items, products]);

  const revenueChartData = useMemo(() => {
    const keys = Object.keys(monthlyRevenue).sort(); // YYYY-MM sorted
    return {
      labels: keys,
      datasets: [
        {
          label: "Monthly Revenue",
          data: keys.map((k) => monthlyRevenue[k]),
          tension: 0.3,
        },
      ],
    };
  }, [monthlyRevenue]);

  // ---------- TOP PRODUCTS (FOR BAR CHART) ----------

  const productTotals = useMemo(
    () => getProductTotals(items, products),
    [items, products]
  );

  const topProducts = productTotals.slice(0, 5);

  const topProductsChartData = useMemo(() => {
    return {
      labels: topProducts.map((p) => p.product?.item_code || "Unknown"),
      datasets: [
        {
          label: "Revenue",
          data: topProducts.map((p) => p.revenue),
        },
      ],
    };
  }, [topProducts]);

  // ---------- RECENT ORDERS TABLE ----------

  const recentOrders = useMemo(() => {
    const sorted = [...orders].sort(
      (a, b) => new Date(b.order_date) - new Date(a.order_date)
    );
    return sorted.slice(0, 5);
  }, [orders]);

  const prodMap = useMemo(
    () => Object.fromEntries(products.map((p) => [p.id, p])),
    [products]
  );
  const orderMap = useMemo(
    () => Object.fromEntries(orders.map((o) => [o.id, o])),
    [orders]
  );
  const custMap = useMemo(
    () => Object.fromEntries(customers.map((c) => [c.id, c])),
    [customers]
  );

  const recentOrdersWithTotals = useMemo(() => {
    return recentOrders.map((o) => {
      let revenue = 0;
      let units = 0;
      items
        .filter((it) => it.order_id === o.id)
        .forEach((it) => {
          const p = prodMap[it.product_id];
          if (!p) return;
          revenue += it.quantity * Number(p.unit_price || 0);
          units += it.quantity;
        });

      return {
        ...o,
        revenue,
        units,
        customer_name: custMap[o.customer_id]?.customer_name || "Unknown",
      };
    });
  }, [recentOrders, items, prodMap, custMap]);

  // ---------- RENDER ----------

  async function handleAddCustomer(e) {
    e.preventDefault();
    setCustomerError(null);

    if (!newCustomer.customer_name.trim()) {
      setCustomerError("Customer name is required");
      return;
    }

    setAddingCustomer(true);

    const { error } = await supabase.from("customers").insert([
      {
        customer_name: newCustomer.customer_name.trim(),
        email: newCustomer.email || null,
        phone: newCustomer.phone || null,
      },
    ]);

    if (error) {
      setCustomerError(error.message);
      setAddingCustomer(false);
      return;
    }

    // Refresh customers list
    const { data: custs } = await supabase.from("customers").select("*");
    setCustomers(custs || []);

    // Reset form
    setNewCustomer({ customer_name: "", email: "", phone: "" });
    setAddingCustomer(false);
  }

  if (loading) {
    return <div className="p-6">Loading dashboard...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold mb-2">Business Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        High-level overview of revenue, customers, and products.
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border border-border rounded p-4 flex flex-col justify-between bg-card">
          <div className="text-xs uppercase text-muted-foreground">Total Revenue</div>
          <div className="text-2xl font-semibold mt-2">
            ${basicTotals.totalAmount.toFixed(2)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Across {basicTotals.orderCount} orders
          </div>
        </div>

        <div className="border border-border rounded p-4 flex flex-col justify-between bg-card">
          <div className="text-xs uppercase text-muted-foreground">Total Units Sold</div>
          <div className="text-2xl font-semibold mt-2">
            {basicTotals.totalUnits}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Across all products
          </div>
        </div>

        <div className="border border-border rounded p-4 flex flex-col justify-between bg-card">
          <div className="text-xs uppercase text-muted-foreground">
            Active Customers (90d)
          </div>
          <div className="text-2xl font-semibold mt-2">
            {activeCustomers.length}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Out of {customers.length} total
          </div>
        </div>

        <div className="border border-border rounded p-4 flex flex-col justify-between bg-card">
          <div className="text-xs uppercase text-muted-foreground">
            Top Customer (by revenue)
          </div>
          {customerRevenue.length > 0 ? (
            <>
              <div className="text-sm font-semibold mt-2">
                {customerRevenue[0].customer.customer_name}
              </div>
              <div className="text-lg mt-1">
                ${customerRevenue[0].revenue.toFixed(2)}
              </div>
            </>
          ) : (
            <div className="text-sm mt-2 text-muted-foreground">No data yet</div>
          )}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly revenue */}
        <div className="border border-border rounded p-4 bg-card">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-semibold">Revenue over time</h2>
            <span className="text-[11px] text-muted-foreground">by month</span>
          </div>
          {Object.keys(monthlyRevenue).length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No revenue data yet. Create some orders to see trends.
            </div>
          ) : (
            <Line
              data={revenueChartData}
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
            <h2 className="text-sm font-semibold">Top products by revenue</h2>
            <span className="text-[11px] text-muted-foreground">
              last {productTotals.length} products
            </span>
          </div>
          {topProducts.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No product sales yet. Orders will populate this chart.
            </div>
          ) : (
            <Bar
              data={topProductsChartData}
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
      </div>

      {/* Top customers + recent orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top customers */}
        <div className="border border-border rounded p-4 bg-card">
          <h2 className="text-sm font-semibold mb-2">Top customers</h2>
          {customerRevenue.length === 0 ? (
            <div className="text-xs text-muted-foreground">No customers with orders.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="border border-border px-2 py-1 text-left">Customer</th>
                  <th className="border border-border px-2 py-1 text-right">Revenue</th>
                  <th className="border border-border px-2 py-1 text-right">Units</th>
                </tr>
              </thead>
              <tbody>
                {customerRevenue.slice(0, 5).map((c) => (
                  <tr key={c.customer.customer_name} className="hover:bg-muted/50">
                    <td className="border border-border px-2 py-1">
                      {c.customer.customer_name}
                    </td>
                    <td className="border border-border px-2 py-1 text-right">
                      ${c.revenue.toFixed(2)}
                    </td>
                    <td className="border border-border px-2 py-1 text-right">
                      {c.units}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent orders */}
        <div className="border border-border rounded p-4 bg-card">
          <h2 className="text-sm font-semibold mb-2">Recent orders</h2>
          {recentOrdersWithTotals.length === 0 ? (
            <div className="text-xs text-muted-foreground">No orders yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="border border-border px-2 py-1 text-left">Date</th>
                  <th className="border border-border px-2 py-1 text-left">Customer</th>
                  <th className="border border-border px-2 py-1 text-right">Units</th>
                  <th className="border border-border px-2 py-1 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {recentOrdersWithTotals.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/50">
                    <td className="border border-border px-2 py-1">{o.order_date}</td>
                    <td className="border border-border px-2 py-1">{o.customer_name}</td>
                    <td className="border border-border px-2 py-1 text-right">{o.units}</td>
                    <td className="border border-border px-2 py-1 text-right">
                      ${o.revenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}



