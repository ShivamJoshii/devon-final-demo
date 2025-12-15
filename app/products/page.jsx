"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("item_code");
      if (!error) setProducts(data || []);
    })();
  }, []);

  const filteredProducts = products.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.item_code.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  });

  const productsByCategory = useMemo(() => {
    const map = {};

    filteredProducts.forEach((p) => {
      const category = p.category || "Uncategorized";
      if (!map[category]) map[category] = [];
      map[category].push(p);
    });

    return map;
  }, [filteredProducts]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Products</h1>

      <div className="mt-4">
        <input
          className="border border-input px-3 py-2 rounded w-80 bg-background text-foreground"
          placeholder="Search products (item code or description)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-auto border border-border rounded mt-4">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="border border-border px-2 py-1 text-left">Item Code</th>
              <th className="border border-border px-2 py-1 text-left">Description</th>
              <th className="border border-border px-2 py-1 text-left">Grade</th>
              <th className="border border-border px-2 py-1 text-left">mL</th>
              <th className="border border-border px-2 py-1 text-right">Unit Price</th>
              <th className="border border-border px-2 py-1 text-right">Units/Case</th>
              <th className="border border-border px-2 py-1 text-right">Case Price</th>
            </tr>
          </thead>
      <tbody>
        {Object.entries(productsByCategory).map(([category, items]) => (
          <React.Fragment key={category}>
            {/* CATEGORY HEADER */}
            <tr>
              <td
                colSpan={7}
                className="bg-muted font-semibold text-sm px-3 py-2 border border-border"
              >
                {category}
              </td>
            </tr>

            {/* PRODUCTS */}
            {items.map((p) => (
              <tr key={p.id} className="hover:bg-muted/50">
                <td className="border px-2 py-1">{p.item_code}</td>
                <td className="border px-2 py-1">{p.description}</td>
                <td className="border px-2 py-1">{p.grade}</td>
                <td className="border px-2 py-1">{p.ml}</td>
                <td className="border px-2 py-1 text-right">
                  ${Number(p.unit_price).toFixed(2)}
                </td>
                <td className="border px-2 py-1 text-right">{p.units_per_case}</td>
                <td className="border px-2 py-1 text-right">
                  ${Number(p.case_price).toFixed(2)}
                </td>
              </tr>
            ))}
          </React.Fragment>
        ))}
      </tbody>
        </table>
      </div>
    </div>
  );
}

