'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Settings, 
  Plus, 
  Search, 
  Trash2, 
  LogOut, 
  TrendingUp,
  DollarSign
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const router = useRouter();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    let imageUrl = null;
    if (image) {
      const fileName = `${Date.now()}-${image.name}`;
      const { data, error } = await supabase.storage.from('product-images').upload(fileName, image);
      if (data) {
        const { data: publicUrl } = supabase.storage.from('product-images').getPublicUrl(fileName);
        imageUrl = publicUrl.publicUrl;
      }
    }

    await supabase.from('products').insert([{ 
      name, 
      price: parseFloat(price), 
      description,
      image_url: imageUrl 
    }]);

    setUploading(false);
    setIsAdding(false);
    setName(''); setPrice(''); setDescription(''); setImage(null);
    fetchProducts(); // Refresh list
  };

  const handleDelete = async (id: string) => {
    if(!confirm('Are you sure you want to delete this product?')) return;
    await supabase.from('products').delete().match({ id });
    fetchProducts();
  };

  // Stats Calculation
  const totalValue = products.reduce((acc, p) => acc + (p.price || 0), 0);
  const averagePrice = products.length > 0 ? Math.round(totalValue / products.length) : 0;

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
      
      {/* 🟢 SIDEBAR */}
      <aside className="w-64 bg-green-900 text-white hidden md:flex flex-col">
        <div className="p-6 border-b border-green-800">
          <div className="text-2xl font-black tracking-tight">GAMBIA<span className="text-green-400">ADMIN</span></div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button className="flex items-center gap-3 w-full px-4 py-3 bg-green-800 rounded-xl text-white font-medium shadow-sm">
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button className="flex items-center gap-3 w-full px-4 py-3 text-green-100 hover:bg-green-800/50 rounded-xl transition-colors">
            <Package size={20} /> Products
          </button>
          <button className="flex items-center gap-3 w-full px-4 py-3 text-green-100 hover:bg-green-800/50 rounded-xl transition-colors">
            <ShoppingCart size={20} /> Orders
          </button>
          <button className="flex items-center gap-3 w-full px-4 py-3 text-green-100 hover:bg-green-800/50 rounded-xl transition-colors">
            <Settings size={20} /> Settings
          </button>
        </nav>

        <div className="p-4 border-t border-green-800">
          <Link href="/" className="flex items-center gap-2 text-green-300 hover:text-white text-sm">
            <LogOut size={16} /> Back to Store
          </Link>
        </div>
      </aside>

      {/* ⚪ MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b h-16 flex items-center justify-between px-8 sticky top-0 z-10">
          <h1 className="text-xl font-bold text-gray-800">Overview</h1>
          <div className="flex items-center gap-4">
            <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold">
              A
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          
          {/* 📊 STATS CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                <Package size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Products</p>
                <p className="text-2xl font-black">{products.length}</p>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
              <div className="p-3 bg-green-50 rounded-xl text-green-600">
                <DollarSign size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Inventory Value</p>
                <p className="text-2xl font-black">D{totalValue.toLocaleString()}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-4">
              <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Avg. Price</p>
                <p className="text-2xl font-black">D{averagePrice}</p>
              </div>
            </div>
          </div>

          {/* 📦 PRODUCT MANAGEMENT */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
              <h2 className="font-bold text-lg">Inventory</h2>
              <button 
                onClick={() => setIsAdding(!isAdding)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all"
              >
                {isAdding ? 'Cancel' : <><Plus size={18} /> Add Product</>}
              </button>
            </div>

            {/* ADD PRODUCT FORM (Collapsible) */}
            {isAdding && (
              <div className="p-6 bg-green-50 border-b animate-in fade-in slide-in-from-top-4">
                <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                  <input 
                    type="text" placeholder="Product Name" required
                    className="p-3 border rounded-lg"
                    value={name} onChange={e => setName(e.target.value)}
                  />
                  <input 
                    type="number" placeholder="Price (Dalasi)" required
                    className="p-3 border rounded-lg"
                    value={price} onChange={e => setPrice(e.target.value)}
                  />
                  <textarea 
                    placeholder="Description"
                    className="p-3 border rounded-lg md:col-span-2"
                    value={description} onChange={e => setDescription(e.target.value)}
                  />
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Product Image</label>
                    <input 
                      type="file" accept="image/*"
                      onChange={e => setImage(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-100 file:text-green-700 hover:file:bg-green-200"
                    />
                  </div>
                  <button disabled={uploading} className="bg-black text-white py-3 rounded-lg font-bold md:col-span-2 hover:bg-gray-800">
                    {uploading ? 'Saving...' : 'Save Product'}
                  </button>
                </form>
              </div>
            )}

            {/* TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500 border-b">
                  <tr>
                    <th className="p-4 font-medium">Product</th>
                    <th className="p-4 font-medium">Price</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 flex items-center gap-3">
                        <div className="h-10 w-10 bg-gray-100 rounded-lg overflow-hidden border">
                          {p.image_url && <img src={p.image_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <span className="font-medium text-gray-900">{p.name}</span>
                      </td>
                      <td className="p-4 font-medium text-gray-600">D{p.price}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => handleDelete(p.id)}
                          className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {products.length === 0 && !loading && (
                <div className="p-12 text-center text-gray-400">No products found. Add one!</div>
              )}
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}