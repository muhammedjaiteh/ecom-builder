'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// PDP description: clamped to `lines` by default (Tailwind line-clamp with a
// bottom fade), expandable with "Read full description ⌄" / "Show less ⌃".
// The toggle only renders when the text actually overflows the clamp —
// measured post-mount (and on every resize) via ResizeObserver, so a short
// description never grows a pointless button. Server render = collapsed.

const CLAMP: Record<number, string> = {
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
};

export default function CollapsibleDescription({
  text,
  lines = 4,
  className = '',
  toggleClassName = '',
  fadeClassName = '',
}: {
  text: string;
  /** Visible lines while collapsed (3–6). */
  lines?: 3 | 4 | 5 | 6;
  /** Paragraph typography — the PDP's existing description classes. */
  className?: string;
  toggleClassName?: string;
  /** Gradient overlay classes (`bg-gradient-to-t from-<page-bg>`); omit for none. */
  fadeClassName?: string;
}) {
  const id = useId();
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    if (typeof ResizeObserver === 'undefined') {
      measure();
      return;
    }
    // Fires once on observe, then on every size change (fonts, viewport).
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, text]);

  const showToggle = overflows || expanded;
  const fade = !expanded && overflows && fadeClassName;

  return (
    <div>
      <div className="relative">
        <p
          id={id}
          ref={textRef}
          className={`${className} ${expanded ? '' : CLAMP[lines] ?? CLAMP[4]}`}
        >
          {text}
        </p>
        {fade && (
          <div aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-0 h-8 ${fadeClassName}`} />
        )}
      </div>
      {showToggle && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={id}
          className={`mt-3 inline-flex min-h-9 items-center gap-1.5 transition ${toggleClassName}`}
        >
          {expanded ? 'Show less' : 'Read full description'}
          {expanded ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
        </button>
      )}
    </div>
  );
}
