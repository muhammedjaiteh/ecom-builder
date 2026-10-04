'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

function CurateEngine() {
  const router = useRouter();
  const [shopName, setShopName] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [input, setInput] = useState('');
  const [isCurating, setIsCurating] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 1. Fable 5.1 Standard: strict auth checking and data hydration on mount
  useEffect(() => {
    async function loadShop() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      
      const { data } = await supabase.from('shops').select('shop_name').eq('id', user.id).maybeSingle();
      if (data?.shop_name) {
        setShopName(data.shop_name);
      }
      setIsAuthLoading(false);
    }
    loadShop();
  }, [router, supabase]);

  // 2. Personalized Theatrical Loading Stages
  const dynamicStages = [
    `Analyzing material provenance for ${shopName || 'your boutique'}...`,
    'Isolating physical facts...',
    'Selecting structural typography...',
    'Generating editorial tokens...',
    'Minting the matrix...'
  ];

  // Cycle through the theatrical loading stages every 800ms
  useEffect(() => {
    if (!isCurating) return;
    const interval = setInterval(() => {
      setStageIndex((current) => (current < dynamicStages.length - 1 ? current + 1 : current));
    }, 800);
    return () => clearInterval(interval);
  }, [isCurating, dynamicStages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim().length < 10) {
      setError('Please provide a bit more detail about your physical products.');
      return;
    }

    setError(null);
    setIsCurating(true);

    try {
      // Enforce a minimum 4-second wait for the theatrical effect, even if the API is faster
      const minimumWait = new Promise((resolve) => setTimeout(resolve, 4000));
      
      const apiCall = fetch('/api/brand/curate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: input }),
      });

      const [response] = await Promise.all([apiCall, minimumWait]);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to curate identity.');
      }

      // The instant it succeeds, route them to the dashboard 
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
      setIsCurating(false);
      setStageIndex(0);
    }
  };

  // Render the Fable-standard loading state while verifying the session
  if (isAuthLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="w-full max-w-md">
      <AnimatePresence mode="wait">
        {!isCurating ? (
          <motion.div
            key="input-form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <div className="mb-8 text-center">
              <h1 className="font-serif text-3xl font-bold tracking-tight text-gray-900">
                The Atelier Setup
              </h1>
              <p className="mt-3 text-sm text-gray-500">
                Describe your inventory. Ignore marketing. Tell us the origin, the materials, and the physical weight. We will curate the rest.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g., We sell tie-dye bazin, hand-dyed in Serrekunda. Heavy woven cotton, stitched by local tailors..."
                className="h-40 w-full resize-none rounded-none border-b border-gray-300 bg-transparent p-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-0"
                autoFocus
              />
              
              {error && (
                <p className="text-center text-xs font-semibold text-red-600">{error}</p>
              )}

              <button
                type="submit"
                className="w-full bg-[#1a2e1a] py-4 text-xs font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-black active:scale-[0.98]"
              >
                Curate Identity
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="loading-sequence"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center text-center"
          >
            <Loader2 className="mb-6 h-6 w-6 animate-spin text-[#1a2e1a]" />
            <motion.p
              key={dynamicStages[stageIndex]}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="font-serif text-lg tracking-tight text-gray-900"
            >
              {dynamicStages[stageIndex]}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 3. Fable 5.1 Standard: The Suspense boundary wrapper
export default function CuratePage() {
  return (
    <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center p-4 selection:bg-gray-900 selection:text-white pb-24">
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-gray-400" /></div>}>
        <CurateEngine />
      </Suspense>
    </div>
  );
}