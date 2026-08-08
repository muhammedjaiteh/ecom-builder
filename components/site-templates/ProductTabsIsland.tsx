'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Pencil } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// ProductTabsIsland — the tab-switching client island of the product_tabs
// block (Phase 4). The section shell (heading, spacing) stays server-rendered
// in each template; this island owns ONLY the tablist interaction.
//
// Accessibility: role=tablist/tab/tabpanel with aria-selected/aria-controls
// wiring, roving tabindex, and Left/Right/Home/End keyboard switching. Every
// panel is rendered (inactive ones carry `hidden`), so the full copy is in
// the server HTML for crawlers.
//
// Site Editor contract:
//   - A plain click on a tab SWITCHES it — the editor's click-capture routes
//     [role="tab"] clicks here untouched.
//   - The ACTIVE tab renders a small pencil affordance carrying the
//     data-block-id/data-block-field markers for its title (tabs.N.title).
//     It is display-hidden on the public site and revealed only inside the
//     editor frame via the .sndk-copy-editor scoped stylesheet.
//   - The active panel's copy node carries markers for tabs.N.content, so the
//     standard overlay-input flow edits panel copy directly.
// ─────────────────────────────────────────────────────────────────────────────

type ProductTab = { title: string; content: string };

type TabsVariant = 'ritual' | 'editorial';

type ProductTabsIslandProps = {
  blockId: string;
  tabs: ProductTab[];
  variant: TabsVariant;
};

const VARIANT_STYLES: Record<TabsVariant, {
  list: string;
  tab: (active: boolean) => string;
  panel: string;
  pencil: string;
}> = {
  ritual: {
    list: 'flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-b border-stone-200 pb-px',
    tab: (active) =>
      `relative -mb-px inline-flex items-center gap-2 border-b-2 pb-3 text-[10px] font-bold uppercase tracking-[0.25em] transition ${
        active ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-400 hover:text-stone-600'
      }`,
    panel: 'mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-stone-600 md:text-base',
    pencil: 'text-stone-400',
  },
  editorial: {
    list: 'flex flex-wrap items-stretch border border-neutral-900',
    tab: (active) =>
      `inline-flex flex-1 items-center justify-center gap-2 border-neutral-900 px-4 py-3.5 font-serif text-sm italic transition first:border-l-0 [&:not(:first-child)]:border-l md:text-base ${
        active ? 'bg-neutral-900 text-[#F7F5F0]' : 'bg-transparent text-neutral-900 hover:bg-neutral-900/5'
      }`,
    panel: 'mt-7 max-w-3xl text-sm leading-relaxed text-neutral-600 md:text-base',
    pencil: 'text-current opacity-70',
  },
};

export default function ProductTabsIsland({ blockId, tabs, variant }: ProductTabsIslandProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Defensive clamp: the schema pins 2-4 tabs, but a shrinking array (future
  // tooling) must never strand the selection on a missing panel.
  const active = Math.min(activeIndex, Math.max(0, tabs.length - 1));
  const styles = VARIANT_STYLES[variant];

  const focusTab = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    setActiveIndex(next);
    tabRefs.current[next]?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        focusTab(active + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        focusTab(active - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusTab(0);
        break;
      case 'End':
        e.preventDefault();
        focusTab(tabs.length - 1);
        break;
    }
  };

  return (
    <div>
      <div role="tablist" aria-label="Product information" className={styles.list} onKeyDown={handleKeyDown}>
        {tabs.map((tab, i) => {
          const isActive = i === active;
          return (
            <button
              key={i}
              ref={(el) => { tabRefs.current[i] = el; }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${i}`}
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${i}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveIndex(i)}
              className={styles.tab(isActive)}
            >
              {tab.title}
              {isActive && (
                <span
                  data-block-id={blockId}
                  data-block-field={`tabs.${i}.title`}
                  className={`sndk-tab-edit hidden items-center ${styles.pencil}`}
                  aria-label={`Edit "${tab.title}" tab title`}
                >
                  <Pencil size={11} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tabs.map((tab, i) => (
        <div
          key={i}
          role="tabpanel"
          id={`${baseId}-panel-${i}`}
          aria-labelledby={`${baseId}-tab-${i}`}
          hidden={i !== active}
          tabIndex={0}
          className={styles.panel}
        >
          <p data-block-id={blockId} data-block-field={`tabs.${i}.content`}>{tab.content}</p>
        </div>
      ))}
    </div>
  );
}
