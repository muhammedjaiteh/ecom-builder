'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Coach marks — first-run guidance for the Themes hub and Customize cockpit.
// Pulsing dots sit on the primary controls (Generate → Customize → Publish on
// the hub; Theme → Copy → Save in the cockpit); one ≥44px dismiss stores the
// flag in localStorage so a seller sees the tour exactly once per surface.
//
// Hydration-safe via useSyncExternalStore: the server snapshot reports
// "dismissed" (no marks in SSR HTML), the client snapshot reads the real
// localStorage flag after hydration — no setState-in-effect cascade, no
// hydration mismatch.
// ─────────────────────────────────────────────────────────────────────────────

function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

export function useCoachMarks(storageKey: string) {
  // Session-local dismissal — flips instantly even if localStorage is
  // unavailable (private-mode quota), so the ≥44px dismiss always works.
  const [dismissedNow, setDismissedNow] = useState(false);

  const storedDismissed = useSyncExternalStore(
    subscribeToStorage,
    () => {
      try {
        return window.localStorage.getItem(storageKey) !== null;
      } catch {
        return true; // storage unavailable — never show, never crash
      }
    },
    () => true // server snapshot: dismissed (marks appear only client-side)
  );

  const dismiss = useCallback(() => {
    setDismissedNow(true);
    try {
      window.localStorage.setItem(storageKey, String(Date.now()));
    } catch {
      // Best-effort: the tour simply reappears next visit.
    }
  }, [storageKey]);

  return { visible: !storedDismissed && !dismissedNow, dismiss };
}

/** Pulsing dot pinned to a control's top-right corner — the PARENT must be
 *  position:relative. Decorative (aria-hidden): the step legend carries the
 *  accessible copy. */
export function CoachDot({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute -right-1 -top-1 z-10 flex h-3.5 w-3.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f0a500] opacity-70" />
      <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[#f0a500] ring-2 ring-white" />
    </span>
  );
}

/** The step legend + the single ≥44px dismiss. */
export function CoachLegend({
  show,
  steps,
  onDismiss,
}: {
  show: boolean;
  steps: string[];
  onDismiss: () => void;
}) {
  if (!show) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-amber-200 bg-amber-50/70 py-1.5 pl-4 pr-1.5">
      {steps.map((step, i) => (
        <span key={step} className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-900">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#f0a500] font-mono text-[9px] font-bold text-black">
            {i + 1}
          </span>
          {step}
        </span>
      ))}
      <button
        type="button"
        onClick={onDismiss}
        className="ml-auto flex min-h-[44px] items-center gap-1 rounded-full px-3 text-[10px] font-bold uppercase tracking-widest text-amber-700 transition hover:text-amber-950"
      >
        <X size={12} /> Got it
      </button>
    </div>
  );
}
