# Phase 10 Observation Findings

## The Gambia Mall

Selected Niche:
Cosmetics & Skincare

Theme(s):
Deep Luxury
Pastel Minimalist

Observed Architecture:
Classic (current)

Preferred Architecture:
Counter

Founder Verdict:
Strongly Agree

Confidence:
Very High

What Worked:

- Products feel real and trustworthy.
- Inventory quality is strong.
- Deep Luxury presents the catalog professionally.
- Theme changes do not change the merchant's underlying selling behaviour.

What Felt Wrong:

- Products arrive too late in the flow.
- Comparison shopping is not supported early enough.
- Routine-led shopping behaviour is flattened into a narrative structure.

Clone Risk Observation:

The storefront currently differentiates itself primarily through theme rather than architecture.

If another skincare merchant received the same rhythm, the two stores would feel too similar.

Architecture Conclusion:

Counter remains the most natural architecture.

Expression Conclusion:

Routine Counter remains conceptually justified.

Implementation Observation:

The live merchant does not qualify for Routine Counter under the frozen rules.

Live inventory contains:

- 11 products in "Beauty & Wellness"
- 1 product in "Beauty"

Result:

Two normalized categories.

Routine Counter requires three.

Therefore the merchant correctly degrades to:

Item Counter

Finding:

Routine buying behaviour does not necessarily align with category structure.

This is a signal-quality observation, not an implementation defect.

---

## Jambaba Boutique

Selected Niche:
Tech & Electronics

Theme:
High-Contrast Street

Observed Architecture:
Classic (current)

Preferred Architecture:
Counter

Founder Verdict:
Strongly Agree

Confidence:
Very High

What Worked:

- Products feel inventory-driven.
- Shopping behaviour is obvious.
- Theme adds urgency and commercial energy.

What Felt Wrong:

- Electronics are still forced into a narrative structure.
- Catalog comparison is not immediate enough.
- Product decisions require browsing rather than direct comparison.

Clone Risk Observation:

The storefront feels different primarily because of theme rather than commerce structure.

Without theme treatment, the underlying rhythm converges toward other Classic storefronts.

Architecture Conclusion:

Counter remains correct.

Expression Conclusion:

Item Counter remains justified.

Implementation Observation:

The live merchant is currently Counter-ineligible.

Inventory:

- 4 products
- 1 category

Current Counter eligibility requires:

- 6 priced products

OR

- 2 categories

Finding:

The implementation is correct.

The merchant simply does not satisfy the current Counter thresholds.

---

## Devine Perfume

Selected Niche:
Oud, Fragrance & Home

Theme:
Deep Luxury

Observed Architecture:
Gallery

Founder Verdict:
Strongly Agree

Confidence:
Very High

What Worked:

- Atmosphere is strong.
- Desire and identity are communicated effectively.
- Gallery supports image-driven buying behaviour.
- Fragrance feels aspirational rather than inventory-driven.

What Felt Wrong:

Nothing significant within the current Atmosphere Gallery expression.

Clone Risk Observation:

The original Gallery expression worked extremely well for fragrance but was later observed to converge with jewellery merchants.

Architecture Conclusion:

Gallery remains correct.

Expression Conclusion:

Atmosphere Gallery remains justified.

Reason:

The merchant sells through:

- mood
- identity
- imagery
- atmosphere

rather than comparison.

---

## Subora (Jewellery)

Selected Niche:
Jewellery & Watches

Theme:
Deep Luxury

Observed Architecture:
Gallery

Founder Verdict:
Gallery remains directionally correct.

Confidence:
High

What Worked:

- Premium presentation.
- Jewellery feels luxurious.
- Gallery remains a stronger fit than Counter or Classic.

What Felt Wrong:

The storefront felt closer to a fragrance storefront than a jewellery storefront.

Atmosphere Gallery's:

- staggered exhibit rhythm
- story treatment
- closing structure
- overall geometry

remained largely unchanged despite a radically different product type.

The products changed.

The expression did not.

Clone Risk Observation:

If another jewellery merchant received this same Gallery rhythm, the two storefronts would feel extremely similar.

Architecture Conclusion:

Gallery remains correct.

Expression Conclusion:

Scale Gallery is justified.

Reason:

Jewellery benefits from:

- object scale
- breathing room
- collection focus

more than atmosphere-driven sequencing.

Conclusion:

This became the strongest real-world evidence supporting a second Gallery expression.

---

## Gallery Clone Baseline

Pair:

- Devine Perfume
- Subora

Result:

FAIL

Clone risk clearly visible.

Reason:

The two merchants belong to different niches:

- Fragrance
- Jewellery

but were still receiving the same Gallery expression.

After removing:

- copy
- names
- product context

the storefront rhythm remained largely unchanged.

Finding:

Atmosphere Gallery behaved as a single Gallery expression.

This finding directly justified Scale Gallery.

---

## Counter Clone Baseline

Pair:

- The Gambia Mall
- Jambaba Boutique

Result:

PARTIAL FAIL

Reason:

The perceived differences came primarily from:

- theme
- palette
- typography

rather than commerce structure.

Finding:

Both merchants wanted Counter, but for different reasons:

- The Gambia Mall → Routine-led browsing
- Jambaba Boutique → Item-led comparison

Conclusion:

Counter remained directionally correct.

Internal expression diversity was still required.

---

## Counter Expression Validation (Phase 10L.5)

Expressions:

- Routine Counter
- Item Counter

Validation Pair:

Mock Routine Counter Merchant
vs
Mock Item Counter Merchant

Result:

PASS

Tests:

- Thumbnail
- Greyscale
- Blur
- Hidden Name

Structural Differences:

Routine Counter:

- aisle index opener
- banded wall
- grouped shelves
- visible whitespace breaks

Item Counter:

- hook + signal pill
- continuous inventory wall
- unbroken comparison surface

Finding:

Routine Counter and Item Counter remain visibly different after:

- copy removal
- colour removal
- merchant identity removal

This is the first successful anti-clone validation inside a single architecture.

Blind Review Outcome:

Distinct.

Clone risk materially reduced for merchants receiving different Counter expressions.

---

## Gallery Expression Validation (Phase 10L.6)

Expressions:

- Atmosphere Gallery
- Scale Gallery

Validation Pair:

Mock Atmosphere Gallery Merchant
vs
Mock Scale Gallery Merchant

Result:

PASS

Tests:

- Thumbnail
- Greyscale
- Blur
- Hidden Name

Structural Differences:

Atmosphere Gallery:

- staggered two-column rhythm
- Notes section
- Split CTA spread
- atmospheric sequencing

Scale Gallery:

- single-column rhythm
- large object emphasis
- no Notes section
- no Split CTA spread
- bridge as closer

Blind Anti-Clone Review:

Before:

Atmosphere vs Atmosphere

Phone:
CLONE (3/3)

Desktop:
CLONE (3/3)

After:

Atmosphere vs Scale

Phone:
DISTINCT (3/3)

Desktop:
DISTINCT (3/3)

Finding:

Atmosphere Gallery and Scale Gallery are structurally distinguishable under:

- thumbnail review
- greyscale review
- blurred-copy review
- hidden-name review

This is the strongest anti-clone evidence produced during Expression Family implementation.

---

## Expression Family Implementation Findings

Counter:

Routine Counter
≠
Item Counter

Gallery:

Atmosphere Gallery
≠
Scale Gallery

Observation:

Expression Families materially reduce clone risk between merchants sharing the same architecture.

Expression Families are now implemented and validated.

Finding:

Architecture assignment alone was insufficient.

Expression differentiation proved necessary.

---

## Founder Anti-Clone Principle

Question:

If another merchant in the same category joined tomorrow, would I be happy if they received the same storefront rhythm?

Answer:

No.

Reason:

The whole purpose of owning an independent website is to feel unique.

A merchant may sell similar products to another merchant, but should not feel like a copy of that merchant.

Merchants perceive uniqueness through:

- rhythm
- flow
- merchandising behaviour
- browsing pattern
- presentation style
- storefront personality

not through:

- colours alone
- copy alone
- product names alone
- imagery alone

Observation:

Two merchants sharing the same architecture should still feel like two different businesses.

Architecture assignment solves:

"How should this merchant sell?"

Expression families solve:

"How should this merchant feel different from another merchant selling in the same way?"

Conclusion:

Architecture correctness alone is insufficient.

The platform succeeds only when merchants receive both:

1. The correct commerce architecture.
2. A distinct expression of that architecture.

Design Principle:

Theme changes presentation.

Architecture changes selling behaviour.

Expression changes merchant identity.

A merchant does not buy a website.

A merchant buys a feeling of uniqueness.

---

# Phase 11A — Architecture Reachability Audit

Summary:

Phase 11A investigated why architectures and
expressions validated during Phase 10 were not
appearing in live storefront generation.


Status:
Completed (Read-Only Audit)

Purpose:

Determine whether merchants are naturally reaching
the architecture and expression implied by the
dashboard preview.

---

## Key Finding

The architecture system is correctly implemented
but currently disconnected from production storefront generation.

Counter, Gallery and Expression Families exist,
have been implemented, and have been validated.

However:

No live merchant currently reaches Counter,
Gallery, Routine Counter, Item Counter,
Atmosphere Gallery or Scale Gallery through
the standard production generation path.

Result:

Live storefronts continue to render Classic
or Subtraction structures.

---

## Architecture Reachability Summary

Current production flow:

Theme
↓
Template
↓
Storefront Family
↓
Storefront

Observed flow is NOT:

Theme
↓
Architecture
↓
Expression
↓
Storefront

because architecture and expression remain
unreachable in production.

---

## Confirmed Findings

### Architecture Assignment

Architecture assignment is operating correctly.

Counter, Gallery and Classic continue to be:

- assigned
- logged
- validated

However:

Assignment currently does not influence
generation output.

Observation:

Architecture is presently an observational
system rather than a production-routing system.

---

### Counter Reachability

Counter requires:

- Ritual template
- non-Subtraction family
- grid = counter
- eligibility success

Current state:

No production write path exists for:

layout_strategy.grid = counter

Result:

Counter is unreachable through standard generation.

Observation:

Merchants may appear Counter-like due to:

- Subtraction
- product-first family
- inventory-heavy storefronts

but are not actually rendering Counter.

---

### Gallery Reachability

Gallery requires:

- Ritual template
- non-Subtraction family
- grid = gallery
- hero media
- exhibit eligibility

Current state:

No production write path exists for:

layout_strategy.grid = gallery

Result:

Gallery is unreachable through standard generation.

Observation:

Merchants may appear Gallery-like in preview
but do not actually render Gallery.

---

## Theme Influence Findings

Confirmed:

Themes are not architecture-neutral.

Theme selection determines:

- template
- available storefront structures

Examples:

Deep Luxury
→ Ritual

Pastel Minimalist
→ Ritual

Warm Editorial
→ Editorial

High-Contrast Street
→ Vitality

Observation:

Because Counter and Gallery are Ritual-only,
theme choice currently has more practical
influence on storefront structure than
architecture assignment.

---

## Preview Findings

Four preview surfaces exist.

Only one reflects the actual storefront:

Preview Draft
(/site/[slug]?preview=1)

Other previews:

- theme cards
- concept cards
- themes hub thumbnails

do not consistently represent architecture.

---

### Hero Substitution Finding

Miniature previews substitute
the lead product image when no banner exists.

The live storefront does not.

Result:

A merchant may see an image-led entrance
in previews but receive a plate-style hero
on the storefront.

Observation:

This creates a preview-to-storefront
expectation gap.

---

## Merchant Findings

### The Gambia Mall

Preview suggests:

Catalog-heavy experience.

Stored row:

Subtraction on Ritual.

Finding:

Observed Counter-like behaviour is more likely
Subtraction than Counter.

---

### Jambaba Boutique

Stored row:

Classic on Vitality.

Finding:

Counter cannot render because Vitality
does not support recipes.

---

### Devine Cosmetics

Preview suggests:

Image-led / Gallery-like experience.

Stored row:

Subtraction on Ritual.

Additional issue:

No hero media.

Finding:

Gallery cannot be reached.

---

### Subora

Preview suggests:

Gallery-like jewellery experience.

Stored row:

Editorial template.

Additional issue:

No hero media.

Finding:

Gallery cannot be reached.

---

## Architecture Reality Verdict

Confirmed:

The architecture system behaves exactly
as implemented.

Confirmed:

Counter, Gallery and Expression Families
are functional.

Confirmed:

No production storefront currently reaches
those architectures through the normal
generation path.

Primary conclusion:

The dominant problem is no longer:

"Architecture Design"

The dominant problem is:

"Architecture Reachability"

---

## Phase 11A Conclusion

Before Phase 11A:

Question:

"Why do live storefronts continue to
feel Classic?"

After Phase 11A:

Answer:

Because nothing in production currently writes:

- layout_strategy.grid = counter
- layout_strategy.grid = gallery

and the generation gate remains closed.

Result:

Architecture assignment, Counter, Gallery,
and Expression Families are implemented
but remain disconnected from live generation.

Architecture Reachability is now the primary
validated bottleneck.


---

# Phase 11 Conclusions

Phase 11 investigation is complete. Durable findings only.

- **Reachability gap confirmed.** Counter, Gallery and the expression families are built and render, but live generation does not reach them.
- **Assignment influences no production output.** It runs and is logged; nothing downstream consumes it.
- **Grid survival is the activation bottleneck.** Until a Counter or Gallery grid value survives generation into the saved storefront, every live storefront resolves to Classic.
- **Activation affects multiple systems.** Opening the path is not a single switch; it spans routing, assignment, the prompt, layout application, the gate, persistence and rendering.
- **Studio and Onboarding differ materially.** Studio sends a niche and forces the template through an archetype or concept. Onboarding sends neither: the model picks the template and assignment receives no niche. Any activation strategy must treat them as two paths.
- **Most remaining uncertainty sits outside the repository.** The open questions concern what the model emits and what merchants receive in production.
- **Additional repository auditing offers limited value.** The next evidence must come from production generations.

Status:

- Repository Discovery = Complete
- Decision Readiness = Sufficient for strategy selection

---

# Phase 12 Conclusions

- Architecture authority selected
- Authority hierarchy established
- Routing authority boundary established
- Subtraction ownership established
- Gate role established
- Governance completed
- Remaining work is activation specification and implementation

---

# Phase 13 Conclusions

- Four-key architectural truth contract established
- Resolver contract established
- Storefront Family contract established
- Studio and Onboarding parity requirements identified
- Subtraction rule defined
- Remaining work is implementation specification and authority wiring
