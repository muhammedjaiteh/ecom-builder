import { CartProvider } from "../components/CartProvider";
import Cart from "../components/Cart"; // 🚀 Added the Cart UI
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Flag sweep: env-driven origin (PUBLIC_APP_URL ?? NEXT_PUBLIC_APP_URL)
// instead of the hardcoded preview deployment domain. Resolved at BUILD time
// (this metadata is static — no request headers here); the deployment-domain
// fallback keeps existing environments byte-identical until the env is set.
const APP_ORIGIN =
  process.env.PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://sanndikaa-vip.vercel.app';

export const metadata: Metadata = {
  title: 'Sanndikaa - The Ultimate E-commerce Platform',
  description: 'Discover authentic Gambian products. Buy and sell on The Gambian Marketplace.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sanndikaa',
  },
  openGraph: {
    title: 'Sanndikaa - The Ultimate E-commerce Platform',
    description: 'Discover authentic Gambian products. Buy and sell on The Gambian Marketplace.',
    url: APP_ORIGIN,
    type: 'website',
    images: [
      {
        url: `${APP_ORIGIN}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Sanndikaa E-commerce Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sanndikaa - The Ultimate E-commerce Platform',
    description: 'Discover authentic Gambian products. Buy and sell on The Gambian Marketplace.',
    images: [`${APP_ORIGIN}/og-image.png`],
  },
};

// viewportFit 'cover' is required so env(safe-area-inset-*) resolves to
// non-zero values in standalone iOS — the editor Save bar depends on it.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <CartProvider>
          {children}
          <Cart />
        </CartProvider>
      </body>
    </html>
  );
}