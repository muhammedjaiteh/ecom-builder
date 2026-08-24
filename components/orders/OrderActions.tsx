'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Ban, CheckCircle2, Loader2 } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import BottomSheet from '@/components/website/BottomSheet';
import { useIsMobileViewport } from '@/lib/useIsMobileViewport';
import type { Order } from '@/lib/types';

// ─────────────────────────────────────────────────────────────────────────────
// OrderActions — the ONE implementation of the seller's order-status loop,
// mounted by BOTH orders surfaces (the command center's orders tab and
// /dashboard/orders), which previously duplicated this logic.
//
// AUTHORIZATION EVIDENCE: every write here runs on the seller's own browser
// client. RLS_PRODUCTS_ORDERS_SHOPS.sql §5 "orders_owner_update" grants
// UPDATE TO authenticated USING/WITH CHECK (shop_id = auth.uid()) — the exact
// scope both pages' legacy Mark-Paid flows already exercised in production.
// increment_stock (INVENTORY_DEDUCTION_RPC.sql) is SECURITY DEFINER and is
// already called from the anonymous buyer client (Cart.tsx rollbackStock), so
// the authenticated seller may call it a fortiori. No service-role API route
// is needed.
//
// MECHANICS:
//   · Mark as Paid — optimistic pending→completed flip with a drawn-check
//     micro-celebration; the UPDATE carries .eq('status','pending') +
//     .select('id') so zero rows updated means someone else acted first —
//     the local state is then resynced from the database, never guessed.
//   · Cancel & Restock — destructive confirm via BottomSheet (mobile) /
//     centered modal with Escape parity (desktop — the domains-page
//     precedent). On confirm: UPDATE … SET status='cancelled' WHERE
//     id=… AND shop_id=… AND status='pending'. THE RACE GUARD: zero rows
//     updated = another tab/device already moved this order — the restock is
//     ABORTED (stock must never be re-credited for an order that was paid or
//     already cancelled elsewhere). Only after the guarded UPDATE lands does
//     increment_stock run per order_item; the RPC itself no-ops products with
//     NULL stock_quantity (untracked inventory stays untracked), and per-item
//     failures are tolerated with an honest 'X of Y items restocked' toast.
//   · Terminal states are immutable here: 'cancelled' renders a muted badge
//     with no actions (stock was already restored — reopening would
//     double-count it). 'completed' keeps its long-standing Undo.
// ─────────────────────────────────────────────────────────────────────────────

export type ActionableOrder = {
  id: string;
  status: Order['status'];
  order_items: { quantity: number; product_id?: string | null }[];
};

type TransitionResult = 'ok' | 'raced' | 'failed';

type OrderActionsProps = {
  order: ActionableOrder;
  /** The authenticated seller (shop_id) — owner scope for every write. */
  userId: string;
  supabase: SupabaseClient;
  /** Apply a status to the parent's local orders state (optimistic + resync). */
  applyStatus: (orderId: string, status: Order['status']) => void;
  onToast: (message: string) => void;
};

/** Transient toast state with timer cleanup — one per orders surface. */
export function useOrderToast() {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const showToast = (message: string) => {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4500);
  };
  return { toast, showToast };
}

/** The honest-outcome chip — neutral dark (successes and failures both land here). */
export function OrderActionToast({ toast }: { toast: string | null }) {
  return (
    <div
      aria-live="polite"
      className={`fixed bottom-6 left-1/2 z-[120] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 transition-all duration-500 ${
        toast ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      }`}
    >
      <div className="rounded-2xl bg-gray-900 px-5 py-3 text-center text-xs font-semibold text-white shadow-xl">
        {toast}
      </div>
    </div>
  );
}

/** Subtle drawn-check micro-celebration for the Mark-Paid flip. */
function DrawnCheck() {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
      aria-hidden
    >
      <motion.svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <motion.path
          d="M4.5 12.5l5 5 10-11"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.1 }}
        />
      </motion.svg>
    </motion.span>
  );
}

export default function OrderActions({ order, userId, supabase, applyStatus, onToast }: OrderActionsProps) {
  const isMobile = useIsMobileViewport();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const celebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (celebrationTimer.current) clearTimeout(celebrationTimer.current); }, []);

  // Desktop modal Escape parity (the BottomSheet handles its own on mobile) —
  // same contract as the domains-page disconnect confirm.
  useEffect(() => {
    if (!confirming || isMobile) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirming(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirming, isMobile]);

  const startCelebration = () => {
    setCelebrating(true);
    if (celebrationTimer.current) clearTimeout(celebrationTimer.current);
    celebrationTimer.current = setTimeout(() => setCelebrating(false), 1500);
  };

  /** Guarded owner-scoped status transition. .select('id') exposes the row
   *  count: zero rows = the `from` precondition no longer held (raced). */
  const transition = async (from: Order['status'], to: Order['status']): Promise<TransitionResult> => {
    const { data, error } = await supabase
      .from('orders')
      .update({ status: to })
      .eq('id', order.id)
      .eq('shop_id', userId)
      .eq('status', from)
      .select('id');
    if (error) return 'failed';
    return data && data.length > 0 ? 'ok' : 'raced';
  };

  /** Pull the real status after a detected race — shown, never guessed. */
  const resyncStatus = async () => {
    const { data } = await supabase.from('orders').select('status').eq('id', order.id).maybeSingle();
    if (data?.status) applyStatus(order.id, data.status as Order['status']);
  };

  // Mark Paid covers every NON-TERMINAL status — the legacy vocabulary
  // ('new'/'processing'/'shipped', pre-rebuild checkout) always had this
  // button and keeps it. The transition guards on the order's ACTUAL current
  // status, so the race guard holds for legacy rows too.
  const fromStatus = order.status;

  const handleMarkPaid = async () => {
    if (busy) return;
    setBusy(true);
    applyStatus(order.id, 'completed'); // optimistic flip
    startCelebration();
    const result = await transition(fromStatus, 'completed');
    if (result === 'failed') {
      setCelebrating(false);
      applyStatus(order.id, fromStatus); // honest rollback
      onToast('Could not mark this order as paid — nothing was changed. Check your connection and try again.');
    } else if (result === 'raced') {
      setCelebrating(false);
      onToast('This order was already updated somewhere else — showing its latest status.');
      await resyncStatus();
    }
    setBusy(false);
  };

  const handleUndo = async () => {
    if (busy) return;
    setBusy(true);
    applyStatus(order.id, 'pending'); // optimistic (the long-standing Undo flow)
    const result = await transition('completed', 'pending');
    if (result === 'failed') {
      applyStatus(order.id, 'completed');
      onToast('Could not undo — nothing was changed. Check your connection and try again.');
    } else if (result === 'raced') {
      onToast('This order was already updated somewhere else — showing its latest status.');
      await resyncStatus();
    }
    setBusy(false);
  };

  const handleCancelConfirmed = async () => {
    if (cancelling) return;
    setCancelling(true);

    const result = await transition('pending', 'cancelled');

    if (result === 'failed') {
      setCancelling(false);
      setConfirming(false);
      onToast('Could not cancel this order — nothing was changed. Check your connection and try again.');
      return;
    }
    if (result === 'raced') {
      // RACE GUARD TRIPPED: someone else acted on this order first. The
      // restock is aborted — re-crediting stock for an order that was paid
      // (or already cancelled) elsewhere would corrupt inventory.
      setCancelling(false);
      setConfirming(false);
      onToast('This order was already updated somewhere else — no stock was changed.');
      await resyncStatus();
      return;
    }

    applyStatus(order.id, 'cancelled');
    setConfirming(false);

    // Restock per order_item. Lines whose product row is gone (no product_id)
    // cannot be restocked; the RPC internally no-ops NULL stock_quantity
    // (untracked inventory) and re-credits tracked stock atomically.
    const lines = order.order_items;
    let restocked = 0;
    for (const item of lines) {
      if (!item.product_id || !(item.quantity > 0)) continue;
      const { data: ok, error: rpcError } = await supabase.rpc('increment_stock', {
        product_id_param: item.product_id,
        quantity_param: item.quantity,
      });
      if (!rpcError && ok !== false) restocked += 1;
      else console.error(`[orders] restock failed for product ${item.product_id}:`, rpcError?.message ?? 'product not found');
    }
    setCancelling(false);

    if (lines.length === 0) {
      onToast('Order cancelled.');
    } else if (restocked === lines.length) {
      onToast('Order cancelled — all items returned to stock.');
    } else {
      onToast(`Order cancelled; ${restocked} of ${lines.length} items restocked.`);
    }
  };

  const unitCount = order.order_items.reduce((acc, item) => acc + (Number(item.quantity) || 0), 0);

  const confirmBody = (
    <p className="text-sm leading-relaxed text-gray-600">
      Cancel this order and return its {unitCount > 0 ? `${unitCount} unit${unitCount === 1 ? '' : 's'}` : 'items'} to
      stock? This is final — a cancelled order cannot be reopened, and the customer is not notified automatically.
    </p>
  );

  const confirmActions = (mobile: boolean) => (
    <div className={mobile ? 'flex gap-2 px-5 pt-3' : 'mt-6 flex gap-2'}>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={cancelling}
        className="flex min-h-[48px] flex-1 items-center justify-center rounded-full border border-gray-200 bg-white text-[11px] font-bold uppercase tracking-widest text-gray-700 transition hover:bg-gray-50 active:scale-95 disabled:opacity-50"
      >
        Keep Order
      </button>
      <button
        type="button"
        onClick={handleCancelConfirmed}
        disabled={cancelling}
        className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full bg-red-600 text-[11px] font-bold uppercase tracking-widest text-white transition hover:bg-red-700 active:scale-95 disabled:opacity-60"
      >
        {cancelling ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
        Cancel &amp; Restock
      </button>
    </div>
  );

  return (
    <>
      {order.status !== 'completed' && order.status !== 'cancelled' ? (
        <div className="flex flex-wrap items-center justify-end gap-2 md:flex-col md:items-stretch">
          <button
            type="button"
            onClick={handleMarkPaid}
            disabled={busy}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-gray-900 px-5 text-[10px] font-bold uppercase tracking-widest text-white transition hover:bg-black active:scale-95 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Mark Paid
          </button>
          {/* Cancel & Restock is STRICTLY pending-only: legacy 'new' orders
              (pre-rebuild checkout) never decremented stock at checkout, so
              restocking them would invent inventory that was never reserved. */}
          {order.status === 'pending' && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={busy}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-5 text-[10px] font-bold uppercase tracking-widest text-red-600 transition hover:bg-red-100 active:scale-95 disabled:opacity-60"
            >
              <Ban size={14} /> Cancel &amp; Restock
            </button>
          )}
        </div>
      ) : order.status === 'completed' ? (
        <div className="flex items-center justify-end gap-2">
          <AnimatePresence>{celebrating && <DrawnCheck />}</AnimatePresence>
          <button
            type="button"
            onClick={handleUndo}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full bg-gray-100 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-600 transition hover:bg-gray-200 disabled:opacity-60"
          >
            Undo
          </button>
        </div>
      ) : order.status === 'cancelled' ? (
        // Terminal flake state — immutable. Stock was already restored;
        // reopening would double-count it.
        <span className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-gray-100 px-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          <Ban size={12} /> Cancelled
        </span>
      ) : null}

      {/* Destructive confirm — sheet on mobile, centered modal on desktop */}
      <AnimatePresence>
        {confirming && isMobile && (
          <BottomSheet label="Cancel this order" onDismiss={() => setConfirming(false)} footer={confirmActions(true)}>
            <div className="px-5 pb-4 pt-2">{confirmBody}</div>
          </BottomSheet>
        )}
      </AnimatePresence>
      {confirming && !isMobile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setConfirming(false)}
            className="absolute inset-0 cursor-default bg-neutral-950/60 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cancel this order"
            className="relative w-full max-w-md rounded-[1.5rem] bg-white p-6 shadow-2xl"
          >
            <h3 className="font-serif text-lg font-bold text-gray-900">Cancel this order</h3>
            <div className="mt-3">{confirmBody}</div>
            {confirmActions(false)}
          </div>
        </div>
      )}
    </>
  );
}
