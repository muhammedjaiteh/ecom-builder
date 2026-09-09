import { CartProvider } from "../components/CartProvider";
import Cart from "../components/Cart"; // 🚀 Added the Cart UI
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import {
  Bodoni_Moda,
  Cormorant_Garamond,
  Fraunces,
  Geist,
  Geist_Mono,
  Lora,
  Playfair_Display,
} from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Brand display serif — Playfair Display (variable, 400–900 + true italics).
// Chosen over Fraunces: the Editorial template is literally a print-magazine
// anatomy (900-weight uppercase masthead, italic pull-quotes, italic prices)
// and Playfair's high-contrast transitional forms hold that luxury register
// at masthead sizes where Fraunces' soft "wonky" forms read artisanal instead.
// Wired as a CSS variable and mapped to --font-serif in globals.css @theme,
// so every existing `font-serif` utility (templates, chromes, cart, PDP)
// resolves to it with zero per-component edits.
const playfair = Playfair_Display({
  variable: "--font-display-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

// ── Curated site display faces (Customize cockpit font picker) ──────────────
// Each face earns its slot in a distinct luxury register (see lib/siteTheme.ts
// blurbs): Cormorant Garamond (feather-light couture garamond for beauty/
// fragrance), Fraunces (soft old-style warmth for artisanal brands), Lora
// (contemporary, the most readable serif for story-led long copy), Bodoni
// Moda (razor didone, the high-fashion editorial register). All variable
// subsets with true italics, display:swap; preload:false so PUBLIC pages only
// download the face a site's theme actually references — the @font-face rules
// and CSS variables ship, the woff2 streams on first use.
const cormorant = Cormorant_Garamond({
  variable: "--font-serif-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

const fraunces = Fraunces({
  variable: "--font-serif-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

const lora = Lora({
  variable: "--font-serif-lora",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

const bodoni = Bodoni_Moda({
  variable: "--font-serif-bodoni",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
});

// Flag sweep: env-driven origin (PUBLIC_APP_URL ?? NEXT_PUBLIC_APP_URL)
// instead of the hardcoded preview deployment domain. Resolved at BUILD time
// (this metadata is static — no request headers here); the deployment-domain
// fallback keeps existing environments byte-identical until the env is set.
const APP_ORIGIN =
  process.env.PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://sanndikaa-vip.vercel.app';

// Global brand copy — one source of truth for <title>, Open Graph and Twitter
// so WhatsApp / Facebook / X link previews unfurl with identical wording.
// Dual-market positioning: buyers (curated African boutiques) AND sellers
// (launch a premium storefront) in a single sentence.
const SITE_TITLE = "Sanndikaa | Africa's Finest Boutiques";
const SITE_DESCRIPTION =
  'Shop curated collections from independent African designers and artisans, or launch your own premium digital storefront today.';

// Meta Pixel — build-time public env. Pixel IDs are numeric; the digits-only
// guard means a malformed/empty value renders NOTHING rather than an inline
// script with arbitrary text interpolated into it.
const META_PIXEL_ID = (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? '').trim();
const HAS_META_PIXEL = /^\d{5,20}$/.test(META_PIXEL_ID);

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sanndikaa',
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: 'Sanndikaa',
    url: APP_ORIGIN,
    type: 'website',
    images: [
      {
        url: `${APP_ORIGIN}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Sanndikaa — Africa's Finest Boutiques",
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [`${APP_ORIGIN}/og-image.png`],
  },
};

// viewportFit 'cover' is required so env(safe-area-inset-*) resolves to
// non-zero values in standalone iOS — the editor Save bar depends on it.
// Pinch-zoom is a buyer accessibility right: maximumScale/userScalable were
// removed (WCAG 1.4.4) — iOS input auto-zoom is prevented the correct way,
// with ≥16px (text-base) font-size on every focusable field instead.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1a2e1a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${cormorant.variable} ${fraunces.variable} ${lora.variable} ${bodoni.variable} antialiased`}
      >
        <CartProvider>
          {children}
          <Cart />
        </CartProvider>

        {/* Meta Pixel base code. afterInteractive: loads post-hydration so it
            never competes with LCP on slow Gambian mobile networks. Rendered
            only when NEXT_PUBLIC_META_PIXEL_ID is a valid numeric pixel id. */}
        {HAS_META_PIXEL && (
          <>
            <Script id="meta-pixel" strategy="afterInteractive">
              {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`}
            </Script>
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                height="1"
                width="1"
                style={{ display: 'none' }}
                alt=""
                src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
              />
            </noscript>
          </>
        )}
      </body>
    </html>
  );
}