import { supabase } from "./supabaseClient";

// ------------------------
// UTILITIES
// ------------------------

function groupBy(arr, keyFn) {
  return arr.reduce((map, item) => {
    const key = keyFn(item);
    if (!map[key]) map[key] = [];
    map[key].push(item);
    return map;
  }, {});
}

function monthsBetween(d1, d2) {
  let months;
  months = (d2.getFullYear() - d1.getFullYear()) * 12;
  months -= d1.getMonth();
  months += d2.getMonth();
  return months <= 0 ? 0 : months;
}

function daysBetween(d1, d2) {
  const ms = Math.abs(d2 - d1);
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// ------------------------
// CORE LOADERS
// ------------------------

export async function loadAllProducts() {
  const { data } = await supabase.from("products").select("*");
  return data || [];
}

export async function loadAllCustomers() {
  const { data } = await supabase.from("customers").select("*");
  return data || [];
}

export async function loadCustomerOrders(customerId) {
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_id", customerId)
    .order("order_date", { ascending: true });

  return data || [];
}

export async function loadOrderItems(orderIds) {
  if (orderIds.length === 0) return [];

  const { data } = await supabase
    .from("order_items")
    .select("*")
    .in("order_id", orderIds);

  return data || [];
}

// ------------------------
// CALCULATIONS
// ------------------------

export function calculateOrderTotal(orderId, orderItems, products) {
  const pMap = Object.fromEntries(products.map((p) => [p.id, p]));
  const items = orderItems.filter((it) => it.order_id === orderId);

  return items.reduce((sum, it) => {
    const p = pMap[it.product_id];
    if (!p) return sum;
    return sum + it.quantity * Number(p.unit_price);
  }, 0);
}

export function calculateCustomerTotals(orders, orderItems, products) {
  let totalAmount = 0;
  let totalUnits = 0;

  const pMap = Object.fromEntries(products.map((p) => [p.id, p]));

  orderItems.forEach((it) => {
    const p = pMap[it.product_id];
    if (!p) return;
    totalAmount += it.quantity * Number(p.unit_price);
    totalUnits += it.quantity;
  });

  return { totalAmount, totalUnits, orderCount: orders.length };
}

export function getCustomerOrderFrequency(orders) {
  if (orders.length < 2) return null;

  const sorted = [...orders].sort(
    (a, b) => new Date(a.order_date) - new Date(b.order_date)
  );

  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].order_date);
    const curr = new Date(sorted[i].order_date);
    gaps.push(daysBetween(prev, curr));
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return Math.round(avgGap);
}

export function getNextOrderPrediction(orders) {
  const avgGap = getCustomerOrderFrequency(orders);
  if (!avgGap) return null;

  const last = orders[orders.length - 1];
  const lastDate = new Date(last.order_date);

  const nextDate = new Date(
    lastDate.getTime() + avgGap * 24 * 60 * 60 * 1000
  );

  return nextDate.toISOString().slice(0, 10);
}

export function getCustomerTopProducts(orderItems, products, limit = 5) {
  const pMap = Object.fromEntries(products.map((p) => [p.id, p]));

  const totals = {};

  orderItems.forEach((it) => {
    if (!totals[it.product_id]) totals[it.product_id] = 0;
    totals[it.product_id] += it.quantity;
  });

  const ranked = Object.entries(totals)
    .map(([productId, qty]) => ({
      product: pMap[productId],
      quantity: qty,
    }))
    .sort((a, b) => b.quantity - a.quantity);

  return ranked.slice(0, limit);
}

export function getMonthlyRevenue(orders, orderItems, products) {
  const pMap = Object.fromEntries(products.map((p) => [p.id, p]));

  const bucket = {};

  orderItems.forEach((it) => {
    const order = orders.find((o) => o.id === it.order_id);
    if (!order) return;

    const p = pMap[it.product_id];
    if (!p) return;

    const monthKey = order.order_date.slice(0, 7); // YYYY-MM

    if (!bucket[monthKey]) bucket[monthKey] = 0;
    bucket[monthKey] += it.quantity * Number(p.unit_price);
  });

  return bucket;
}

export function getProductTotals(orderItems, products) {
  const totals = {};
  const pMap = Object.fromEntries(products.map((p) => [p.id, p]));

  orderItems.forEach((it) => {
    const p = pMap[it.product_id];
    if (!p) return;

    if (!totals[it.product_id]) {
      totals[it.product_id] = { product: p, units: 0, revenue: 0 };
    }

    totals[it.product_id].units += it.quantity;
    totals[it.product_id].revenue += it.quantity * Number(p.unit_price);
  });

  return Object.values(totals).sort((a, b) => b.revenue - a.revenue);
}

export function getCustomerBuyingPatterns(orders, orderItems, products) {
  if (orders.length === 0) return {};

  const last3Orders = orders.slice(-3).map((o) => o.id);
  const recentItems = orderItems.filter((it) =>
    last3Orders.includes(it.order_id)
  );

  const pMap = Object.fromEntries(products.map((p) => [p.id, p]));

  const countMap = {};
  recentItems.forEach((it) => {
    if (!countMap[it.product_id]) countMap[it.product_id] = 0;
    countMap[it.product_id]++;
  });

  const alwaysBuys = [];
  const sometimesBuys = [];
  const stoppedBuying = [];

  products.forEach((p) => {
    const count = countMap[p.id] || 0;
    if (count === 3) alwaysBuys.push(p);
    else if (count > 0) sometimesBuys.push(p);
    else stoppedBuying.push(p);
  });

  return { alwaysBuys, sometimesBuys, stoppedBuying };
}

