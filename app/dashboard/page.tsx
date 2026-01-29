import { createClient } from "@supabase/supabase-js";

// This is a Server Component, so it fetches data directly
export default async function Dashboard() {
  // 1. Initialize Database Connection
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 2. Fetch all orders (Newest first)
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return <div className="p-8 text-red-500">Error loading orders: {error.message}</div>;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">📦 Order Dashboard</h1>
          <div className="bg-white px-4 py-2 rounded shadow text-sm">
            Total Orders: <strong>{orders?.length || 0}</strong>
          </div>
        </header>

        <div className="bg-white shadow-md rounded-xl overflow-hidden border border-gray-100">
          <table className="min-w-full text-left">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="py-4 px-6 font-semibold text-gray-600">Product</th>
                <th className="py-4 px-6 font-semibold text-gray-600">Price</th>
                <th className="py-4 px-6 font-semibold text-gray-600">Status</th>
                <th className="py-4 px-6 font-semibold text-gray-600">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders?.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6 font-medium text-gray-900">
                    {order.product_name}
                  </td>
                  <td className="py-4 px-6 text-green-600 font-bold">
                    D{order.price_d}
                  </td>
                  <td className="py-4 px-6">
                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wide">
                      {order.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-gray-500 text-sm">
                    {new Date(order.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              
              {orders?.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500">
                    No orders received yet. Go place some!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}