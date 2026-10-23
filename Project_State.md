Sanndikaa Project State
Vision
Sanndikaa generates premium, mobile-first storefronts for African merchants.

The objective is not to produce websites that look AI-generated.

The objective is to produce storefronts that feel intentionally designed for the merchant's niche, inventory, and customers.

Current Status
Current Phase: 6B Complete

Next Phase: Storefront Families Investigation (Phase 7 Planning)

Completed Work
Pass 1
Merchant Strategy & Content Integrity

Delivered:

Merchant strategy engine
Content integrity rules
Niche-aware generation foundations
Pass 2
Generation Integration

Delivered:

Strategy integration
Archetype integration
Content cleaning pipeline
Pass 3
Premium Storefront Presentation

Delivered:

EditorialTemplate
RitualTemplate
VitalityTemplate
Category navigation
Product collages
Mobile-first storefront improvements
Pass 3.1
Storefront Polish

Delivered:

AI filler cleanup
Footer cleanup
StoryClamp improvements
Theme-aware reviews
Sticky CTA improvements
Phase 4A
Conversion Foundations

Delivered:

PDP product rail
Rich WhatsApp payloads
Trust zone
Phase 5A
Consultation Alignment

Delivered:

Food & Culinary no longer routes into streetwear archetypes
Phase 5B
Theme Respect

Delivered:

Seller theme choices influence consultation concepts
Phase 5C
Category Alignment & Theme Guardrails

Delivered:

Bakery categories route correctly
Theme picker respects niche compatibility
Incompatible themes disabled instead of hidden
Phase 6A
Layout Strategy Metadata

Delivered:

layout_strategy schema
Hero strategy generation
Grid strategy generation
Phase 6B
Layout Variation

Delivered:

Standard hero
Split hero
Text-centric hero
Standard grid
Featured-first grid
Backward-compatible rendering of layout_strategy
Current Discovery
Founder testing across multiple regenerations revealed:

Copy variation is high.
Concept quality is improving.
Perceived design variation remains low.
Merchants primarily judge uniqueness through:

Page structure
Merchandising flow
Hero composition
Content hierarchy
Product presentation
rather than headlines, stories, or theme names.

The current bottleneck is no longer archetype selection.

The current bottleneck is structural variation.

Different regenerations frequently produce different copy but still feel like the same storefront because generationToConfig() assembles largely similar merchandising structures.

Merchant Testing Findings (October 2026)
Testing across repeated storefront generations showed:

Najat Cakes
The generator successfully produces:

Different concept names
Different stories
Different headlines
Different brand narratives
However, repeated generations still feel visually similar because the same merchandising sequence is used across most outputs.

Key Learning
Merchants do not perceive:

Different headlines
Different stories
Different CTA text
as meaningful design variation.

Merchants perceive:

Different page hierarchy
Different merchandising strategy
Different storefront structure
as meaningful design variation.

Important Discovery
The AI model is not the bottleneck.

The current bottleneck is the assembly layer.

generationToConfig() currently converts many ideas into similar storefront structures.

Current Focus
Phase 6B delivered:

standard hero
split hero
text-centric hero
standard grid
featured-first grid
The next investigation is whether layout variants alone create meaningful perceived variation.

Emerging Direction:

Phase 7 – Storefront Families
Potential families:

Product First
Examples:

Electronics
Marketplace
Grocery
Structure:

Hero → Categories → Products → Trust → CTA

Lifestyle Story
Examples:

Fashion
Jewellery
Beauty
Structure:

Hero → Story → Featured Products → Collection → CTA

Menu & Occasion
Examples:

Bakery
Restaurant
Catering
Structure:

Hero → Occasion Categories → Menu Grid → Booking / WhatsApp CTA

Goal:

Allow businesses in the same niche to generate meaningfully different commerce structures without creating template explosion.

Known Future Opportunities
Better bakery hero imagery
Food-specific CTA language
Additional layout strategies
Storefront families
Conversion analytics
Merchant intelligence
Learning loops from storefront performance
Do Not Reintroduce
Bakery → Nightclub concepts
Food → High Contrast Street routing
Ignoring merchant archetype selection
Mobile viewport overflow/wiggle
Category routing inconsistencies
Theme picker / niche incompatibility