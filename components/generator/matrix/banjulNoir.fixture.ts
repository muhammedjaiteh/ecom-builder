import type { StorefrontMerchant, StorefrontProduct } from './BanjulNoirStorefront';

/**
 * Preview fixture for the Banjul Noir matrix. Production storefronts receive
 * `merchant` and `products` from Supabase; this exists only so the component
 * can be rendered in isolation (app/page.tsx) without a database.
 */
export const banjulNoirMerchant: StorefrontMerchant = {
  name: 'Banjul Noir',
  whatsappNumber: '2200000000',
  hero: {
    title: 'The Ritual of Oud',
    subtitle: 'Four attars. Pressed in Banjul. Worn on the pulse.',
    backgroundImage:
      'https://images.unsplash.com/photo-1615634260167-c8cdede054de?q=80&w=1600&auto=format&fit=crop',
  },
};

export const banjulNoirProducts: StorefrontProduct[] = [
  {
    id: 'oud-royale',
    name: 'Oud Royale',
    kicker: 'Attar · 12ml',
    extraction: 'Cambodian oud · Cold-pressed · 36-month maceration',
    price: 4850,
    image: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?q=80&w=1200&auto=format&fit=crop',
    inStock: true,
    reviewCount: 0,
    rating: 0,
    description: [
      'Aged Cambodian oud, pressed without alcohol. Opens dark, settles into leather and smoke.',
      'Wear it on the pulse. One drop holds the day.',
    ],
    details: ['Hand-filled in Banjul', 'Glass vial, brass cap', 'Ships within The Gambia in 48h'],
  },
  {
    id: 'amber-noir',
    name: 'Amber Noir',
    kicker: 'Attar · 12ml',
    extraction: 'Labdanum resin · Steam-distilled · 18-month maceration',
    price: 3900,
    image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?q=80&w=1200&auto=format&fit=crop',
    inStock: false,
    reviewCount: 14,
    rating: 4.8,
    description: [
      'Labdanum resin over dried fig. A warm, close scent built for evenings.',
      'Long on the skin. Quiet in the room.',
    ],
    details: ['Hand-filled in Banjul', 'Glass vial, brass cap', 'Restock expected monthly'],
  },
  {
    id: 'sahel-musk',
    name: 'Sahel Musk',
    kicker: 'Attar · 6ml',
    extraction: 'White musk · Alcohol-free blend · 12-month maceration',
    price: 2400,
    image: 'https://images.unsplash.com/photo-1587017539504-67cfbddac569?q=80&w=1200&auto=format&fit=crop',
    inStock: true,
    reviewCount: 3,
    rating: 5,
    description: ['White musk cut with dry grass and salt. Clean without being sterile.'],
    details: ['Hand-filled in Banjul', 'Glass vial, brass cap'],
  },
  {
    id: 'kola-vetiver',
    name: 'Kola Vetiver',
    kicker: 'Attar · 12ml',
    extraction: 'Vetiver root · Smoke-distilled · 24-month maceration',
    price: 3600,
    image: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?q=80&w=1200&auto=format&fit=crop',
    inStock: true,
    reviewCount: 0,
    rating: 0,
    description: ['Smoked vetiver root and bitter kola. Green, rooted, unsweetened.'],
    details: ['Hand-filled in Banjul', 'Glass vial, brass cap'],
  },
];
