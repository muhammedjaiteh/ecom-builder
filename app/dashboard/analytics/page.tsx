'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useEffect, useState } from 'react';
import { ArrowLeft, TrendingUp, Users, DollarSign } from 'lucide-react';
import Link from 'next/link';

export default function AnalyticsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function getLeads() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      setLeads(data || []);
      setLoading(false);
    }
    getLeads();
  }, []);

  // Calculate Stats
  const totalLeads = leads.length;
  const potentialRevenue = leads.reduce((acc, curr) => acc + (curr.product_price || 0), 0);

  return (
    <div className="min-h-screen bg-[#F9F8F6] p-8 text-[#2C3E2C]">
      <Link href="/dashboard" className="flex items-center gap-2 text-gray-500 mb-8 hover:text-green-700">
        <ArrowLeft size={20} /> Back to Dashboard
      </Link>

      <h1 className="text-3xl font-serif font-bold mb-2">Analytics</h1>
      <p className="text-gray-500 mb-8">Track your customer interest and potential sales.</p>

      {/* 📊 STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E6E4DC]">
            <div className="flex items-center gap-3 mb-2 text-blue-600">
                <Users size={24} /> <span className="text-xs font-bold uppercase tracking-wider">Total Leads</span>
            </div>
            <p className="text-4xl font-serif">{totalLeads}</p>
            <p className="text-xs text-gray-400 mt-2">Clicks on "Order WhatsApp"</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E6E4DC]">
            <div className="flex items-center gap-3 mb-2 text-green-600">
                <DollarSign size={24} /> <span className="text-xs font-bold uppercase tracking-wider">Potential Revenue</span>
            </div>
            <p className="text-4xl font-serif">D{potentialRevenue}</p>
            <p className="text-xs text-gray-400 mt-2">Value of interested customers</p>
        </div>
      </div>

      {/* 📋 LEAD HISTORY */}
      <div className="bg-white rounded-3xl shadow-sm border border-[#E6E4DC] overflow-hidden">
        <div className="p-6 border-b border-[#E6E4DC]">
            <h3 className="font-bold">Recent Interested Customers</h3>
        </div>
        
        {leads.length === 0 ? (
            <div className="p-10 text-center text-gray-400">No leads yet. Share your shop link!</div>
        ) : (
            <table className="w-full text-left">
                <thead className="bg-[#F9F8F6] text-xs uppercase text-gray-500">
                    <tr>
                        <th className="px-6 py-4">Product</th>
                        <th className="px-6 py-4">Value</th>
                        <th className="px-6 py-4">Date</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {leads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 font-bold">{lead.product_name}</td>
                            <td className="px-6 py-4 text-green-700">D{lead.product_price}</td>
                            <td className="px-6 py-4 text-gray-500 text-sm">
                                {new Date(lead.created_at).toLocaleDateString()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        )}
      </div>
    </div>
  );
}