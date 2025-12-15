"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function HomePage() {
  const [customers, setCustomers] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("customers")
          .select("*")
          .order("customer_name");
        
        if (error) {
          console.error("Error fetching customers:", error);
          setError(error.message);
        } else {
          console.log("Fetched customers:", data);
          setCustomers(data || []);
          setError(null);
        }
      } catch (err) {
        console.error("Unexpected error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function addCustomer(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const { data, error } = await supabase
      .from("customers")
      .insert({ customer_name: name.trim() })
      .select()
      .single();
    if (!error) {
      setCustomers((prev) => [...prev, data]);
      setName("");
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Customers</h1>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive rounded text-destructive text-sm">
          Error: {error}
        </div>
      )}

      {loading && (
        <div className="text-sm text-muted-foreground">Loading customers...</div>
      )}

      <form onSubmit={addCustomer} className="flex gap-2">
        <input
          className="border border-input px-3 py-2 rounded w-64 bg-background text-foreground"
          placeholder="New customer name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          onClick={addCustomer}
          className="px-4 py-2 rounded bg-primary text-primary-foreground hover:opacity-90"
        >
          Add
        </button>
      </form>

      <div className="mt-4 border border-border rounded">
        {customers.length === 0 && !loading && !error && (
          <div className="p-4 text-sm text-muted-foreground text-center">
            No customers found. Check the browser console for details.
          </div>
        )}
        {customers.map((c) => (
          <Link
            key={c.id}
            href={`/customers/${c.id}`}
            className="block px-4 py-2 border-b border-border hover:bg-muted transition-colors"
          >
            {c.customer_name}
          </Link>
        ))}
      </div>

      <Link href="/products" className="underline text-primary hover:opacity-80">
        Manage products →
      </Link>
    </div>
  );
}

