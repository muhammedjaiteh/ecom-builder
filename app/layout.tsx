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
  title: 'Sanndikaa | The Gambian Marketplace',
  description: 'Buy and sell authentic Gambian products.',
}

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
          <Cart /> {/* 🚀 The Cart is now active everywhere! */}
        </CartProvider>
      </body>
    </html>
  );
}