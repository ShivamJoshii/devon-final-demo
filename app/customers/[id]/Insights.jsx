"use client";

export default function Insights({ orders, items, products, customer }) {
  if (!orders || orders.length === 0) {
    return (
      <div className="border border-border rounded p-4 bg-muted/50 text-sm">
        No orders yet for {customer.customer_name}.  
        Create the first order to unlock insights.
      </div>
    );
  }

  // --- last order
  const last = orders[orders.length - 1];
  const lastDate = new Date(last.order_date);
  const now = new Date();
  const daysSinceLast = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

  // --- avg gap
  let avgGap = null;
  if (orders.length > 1) {
    const diffs = [];
    for (let i = 1; i < orders.length; i++) {
      const d1 = new Date(orders[i - 1].order_date);
      const d2 = new Date(orders[i].order_date);
      diffs.push(Math.floor((d2 - d1) / (1000 * 60 * 60 * 24)));
    }
    avgGap = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
  }

  let predicted = null;
  if (avgGap) {
    predicted = new Date(lastDate.getTime() + avgGap * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  }

  // --- buying patterns (last 3 orders)
  const last3 = orders.slice(-3).map((o) => o.id);
  const recentItems = items.filter((i) => last3.includes(i.order_id));

  const pMap = Object.fromEntries(products.map((p) => [p.id, p]));

  const countMap = {};
  recentItems.forEach((it) => {
    if (!countMap[it.product_id]) countMap[it.product_id] = 0;
    countMap[it.product_id]++;
  });

  const always = [];
  const sometimes = [];
  const stopped = [];

  products.forEach((p) => {
    const c = countMap[p.id] || 0;
    if (c === 3) always.push(p);
    else if (c > 0) sometimes.push(p);
    else stopped.push(p);
  });

  return (
    <div className="border border-border rounded p-4 bg-muted/30 space-y-3">
      <h2 className="text-sm font-semibold">Customer Insights</h2>

      <div className="text-xs space-y-1">
        <div>
          <span className="font-semibold">Last order:</span>{" "}
          {last.order_date} ({daysSinceLast} days ago)
        </div>

        <div>
          <span className="font-semibold">Order frequency:</span>{" "}
          {avgGap ? `${avgGap} days` : "Not enough data"}
        </div>

        <div>
          <span className="font-semibold">Next expected order:</span>{" "}
          {predicted || "Not enough data"}
        </div>
      </div>

      {/* Patterns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        {/* ALWAYS BUYS — KEEP FULL LIST */}
        <div>
          <div className="font-semibold text-primary mb-1">Always Buys</div>
          {always.length === 0 ? (
            <div className="text-muted-foreground">None</div>
          ) : (
            always.map((p) => (
              <div key={p.id} className="border border-border rounded px-2 py-1 bg-card">
                {p.item_code} – {p.description}
              </div>
            ))
          )}
        </div>

        {/* SOMETIMES — LIMIT TO 1 */}
        <div>
          <div className="font-semibold text-secondary mb-1">Sometimes Buys</div>
          {sometimes.length === 0 ? (
            <div className="text-muted-foreground">None</div>
          ) : (
            <div className="border border-border rounded px-2 py-1 bg-card">
              {sometimes[0].item_code} – {sometimes[0].description}
            </div>
          )}
        </div>

        {/* STOPPED BUYING — LIMIT TO 1 */}
        <div>
          <div className="font-semibold text-destructive mb-1">
            Not Bought Recently
          </div>
          {stopped.length === 0 ? (
            <div className="text-muted-foreground">None</div>
          ) : (
            <div className="border border-border rounded px-2 py-1 bg-card">
              {stopped[0].item_code} – {stopped[0].description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

