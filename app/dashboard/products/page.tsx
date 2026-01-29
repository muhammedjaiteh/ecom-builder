'use client';

import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch Products on Load
  useEffect(() => {
    const fetchProducts = async () => {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
        
      if (data) setProducts(data);
      setLoading(false);
    };
    fetchProducts();
  }, []);

  // 2. The Delete Function
  const handleDelete = async (id: string) => {
    // Confirm with the user first
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      
      if (res.ok) {
        // Success! Remove it from the list immediately (so we don't need to refresh)
        setProducts(products.filter((p) => p.id !== id));
      } else {
        alert("Failed to delete. Check console.");
      }
    } catch (error) {
      alert("Error deleting product");
    }
  };

  if (loading) return <div className="p-10 text-center">Loading inventory...</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 min-h-screen bg-gray-50">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">📦 Inventory Manager</h1>
        <Link 
          href="/dashboard/add-product" 
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition"
        >
          + Add New Product
        </Link>
      </div>

      <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-100">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 font-semibold text-gray-600">Product Name</th>
              <th className="p-4 font-semibold text-gray-600">Price</th>
              <th className="p-4 text-right font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4 font-medium text-gray-900">{product.name}</td>
                <td className="p-4 text-green-600 font-bold">D{product.price_d}</td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="text-red-600 hover:text-white border border-red-200 hover:bg-red-600 px-3 py-1 rounded transition-all text-sm font-medium"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {products.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            No products found. Go add some!
          </div>
        )}
      </div>
      
      <div className="mt-8 text-center">
         <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 hover:underline">← Back to Orders Dashboard</Link>
      </div>
    </div>
  );
}