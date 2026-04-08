'use client';

import { useMemo } from 'react';
import { DollarSign, ShoppingCart, TrendingUp, Package, ArrowUpRight } from 'lucide-react';

type OrderItem = { 
  quantity: number; 
  products: { name: string; image_url: string | null } 
};

type Order = { 
  id: string; 
  total_amount: number; 
  status: string; 
  created_at: string; 
  customers: { name: string }; 
  order_items: OrderItem[] 
};

type Product = { 
  id: string; 
  name: string; 
  price: number; 
  image_url: string | null 
};

interface AnalyticsDashboardProps {
  orders: Order[];
  products: Product[];
}

export default function AnalyticsDashboard({ orders, products }: AnalyticsDashboardProps) {
  
  // Calculate analytics metrics
  const analytics = useMemo(() => {
    const totalRevenue = orders.reduce((acc, order) => acc + Number(order.total_amount), 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const totalProductsSold = orders.reduce((acc, order) => 
      acc + order.order_items.reduce((itemAcc, item) => itemAcc + item.quantity, 0), 0
    );

    // Calculate top performing products
    const productSales: Record<string, { name: string; quantity: number; image_url: string | null }> = {};
    orders.forEach((order) => {
      order.order_items.forEach((item) => {
        const productName = item.products?.name || 'Unknown';
        if (!productSales[productName]) {
          productSales[productName] = { name: productName, quantity: 0, image_url: item.products?.image_url || null };
        }
        productSales[productName].quantity += item.quantity;
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Calculate recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentOrders = orders.filter(order => new Date(order.created_at) > sevenDaysAgo).slice(0, 5);

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      totalProductsSold,
      topProducts,
      recentOrders,
    };
  }, [orders]);

  // Calculate max quantity for bar chart scaling
  const maxQuantity = Math.max(...analytics.topProducts.map(p => p.quantity), 1);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* STAT CARDS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-6">
        
        {/* Total Revenue Card */}
        <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-2">Total Revenue</p>
              <p className="text-3xl font-black text-emerald-900">D{analytics.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <DollarSign size={24} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
            <ArrowUpRight size={14} />
            <span>All time earnings</span>
          </div>
        </div>

        {/* Total Orders Card */}
        <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">Total Orders</p>
              <p className="text-3xl font-black text-blue-900">{analytics.totalOrders}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <ShoppingCart size={24} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700">
            <ArrowUpRight size={14} />
            <span>{analytics.recentOrders.length} in last 7 days</span>
          </div>
        </div>

        {/* Average Order Value Card */}
        <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-purple-600 mb-2">Avg Order Value</p>
              <p className="text-3xl font-black text-purple-900">D{analytics.averageOrderValue.toLocaleString()}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600">
              <TrendingUp size={24} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700">
            <ArrowUpRight size={14} />
            <span>Per transaction</span>
          </div>
        </div>

        {/* Total Products Sold Card */}
        <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-2">Items Sold</p>
              <p className="text-3xl font-black text-orange-900">{analytics.totalProductsSold}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600">
              <Package size={24} />
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-orange-700">
            <ArrowUpRight size={14} />
            <span>Units shipped</span>
          </div>
        </div>

      </div>

      {/* TOP PERFORMING PRODUCTS */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6 md:p-8">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-1">Top Performing Products</h3>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Based on quantity sold</p>
        </div>

        {analytics.topProducts.length === 0 ? (
          <div className="py-12 text-center">
            <Package className="mx-auto mb-3 h-8 w-8 text-gray-200" />
            <p className="text-sm text-gray-500">No sales data yet. Your top products will appear here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {analytics.topProducts.map((product, idx) => {
              const percentage = (product.quantity / maxQuantity) * 100;
              return (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-bold uppercase tracking-widest text-gray-400">#{idx + 1}</span>
                      <p className="text-sm font-bold text-gray-900 truncate">{product.name}</p>
                    </div>
                    <span className="ml-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold whitespace-nowrap">
                      {product.quantity} sold
                    </span>
                  </div>
                  
                  {/* Tailwind CSS Bar Chart */}
                  <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-green-500 rounded-lg transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-xs font-bold text-gray-700" style={{ opacity: percentage > 30 ? 1 : 0 }}>
                        {percentage > 30 && `${Math.round(percentage)}%`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RECENT ACTIVITY */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-6 md:px-8 py-6 md:py-8">
          <h3 className="text-lg font-bold text-gray-900 mb-1">Recent Activity</h3>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Last 7 days</p>
        </div>

        {analytics.recentOrders.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart className="mx-auto mb-3 h-8 w-8 text-gray-200" />
            <p className="text-sm text-gray-500">No orders in the last 7 days. Keep promoting!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {analytics.recentOrders.map((order) => {
              const orderDate = new Date(order.created_at);
              const today = new Date();
              const yesterday = new Date(today);
              yesterday.setDate(yesterday.getDate() - 1);
              
              let dateLabel = orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              if (orderDate.toDateString() === today.toDateString()) {
                dateLabel = 'Today';
              } else if (orderDate.toDateString() === yesterday.toDateString()) {
                dateLabel = 'Yesterday';
              }

              return (
                <div key={order.id} className="p-5 md:p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-sm font-bold text-gray-900">{order.customers.name}</h4>
                        <span className={`px-2 py-1 text-[9px] font-bold uppercase tracking-widest rounded-full ${
                          order.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        {order.order_items.map((item) => item.products?.name || 'Unknown').join(', ')}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{dateLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-gray-900">D{order.total_amount.toLocaleString()}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-1">
                        {order.order_items.reduce((acc, item) => acc + item.quantity, 0)} item{order.order_items.reduce((acc, item) => acc + item.quantity, 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
