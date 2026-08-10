'use client';

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { motion, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// BottomSheet — the mobile counterpart of the Site Editor's floating chip and
// modal surfaces (Gambia Standard, Step 3). One primitive, three consumers:
// block settings, "Add a section", the copy editor, plus the film picker.
//
// Mechanics:
//   - framer-motion y-drag started from the grab-handle header only
//     (dragListener=false + dragControls), so scrolling the sheet body never
//     fights the dismiss gesture. Release past 96px of travel OR a 600px/s
//     downward flick dismisses; anything less springs back to rest.
//   - Backdrop tap, the ✕ button, and Escape all dismiss. `onEscape` lets a
//     consumer give Escape different semantics (the copy sheet cancels while
//     drag/backdrop commit — mirroring the desktop overlay's blur-commit /
//     Escape-cancel contract).
//   - Virtual-keyboard defense: the sheet is sized against the VISUAL
//     viewport where the API exists (maxHeight = 92% of visualViewport.height,
//     and the sheet is lifted by the keyboard's overlap on browsers that do
//     not resize the layout viewport, i.e. iOS). Fallback: max-h-[85dvh].
//   - Body scroll is ref-count locked while any sheet is open, the html
//     element gets overscroll-behavior:none (pull-to-refresh must never win
//     against a sheet drag), and the sheet body is overscroll-contain.
//   - Focus is trapped sensibly: focus moves into the sheet on mount (unless
//     an autoFocus child already took it), Tab cycles within, and focus is
//     handed back on unmount.
//
// Render behind <AnimatePresence> at the callsite so drag-dismiss and close
// play the exit slide instead of vanishing mid-gesture.
// ─────────────────────────────────────────────────────────────────────────────

const DISMISS_OFFSET_PX = 96;
const DISMISS_VELOCITY = 600;

// Structural stand-in for motion-dom's PanInfo — framer-motion v12 stopped
// re-exporting the type from its public entry; TS matches it structurally.
type DragPoint = { x: number; y: number };
type DragPanInfo = { point: DragPoint; delta: DragPoint; offset: DragPoint; velocity: DragPoint };

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Ref-counted body lock — sheets can overlap for a frame while one exits and
// the next enters; the styles restore only when the LAST sheet unmounts.
let bodyLockCount = 0;
let prevBodyOverflow = '';
let prevHtmlOverscroll = '';

function useBodyScrollLock() {
  useEffect(() => {
    bodyLockCount += 1;
    if (bodyLockCount === 1) {
      prevBodyOverflow = document.body.style.overflow;
      prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehavior = 'none';
    }
    return () => {
      bodyLockCount = Math.max(0, bodyLockCount - 1);
      if (bodyLockCount === 0) {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
      }
    };
  }, []);
}

/** Visual-viewport box: maxHeight keeps the sheet inside the VISIBLE area
 *  (so an open virtual keyboard can never hide the textarea), lift raises
 *  the sheet above the keyboard on browsers where position:fixed pins to the
 *  LAYOUT viewport behind it (iOS). rAF-coalesced; no-op state updates skip. */
function useVisualViewportBox() {
  const [box, setBox] = useState<{ maxHeight: number | null; lift: number }>({
    maxHeight: null,
    lift: 0,
  });
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let frame = 0;
    const measure = () => {
      const maxHeight = Math.round(vv.height * 0.92);
      const lift = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      setBox((prev) => (prev.maxHeight === maxHeight && prev.lift === lift ? prev : { maxHeight, lift }));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
    };
  }, []);
  return box;
}

type BottomSheetProps = {
  /** Header label — also the dialog's accessible name. */
  label: string;
  /** Backdrop tap, ✕, drag-past-threshold, and (absent onEscape) Escape. */
  onDismiss: () => void;
  /** Optional distinct Escape semantic (the copy sheet cancels on Escape). */
  onEscape?: () => void;
  /** Pinned below the scrollable body, safe-area padded. */
  footer?: ReactNode;
  children: ReactNode;
};

export default function BottomSheet({ label, onDismiss, onEscape, footer, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragControls = useDragControls();
  const box = useVisualViewportBox();
  useBodyScrollLock();

  // Move focus into the sheet on mount — unless an autoFocus child (the copy
  // sheet's input) already claimed it; stealing focus back would close the
  // just-opened virtual keyboard. Hand focus back where it was on unmount.
  useEffect(() => {
    const sheet = sheetRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (sheet && !sheet.contains(document.activeElement)) sheet.focus();
    return () => {
      if (previous && previous.isConnected) previous.focus();
    };
  }, []);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      (onEscape ?? onDismiss)();
      return;
    }
    if (e.key !== 'Tab') return;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const focusables = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === sheet)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const startDrag = (e: ReactPointerEvent) => dragControls.start(e);

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <motion.button
        type="button"
        aria-label="Close"
        onClick={onDismiss}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="absolute inset-0 cursor-default bg-neutral-950/60 backdrop-blur-[2px]"
      />
      <motion.div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_event: MouseEvent | TouchEvent | PointerEvent, info: DragPanInfo) => {
          // Travel past the offset threshold OR a downward flick past the
          // velocity threshold dismisses; otherwise spring back to rest.
          if (info.offset.y > DISMISS_OFFSET_PX || info.velocity.y > DISMISS_VELOCITY) onDismiss();
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 34, stiffness: 380, mass: 0.9 }}
        style={{ bottom: box.lift, maxHeight: box.maxHeight ?? undefined }}
        className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl outline-none"
      >
        {/* Grab handle + header — the ONLY drag-to-dismiss initiator */}
        <div
          className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
          onPointerDown={startDrag}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-gray-200" aria-hidden />
          <div className="flex min-h-[44px] items-center justify-between gap-3 pb-1 pl-5 pr-2.5 pt-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
            <button
              type="button"
              aria-label="Close"
              onClick={onDismiss}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-400 transition active:bg-gray-100"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          style={footer ? undefined : { paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          {children}
        </div>

        {footer && (
          <div
            className="shrink-0 border-t border-gray-100 bg-white"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  );
}
