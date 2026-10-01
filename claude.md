# Sanndikaa Project Architecture & Claude Design Rules

## The Mental Model (Anti-AI Manifesto)
Sanndikaa is an elite, high-end e-commerce platform built to dominate the Gambian luxury market. You are acting as a Principal UI/UX Architect for $50,000-tier digital flagships (e.g., SSENSE, Bottega Veneta, Byredo). 
**BANNED CONCEPTS:** You must actively suppress the "AI Look" (SaaS dashboards, soft drop-shadows, rounded buttons, symmetrical masonry grids, and friendly/chatty copywriting). Everything must feel heavy, tactile, scarce, and arrogant.

## Claude Design: Autonomous Layout Generation
When using Claude Design to prototype a merchant's storefront, you must evaluate the merchant's "Vibe" (e.g., Arabian Attar vs. Clinical Skincare) and generate a bespoke layout that breaks generic web conventions:
- **For Heritage/Rich Vibes (e.g., Oud):** Force Dark Mode (`--mall-forest`), vertical scroll-snapping, and heavy gold accents.
- **For Clinical/Pure Vibes (e.g., Skincare):** Force Light Mode (`--mall-bone`), asymmetrical data-heavy cards, and monospaced clinical details.
- **For Avant-Garde/Fashion:** Force aggressive whitespace, hidden borders, and massive 4:5 imagery.

## Tech Stack & Conventions
- **Framework**: Next.js 16 (App Router), React 19, Tailwind CSS v4.1, zod v4.
- **Styling**: Strictly use our Tailwind v4.1 design token cascade:
  - `--mall-bone` (Off-white/Ivory background: `oklch(0.96 0.01 90)`)
  - `--mall-forest` (Deep green: `oklch(0.25 0.05 150)`)
  - `--mall-gold` (Champagne gold accent: `oklch(0.75 0.15 85)`)

## Design & Aesthetic Mandates
- **Typography**: Never pair two serifs. Use a striking serif (Playfair Display or Cinzel) strictly for headers with `text-balance`. Use a hyper-clean, geometric sans-serif (Montserrat, Inter) for body copy. Write copy that is terse and editorial (e.g., "The Ritual", not "Check out our great products!").
- **Imagery & Ratios**: Enforce strict vertical aspect ratios of 3:4 or 4:5 using `object-cover`. Images must look like controlled editorial magazine covers. Implement "Blur-to-Focus" loading states.
- **Whitespace & Structure**: Double the standard whitespace (`py-24` or `py-32`). Force layout asymmetry. Never use generic, uniform flexbox grids. 

## Mobile-First "Felt Quality" (Native iOS UX)
- **Bottom-Sheet Architecture**: Ban traditional top-nav hamburger menus. All carts, filters, and menus must slide up from the bottom of the screen using Framer Motion, keeping touch-targets near the user's thumb.
- **Physics**: All animations must use Framer Motion with the "Heavy Luxury" critical damping profile: `{ type: 'spring', stiffness: 80, damping: 25.29, mass: 2 }`. No bouncy elastic effects.
- **Tactile Hover/Tap States**: Use slow, heavy image scaling (`scale-105` with `duration-700`) or subtle opacity drops (`opacity-80`). Add haptic feedback triggers (e.g., `scale: 0.98` on tap) to "Order via WhatsApp" buttons.

## Danger Zones (Do NOT touch without explicit permission)
- **Iron Dome Security**: `app/api/ai/remove-bg/route.ts` and `supabase/migrations/`.
- **Checkout Flow**: `lib/orderFlow.ts` containing the iOS Safari `whatsapp://send` bypass.
- **Photoroom API Pipeline**: Do not alter error handling in Ad Studio routes.
- **Code Quality**: Run `npx tsc --noEmit` after logic changes. Use native `color-mix()` for transparent layers.
## Commercial Conversion & Accessibility Mandates (Zero-Leak UX)
- **Mobile Header Architecture**: Never include a "Shop Now" pill in the persistent mobile header. Dedicate 70% of horizontal space to brand identity to prevent truncation on names over 8 characters. Flank solely with Search and Bag icons.
- **Hero Legibility & Scrims**: Any typography layered over hero imagery must sit atop a high-contrast dynamic scrim (e.g., `bg-gradient-to-t from-black/80 via-black/30 to-transparent`). Never float badges across product label zones.
- **Contrast Ratios**: Maintain a minimum 4.5:1 WCAG AA contrast ratio. Banned: light grey (`#A09D98`) on cream (`#FAF6F0`). All eyebrow text, tickers, and metadata must use deep, legible tones (minimum `#595550` or `color-mix(in oklab, var(--color-mall-forest) 75%, black)`).
- **Zero-Friction Layout**: 
  - Never use accordions for copy under 80 words. Auto-expand full descriptions.
  - Price tags must sit directly below product titles in high-contrast bold weight; do not float prices to outer screen edges.
  - Suppress star rating components completely if review count is 0.
- **WhatsApp Transactional Priority**: 
  - Out-of-stock items must render an active "Notify via WhatsApp When Restocked" lead-capture button instead of static text.
  - Replace auxiliary plain-text WhatsApp links with full-width, tactile secondary action buttons.