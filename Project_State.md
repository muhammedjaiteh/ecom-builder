Sanndikaa Project State
Vision
Sanndikaa generates premium, mobile-first storefronts for African merchants.

The objective is not to produce websites that look AI-generated.

The objective is to produce storefronts that feel intentionally designed for the merchant's niche, inventory, and customers.

Current Status
Current Phase: 7B Complete

Next Phase: Subtraction Family Specification (Read-Only Design Phase)

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
Phase 7A
Storefront Family Preservation

Delivered:

storefront_family survives generation pipeline
storefront_family survives applyArchetype()
storefront_family survives applyGenerationLayout()
storefront_family persisted onto WebsiteConfig
family ordering no longer overwritten during generation
Phase 7B
Template Unchaining

Delivered:

VitalityTemplate no longer forces fixed body ordering
VitalityTemplate respects config.blocks ordering
storefront_family ordering now reaches rendering layer
backward compatibility preserved
TypeScript and ESLint clean
Current Discovery
Founder testing across Food, Cosmetics, Marketplace, Electronics, and Bakery storefronts revealed:

Copy variation is high.
Concept quality is improving.
Structural ordering variation exists.
Perceived design variation remains low.
The storefronts still feel too similar despite:

different concepts
different archetypes
different ordering
different hero variants
Merchant Testing Findings
Najat Cakes
The generator successfully produces:

Different concept names
Different stories
Different headlines
Different brand narratives
However, repeated generations still feel visually similar because the same overall commerce model is used.

Cosmetics
Multiple generations produced different copy and themes but retained the same overall perception:

Hero → Collection → Products → Story

Marketplace
Different concepts still felt structurally similar because the merchandising experience remained largely unchanged.

Electronics
The storefront felt different in branding but not different enough in interaction, density, or page rhythm.

Important Discovery
The AI model is NOT the bottleneck.

The prompting system is NOT the bottleneck.

The archetype system is NOT the bottleneck.

The current bottleneck is how storefronts are composed.

Merchants judge uniqueness primarily through:

interaction models
merchandising strategies
section density
product presentation
overall composition
Merchants do not strongly perceive:

copy changes
palette changes
archetype changes
block reordering
as meaningful differentiation.

Banjul Noir Discovery
Banjul Noir is the first storefront in the codebase that consistently feels fundamentally different.

Key reasons:

Interaction Model
Banjul Noir behaves more like an app than a traditional storefront page.

Section Subtraction
Instead of adding more sections, it removes them.

It focuses on:

Hero → Catalog

while most AI storefronts continue adding:

values
stories
marquees
testimonials
bridges
CTA sections
Merchandising Density
Products become the primary content rather than supporting content.

Visual Identity
Banjul Noir combines:

dark premium surfaces
framed product plates
mono metadata voice
sparse navigation
scarcity language
but these are secondary effects.

The strongest differentiator remains:

interaction and composition.

Current Direction
The project has shifted from:

Theme Variation

towards:

Storefront Composition

Future differentiation should come from:

composition profiles
storefront families
commerce modes
rather than additional archetypes.

Next Investigation
Subtraction Family
Goal:

Create a storefront family that feels fundamentally different through removal rather than addition.

Initial principles:

Hero
Full catalog grid
Quiet chrome
Reduced section count
Framed product presentation
Monospace metadata voice
Strong merchandising density
This phase is currently DESIGN ONLY.

No implementation approved yet.

Known Future Opportunities
Better bakery hero imagery
Food-specific CTA language
Full catalog mode
Staggered masonry grids
Storefront families
Commerce modes
Conversion analytics
Merchant intelligence
Learning loops from storefront performance
Architectural Lessons Learned
Lesson 1
Routing bugs create bigger problems than weak AI models.

Lesson 2
Merchants care more about layout and merchandising than copy.

Lesson 3
Storefront families are more valuable than additional archetypes.

Lesson 4
Subtraction can create more perceived quality than adding features.

Lesson 5
Interaction patterns create stronger differentiation than visual themes.

Do Not Reintroduce
Bakery → Nightclub concepts
Food → High Contrast Street routing
Ignoring merchant archetype selection
Mobile viewport overflow / wiggle
Category routing inconsistencies
Theme picker / niche incompatibility
storefront_family overwrite bug
Fixed Vitality body ordering