import Link from "next/link";
import type { ReactNode } from "react";

/** Back navigation rendered above the page title in the sticky header. */
export interface DashboardBackLink {
  /** Destination route, e.g. "/dashboard". */
  href: string;
  /** Visible label. Defaults to "Back". */
  label?: string;
}

export interface DashboardShellProps {
  /** Page title — rendered as the page's single <h1> inside the sticky header. */
  title: string;
  /** Optional back navigation rendered above the title. */
  backLink?: DashboardBackLink;
  /** Optional right-aligned header slot for the page's primary actions. */
  actions?: ReactNode;
  /** Page content, rendered inside the standard left-padded region. */
  children: ReactNode;
}

/**
 * Shared horizontal rhythm for header and content so the title's left edge
 * and the first card's left edge always align. Kept as one string so Tailwind
 * v4's scanner sees every class.
 */
const CONTENT_X = "w-full max-w-7xl px-5 sm:px-8 lg:pl-12 lg:pr-10";

/**
 * DashboardShell — the standard dashboard page wrapper.
 *
 * Owns the bone canvas, the sticky safe-area-aware header and the left-padded
 * content region so every dashboard page shares one rhythm. Server component,
 * zero client JS. Layout-agnostic: it fills whatever region its parent layout
 * gives it — the sidebar offset belongs to the layout, not here — so it
 * composes with or without DashboardSidebar. Reads only the --dash-* tokens
 * declared in app/globals.css; no literal colours.
 */
export function DashboardShell({ title, backLink, actions, children }: DashboardShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-dash-bone text-dash-forest">
      <header className="sticky top-0 z-30 border-b border-dash-forest/10 bg-dash-bone/85 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className={`${CONTENT_X} flex items-end justify-between gap-4 py-4 sm:py-5`}>
          <div className="min-w-0">
            {backLink ? (
              <Link
                href={backLink.href}
                className="mb-1.5 inline-flex items-center gap-1.5 rounded-full text-[11px] font-medium uppercase tracking-[0.18em] text-dash-forest/60 transition-colors hover:text-dash-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-gold focus-visible:ring-offset-2 focus-visible:ring-offset-dash-bone"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  className="size-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 3 5 8l5 5" />
                </svg>
                {backLink.label ?? "Back"}
              </Link>
            ) : null}
            <h1 className="truncate font-serif text-2xl leading-tight tracking-tight sm:text-3xl">{title}</h1>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      </header>

      <main className={`${CONTENT_X} flex-1 pt-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] sm:pt-8`}>
        {children}
      </main>
    </div>
  );
}

export default DashboardShell;
