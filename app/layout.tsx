import { CartProvider } from "../components/CartProvider";
import Cart from "../components/Cart"; // 🚀 Added the Cart UI
import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: 'Sanndikaa - The Ultimate E-commerce Platform',
  description: 'Discover authentic Gambian products. Buy and sell on The Gambian Marketplace.',
  openGraph: {
    title: 'Sanndikaa - The Ultimate E-commerce Platform',
    description: 'Discover authentic Gambian products. Buy and sell on The Gambian Marketplace.',
    url: 'https://sanndikaa-vip.vercel.app',
    type: 'website',
    images: [
      {
        url: 'https://sanndikaa-vip.vercel.app/og-image.png', 
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
    images: ['https://sanndikaa-vip.vercel.app/og-image.png'],
  },
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