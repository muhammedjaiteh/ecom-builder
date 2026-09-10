import type { Metadata } from 'next';
import Link from 'next/link';
import { SUPPORT_WHATSAPP } from '@/lib/tiers';

// ─────────────────────────────────────────────────────────────────────────────
// /legal/cookies — static Cookie Policy.
//
// Linked from the marketplace footer ("Cookie Policy") and required alongside
// /legal/privacy by Meta / TikTok ad-account review: a reachable cookies URL
// that names the Pixel, separates essential from marketing storage and tells
// people how to opt out. Pure Server Component: no auth, no data, no client JS
// beyond the framework shell — prerendered once, served from the CDN.
//
// Disclosures mirror what actually ships: the Meta Pixel base script in
// app/layout.tsx (gated on NEXT_PUBLIC_META_PIXEL_ID, PageView only today),
// Supabase auth cookies for sellers, and localStorage for the buyer cart /
// seller plan intent. The TikTok Pixel is disclosed as "may use" so the policy
// stays truthful the day it is switched on without another legal edit.
//
// Same hand-set reading rhythm as privacy/terms (no @tailwindcss/typography).
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Cookie Policy — Sanndikaa',
  description:
    'Which cookies and similar technologies Sanndikaa uses, including the Meta Pixel, why we use them, and how to manage your preferences.',
  openGraph: {
    title: 'Cookie Policy — Sanndikaa',
    description:
      'Which cookies and similar technologies Sanndikaa uses, including the Meta Pixel, why we use them, and how to manage your preferences.',
    type: 'article',
  },
};

const LAST_UPDATED = '11 September 2026';

const SECTIONS = [
  { id: 'what-are-cookies', label: 'What Are Cookies?' },
  { id: 'how-we-use-them', label: 'How We Use Them' },
  { id: 'cookies-we-set', label: 'Cookies We Set' },
  { id: 'managing-your-preferences', label: 'Managing Your Preferences' },
  { id: 'changes', label: 'Changes to This Policy' },
  { id: 'contact', label: 'Contact Us' },
] as const;

const ARTICLE_RHYTHM = [
  'mx-auto max-w-3xl px-6 pb-12 md:pb-16',
  '[&_h2]:mt-14 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-mall-forest md:[&_h2]:text-3xl',
  '[&_h3]:mt-8 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-mall-forest',
  '[&_p]:mt-4 [&_p]:text-[15px] [&_p]:leading-7 [&_p]:text-mall-forest/80',
  '[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_li]:text-[15px] [&_li]:leading-7 [&_li]:text-mall-forest/80',
  '[&_a]:underline [&_a]:decoration-mall-gold/60 [&_a]:underline-offset-4 [&_a]:transition hover:[&_a]:decoration-mall-gold',
  '[&_strong]:font-semibold [&_strong]:text-mall-forest',
  // Cookie inventory table — quiet rules, no zebra fills, wraps on mobile.
  '[&_table]:mt-6 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-sm',
  '[&_th]:border-b [&_th]:border-mall-forest/20 [&_th]:py-3 [&_th]:pr-4 [&_th]:align-top [&_th]:text-[10px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[0.2em] [&_th]:text-mall-forest/60',
  '[&_td]:border-b [&_td]:border-mall-forest/10 [&_td]:py-3 [&_td]:pr-4 [&_td]:align-top [&_td]:leading-6 [&_td]:text-mall-forest/80',
  '[&_code]:rounded [&_code]:bg-mall-forest/5 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-mall-forest',
].join(' ');

export default function CookiePolicyPage() {
  const supportHref = `https://wa.me/${SUPPORT_WHATSAPP}`;

  return (
    <main className="min-h-screen bg-mall-bone font-sans text-mall-forest selection:bg-mall-gold/20">
      {/* Masthead — quiet, editorial, one click back to the mall. */}
      <header className="border-b border-mall-forest/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-[11px] font-bold uppercase tracking-[0.4em] text-mall-forest">
            Sanndikaa
          </Link>
          <nav aria-label="Legal" className="flex items-center gap-5 text-xs">
            <Link href="/legal/privacy" className="text-mall-forest/60 transition hover:text-mall-forest">
              Privacy
            </Link>
            <Link href="/legal/terms" className="text-mall-forest/60 transition hover:text-mall-forest">
              Terms
            </Link>
            <span aria-current="page" className="font-semibold text-mall-forest">Cookies</span>
          </nav>
        </div>
      </header>

      {/* Title block sits outside the article so the descendant rhythm never
          fights the kicker / dateline / contents styling. */}
      <div className="mx-auto max-w-3xl px-6 pt-12 md:pt-20">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-mall-gold">Legal · Cookies</p>
        <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-mall-forest md:text-5xl">
          Cookie Policy
        </h1>
        <p className="mt-3 text-xs uppercase tracking-widest text-mall-forest/50">Last updated {LAST_UPDATED}</p>
        <p className="mt-8 text-lg leading-8 text-mall-forest/80">
          This policy explains what cookies and similar technologies Sanndikaa uses, why we use them,
          and the choices you have. It covers the marketplace at sanndikaa.com, the boutique pages
          hosted under it, and the seller storefronts we serve on custom domains. It should be read
          together with our <Link href="/legal/privacy">Privacy Policy</Link>, which describes how we
          handle personal data more broadly.
        </p>

        <nav aria-label="On this page" className="mt-10 border-y border-mall-forest/10 py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-mall-forest/50">On this page</p>
          <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-mall-forest/70 underline-offset-4 transition hover:text-mall-forest hover:underline"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <article className={ARTICLE_RHYTHM}>
        <section id="what-are-cookies">
          <h2>What Are Cookies?</h2>
          <p>
            Cookies are small text files that a website places on your phone or computer when you
            visit. They let the site remember things between pages and between visits — for example
            that you are signed in, or that you have been here before. Cookies set by the site you are
            visiting are called <strong>first-party cookies</strong>; cookies set by another company
            whose code runs on that site are called <strong>third-party cookies</strong>.
          </p>
          <p>
            This policy also covers similar technologies that do a comparable job:
          </p>
          <ul>
            <li>
              <strong>Local storage</strong> — a space in your browser where a site can keep
              information on your device without sending it to a server on every request.
            </li>
            <li>
              <strong>Pixels and tags</strong> — tiny pieces of code or invisible images that tell a
              third party (such as Meta) that a page was viewed or an action was taken.
            </li>
          </ul>
        </section>

        <section id="how-we-use-them">
          <h2>How We Use Them</h2>
          <p>
            We keep our use of cookies deliberately small. Everything we set falls into one of two
            groups.
          </p>

          <h3>Essential</h3>
          <p>
            These are required for Sanndikaa to work and cannot be switched off in our settings. They
            keep sellers signed in to their dashboard, protect password-recovery links, and remember
            the cart a buyer is building so it survives a page refresh. They do not track you across
            other websites. Buyers do not need an account and receive no authentication cookies.
          </p>

          <h3>Analytics &amp; Marketing</h3>
          <p>
            These help us understand which adverts bring shoppers to Sanndikaa and let us show
            relevant ads on other platforms. They are set by advertising partners, not by us, and you
            can opt out of them as described in{' '}
            <a href="#managing-your-preferences">Managing Your Preferences</a>.
          </p>
          <p>
            <strong>Meta Pixel.</strong> Our pages load the Meta Pixel, a snippet of code provided by
            Meta Platforms, Inc. and Meta Platforms Ireland Ltd. When a page loads, the Pixel records
            a page view and may record standard shopping events such as viewing a product, adding to
            cart, starting checkout or sending an order. With each event it sends technical
            information — your IP address, browser and device details, the page URL and a cookie
            identifier — to Meta, and it sets the <code>_fbp</code> and <code>_fbc</code> cookies
            listed below. If you are logged in to Facebook or Instagram, Meta may link this activity
            to your account. We use this data to measure our advertising, to reach people who have
            visited Sanndikaa, and to find new shoppers with similar interests. Meta processes it
            under its own{' '}
            <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>{' '}
            and{' '}
            <a href="https://www.facebook.com/privacy/policies/cookies/" target="_blank" rel="noopener noreferrer">
              Cookies Policy
            </a>
            .
          </p>
          <p>
            <strong>TikTok Pixel.</strong> We may also use the TikTok Pixel, provided by TikTok Pte.
            Ltd. and its affiliates, for the same purposes on TikTok. It collects the same categories
            of technical and event data, sets its own cookies (such as <code>_ttp</code>), and is
            governed by the{' '}
            <a href="https://www.tiktok.com/legal/page/global/privacy-policy/en" target="_blank" rel="noopener noreferrer">
              TikTok Privacy Policy
            </a>
            .
          </p>
          <p>
            We do not use cookies to sell your personal data, and we do not run third-party
            advertising networks on Sanndikaa pages.
          </p>
        </section>

        <section id="cookies-we-set">
          <h2>Cookies We Set</h2>
          <p>
            The table below lists the cookies and browser storage you may encounter on Sanndikaa.
            Exact names and lifetimes are controlled by the provider and may change; we will update
            this page when they do.
          </p>
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Set by</th>
                <th scope="col">Purpose</th>
                <th scope="col">Type</th>
                <th scope="col">Duration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>sb-*-auth-token</code></td>
                <td>Sanndikaa (via Supabase)</td>
                <td>Keeps a seller signed in to their dashboard and secures password recovery.</td>
                <td>Essential</td>
                <td>Session; refreshed while signed in</td>
              </tr>
              <tr>
                <td>Cart &amp; plan (local storage)</td>
                <td>Sanndikaa</td>
                <td>
                  Remembers the items in a buyer’s cart and, for sellers, the plan chosen during
                  sign-up. Stays on your device.
                </td>
                <td>Essential</td>
                <td>Until cleared</td>
              </tr>
              <tr>
                <td><code>_fbp</code></td>
                <td>Meta</td>
                <td>Identifies your browser to the Meta Pixel so ad results can be measured.</td>
                <td>Marketing</td>
                <td>90 days</td>
              </tr>
              <tr>
                <td><code>_fbc</code></td>
                <td>Meta</td>
                <td>
                  Stores the click identifier when you arrive from a Facebook or Instagram advert.
                </td>
                <td>Marketing</td>
                <td>90 days</td>
              </tr>
              <tr>
                <td><code>_ttp</code></td>
                <td>TikTok</td>
                <td>Identifies your browser to the TikTok Pixel, if enabled.</td>
                <td>Marketing</td>
                <td>Up to 13 months</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section id="managing-your-preferences">
          <h2>Managing Your Preferences</h2>
          <p>
            You are in control of marketing cookies and pixels. Any of the following will stop them
            without affecting your ability to browse and order on Sanndikaa:
          </p>
          <ul>
            <li>
              <strong>Browser settings.</strong> Every modern browser lets you block or delete
              cookies, either for all sites or for specific ones. Look for “Cookies” or “Site data”
              under Privacy in Chrome, Safari, Firefox, Edge or Samsung Internet. Blocking all
              cookies will sign sellers out of the dashboard; the buyer experience is unaffected.
            </li>
            <li>
              <strong>Tracking protection.</strong> Turn on your browser’s tracking-protection or
              “Do Not Track” mode, or use a content blocker, to prevent advertising pixels from
              loading at all.
            </li>
            <li>
              <strong>Meta ad settings.</strong> Manage how Meta uses data from partner websites at{' '}
              <a href="https://www.facebook.com/adpreferences/ad_settings" target="_blank" rel="noopener noreferrer">
                Facebook Ad Preferences
              </a>{' '}
              or by opening Settings → Accounts Center → Ad preferences in the Facebook or Instagram
              app.
            </li>
            <li>
              <strong>TikTok ad settings.</strong> In the TikTok app open Settings and privacy →
              Privacy → Ads and switch off “Using Off-TikTok activity for ad targeting”.
            </li>
            <li>
              <strong>Industry opt-outs.</strong> Visit{' '}
              <a href="https://optout.aboutads.info/" target="_blank" rel="noopener noreferrer">
                aboutads.info
              </a>{' '}
              or{' '}
              <a href="https://www.youronlinechoices.com/" target="_blank" rel="noopener noreferrer">
                youronlinechoices.com
              </a>{' '}
              to opt out of interest-based advertising from participating companies.
            </li>
          </ul>
          <p>
            Cookie choices are stored per browser and per device, so you will need to repeat them if
            you use more than one, or if you clear your cookies.
          </p>
        </section>

        <section id="changes">
          <h2>Changes to This Policy</h2>
          <p>
            We may update this policy when we add or remove tools, or when the law changes. The date
            at the top shows when it was last revised. Material changes will be announced on the site
            or, for sellers, in the dashboard before they take effect.
          </p>
        </section>

        <section id="contact">
          <h2>Contact Us</h2>
          <p>
            Questions about cookies or this policy are welcome. Message our team on{' '}
            <a href={supportHref} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>{' '}
            and mention “Cookies” so it reaches the right person. Our{' '}
            <Link href="/legal/privacy">Privacy Policy</Link> explains how we handle personal data,
            and our <Link href="/legal/terms">Terms of Service</Link> describe the rules of the
            marketplace.
          </p>
        </section>
      </article>

      <footer className="border-t border-mall-forest/10">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-8 text-xs text-mall-forest/50 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Sanndikaa. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link href="/legal/privacy" className="transition hover:text-mall-forest">Privacy Policy</Link>
            <Link href="/legal/terms" className="transition hover:text-mall-forest">Terms of Service</Link>
            <Link href="/" className="transition hover:text-mall-forest">Back to the marketplace</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
