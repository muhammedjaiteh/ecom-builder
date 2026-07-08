import { z } from 'zod';

// Shared elite ad-copy standard. Used by generate-still (full director prompt),
// regenerate-copy (copy-only refresh), and generate-website (site copy).
// Single source of truth so the brand voice can't drift between features.

export const ELITE_COPY_RULES = `ELITE COPY RULES — BINDING:
- 3-5 words MAX per copy field. No exceptions.
- TONE: confident, declarative, sensory, heritage-aware. Sound like Aēsop, Glossier, Loewe, Telfar, Apple. NEVER like a discount retailer.
- HOOK: a sensory or aspirational property of the product (e.g. "Skin Drinks Light", "Hand-Cut Linen, Stillness", "Silk That Whispers", "Cashmere, Quiet As Snow").
- VALUE_PROP: a specific benefit, ingredient, or craftsmanship cue (e.g. "Botanical Ferments Brighten", "Hand-Loomed In Lagos", "Twenty-Four Hour Hydration", "Hand-Stitched In Marrakech").
- CTA: quiet, action-implying, never pressure-y (e.g. "Discover", "Begin The Ritual", "Wear The Heritage", "Find Your Drape", "Step Into Luxury").

BANNED COPY VOCABULARY (cheap promotional voice — these are immediate disqualifications):
- Pressure phrases: "Buy Now", "Shop Now", "Order Today", "Hurry", "Limited Time", "Last Chance", "Don't Miss"
- Discount language: "Sale", "Deal", "Discount", "% Off", "Free Shipping", "Save Big"
- Hype words: "Amazing", "Incredible", "Best Ever", "Must Have", "Game Changer", "Unbelievable", "Revolutionary", "Mind-Blowing"
- Generic verbs alone: "Buy", "Get", "Click"
- ALL CAPS shouting
- More than one exclamation mark across all three copy fields combined`;

export const CopySchema = z.object({
  hook: z.string().min(1).max(60),
  value_prop: z.string().min(1).max(60),
  cta: z.string().min(1).max(60),
});

export type AdCopy = z.infer<typeof CopySchema>;

export function buildCopyOnlyPrompt(product: { name: string; description: string | null }): string {
  return `You are the copy director for Sanndikaa, an enterprise-grade African e-commerce platform serving the premium African marketplace.

Product: ${product.name}
${product.description ? `Description: ${product.description}` : ''}

Write a fresh set of on-screen ad copy for this product's video advertisement.

Return a JSON object with exactly these keys:
- "hook"       : 3-5 word scroll-stopping editorial line
- "value_prop" : 3-5 word benefit / ingredient / craftsmanship cue
- "cta"        : 3-5 word quiet, confident call-to-action

${ELITE_COPY_RULES}

Example output:
{"hook":"Skin Drinks Light","value_prop":"Botanical Ferments Brighten","cta":"Begin The Ritual"}`;
}
