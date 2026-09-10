import type { Metadata } from 'next';
import Link from 'next/link';
import { SUPPORT_WHATSAPP } from '@/lib/tiers';

// ─────────────────────────────────────────────────────────────────────────────
// /legal/privacy — static Privacy Policy.
//
// Linked from the marketplace footer and required by Meta / TikTok ad-account
// review (a reachable privacy URL that names the Pixel, what it collects and
// how to opt out). Pure Server Component: no auth, no data, no client JS
// beyond the framework shell — prerendered once, served from the CDN.
//
// Tracking disclosures mirror what actually ships: the Meta Pixel base script
// in app/layout.tsx (gated on NEXT_PUBLIC_META_PIXEL_ID), Supabase auth
// cookies for sellers, and localStorage for the buyer cart / plan intent.
// The TikTok Pixel is disclosed as "may use" so the policy stays truthful
// the day it is switched on without another legal edit.
//
// No @tailwindcss/typography in this repo, so the article's reading rhythm is
// hand-set with descendant variants instead of `prose`.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Privacy Policy — Sanndikaa',
  description:
    'How Sanndikaa collects, uses and protects the personal data of buyers and sellers, including our use of the Meta Pixel and TikTok Pixel.',
  openGraph: {
    title: 'Privacy Policy — Sanndikaa',
    description:
      'How Sanndikaa collects, uses and protects the personal data of buyers and sellers, including our use of the Meta Pixel and TikTok Pixel.',
    type: 'article',
  },
};

const LAST_UPDATED = '11 September 2026';

const SECTIONS = [
  { id: 'who-we-are', label: 'Who We Are' },
  { id: 'information-we-collect', label: 'Information We Collect' },
  { id: 'how-we-use-your-data', label: 'How We Use Your Data' },
  { id: 'orders-and-sellers', label: 'Orders & Sellers' },
  { id: 'tracking-and-cookies', label: 'Tracking & Cookies' },
  { id: 'sharing', label: 'Sharing & Service Providers' },
  { id: 'retention', label: 'Data Retention' },
  { id: 'security', label: 'Security' },
  { id: 'your-rights', label: 'Your Rights & Choices' },
  { id: 'children', label: 'Children' },
  { id: 'international', label: 'International Transfers' },
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
].join(' ');

export default function PrivacyPolicyPage() {
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
            <span aria-current="page" className="font-semibold text-mall-forest">Privacy</span>
            <Link href="/legal/terms" className="text-mall-forest/60 transition hover:text-mall-forest">
              Terms
            </Link>
            <Link href="/legal/cookies" className="text-mall-forest/60 transition hover:text-mall-forest">
              Cookies
            </Link>
          </nav>
        </div>
      </header>

      {/* Title block sits outside the article so the descendant rhythm never
          fights the kicker / dateline / contents styling. */}
      <div className="mx-auto max-w-3xl px-6 pt-12 md:pt-20">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-mall-gold">Legal · Privacy</p>
        <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-mall-forest md:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-xs uppercase tracking-widest text-mall-forest/50">Last updated {LAST_UPDATED}</p>
        <p className="mt-8 text-lg leading-8 text-mall-forest/80">
          Sanndikaa is a curated marketplace for Africa’s finest boutiques. This policy explains what
          personal data we collect from buyers and sellers, why we collect it, who we share it with, and
          the choices you have — including how we use advertising tools such as the Meta Pixel and
          TikTok Pixel.
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
        <section id="who-we-are">
          <h2>Who We Are</h2>
          <p>
            Sanndikaa (“Sanndikaa”, “we”, “us”) operates the marketplace at{' '}
            <Link href="/">sanndikaa.com</Link>, the boutique pages hosted under it, and the seller
            storefronts we serve on sellers’ own custom domains. We are based in The Gambia and serve
            buyers and independent sellers across West Africa and beyond.
          </p>
          <p>
            Sanndikaa is a platform. Each boutique on Sanndikaa is an independent business that decides
            what it sells, how it prices and how it delivers. When you order, your details are shared
            with that seller so they can fulfil your order — see{' '}
            <a href="#orders-and-sellers">Orders &amp; Sellers</a> below.
          </p>
        </section>

        <section id="information-we-collect">
          <h2>Information We Collect</h2>

          <h3>Information you give us</h3>
          <ul>
            <li>
              <strong>Buyers.</strong> Your name, phone or WhatsApp number, delivery address, the items
              you order, any notes you add, and the payment method you choose (Cash on Delivery or a
              Wave / mobile-money transfer). We never ask for, and never store, card numbers.
            </li>
            <li>
              <strong>Reviews.</strong> The rating, text and display name you submit when you review a
              product.
            </li>
            <li>
              <strong>Sellers.</strong> Your email address, password (stored only as a secure hash),
              phone or WhatsApp number, shop name, brand assets and logo, product listings and photos,
              the plan you request, and any custom domain you connect.
            </li>
            <li>
              <strong>Support conversations.</strong> Messages you send our team, most often over
              WhatsApp, including payment confirmations for seller subscriptions.
            </li>
          </ul>

          <h3>Information collected automatically</h3>
          <ul>
            <li>
              Device and browser details, IP address, approximate location derived from it, the pages
              and products you view, the links you tap, and the page that referred you to us.
            </li>
            <li>
              Data recorded by cookies, local storage and advertising pixels as described in{' '}
              <a href="#tracking-and-cookies">Tracking &amp; Cookies</a>.
            </li>
            <li>Server and security logs kept by our hosting provider.</li>
          </ul>

          <h3>Information from third parties</h3>
          <ul>
            <li>
              If you reach us from an advert on Facebook, Instagram or TikTok, those platforms tell us
              that the ad was clicked and may share campaign-level information about the audience it
              reached.
            </li>
            <li>
              Sellers may see order activity for their own boutique, and we receive that same activity
              because it runs through our systems.
            </li>
          </ul>
        </section>

        <section id="how-we-use-your-data">
          <h2>How We Use Your Data</h2>
          <ul>
            <li>
              <strong>To run the marketplace.</strong> Showing boutiques and products, keeping your
              cart, recording your order and handing it to the seller over WhatsApp with your details
              pre-filled.
            </li>
            <li>
              <strong>To give sellers the tools they pay for.</strong> Order history, customer lists,
              sales analytics, review management and the WhatsApp broadcast engine for their own
              customers.
            </li>
            <li>
              <strong>To power our AI studio for sellers.</strong> Product photos a seller uploads are
              processed by our AI partners to produce advertising imagery, short videos and website
              copy for that seller’s boutique. Sellers remain responsible for the rights to the photos
              they upload.
            </li>
            <li>
              <strong>To communicate with you.</strong> Order confirmations, account and security
              notices such as password-reset emails, and replies to your support requests.
            </li>
            <li>
              <strong>To measure and improve our advertising.</strong> Understanding which campaigns
              bring shoppers to Sanndikaa, building audiences of people who visited us, and showing
              relevant ads on Meta and TikTok platforms.
            </li>
            <li>
              <strong>To keep Sanndikaa safe.</strong> Preventing fraud, abuse and unauthorised access,
              enforcing our <Link href="/legal/terms">Terms of Service</Link>, and meeting legal
              obligations.
            </li>
          </ul>
          <p>
            We do not sell your personal data, and we do not share buyer contact details with any
            business other than the seller you ordered from.
          </p>
        </section>

        <section id="orders-and-sellers">
          <h2>Orders &amp; Sellers</h2>
          <p>
            Sanndikaa does not process payments or hold money on the website. Checkout finishes in a
            WhatsApp conversation between you and the seller, and payment is made directly to the
            seller — in cash on delivery or by a Wave / mobile-money transfer to the number the seller
            gives you.
          </p>
          <p>
            To make that possible we pass your name, contact number, delivery address and order
            contents to the seller, and we keep a copy in the seller’s dashboard so they can track
            and fulfil the order. Sellers are independent businesses and are responsible for handling
            your data lawfully once they receive it. WhatsApp is a service of Meta Platforms and your
            conversation there is governed by the{' '}
            <a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
              WhatsApp Privacy Policy
            </a>
            .
          </p>
        </section>

        <section id="tracking-and-cookies">
          <h2>Tracking &amp; Cookies (Meta/TikTok Pixels)</h2>
          <p>
            We use a small number of cookies and similar technologies. Some are essential to make the
            site work; others help us understand and improve how our advertising performs.
          </p>

          <h3>Essential storage</h3>
          <ul>
            <li>
              <strong>Session cookies</strong> that keep sellers signed in to their dashboard and
              protect password-recovery links. Buyers do not need an account and receive no
              authentication cookies.
            </li>
            <li>
              <strong>Local storage</strong> in your browser that remembers your cart and, for sellers,
              the plan you selected while signing up. This data stays on your device.
            </li>
          </ul>

          <h3>Meta Pixel</h3>
          <p>
            Our pages load the Meta Pixel, a snippet of code provided by Meta Platforms, Inc. and Meta
            Platforms Ireland Ltd. The Pixel records that a page was viewed and may record standard
            shopping events such as viewing a product, adding to cart, starting checkout or sending an
            order. With each event it sends technical information — your IP address, browser and
            device details, the page URL and a cookie identifier — to Meta. If you are logged in to
            Facebook or Instagram, Meta may link this activity to your account.
          </p>
          <p>
            We use this data to measure the results of our advertising, to reach people who have
            visited Sanndikaa with relevant ads, and to find new shoppers with similar interests. Meta
            processes this data under its own{' '}
            <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>
            .
          </p>

          <h3>TikTok Pixel</h3>
          <p>
            We may also use the TikTok Pixel, provided by TikTok Pte. Ltd. and its affiliates, for the
            same purposes on TikTok. It collects the same categories of technical and event data and
            is governed by the{' '}
            <a href="https://www.tiktok.com/legal/page/global/privacy-policy/en" target="_blank" rel="noopener noreferrer">
              TikTok Privacy Policy
            </a>
            .
          </p>

          <h3>Your choices</h3>
          <ul>
            <li>
              Adjust your Meta ad settings at{' '}
              <a href="https://www.facebook.com/adpreferences/ad_settings" target="_blank" rel="noopener noreferrer">
                Facebook Ad Preferences
              </a>{' '}
              and your TikTok ad settings in the TikTok app under Settings → Privacy → Ads.
            </li>
            <li>
              Block or delete cookies through your browser settings. Essential features such as the
              seller dashboard will not work without session cookies; the buyer experience is
              unaffected.
            </li>
            <li>
              Use a content blocker or your browser’s tracking-protection mode to prevent pixels from
              loading.
            </li>
          </ul>
        </section>

        <section id="sharing">
          <h2>Sharing &amp; Service Providers</h2>
          <p>We share personal data only with:</p>
          <ul>
            <li>
              <strong>The seller you order from</strong>, so they can confirm, deliver and support your
              order.
            </li>
            <li>
              <strong>Infrastructure providers</strong> that host the site, store our database and
              authenticate sellers, acting on our instructions.
            </li>
            <li>
              <strong>AI and media providers</strong> that process seller-uploaded product images to
              generate advertising assets and websites for that seller.
            </li>
            <li>
              <strong>Advertising platforms</strong> — Meta and TikTok — through the pixels described
              above.
            </li>
            <li>
              <strong>Authorities or other parties</strong> where the law requires it, to protect the
              rights and safety of our users, or as part of a merger or sale of Sanndikaa.
            </li>
          </ul>
        </section>

        <section id="retention">
          <h2>Data Retention</h2>
          <p>
            We keep seller account data for as long as the account is active. Order records are kept
            so sellers can honour deliveries, resolve disputes and keep accurate books, and are
            deleted or anonymised when no longer needed for those purposes. Server logs are retained
            for a limited period for security. When a seller closes their boutique we remove or
            anonymise personal data within a reasonable time, except where we must keep it to meet a
            legal obligation.
          </p>
        </section>

        <section id="security">
          <h2>Security</h2>
          <p>
            Every page on Sanndikaa, including custom seller domains, is served over HTTPS. Passwords
            are stored as secure hashes, database access is restricted with row-level permissions so
            a seller can only see their own boutique, and we never collect or store card details. No
            system is perfectly secure, so please keep your WhatsApp account and, for sellers, your
            login credentials safe.
          </p>
        </section>

        <section id="your-rights">
          <h2>Your Rights &amp; Choices</h2>
          <p>
            You can ask us to access, correct or delete the personal data we hold about you, to stop
            using it for marketing, or to explain how it is used. Sellers can update most of their
            details directly in the dashboard Settings. For anything else,{' '}
            <a href="#contact">contact us</a> and we will respond within a reasonable time. You may
            also complain to the data-protection authority in your country.
          </p>
        </section>

        <section id="children">
          <h2>Children</h2>
          <p>
            Sanndikaa is not directed at children. You must be at least 18 to open a seller account.
            If you believe a child has provided us with personal data, contact us and we will delete
            it.
          </p>
        </section>

        <section id="international">
          <h2>International Transfers</h2>
          <p>
            Our service providers may store and process data in countries outside The Gambia,
            including the European Union and the United States. Where they do, we rely on their
            contractual commitments and security certifications to keep your data protected to the
            standard described in this policy.
          </p>
        </section>

        <section id="changes">
          <h2>Changes to This Policy</h2>
          <p>
            We may update this policy as Sanndikaa grows. The date at the top shows when it was last
            revised. Material changes will be announced on the site or, for sellers, in the dashboard
            before they take effect.
          </p>
        </section>

        <section id="contact">
          <h2>Contact Us</h2>
          <p>
            Questions about privacy or this policy are welcome. Message our team on{' '}
            <a href={supportHref} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>{' '}
            and mention “Privacy” so it reaches the right person. Our{' '}
            <Link href="/legal/terms">Terms of Service</Link> describe the rules of the marketplace.
          </p>
        </section>
      </article>

      <footer className="border-t border-mall-forest/10">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-8 text-xs text-mall-forest/50 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Sanndikaa. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link href="/legal/terms" className="transition hover:text-mall-forest">Terms of Service</Link>
            <Link href="/legal/cookies" className="transition hover:text-mall-forest">Cookie Policy</Link>
            <Link href="/" className="transition hover:text-mall-forest">Back to the marketplace</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
