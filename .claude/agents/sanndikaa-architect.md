Sanndikaa Architecture
Generation Flow
Merchant Data ↓ Inventory Analysis ↓ Merchant Strategy ↓ Archetype Selection ↓ Website Generation ↓ Layout Strategy Selection ↓ WebsiteConfig ↓ Template Rendering ↓ Storefront

Core Systems
Merchant Strategy
Determines:

merchant intent
niche positioning
content priorities
Primary entry:

resolveMerchantStrategy()

Archetype Engine
Current archetypes:

warm-editorial
pastel-minimalist
deep-luxury
high-contrast-street
Determines:

tone
voice
visual direction
Consultation Engine
Produces:

Concept A
Concept B
Must respect:

selected niche
selected archetype
niche recommendations
Content Integrity Layer
Responsible for:

AI filler removal
description cleanup
trust preservation
Layout Strategy Layer
Current fields:

layout_strategy: {
  hero?: "standard" | "split" | "text-centric"
  grid?: "standard" | "featured-first" | "masonry"
}
Purpose:

Create structure variation without creating new templates.

Templates
Current storefront templates:

EditorialTemplate
RitualTemplate
VitalityTemplate
Templates should become more flexible through layout_strategy rather than multiplying template count.

Conversion Systems
Current:

PDP Product Rail
WhatsApp Order Payloads
Trust Zone
Future:

Event tracking
Merchant intelligence
Performance learning
Current Architectural Direction
Avoid:

template explosion
niche-specific template files
archetype proliferation
Prefer:

shared templates
strategy-driven rendering
layout variation
composable systems