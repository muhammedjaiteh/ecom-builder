import type { Metadata } from 'next';
import LandingPage from '@/components/landing/LandingPage';

export const metadata: Metadata = {
  title: 'Sanndikaa — AI-Powered Commerce for Africa\'s Finest Boutiques',
  description:
    'Upload a product photo. Sanndikaa\'s AI builds a cinematic scene, a scroll-stopping video ad, and an entire premium storefront around it. Enterprise-grade selling tools for high-ticket African sellers.',
  openGraph: {
    title: 'Sanndikaa — Your Products. Cinematic Production. Zero Studios.',
    description:
      'The AI commerce engine for Africa\'s premium boutiques: cinematic ad generation, instant listings, and AI-built storefronts.',
    type: 'website',
  },
};

export default function SellPage() {
  return <LandingPage />;
}
