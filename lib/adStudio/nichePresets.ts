// ─────────────────────────────────────────────────────────────────────────────
// Ad Studio — Niche Intelligence Engine.
//
// The ONE place the premium Ad Studio decides what a product's advertisement
// should look and sound like. A product's category + title resolve to a
// curated niche preset; the preset carries three things the pipeline needs:
//
//   1. The Photoroom scene brief (pedestal, textures, studio light) plus the
//      shadow treatment. Photoroom generates ONLY the environment around the
//      seller's cutout — the product's own pixels are never repainted (Law 4:
//      zero distortion). That is also why the presets never ask for
//      lighting.mode (AI Relight recolours the subject) or expand/upscale.
//   2. Editorial copy hooks — kicker / headline / subline structures in the
//      house register (Aēsop, Loewe, Cartier campaign copy), never discount
//      retail. The banned vocabulary mirrors lib/adCopy.ts ELITE_COPY_RULES.
//   3. Compositor hints — how much forest scrim the canvas needs under type,
//      because a porcelain-bone beauty plate and a velvet-black jewelry plate
//      demand different protection for bone text.
//
// Pure and client-safe: no env reads, no network, no React. The route
// (app/api/ad-studio) and the compositor (components/ad-studio/AdStudioCanvas)
// both import from here so the wire contract has one author.
//
// Photoroom parameter names below were verified against
// docs.photoroom.com on 2026-09-15 (Image Editing API v2, /v2/edit).
// ─────────────────────────────────────────────────────────────────────────────

export const NICHE_KEYS = [
  'LUXURY_BEAUTY',
  'HIGH_FASHION',
  'FINE_JEWELRY',
  'ARTISANAL_DECOR',
  'DEFAULT_BOUTIQUE',
] as const;

export type NicheKey = (typeof NICHE_KEYS)[number];

/** Photoroom shadow treatment. `ai.soft` / `ai.hard` are sent verbatim as
 *  `shadow.mode`; `ambient` means "no synthetic cast shadow" — the parameter
 *  is omitted and the generated scene's own ambient light grounds the
 *  subject (the right call for macro jewelry under diffused tent light). */
export type PhotoroomShadowMode = 'ai.soft' | 'ai.hard' | 'ambient';

export const AD_ASPECT_RATIOS = ['1:1', '9:16'] as const;
export type AdAspectRatio = (typeof AD_ASPECT_RATIOS)[number];

export type AdFormat = {
  ratio: AdAspectRatio;
  label: string;
  width: number;
  height: number;
  /** CSS `aspect-ratio` value for the compositor frame. */
  cssAspectRatio: string;
  /** Photoroom per-side padding — the fraction of the output canvas the
   *  subject must clear on each side. Top/bottom are deliberately generous:
   *  that is where the compositor lays its kicker/headline and price stamp,
   *  and the product must never sit under a scrim. */
  photoroomPadding: { top: number; bottom: number; left: number; right: number };
};

export const AD_FORMATS: Record<AdAspectRatio, AdFormat> = {
  '1:1': {
    ratio: '1:1',
    label: 'Square Feed',
    width: 1080,
    height: 1080,
    cssAspectRatio: '1 / 1',
    photoroomPadding: { top: 0.3, bottom: 0.2, left: 0.14, right: 0.14 },
  },
  '9:16': {
    ratio: '9:16',
    label: 'Story / WhatsApp Status',
    width: 1080,
    height: 1920,
    cssAspectRatio: '9 / 16',
    // Status chrome covers roughly the top and bottom eighth of the screen;
    // the subject box stays inside the safe zone the compositor also honours.
    photoroomPadding: { top: 0.3, bottom: 0.26, left: 0.12, right: 0.12 },
  },
};

export type EditorialCopy = {
  /** Gold whisper caps above the headline. */
  kicker: string;
  /** Editorial serif headline. */
  headline: string;
  /** One quiet supporting line. */
  subline: string;
};

type NicheKeyword = { term: string; weight: number };

export type NichePreset = {
  key: NicheKey;
  label: string;
  /** One-line art direction summary for the studio UI. */
  direction: string;
  photoroom: {
    /** background.prompt — longer, material-specific briefs render better. */
    scenePrompt: string;
    shadowMode: PhotoroomShadowMode;
  };
  /** products.category values that map straight to this niche. */
  categories: readonly string[];
  /** Title/category signals. Weight 3 = unambiguous, 1 = supporting. */
  keywords: readonly NicheKeyword[];
  copy: {
    kickers: readonly string[];
    /** May contain `{title}` — only used when the cleaned title is short. */
    headlines: readonly string[];
    sublines: readonly string[];
  };
  canvas: {
    /** Forest scrim strength the compositor lays under the type. */
    scrim: 'light' | 'balanced' | 'deep';
  };
};

const NO_INTRUSIONS =
  'No text, no lettering, no logos, no people, no hands, no additional products; the centre of the frame stays open and unobstructed for the subject.';

export const NICHE_PRESETS: Record<NicheKey, NichePreset> = {
  LUXURY_BEAUTY: {
    key: 'LUXURY_BEAUTY',
    label: 'Luxury Beauty',
    direction: 'Travertine pedestal on a porcelain-bone sweep, soft-box morning light, macro-clean.',
    photoroom: {
      // Repo doctrine (generate-still cosmetics brief): no smoke, fog, vapor
      // or rocks — those read as generic AI defaults, not a beauty campaign.
      scenePrompt:
        'Luxury beauty editorial still life: a low circular pedestal of honed travertine standing on a seamless warm porcelain-bone studio sweep, a faint arc of morning light raking across the stone, a large soft-box key light from the upper left with a gentle gradient falloff, subtle specular sheen on the polished surface, the soft out-of-focus shadow of a single botanical leaf drifting at the edge of frame, sparse negative space, macro-clean and quiet, high-end skincare campaign aesthetic in the register of Aesop and La Mer, photorealistic, 85mm lens, shallow depth of field. ' +
        NO_INTRUSIONS,
      shadowMode: 'ai.soft',
    },
    categories: ['cosmetics', 'beauty', 'skincare', 'fragrance', 'haircare'],
    keywords: [
      { term: 'serum', weight: 3 },
      { term: 'skincare', weight: 3 },
      { term: 'cosmetic', weight: 3 },
      { term: 'perfume', weight: 3 },
      { term: 'fragrance', weight: 3 },
      { term: 'moisturizer', weight: 3 },
      { term: 'moisturiser', weight: 3 },
      { term: 'cleanser', weight: 3 },
      { term: 'toner', weight: 2 },
      { term: 'lotion', weight: 2 },
      { term: 'cream', weight: 2 },
      { term: 'body butter', weight: 3 },
      { term: 'shea', weight: 3 },
      { term: 'baobab oil', weight: 3 },
      { term: 'black soap', weight: 3 },
      { term: 'soap', weight: 2 },
      { term: 'lip', weight: 2 },
      { term: 'lipstick', weight: 3 },
      { term: 'lip gloss', weight: 3 },
      { term: 'mascara', weight: 3 },
      { term: 'foundation', weight: 2 },
      { term: 'beauty', weight: 2 },
      { term: 'oil', weight: 1 },
      { term: 'scrub', weight: 2 },
      { term: 'mask', weight: 1 },
      { term: 'hair', weight: 1 },
      { term: 'shampoo', weight: 3 },
      { term: 'conditioner', weight: 3 },
      { term: 'attar', weight: 3 },
      { term: 'oud', weight: 3 },
      { term: 'thiouraye', weight: 3 },
      { term: 'churai', weight: 3 },
      { term: 'incense', weight: 2 },
      { term: 'deodorant', weight: 3 },
      { term: 'sunscreen', weight: 3 },
      { term: 'spf', weight: 2 },
      { term: 'body wash', weight: 3 },
      { term: 'shower gel', weight: 3 },
      { term: 'eyeliner', weight: 3 },
      { term: 'eyeshadow', weight: 3 },
      { term: 'kohl', weight: 2 },
      { term: 'henna', weight: 2 },
      { term: 'nail', weight: 2 },
      { term: 'brow', weight: 2 },
      { term: 'lash', weight: 2 },
      { term: 'wig', weight: 2 },
      { term: 'hair extension', weight: 3 },
      { term: 'glow', weight: 1 },
    ],
    // Lines stay formulation-agnostic: the niche spans skin, hair, body and
    // fragrance, so no line may assume "skin" (a hair oil must read true).
    copy: {
      kickers: ['The Ritual', 'Beauty, Considered', 'Botanical Atelier', 'Morning Rite', 'Formulated Quietly'],
      headlines: [
        'Light, Held In Glass',
        'A Quieter Kind Of Glow',
        'Softness, Remembered',
        'Sun-Warmed, Kept Supple',
        '{title}, Simply',
        'Begin With The Ritual',
      ],
      sublines: [
        'Small batch. Hand-poured. Yours.',
        'Botanicals gathered, never rushed.',
        'Made for life in the sun.',
        'Slow beauty, from the source.',
        'One ritual, kept for life.',
      ],
    },
    canvas: { scrim: 'deep' },
  },

  HIGH_FASHION: {
    key: 'HIGH_FASHION',
    label: 'High Fashion',
    direction: 'Raw plaster wall, polished concrete, one hard rectangle of late sun. Loewe register.',
    photoroom: {
      scenePrompt:
        'High-fashion editorial studio: a raw plaster wall in warm greige with fine hairline cracks, a polished concrete floor catching a single hard rectangle of late-afternoon sunlight through an unseen window, long crisp architectural shadows, one brushed-brass rail element far in the background, a restrained palette of stone, bone and deep forest green, campaign register of Loewe and Bottega Veneta, medium-format photography, natural hard light with deep clean shadows, cinematic and quiet, dust-free. ' +
        NO_INTRUSIONS +
        ' No mannequins, no other garments.',
      shadowMode: 'ai.hard',
    },
    categories: ['apparel', 'fashion', 'clothing', 'shoes', 'bags', 'accessories'],
    keywords: [
      { term: 'dress', weight: 3 },
      { term: 'gown', weight: 3 },
      { term: 'kaftan', weight: 3 },
      { term: 'caftan', weight: 3 },
      { term: 'boubou', weight: 3 },
      { term: 'agbada', weight: 3 },
      { term: 'abaya', weight: 3 },
      { term: 'dashiki', weight: 3 },
      { term: 'ankara', weight: 3 },
      { term: 'wax print', weight: 3 },
      { term: 'kente', weight: 3 },
      { term: 'aso oke', weight: 3 },
      { term: 'tie-dye', weight: 2 },
      { term: 'tie dye', weight: 2 },
      { term: 'lace', weight: 2 },
      { term: 'fabric', weight: 2 },
      { term: 'suit', weight: 2 },
      { term: 'blazer', weight: 3 },
      { term: 'shirt', weight: 2 },
      { term: 'trouser', weight: 2 },
      { term: 'skirt', weight: 3 },
      { term: 'blouse', weight: 3 },
      { term: 'jumpsuit', weight: 3 },
      { term: 'jacket', weight: 2 },
      { term: 'hoodie', weight: 2 },
      { term: 'tee', weight: 1 },
      { term: 't-shirt', weight: 2 },
      { term: 'sneaker', weight: 3 },
      { term: 'heel', weight: 2 },
      { term: 'sandal', weight: 2 },
      { term: 'slipper', weight: 2 },
      { term: 'shoe', weight: 2 },
      { term: 'loafer', weight: 3 },
      { term: 'boot', weight: 2 },
      { term: 'handbag', weight: 3 },
      { term: 'clutch', weight: 2 },
      { term: 'tote', weight: 2 },
      { term: 'bag', weight: 1 },
      { term: 'scarf', weight: 2 },
      { term: 'headwrap', weight: 3 },
      { term: 'gele', weight: 3 },
      { term: 'hijab', weight: 3 },
      { term: 'sunglasses', weight: 2 },
      { term: 'belt', weight: 2 },
      { term: 'wallet', weight: 2 },
      { term: 'leather', weight: 1 },
      { term: 'hat', weight: 2 },
      { term: 'jeans', weight: 3 },
      { term: 'denim', weight: 2 },
      { term: 'lingerie', weight: 3 },
      { term: 'swimwear', weight: 3 },
      { term: 'bikini', weight: 3 },
      { term: 'sock', weight: 2 },
      { term: 'apparel', weight: 3 },
      { term: 'outfit', weight: 2 },
      { term: 'wear', weight: 1 },
    ],
    copy: {
      kickers: ['New Silhouette', 'The Atelier Edit', 'Worn Well', 'Cut For The Occasion', 'Season, Considered'],
      headlines: [
        'Fabric With A Memory',
        'Dress For The Long Light',
        'Cut Close To The Story',
        'Tailored To Be Kept',
        '{title}, Reconsidered',
        'Move Like You Mean It',
      ],
      sublines: [
        'Hand-finished for the way you move.',
        'Heritage cloth, present-day cut.',
        'Made to be worn, then remembered.',
        'Made for long, warm evenings.',
        'Fit first. Always.',
      ],
    },
    canvas: { scrim: 'balanced' },
  },

  FINE_JEWELRY: {
    key: 'FINE_JEWELRY',
    label: 'Fine Jewelry',
    direction: 'Forest-green marble slab under velvet black, one warm pool of light, gold caustics.',
    photoroom: {
      scenePrompt:
        'Fine jewelry macro editorial: a slab of deep forest-green marble with fine gold veining resting against a velvet-black studio backdrop, a soft pool of warm directional light falling across the polished stone, faint gold light caustics shimmering on the surface, a razor-thin rim of brushed brass catching the light at the far edge, luxurious darkness with sculpted highlights, campaign register of Cartier and Van Cleef & Arpels, macro photography, shallow depth of field, ultra-clean and still. ' +
        NO_INTRUSIONS +
        ' No other jewelry.',
      shadowMode: 'ambient',
    },
    categories: ['jewelry', 'jewellery', 'watches'],
    keywords: [
      { term: 'ring', weight: 3 },
      { term: 'necklace', weight: 3 },
      { term: 'bracelet', weight: 3 },
      { term: 'bangle', weight: 3 },
      { term: 'earring', weight: 3 },
      { term: 'pendant', weight: 3 },
      { term: 'anklet', weight: 3 },
      { term: 'waist bead', weight: 3 },
      { term: 'choker', weight: 3 },
      { term: 'brooch', weight: 3 },
      { term: 'cufflink', weight: 3 },
      { term: 'jewel', weight: 3 },
      { term: 'jewelry', weight: 3 },
      { term: 'jewellery', weight: 3 },
      { term: 'diamond', weight: 3 },
      { term: 'pearl', weight: 3 },
      { term: 'gemstone', weight: 3 },
      { term: 'sapphire', weight: 3 },
      { term: 'emerald', weight: 3 },
      { term: 'ruby', weight: 2 },
      { term: 'karat', weight: 3 },
      { term: 'carat', weight: 3 },
      { term: '18k', weight: 3 },
      { term: '14k', weight: 3 },
      { term: '24k', weight: 3 },
      { term: 'gold plated', weight: 3 },
      { term: 'sterling', weight: 3 },
      { term: 'silver', weight: 1 },
      { term: 'gold', weight: 1 },
      { term: 'watch', weight: 2 },
      { term: 'wristwatch', weight: 3 },
      { term: 'timepiece', weight: 3 },
      { term: 'tiara', weight: 3 },
      { term: 'bead', weight: 1 },
      { term: 'beaded', weight: 1 },
      { term: 'chain', weight: 1 },
      { term: 'cowrie', weight: 2 },
    ],
    copy: {
      kickers: ['The Heirloom Edit', 'Worn Close', 'Gold, Considered', 'Objects Of Permanence', 'Kept Forever'],
      headlines: [
        'Light, Worn Close',
        'Made To Outlast Trends',
        'A Quiet Kind Of Gold',
        'Catch The Evening',
        '{title}, For Generations',
        'Small. Permanent. Yours.',
      ],
      sublines: [
        'Hand-set. Hand-polished. Kept.',
        'Weight you feel for a lifetime.',
        'For the wrist, the neck, the story.',
        'Polished by hand, worn by heart.',
        'Given once. Kept always.',
      ],
    },
    canvas: { scrim: 'light' },
  },

  ARTISANAL_DECOR: {
    key: 'ARTISANAL_DECOR',
    label: 'Artisanal Decor',
    direction: 'Weathered oak, limewashed clay wall, flax linen, soft window light. Kinfolk register.',
    photoroom: {
      scenePrompt:
        'Artisanal interiors editorial: a weathered oak tabletop with visible grain set before a limewashed clay wall in warm bone, soft diffused window light from the left casting a gentle gradient across the plaster, a runner of natural flax linen, a scattering of soft dappled leaf shadows, a hint of terracotta and woven raffia texture at the very edge of frame, warm earthy palette, lookbook register of Kinfolk and Zara Home, natural light photography, calm, tactile, spacious. ' +
        NO_INTRUSIONS +
        ' No other objects competing with the subject.',
      shadowMode: 'ai.soft',
    },
    categories: ['decor', 'home', 'homeware', 'furniture', 'crafts', 'art'],
    keywords: [
      { term: 'basket', weight: 3 },
      { term: 'woven', weight: 3 },
      { term: 'raffia', weight: 3 },
      { term: 'rattan', weight: 3 },
      { term: 'calabash', weight: 3 },
      { term: 'ceramic', weight: 3 },
      { term: 'pottery', weight: 3 },
      { term: 'clay', weight: 2 },
      { term: 'vase', weight: 3 },
      { term: 'bowl', weight: 2 },
      { term: 'candle', weight: 3 },
      { term: 'candle holder', weight: 3 },
      { term: 'decor', weight: 3 },
      { term: 'wall art', weight: 3 },
      { term: 'painting', weight: 2 },
      { term: 'sculpture', weight: 3 },
      { term: 'carving', weight: 3 },
      { term: 'carved', weight: 3 },
      { term: 'wooden', weight: 2 },
      { term: 'wood', weight: 1 },
      { term: 'mudcloth', weight: 3 },
      { term: 'bogolan', weight: 3 },
      { term: 'batik', weight: 2 },
      { term: 'throw', weight: 2 },
      { term: 'cushion', weight: 3 },
      { term: 'pillow', weight: 3 },
      { term: 'rug', weight: 3 },
      { term: 'mat', weight: 2 },
      { term: 'lamp', weight: 3 },
      { term: 'lantern', weight: 3 },
      { term: 'tray', weight: 2 },
      { term: 'holder', weight: 2 },
      { term: 'organizer', weight: 2 },
      { term: 'organiser', weight: 2 },
      { term: 'box', weight: 1 },
      { term: 'stand', weight: 1 },
      { term: 'mirror', weight: 2 },
      { term: 'photo frame', weight: 3 },
      { term: 'wall clock', weight: 3 },
      { term: 'clock', weight: 2 },
      { term: 'shelf', weight: 3 },
      { term: 'chair', weight: 3 },
      { term: 'bench', weight: 2 },
      { term: 'headboard', weight: 3 },
      { term: 'bedding', weight: 2 },
      { term: 'duvet', weight: 3 },
      { term: 'curtain', weight: 3 },
      { term: 'tablecloth', weight: 3 },
      { term: 'placemat', weight: 3 },
      { term: 'coaster', weight: 3 },
      { term: 'mug', weight: 2 },
      { term: 'teapot', weight: 3 },
      { term: 'jug', weight: 2 },
      { term: 'diffuser', weight: 2 },
      { term: 'macrame', weight: 3 },
      { term: 'tapestry', weight: 3 },
      { term: 'planter', weight: 3 },
      { term: 'furniture', weight: 3 },
      { term: 'stool', weight: 3 },
      { term: 'table', weight: 2 },
      { term: 'home', weight: 1 },
      { term: 'handmade', weight: 1 },
      { term: 'artisan', weight: 2 },
    ],
    copy: {
      kickers: ['Made By Hand', 'The Home Edit', 'Objects With Origins', 'Slow Craft', 'Woven, Carved, Kept'],
      headlines: [
        'Rooms Remember Craft',
        'Made Slowly, Kept Long',
        'Warmth You Can Hold',
        'Every Fibre, Considered',
        '{title}, Made By Hand',
        'The Quiet Centre Of A Room',
      ],
      sublines: [
        'Woven by hand, one at a time.',
        'Natural fibre. Honest form.',
        'Brought home from the maker.',
        'Imperfect by intention.',
        'Built to gather years.',
      ],
    },
    canvas: { scrim: 'deep' },
  },

  DEFAULT_BOUTIQUE: {
    key: 'DEFAULT_BOUTIQUE',
    label: 'Boutique',
    direction: 'Matte bone plinth on a deep forest sweep, overhead key, one gold accent. Quiet luxury.',
    photoroom: {
      scenePrompt:
        'Premium boutique product studio: a matte stone plinth in warm bone standing on a seamless deep forest-green studio sweep, a large soft overhead key light with a gentle gradient falloff toward the edges, a single warm gold accent light grazing the edge of the plinth, a subtle reflection on the surface, refined negative space, luxurious minimalism in the campaign register of Apple and Aesop, photorealistic, 85mm lens, soft depth of field. ' +
        NO_INTRUSIONS,
      shadowMode: 'ai.soft',
    },
    categories: ['electronics', 'food', 'grocery', 'phones', 'tech', 'gadgets', 'other'],
    keywords: [],
    copy: {
      kickers: ['The Boutique Edit', 'Considered Objects', 'Quietly Essential', 'New Arrival', 'Curated For You'],
      headlines: [
        'Made To Be Kept',
        'Considered, Then Chosen',
        'The Everyday, Elevated',
        'Fewer Things, Finer Things',
        '{title}, Simply',
        'Quiet Confidence, Delivered',
      ],
      sublines: [
        'Chosen carefully. Delivered kindly.',
        'From our boutique to your door.',
        'Quality you notice daily.',
        'Curated in The Gambia.',
        'Ordered simply, over WhatsApp.',
      ],
    },
    canvas: { scrim: 'balanced' },
  },
};

/** Tie-break order when two niches score equally — the more specific
 *  vocabulary wins (a "gold kaftan" is fashion, but a "gold ring" is jewelry
 *  because ring outweighs gold; identical totals fall through to this list). */
const NICHE_PRIORITY: readonly NicheKey[] = [
  'FINE_JEWELRY',
  'LUXURY_BEAUTY',
  'HIGH_FASHION',
  'ARTISANAL_DECOR',
];

/** A category hit is decisive on its own; keywords refine or override it
 *  only when the title is unmistakably another niche. */
const CATEGORY_WEIGHT = 6;
/** Signals found in the category text count double — sellers type
 *  "Jewellery" there far more deliberately than in a title. */
const CATEGORY_TEXT_MULTIPLIER = 2;
/** Categories that are real signals FOR the boutique preset: a product filed
 *  under food or electronics stays there unless the title is unmistakably
 *  another niche. 'other' is a non-signal and anchors nothing. */
const DEFAULT_ANCHOR_CATEGORIES: readonly string[] = ['electronics', 'food', 'grocery', 'phones', 'tech', 'gadgets'];
/** A single supporting term (weight 1 — "silver", "oil", "bag") must never
 *  re-cast a product on its own; one strong term or two signals are needed
 *  before leaving the boutique preset. */
const MIN_NICHE_SCORE = 2;

// ── Text normalisation ──────────────────────────────────────────────────────

function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const KEYWORD_PATTERNS = new Map<string, RegExp>();

/** Whole-word match with an optional English plural, so "ring" hits "rings"
 *  but never "earring" or "spring". Boundaries are ASCII alphanumerics on a
 *  normalised string (no lookbehind — the repo targets ES2017). */
function keywordPattern(term: string): RegExp {
  const cached = KEYWORD_PATTERNS.get(term);
  if (cached) return cached;
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(normalizeText(term))}(?:e?s)?(?=$|[^a-z0-9])`);
  KEYWORD_PATTERNS.set(term, pattern);
  return pattern;
}

// ── Niche detection ─────────────────────────────────────────────────────────

export type NicheMatch = {
  key: NicheKey;
  score: number;
  /** Human-readable signals that produced the match — surfaced in the
   *  studio UI so the seller understands (and can override) the choice. */
  matched: string[];
};

export type NicheDetectInput = {
  category?: string | null;
  productTitle?: string | null;
};

export function detectNiche(input: NicheDetectInput): NicheMatch {
  const category = normalizeText(input.category);
  const title = normalizeText(input.productTitle);

  // A filed food/electronics category anchors the boutique preset: another
  // niche must beat CATEGORY_WEIGHT outright (its own category hit, or
  // several strong title terms) to re-cast the product.
  let best: NicheMatch =
    category && DEFAULT_ANCHOR_CATEGORIES.includes(category)
      ? { key: 'DEFAULT_BOUTIQUE', score: CATEGORY_WEIGHT, matched: [`category:${category}`] }
      : { key: 'DEFAULT_BOUTIQUE', score: 0, matched: [] };

  for (const key of NICHE_PRIORITY) {
    const preset = NICHE_PRESETS[key];
    let score = 0;
    const matched: string[] = [];

    if (category && preset.categories.includes(category)) {
      score += CATEGORY_WEIGHT;
      matched.push(`category:${category}`);
    }

    for (const keyword of preset.keywords) {
      const pattern = keywordPattern(keyword.term);
      if (category && pattern.test(category)) {
        score += keyword.weight * CATEGORY_TEXT_MULTIPLIER;
        matched.push(`category:${keyword.term}`);
      }
      if (title && pattern.test(title)) {
        score += keyword.weight;
        matched.push(`title:${keyword.term}`);
      }
    }

    // Strictly greater: NICHE_PRIORITY order already settles exact ties.
    if (score > best.score) best = { key, score, matched };
  }

  if (best.key !== 'DEFAULT_BOUTIQUE' && best.score < MIN_NICHE_SCORE) {
    return { key: 'DEFAULT_BOUTIQUE', score: 0, matched: [] };
  }
  return best;
}

export type ResolvedNiche = { preset: NichePreset; match: NicheMatch };

/** Detection with an explicit seller override (the studio UI lets a seller
 *  re-cast a product into another niche without renaming it). */
export function resolveNichePreset(
  input: NicheDetectInput & { override?: NicheKey | null },
): ResolvedNiche {
  if (input.override && input.override in NICHE_PRESETS) {
    return {
      preset: NICHE_PRESETS[input.override],
      // Finite sentinel (Infinity serialises to null in JSON responses).
      match: { key: input.override, score: CATEGORY_WEIGHT * 10, matched: ['override'] },
    };
  }
  const match = detectNiche(input);
  return { preset: NICHE_PRESETS[match.key], match };
}

// ── Editorial copy composition ──────────────────────────────────────────────

/** Longest cleaned title allowed inside a `{title}` headline structure —
 *  anything longer wraps to three serif lines on a square and loses the
 *  masthead register. */
const MAX_TITLE_IN_HEADLINE = 22;
const MAX_DISPLAY_TITLE = 40;

/** Seller titles arrive as SKUs ("ORGANIC SHEA BUTTER CREAM 250ml (Pack of
 *  2)"). Strip trailing quantities and parentheticals, then cap at a word
 *  boundary so the stamp and any `{title}` headline read as editorial copy. */
export function cleanProductTitle(raw: string): string {
  let title = raw.replace(/\s+/g, ' ').trim();
  // Trailing parenthetical / bracketed qualifiers.
  title = title.replace(/\s*[([][^)\]]*[)\]]\s*$/g, '').trim();
  // Trailing size / quantity tokens: "250ml", "- 2 pack", "| 50 g", "x3".
  title = title
    .replace(/\s*[-–|,]?\s*(?:x\s?)?\d+(?:\.\d+)?\s?(?:ml|cl|l|g|kg|oz|lb|pcs?|pieces?|pack|pk|set)\b.*$/i, '')
    .trim();
  // Trailing multipliers: "x3", "3x", "×2".
  title = title.replace(/\s*[-–|,]?\s*(?:[x×]\s?\d+|\d+\s?[x×])\s*$/i, '').trim();
  title = title.replace(/[-–|,:;]+$/g, '').trim();
  if (title.length > MAX_DISPLAY_TITLE) {
    const cut = title.slice(0, MAX_DISPLAY_TITLE + 1);
    const boundary = cut.lastIndexOf(' ');
    title = (boundary > 12 ? cut.slice(0, boundary) : cut.slice(0, MAX_DISPLAY_TITLE)).trim();
  }
  return title || raw.trim();
}

const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'de', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with', 'x']);

/** Editorial title case: every word capitalised except short connectives,
 *  short all-caps tokens (SPF, XL, 18K) preserved, shouting lower-cased. */
export function toEditorialTitle(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word, index) => {
      // Leave model numbers, sizes and deliberate brand casing untouched
      // ("256GB", "SPF50", "iPhone", "McQueen"); short all-caps tokens stay.
      if (/\d/.test(word)) return word;
      if (/^[A-Z]{1,3}$/.test(word)) return word;
      if (/[a-z]/.test(word) && /[A-Z]/.test(word.slice(1))) return word;
      const lower = word.toLowerCase();
      if (index > 0 && SMALL_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/** The title the stamp and any `{title}` headline show: cleaned SKU noise,
 *  editorial case. */
export function toDisplayTitle(raw: string): string {
  return toEditorialTitle(cleanProductTitle(raw));
}

/** FNV-1a 32-bit — deterministic so the same product always draws the same
 *  copy set until the seller asks for another `variant`. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function pick<T>(list: readonly T[], seed: number, salt: number): T {
  return list[(seed + salt * 7919) % list.length];
}

export type ComposeCopyInput = {
  productTitle: string;
  /** 0 = the product's default set; increment to cycle to the next
   *  combination ("Try another line" in the studio). */
  variant?: number | null;
};

export function composeEditorialCopy(preset: NichePreset, input: ComposeCopyInput): EditorialCopy {
  const displayTitle = toDisplayTitle(input.productTitle);
  const variant = Math.max(0, Math.floor(input.variant ?? 0));
  const seed = (hashString(normalizeText(displayTitle) || preset.key) + variant) >>> 0;

  const titleFits = displayTitle.length > 0 && displayTitle.length <= MAX_TITLE_IN_HEADLINE;
  const headlines = preset.copy.headlines.filter((line) => titleFits || !line.includes('{title}'));
  const headline = pick(headlines.length ? headlines : preset.copy.headlines, seed, 1).replace(
    /\{title\}/g,
    displayTitle,
  );

  return {
    kicker: pick(preset.copy.kickers, seed, 2),
    headline,
    subline: pick(preset.copy.sublines, seed, 3),
  };
}

// ── Copy hygiene ────────────────────────────────────────────────────────────

/** The discount-retailer vocabulary that disqualifies a line outright —
 *  mirrors the BANNED list in lib/adCopy.ts ELITE_COPY_RULES so the two
 *  copy surfaces can never drift apart in register. */
export const BANNED_COPY_TERMS: readonly string[] = [
  'buy now',
  'shop now',
  'order today',
  'order now',
  'hurry',
  'limited time',
  'last chance',
  "don't miss",
  'sale',
  'deal',
  'discount',
  '% off',
  'percent off',
  'free shipping',
  'save big',
  'cheap',
  'bargain',
  'clearance',
  'amazing',
  'incredible',
  'best ever',
  'best deal',
  'best price',
  'must have',
  'game changer',
  'unbelievable',
  'revolutionary',
  'mind-blowing',
];

/** Returns the first banned term found in `text`, or null when it is clean. */
export function containsBannedCopy(text: string): string | null {
  const haystack = normalizeText(text);
  if (!haystack) return null;
  for (const term of BANNED_COPY_TERMS) {
    if (keywordPattern(term).test(haystack)) return term;
  }
  return null;
}

/** Audits every curated line in every preset. Returns violations as
 *  `NICHE.field: "line" → term`; empty means the banks are clean. Used by
 *  reviews/tests — never at import time. */
export function auditCopyBanks(): string[] {
  const violations: string[] = [];
  for (const preset of Object.values(NICHE_PRESETS)) {
    for (const field of ['kickers', 'headlines', 'sublines'] as const) {
      for (const line of preset.copy[field]) {
        const hit = containsBannedCopy(line);
        if (hit) violations.push(`${preset.key}.${field}: "${line}" → ${hit}`);
        if (/!.*!/.test(line)) violations.push(`${preset.key}.${field}: "${line}" → multiple exclamation marks`);
      }
    }
  }
  return violations;
}

// ── Tenant domain ───────────────────────────────────────────────────────────

/** "https://www.Shop.Domain.gm/collections/" → "shop.domain.gm". Accepts a
 *  bare host, a full URL, or an empty string (→ '' so the stamp is omitted). */
export function formatTenantDomain(input: string | null | undefined): string {
  if (!input) return '';
  let host = input.trim().toLowerCase();
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  host = host.split(/[/?#]/)[0] ?? '';
  host = host.replace(/^www\./, '').replace(/\.+$/, '');
  host = host.replace(/:\d+$/, '');
  return host;
}

// ── Photoroom dispatch parameters ───────────────────────────────────────────

export type PhotoroomEditParams = Record<string, string>;

/** The exact `/v2/edit` query parameters for a preset + format. Pure, so the
 *  route stays thin and the dispatch can be inspected in mock/dry-run mode.
 *
 *  What is deliberately NOT sent (Law 4 — the product's pixels are sacred):
 *  lighting.mode (AI Relight recolours the subject), expand.mode,
 *  upscale.mode, beautify.mode, textRemoval.mode. removeBackground stays
 *  true — the cutout is a mask over the seller's pixels, never a repaint. */
export function buildPhotoroomEditParams(
  preset: NichePreset,
  format: AdFormat,
  opts: { seed?: number | null } = {},
): PhotoroomEditParams {
  const { photoroomPadding: pad } = format;
  const params: PhotoroomEditParams = {
    'background.prompt': preset.photoroom.scenePrompt,
    removeBackground: 'true',
    outputSize: `${format.width}x${format.height}`,
    referenceBox: 'subjectBox',
    scaling: 'fit',
    horizontalAlignment: 'center',
    verticalAlignment: 'center',
    paddingTop: pad.top.toString(),
    paddingBottom: pad.bottom.toString(),
    paddingLeft: pad.left.toString(),
    paddingRight: pad.right.toString(),
    'export.format': 'png',
  };
  if (preset.photoroom.shadowMode !== 'ambient') {
    params['shadow.mode'] = preset.photoroom.shadowMode;
  }
  if (opts.seed != null && Number.isInteger(opts.seed) && opts.seed > 0) {
    params['background.seed'] = String(opts.seed);
  }
  return params;
}

// ── Wire contract: POST /api/ad-studio ──────────────────────────────────────

export type AdStudioDelivery =
  /** Composite rehosted to Supabase Storage — durable public URL. */
  | 'storage'
  /** Composite returned as a data: URL (storage unavailable). */
  | 'inline'
  /** No composite was generated — imageUrl is the seller's source image. */
  | 'source';

export type AdStudioMockReason = 'dry_run' | 'photoroom_key_missing';

export type AdStudioRenderResult = {
  ok: true;
  /** true when no Photoroom credit was spent — the canvas still composes. */
  mock: boolean;
  mockReason: AdStudioMockReason | null;
  niche: NicheKey;
  nicheLabel: string;
  nicheDirection: string;
  matchedSignals: string[];
  aspectRatio: AdAspectRatio;
  width: number;
  height: number;
  /** The base layer for the compositor. */
  imageUrl: string;
  sourceImageUrl: string;
  delivery: AdStudioDelivery;
  /** Photoroom's `pr-ai-background-seed` — resend as `seed` to reproduce. */
  seed: number | null;
  copy: EditorialCopy;
  /** The seller's title exactly as submitted. */
  productTitle: string;
  /** cleanProductTitle + editorial case — what the compositor stamps. */
  displayTitle: string;
  price: number;
  priceLabel: string;
  tenantDomain: string;
  photoroom: {
    scenePrompt: string;
    shadowMode: PhotoroomShadowMode;
    params: PhotoroomEditParams;
  };
};
