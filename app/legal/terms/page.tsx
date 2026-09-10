import type { Metadata } from 'next';
import Link from 'next/link';
import { CONCIERGE_PRICE, SUPPORT_WHATSAPP, TIER_MATRIX } from '@/lib/tiers';

// ─────────────────────────────────────────────────────────────────────────────
// /legal/terms — static Terms of Service.
//
// Linked from the marketplace footer and required by Meta / TikTok ad-account
// review. Pure Server Component, prerendered once.
//
// Billing facts are NOT hand-typed: the plan ladder and the Done-For-You
// Setup fee render from lib/tiers (the single source of truth also behind
// /pricing, the dashboard billing section and every WhatsApp invoice), so a
// founder-matrix change can never leave the Terms quoting stale Dalasi.
//
// The payment model described here is the one that ships: buyers pay sellers
// directly (Cash on Delivery or Wave / mobile money agreed on WhatsApp);
// sellers pay their monthly plan to Sanndikaa via a WhatsApp-confirmed
// transfer and the dashboard unlocks on activation (app/dashboard/layout.tsx).
//
// Same hand-set reading rhythm as /legal/privacy — no typography plugin.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Terms of Service — Sanndikaa',
  description:
    'The rules of the Sanndikaa marketplace: how buying works, seller accounts and paid subscriptions, prohibited items, content rights and liability.',
  openGraph: {
    title: 'Terms of Service — Sanndikaa',
    description:
      'The rules of the Sanndikaa marketplace: how buying works, seller accounts and paid subscriptions, prohibited items, content rights and liability.',
    type: 'article',
  },
};

const LAST_UPDATED = '11 September 2026';

const SECTIONS = [
  { id: 'agreement', label: 'The Agreement' },
  { id: 'marketplace-rules', label: 'Marketplace Rules' },
  { id: 'seller-accounts-billing', label: 'Seller Accounts & Billing' },
  { id: 'prohibited-items', label: 'Prohibited Items' },
  { id: 'content-and-ip', label: 'Content & Intellectual Property' },
  { id: 'ai-studio', label: 'AI Studio & Generated Assets' },
  { id: 'custom-domains', label: 'Custom Domains' },
  { id: 'disclaimers', label: 'Disclaimers & Liability' },
  { id: 'suspension', label: 'Suspension & Termination' },
  { id: 'changes', label: 'Changes to These Terms' },
  { id: 'governing-law', label: 'Governing Law' },
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

export default function TermsOfServicePage() {
  const supportHref = `https://wa.me/${SUPPORT_WHATSAPP}`;

  return (
    <main className="min-h-screen bg-mall-bone font-sans text-mall-forest selection:bg-mall-gold/20">
      <header className="border-b border-mall-forest/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-[11px] font-bold uppercase tracking-[0.4em] text-mall-forest">
            Sanndikaa
          </Link>
          <nav aria-label="Legal" className="flex items-center gap-5 text-xs">
            <Link href="/legal/privacy" className="text-mall-forest/60 transition hover:text-mall-forest">
              Privacy
            </Link>
            <span aria-current="page" className="font-semibold text-mall-forest">Terms</span>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 pt-12 md:pt-20">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-mall-gold">Legal · Terms</p>
        <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight text-mall-forest md:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-3 text-xs uppercase tracking-widest text-mall-forest/50">Last updated {LAST_UPDATED}</p>
        <p className="mt-8 text-lg leading-8 text-mall-forest/80">
          These terms govern your use of Sanndikaa, whether you are browsing and buying from the
          boutiques on our marketplace or running one of them. Please read them carefully — by using
          Sanndikaa you agree to them.
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
        <section id="agreement">
          <h2>The Agreement</h2>
          <p>
            Sanndikaa (“Sanndikaa”, “we”, “us”) operates the marketplace at{' '}
            <Link href="/">sanndikaa.com</Link>, the boutique pages hosted under it, the seller
            dashboard and AI studio, and the storefronts we serve on sellers’ own custom domains
            (together, the “Platform”). We are based in The Gambia.
          </p>
          <p>
            Sanndikaa is a marketplace, not a shop. Every boutique on the Platform is an independent
            business (a “Seller”) that lists its own products, sets its own prices and delivers its
            own orders. When you buy, your contract is with that Seller. These terms, together with
            our <Link href="/legal/privacy">Privacy Policy</Link>, form the agreement between you and
            Sanndikaa. If you use Sanndikaa on behalf of a business, you confirm you have authority to
            bind it.
          </p>
        </section>

        <section id="marketplace-rules">
          <h2>Marketplace Rules</h2>

          <h3>How buying works</h3>
          <ul>
            <li>
              You may browse and order without creating an account. To order, you give the Seller your
              name, contact number and delivery address so they can reach you and deliver.
            </li>
            <li>
              Checkout finishes in a WhatsApp conversation with the Seller. An order is confirmed only
              when the Seller confirms it there. Stock, delivery time and delivery cost are agreed
              between you and the Seller.
            </li>
            <li>
              <strong>Payment goes directly to the Seller</strong> — in cash when your order is
              delivered, or by a Wave / mobile-money transfer to the number the Seller gives you.
              Sanndikaa does not process payments, take card details or hold money on the website. Pay
              only through the method the Seller confirms in your WhatsApp conversation, and never send
              money to anyone claiming to be Sanndikaa in exchange for a product.
            </li>
            <li>
              Returns, exchanges and refunds are between you and the Seller, in line with the terms
              the Seller states and applicable consumer law. We encourage you to raise any problem
              with the Seller first and to <a href="#contact">contact us</a> if it is not resolved.
            </li>
          </ul>

          <h3>Seller obligations</h3>
          <ul>
            <li>
              List only products you own or are authorised to sell, with accurate photos, descriptions,
              prices and availability. Product photos must show the actual item on offer.
            </li>
            <li>
              Respond to orders promptly, honour confirmed prices, deliver as agreed, and handle
              buyers’ personal data lawfully and only for fulfilling their orders.
            </li>
            <li>
              Hold every licence or permit your products and business require, and pay any taxes and
              duties due on your sales.
            </li>
            <li>
              Advertising you create with our AI studio and run on Meta, TikTok or elsewhere must
              comply with those platforms’ advertising policies and with the law where it is shown.
            </li>
          </ul>

          <h3>Conduct on the Platform</h3>
          <ul>
            <li>
              Reviews must be honest and based on a genuine purchase or experience. Sellers may not
              post, buy or manipulate reviews of their own or competing boutiques.
            </li>
            <li>
              Do not harass, threaten or deceive other users, impersonate any person or business, or
              use the Platform to send unsolicited messages.
            </li>
            <li>
              Do not scrape, copy or mirror the Platform, interfere with its security, probe other
              boutiques’ data, or use automated tools to access it except as we permit.
            </li>
          </ul>
          <p>
            We may remove any listing, review or content and suspend any account that breaks these
            rules or puts other users at risk.
          </p>
        </section>

        <section id="seller-accounts-billing">
          <h2>Seller Accounts &amp; Billing (Paid Subscriptions)</h2>

          <h3>Eligibility and your account</h3>
          <ul>
            <li>
              You must be at least 18 and able to enter a binding contract to open a seller account.
            </li>
            <li>
              Keep your registration details, including your WhatsApp number, accurate and current.
              Keep your password confidential — you are responsible for everything done through your
              account.
            </li>
            <li>One boutique per account. Do not share, sell or transfer your account.</li>
          </ul>

          <h3>Plans and prices</h3>
          <p>
            Selling on Sanndikaa requires a paid monthly subscription. Prices are in Gambian Dalasi and
            are set out below and on our <Link href="/pricing">Pricing</Link> page:
          </p>
          <ul>
            {TIER_MATRIX.map((tier) => (
              <li key={tier.id}>
                <strong>{tier.name}</strong> — D{tier.monthlyPrice.toLocaleString('en-GB')} per
                month. {tier.tagline}
              </li>
            ))}
            <li>
              <strong>Done-For-You Setup</strong> (optional) — a one-time fee of D
              {CONCIERGE_PRICE.toLocaleString('en-GB')} for our team to set up your boutique with you.
            </li>
          </ul>
          <p>
            Each plan includes only the features listed for it on the Pricing page and in your
            dashboard. Where a feature says it is metered or subject to fair use, we may limit
            excessive usage after notice.
          </p>

          <h3>Activation and payment</h3>
          <ul>
            <li>
              After registering and choosing a plan, your dashboard remains locked until your first
              payment is confirmed. You send payment by the method our team confirms with you over
              WhatsApp; your dashboard unlocks once we verify it.
            </li>
            <li>
              Subscriptions are billed monthly in advance. A payment confirmation from our team is your
              receipt.
            </li>
            <li>
              If a renewal payment is not received when due, we may mark your account suspended:
              your dashboard locks and your boutique may be hidden from the marketplace and your
              custom domain until the balance is settled. Your data is kept in line with our Privacy
              Policy while the account is suspended.
            </li>
          </ul>

          <h3>Upgrades, downgrades and cancellation</h3>
          <ul>
            <li>
              You may upgrade at any time; the new plan takes effect once its payment is confirmed.
              Downgrades take effect at the start of your next billing month.
            </li>
            <li>
              You may cancel at any time by telling our team. Your boutique stays live until the end of
              the month you have paid for. Subscription fees and the Done-For-You Setup fee are
              non-refundable except where the law requires otherwise.
            </li>
            <li>
              If we change plan prices, we will give existing subscribers at least 30 days’ notice, and
              you will keep every feature you have paid for through the end of your current billing
              month. If we retire a plan, subscribers on it keep the capabilities they paid for.
            </li>
          </ul>
        </section>

        <section id="prohibited-items">
          <h2>Prohibited Items</h2>
          <p>
            The following may not be listed, sold or advertised on Sanndikaa. Listings that break this
            rule are removed and the Seller’s account may be terminated without refund.
          </p>
          <ul>
            <li>
              Counterfeit or replica goods, or anything that infringes a trademark, copyright, design or
              other intellectual-property right.
            </li>
            <li>
              Weapons, ammunition, explosives, and knives or tools marketed as weapons.
            </li>
            <li>
              Illegal drugs and drug paraphernalia; prescription medicines and unregistered or
              unlicensed medical products; supplements making unproven medical claims.
            </li>
            <li>
              Skin-lightening or cosmetic products containing mercury, hydroquinone or other banned
              ingredients, and any cosmetic prohibited by health regulators in The Gambia or the
              buyer’s country.
            </li>
            <li>Tobacco, nicotine and vaping products; alcohol, unless we have approved the listing in writing.</li>
            <li>Stolen goods, and goods whose sale is restricted by export, import or customs law.</li>
            <li>
              Adult or sexually explicit content and services; anything sexualising minors is reported
              to the authorities.
            </li>
            <li>
              Live animals, endangered or protected species and products made from them, including
              ivory, tortoiseshell and protected skins.
            </li>
            <li>Human remains or body parts, and human blood, tissue or organs.</li>
            <li>Hazardous, recalled or unsafe products, including fireworks and unlicensed chemicals.</li>
            <li>
              Gambling, lotteries and games of chance; currency, cryptocurrency, securities, gift-card
              schemes and other financial instruments.
            </li>
            <li>
              Government identity documents, uniforms, badges, official seals, and items used to commit
              fraud, deceive or bypass security.
            </li>
            <li>
              Items that promote hatred, violence or discrimination against any person or group.
            </li>
            <li>
              Anything else that is unlawful to sell in The Gambia or in the country where the buyer or
              Seller is located.
            </li>
          </ul>
          <p>
            Sellers are responsible for knowing the laws that apply to their products. If you are
            unsure whether an item is allowed, <a href="#contact">ask us</a> before listing it.
          </p>
        </section>

        <section id="content-and-ip">
          <h2>Content &amp; Intellectual Property</h2>
          <p>
            Sellers keep ownership of the product photos, brand assets, descriptions and other content
            they upload. By uploading, you give Sanndikaa a worldwide, royalty-free licence to host,
            display, resize, promote and distribute that content on the Platform, in our marketing
            and in the AI studio outputs described below, for as long as it remains on Sanndikaa. You
            confirm you have every right needed to grant that licence and that your content does not
            infringe anyone else’s rights.
          </p>
          <p>
            Buyers who post reviews grant us the same licence for their reviews. Sanndikaa owns the
            Platform itself — its design, software, templates, name and logo — and nothing in these
            terms transfers those rights to you. If you believe content on Sanndikaa infringes your
            rights, <a href="#contact">contact us</a> with details and we will investigate promptly.
          </p>
        </section>

        <section id="ai-studio">
          <h2>AI Studio &amp; Generated Assets</h2>
          <ul>
            <li>
              Our AI studio uses third-party AI models to build advertising imagery, short videos,
              website layouts and copy from the product photos and details a Seller supplies. Outputs
              are generated automatically and provided “as is”; review them before you publish.
            </li>
            <li>
              Our pipelines are designed to keep your product itself faithful — we do not alter,
              deform or invent the product shown in your photos — but scenes, backgrounds and copy
              are creative interpretations that you are responsible for checking.
            </li>
            <li>
              You may use generated assets to market your own boutique on and off Sanndikaa for as
              long as your subscription is active. You may not resell generated assets or use them to
              promote products that are not yours.
            </li>
            <li>
              Do not upload photos of people without their permission, or use the studio to create
              misleading, offensive or unlawful material.
            </li>
          </ul>
        </section>

        <section id="custom-domains">
          <h2>Custom Domains</h2>
          <p>
            Plans that include a custom domain let you point a domain you own at your Sanndikaa
            storefront. You are responsible for registering and renewing the domain and for completing
            the DNS steps shown in your dashboard; we issue and renew the SSL certificate. If your
            subscription lapses or is terminated, the domain stops serving your storefront until it is
            reinstated, and you remain free to point it elsewhere at any time.
          </p>
        </section>

        <section id="disclaimers">
          <h2>Disclaimers &amp; Liability</h2>
          <p>
            Sanndikaa provides the Platform “as is” and “as available”. We do not manufacture, inspect,
            store or deliver the products sold by Sellers, and we make no promise about their quality,
            safety, legality or fitness for your purpose. We work hard to keep the Platform online and
            secure, but we cannot guarantee it will always be available or error-free, particularly on
            slow or interrupted mobile connections.
          </p>
          <p>
            To the fullest extent the law allows, Sanndikaa is not liable for any indirect, incidental
            or consequential loss, or for loss of profits, sales or data, arising from your use of the
            Platform or from any transaction between a buyer and a Seller. For Sellers, our total
            liability in any twelve-month period is limited to the subscription fees you paid us in
            that period. Nothing in these terms limits liability that cannot be limited by law.
          </p>
        </section>

        <section id="suspension">
          <h2>Suspension &amp; Termination</h2>
          <p>
            We may suspend or terminate your access to the Platform if you breach these terms, if your
            subscription is unpaid, if we are required to by law, or to protect Sanndikaa or its users
            from harm. Where reasonable we will tell you why and give you a chance to fix the problem.
            Sellers may close their boutique at any time by telling our team. Sections on content
            licences, disclaimers, liability and governing law survive termination.
          </p>
        </section>

        <section id="changes">
          <h2>Changes to These Terms</h2>
          <p>
            We may revise these terms as Sanndikaa develops. The date at the top shows when they were
            last changed. For material changes we will give notice on the Platform or, for Sellers, in
            the dashboard before they take effect. Continuing to use Sanndikaa after that date means
            you accept the revised terms.
          </p>
        </section>

        <section id="governing-law">
          <h2>Governing Law</h2>
          <p>
            These terms are governed by the laws of the Republic of The Gambia, and the courts of The
            Gambia have jurisdiction over any dispute arising from them, without prejudice to any
            consumer rights you hold under the law of your own country. Before starting any formal
            proceedings, we ask that you contact us so we can try to resolve the matter in good faith.
          </p>
        </section>

        <section id="contact">
          <h2>Contact Us</h2>
          <p>
            Questions about these terms, a listing, or an order that a Seller has not resolved? Message
            our team on{' '}
            <a href={supportHref} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
            . Our <Link href="/legal/privacy">Privacy Policy</Link> explains how we handle your
            personal data.
          </p>
        </section>
      </article>

      <footer className="border-t border-mall-forest/10">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-8 text-xs text-mall-forest/50 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Sanndikaa. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link href="/legal/privacy" className="transition hover:text-mall-forest">Privacy Policy</Link>
            <Link href="/" className="transition hover:text-mall-forest">Back to the marketplace</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
