'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgePercent, Loader2, Plus, Sparkles, Trash2, ToggleLeft, ToggleRight, X,
} from 'lucide-react';
import type { Product } from '@/lib/types';

type DiscountRow = {
  id: string;
  code_name: string;
  discount_percentage: number;
  active_status: boolean;
  created_at: string;
};

type AISuggestion = {
  code_name: string;
  discount_percentage: number;
  strategy: string;
};

type Props = {
  userId: string;
  products: Pick<Product, 'id' | 'name' | 'category' | 'price'>[];
};

export default function DiscountManager({ userId, products }: Props) {
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // Existing discounts
  const [discounts, setDiscounts] = useState<DiscountRow[]>([]);
  const [loadingDiscounts, setLoadingDiscounts] = useState(true);

  // AI strategy
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isSavingSuggestion, setIsSavingSuggestion] = useState(false);

  // Manual creation form
  const [manualCode, setManualCode] = useState('');
  const [manualPercent, setManualPercent] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // ── Load discounts ───────────────────────────────────────────────────────
  const fetchDiscounts = async () => {
    const { data } = await supabase
      .from('discounts')
      .select('id, code_name, discount_percentage, active_status, created_at')
      .eq('shop_id', userId)
      .order('created_at', { ascending: false });
    setDiscounts((data as DiscountRow[]) ?? []);
    setLoadingDiscounts(false);
  };

  useEffect(() => { fetchDiscounts(); }, [userId]);

  // ── AI strategy generator ────────────────────────────────────────────────
  const handleGenerateStrategy = async () => {
    setGenerateError(null);
    setSuggestion(null);
    setIsGenerating(true);
    try {
      const res = await fetch('/api/ai/strategist', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setGenerateError(data.error || 'Failed to generate strategy. Please try again.');
        return;
      }
      setSuggestion(data);
    } catch {
      setGenerateError('Failed to connect to AI service.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveSuggestion = async () => {
    if (!suggestion) return;
    setIsSavingSuggestion(true);
    const { error } = await supabase.from('discounts').insert({
      shop_id: userId,
      code_name: suggestion.code_name,
      discount_percentage: suggestion.discount_percentage,
      active_status: true,
    });
    if (!error) {
      setSuggestion(null);
      await fetchDiscounts();
    }
    setIsSavingSuggestion(false);
  };

  // ── Manual save ──────────────────────────────────────────────────────────
  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    const pct = parseInt(manualPercent, 10);
    if (!manualCode.trim()) { setManualError('Please enter a code name.'); return; }
    if (!pct || pct < 1 || pct > 100) { setManualError('Percentage must be between 1 and 100.'); return; }
    setIsSavingManual(true);
    const { error } = await supabase.from('discounts').insert({
      shop_id: userId,
      code_name: manualCode.trim().toUpperCase(),
      discount_percentage: pct,
      active_status: true,
    });
    if (error) {
      setManualError('Failed to save. Please try again.');
    } else {
      setManualCode('');
      setManualPercent('');
      await fetchDiscounts();
    }
    setIsSavingManual(false);
  };

  // ── Toggle active ────────────────────────────────────────────────────────
  const handleToggle = async (id: string, current: boolean) => {
    setDiscounts((prev) => prev.map((d) => d.id === id ? { ...d, active_status: !current } : d));
    await supabase.from('discounts').update({ active_status: !current }).eq('id', id);
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDiscounts((prev) => prev.filter((d) => d.id !== id));
    await supabase.from('discounts').delete().eq('id', id);
  };

  const activeCount = discounts.filter((d) => d.active_status).length;

  return (
    <div className="animate-in fade-in duration-300 space-y-6">

      {/* ── Header banner ─────────────────────────────────────────────────── */}
      <div className="rounded-[2rem] border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-[#F9F8F6] p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <BadgePercent size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">AI Discount Strategist</h3>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-gray-500">
                Let Gemini analyse your inventory and design the perfect promotional campaign — or create a code manually.
              </p>
            </div>
          </div>
          <div className="rounded-full bg-white/80 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-amber-700 ring-1 ring-amber-100 self-start">
            Offer Vault
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">

        {/* ── Left: AI generator + manual form ─────────────────────────── */}
        <div className="space-y-6">

          {/* AI Strategy Card */}
          <section className="rounded-[2rem] border border-purple-100 bg-gradient-to-br from-purple-50 via-white to-white p-6 shadow-sm md:p-8">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h4 className="flex items-center gap-2 text-base font-bold text-gray-900">
                  <Sparkles size={16} className="text-purple-500" /> Generate AI Strategy
                </h4>
                <p className="mt-1 text-sm text-gray-500">
                  Gemini will analyse your {products.length} product{products.length !== 1 ? 's' : ''} and recommend the optimal promo campaign.
                </p>
              </div>
              <button
                onClick={handleGenerateStrategy}
                disabled={isGenerating || products.length === 0}
                className="flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
              >
                {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {isGenerating ? 'Analysing...' : '✨ Generate Strategy'}
              </button>
            </div>

            {generateError && (
              <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="flex-1 text-sm font-medium text-red-800">{generateError}</p>
                <button onClick={() => setGenerateError(null)} className="text-red-400 hover:text-red-600"><X size={15} /></button>
              </div>
            )}

            <AnimatePresence>
              {suggestion && (
                <motion.div
                  key="ai-suggestion"
                  initial={{ opacity: 0, y: -10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.97 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="rounded-2xl border border-purple-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-purple-500 mb-1">AI Recommendation</p>
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-[#1a2e1a] px-3 py-1.5 font-mono text-sm font-bold tracking-widest text-white">
                          {suggestion.code_name}
                        </span>
                        <span className="text-2xl font-black text-gray-900">{suggestion.discount_percentage}% off</span>
                      </div>
                    </div>
                    <button onClick={() => setSuggestion(null)} className="text-gray-300 transition-colors hover:text-gray-500"><X size={16} /></button>
                  </div>
                  <p className="mb-5 text-sm leading-relaxed text-gray-600 italic">&ldquo;{suggestion.strategy}&rdquo;</p>
                  <button
                    onClick={handleSaveSuggestion}
                    disabled={isSavingSuggestion}
                    className="flex items-center gap-2 rounded-xl bg-[#1a2e1a] px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-md transition-all duration-200 hover:bg-black hover:scale-[1.03] hover:shadow-lg active:scale-95 disabled:opacity-60 disabled:hover:scale-100 disabled:hover:shadow-md"
                  >
                    {isSavingSuggestion ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    {isSavingSuggestion ? 'Saving...' : 'Save This Code'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Manual creation form */}
          <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
            <h4 className="mb-5 text-base font-bold text-gray-900">Create Manually</h4>
            <form onSubmit={handleSaveManual} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Code Name
                  </label>
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                    placeholder="e.g. WELCOME10"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm font-medium text-gray-900 outline-none transition focus:border-gray-900 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Discount %
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={manualPercent}
                      onChange={(e) => setManualPercent(e.target.value)}
                      placeholder="15"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-10 text-sm font-medium text-gray-900 outline-none transition focus:border-gray-900 focus:bg-white"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-bold text-gray-400">%</span>
                  </div>
                </div>
              </div>
              {manualError && <p className="text-xs font-medium text-red-600">{manualError}</p>}
              <button
                type="submit"
                disabled={isSavingManual}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1a2e1a] px-5 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-md transition hover:bg-black disabled:opacity-60"
              >
                {isSavingManual ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {isSavingManual ? 'Saving...' : 'Create Discount'}
              </button>
            </form>
          </section>
        </div>

        {/* ── Right: Active discount codes ──────────────────────────────── */}
        <aside className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-base font-bold text-gray-900">Active Codes</h4>
              <p className="mt-0.5 text-sm text-gray-500">Toggle or delete at any time.</p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-700 ring-1 ring-amber-100">
              {activeCount} Active
            </span>
          </div>

          {loadingDiscounts ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={22} className="animate-spin text-gray-300" />
            </div>
          ) : discounts.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-gray-200 bg-[#F9F8F6] p-10 text-center">
              <BadgePercent className="mx-auto mb-4 h-10 w-10 text-gray-300" />
              <p className="text-sm font-bold text-gray-900">No discount codes yet.</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Generate a strategy above or create one manually.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {discounts.map((d) => (
                <div
                  key={d.id}
                  className={`flex items-center justify-between gap-3 rounded-2xl border p-4 transition ${
                    d.active_status ? 'border-green-100 bg-green-50/50' : 'border-gray-100 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-bold text-gray-900">{d.code_name}</p>
                    <p className="text-xs text-gray-500">{d.discount_percentage}% off</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => handleToggle(d.id, d.active_status)}
                      className="rounded-full p-1.5 text-gray-400 transition-all duration-150 hover:bg-gray-100 hover:text-gray-700 hover:scale-110 active:scale-95"
                      title={d.active_status ? 'Deactivate' : 'Activate'}
                    >
                      {d.active_status
                        ? <ToggleRight size={20} className="text-green-500" />
                        : <ToggleLeft size={20} />}
                    </button>
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="rounded-full p-1.5 text-gray-300 transition-all duration-150 hover:bg-red-50 hover:text-red-500 hover:scale-110 active:scale-95"
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
