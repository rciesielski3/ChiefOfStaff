# QA-News UX Redesign Specification

**Status:** Approved for implementation  
**Date:** 2026-07-15  
**Approach:** Pipeline Showcase — comprehensive redesign balancing usability, positioning, and polish

---

## Overview

Redesign qa-news website to clearly position it as an AI-curated news pipeline while improving usability and visual consistency. Core goal: visitors immediately understand this is PAIOS (AI curation), can explore by topic, and see a polished, intentional design.

## Success Criteria

- **Clarity:** Visitors understand "AI-curated pipeline" within 5 seconds of landing
- **Confidence:** Visual evidence (stats, sources, curation logic) demonstrates trustworthiness
- **Usability:** Can explore/filter articles intuitively
- **Craft:** Professional, consistent design reflecting quality of work

---

## Section 1: Information Architecture & Layout

### Homepage (Daily Page)

**Visual Flow (top to bottom):**

1. **Header**
   - Site title + navigation (Daily | Weekly | Monthly | About)
   - Nav uses boxed treatment for active state (consistent across all pages)

2. **Stats Bar** (prominent, secondary color)
   - Content: "5 feeds tracked · 1,110 articles scanned · 50 selected · Last update: 06:00 UTC"
   - Monospace font for technical feel
   - Desktop: Sticky on scroll
   - Mobile: Static (hide on scroll-down to reclaim viewport)
   - Right side: "How it works →" affordance (clickable link to About)
   - Makes the bar obviously interactive, not silent

3. **Daily Brief Card** (distinct visual container)
   - Title: "Daily Brief — Top Picks"
   - Layout: Grid or card-based (6 curated articles, each with category dot + label)
   - Visual distinction: Brand accent border (not category-specific) + light background + contained padding
   - Each article shows category color dot and label (WCAG AA compliant)
   - Separated visually from Latest News below
   - Not affected by filters (editorial, stays fixed)

4. **Latest News Feed**
   - Title: "Latest News — All 50 Selected Articles"
   - Layout: Reverse-chronological list
   - Includes the 6 Daily Brief picks (marked with "Top Pick" badge)
   - Plain styling (no container, flows naturally)
   - Filters apply to this feed only (Daily Brief stays fixed/editorial)

5. **Footer**
   - Links, PAIOS branding, update schedule

### Weekly & Monthly Pages

Same structure as Daily:
- Stats bar (with weekly/monthly metrics)
- Hero "Top Picks" card (week's/month's best articles)
- Full article feed below

### About Page

Structure (top to bottom):

1. **Hero Section**
   - Headline: "How PAIOS Curates News"
   - Subheading: "Your personal AI news curator"

2. **Pipeline Visualization** (visual walkthrough with steps)
   - Step 1: **Ingestion** — "5 feeds tracked · 1,110+ articles fetched daily at 06:00 UTC"
   - Step 2: **Scoring** — "AI multi-factor ranking: relevance, freshness, quality, novelty"
   - Step 3: **Selection** — "Top 50 articles ranked by predicted value to you"
   - Step 4: **Publication** — "Updated and published at 08:00 UTC daily"

3. **Key Metrics Section**
   - Feeds tracked: 5 (OpenAI Blog, Google AI, Cloudflare, Microsoft, Lobsters)
   - Articles scanned daily: 1,110
   - Articles selected daily: 50 (4.5% selection rate)
   - Update cycle: Fetch at 06:00 UTC → Process & Score → Publish at 08:00 UTC
   - Last successful run: [dynamic timestamp, e.g., "Today 06:00 UTC"]

4. **How to Use Section**
   - "Click tags/categories to filter by topic"
   - "Browse Daily Brief for handpicked top 6"
   - "Scroll Latest News for all selected articles"
   - "Check back daily for fresh picks"

5. **FAQ**
   - "Why only 50 articles?" → Quality over quantity; AI filters for signal
   - "How are articles selected?" → Multi-factor scoring (relevance, novelty, quality)
   - "Can I request sources?" → Future feature; contact link

---

## Section 2: Visual Design & Styling Consistency

### Category Color Mapping (locked 1:1 across all pages)

| Category | Bright (dots, chips, borders) | Text (labels, links) | Usage |
|----------|-------------------------------|----------------------|-------|
| test-automation | #0EA5E9 (blue) | #0369A1 (dark blue) | WCAG AA 5.2:1 |
| qa-practice | #A855F7 (purple) | #6B21A8 (dark purple) | WCAG AA 5.1:1 |
| tooling | #F97316 (orange) | #92400E (dark brown) | WCAG AA 6.5:1 |
| engineering | #10B981 (green) | #065F46 (dark green) | WCAG AA 6.8:1 |
| ai | #06B6D4 (cyan) | #155E75 (dark cyan) | WCAG AA 5.4:1 |

**Rule:** 
- **Bright color** used for: dots, chip backgrounds, card borders, highlights
- **Text color** used for: labels, link text (WCAG AA compliant)
- **Non-color signal:** Category name is always visible as text (colorblind accessible)
- Consistent across Daily, Weekly, Monthly, About pages

### Component Styling

| Component | Style | Behavior |
|-----------|-------|----------|
| **Category Dots** | Solid circle, bright category color (e.g. #0EA5E9) | Clickable (filters) |
| **Category Labels** | Text in dark category variant (e.g. #0369A1) for WCAG AA 5.1:1+ | Consistent with dot color |
| **Tag Chips** | Subtle pill buttons: light bg + bright category color border, hover state | Clickable to filter; clear affordance |
| **Stats Bar** | Secondary color background, monospace font, "How it works →" link | Desktop: sticky on scroll; Mobile: static hide-on-scroll-down |
| **Daily Brief Card** | Brand accent border (neutral) + light background + padding | Clear visual container, not category-specific |
| **Article Links** | Dark text (category text variant), underline on hover | Standard link affordance, WCAG AA |
| **Active Filter Indicator** | Bright category color background | Shows which filters are active |
| **Clear Filters Button** | Secondary text link | Resets filters to show all |
| **Empty State** | Centered text: "No articles match these filters · [Reset filters]" | Shows when filters return 0 results |

### Line Length

- **Body/intro text:** Max 65-75 characters (CSS `max-width` constraint)
- **Applies to:** Daily page intro, About page sections, all body copy
- **Consistent:** Same constraint across Daily, Weekly, Monthly, About pages

### Navigation State

- **Style:** Boxed treatment (bordered button style)
- **Active page:** Highlighted box around current page name
- **Consistent:** Same treatment on all pages (Daily, Weekly, Monthly, About)
- **Hover state:** Subtle color change to indicate interactivity

### Sample Data Badge (Current) → Live Badge (Future)

- **Current:** Small, secondary-colored indicator in corner/footer (not competing with headlines)
- **Future:** Replace with "Live · Updated 06:00 UTC" badge (same styling)
- **Never:** Bright amber, warning-style, competing with content

---

## Section 3: PAIOS Pipeline Positioning & About Page

### Homepage Integration

**Stats Bar Content:** "1,110 sources scanned · 50 articles selected · Updated 06:00 UTC"
- Positioned directly above Daily Brief card
- Real pipeline metrics (proves it's working)
- Clickable → links to About page
- Monospace font for technical credibility

### About Page: Pipeline Story

**Goal:** Make it impossible to miss that this is AI-curated; explain how the pipeline works.

**Content Structure:**

1. **Hero** — Clear statement of what PAIOS does
2. **Visual Pipeline** — Step-by-step walkthrough of source → curation → publication
3. **Metrics Dashboard** — Historical data (articles/day, top categories, source breakdown)
4. **How to Use** — Navigation guide for exploring articles
5. **FAQ** — Common questions about selection criteria, future features, etc.

**Design:** Light, clear layout with visual separators between sections. Icons or diagrams recommended for pipeline steps.

---

## Section 4: Interactive Features & Functionality

### Tag & Category Filtering

**Interaction Model:**
- Click any tag or category dot/label → page filters articles
- **Within same dimension (tags OR tags):** Multiple tags = show articles with ANY of those tags
- **Across dimensions (category AND tags):** Category + tags = show articles with selected category AND any selected tag
- URL encodes filter state (e.g., `?category=ai&tags=llm,eval`) for shareable filtered views

**Visual Feedback:**
- **Active filters:** Highlighted with category color background
- **Status text:** "Showing X of Y articles" (dynamic Y, since article count varies daily)
- **Clear button:** "Reset filters" link to return to full list
- **Empty state:** If filters return 0 results: "No articles match these filters · [Reset filters]"
- **Scope:** Filters apply to Latest News feed only (Daily Brief stays fixed/editorial)
- **Works on:** Daily, Weekly, Monthly pages

### Tag Chip Affordance (Fixed)

**Current problem:** Bordered boxes that look disabled.

**New design:** Subtle pill buttons
- Light category-color background
- Category color text
- Hover state: slightly darker background, cursor pointer
- Makes it clear tags are interactive

### Article Entry Components

**Status/Meta Line:**
- Content: "34 sources scanned · 6 stories selected · Updated 06:00 UTC"
- Monospace font
- Secondary color
- Visible on every page template

---

## Section 5: Closing Empty Spaces & Content Refinement

### Daily Page

**Issue:** Intro paragraph runs edge-to-edge on wide viewports.

**Fix:** Apply line-length constraint (`max-width: 65-75ch`) to match Weekly/Monthly/About pages.

### About Page

**Issue:** Dead space below primary content.

**Solution:** Add **Metrics Dashboard** section
- Articles fetched per day (trend or simple stat)
- Top categories (breakdown visualization)
- Source contribution (which feeds contribute most)
- Monthly comparison (how this month compares to previous)

**Alternative:** Add **Visual Pipeline Diagram** (flowchart of steps with icons).

**Outcome:** Page feels complete and engaging; encourages exploration.

### Monthly Page

**Issue:** Only 2 articles shown → large white space.

**Solution:** Add **Monthly Insights** card above article list
- Top category this month (% of articles)
- Trending topics (AI, testing, etc.)
- Most-referenced source
- Biggest shift from previous month

**Outcome:** Adds context and fills space naturally.

---

## Architecture Summary

**Core Principle:** Make the PAIOS pipeline the star. Every element supports either understanding how curation works or exploring curated content.

**Key Changes:**
1. ✅ Dedup Daily/Latest (Latest includes Top 6 marked with badge; filters only apply to feed)
2. ✅ Surface PAIOS story (explicit stats + "How it works" affordance; timeline clarity: 06:00→08:00)
3. ✅ Functional filtering (OR within dimensions, AND across; empty state for zero results)
4. ✅ WCAG AA accessible (bright colors for affordance, dark variants for text; category names as non-color signal)
5. ✅ Consistent styling (locked color mapping, pinned line-length, boxed nav state)
6. ✅ Polish & fill gaps (metrics cards, proper spacing, mobile-aware sticky elements)
7. ✅ Terminology clarity (5 feeds · 1,110 articles scanned · 50 selected)

**Success Looks Like:**
- Visitor lands → immediately sees "AI-curated" positioning (stats bar + "How it works →")
- Explores About → understands 4-step pipeline (Ingest → Score → Select → Publish)
- Clicks tags/categories → filters work intuitively without hitting zero-result dead ends
- Entire site feels intentional, polished, professional; accessible to all users

---

## Implementation Notes

**Frontend:** Next.js with React components (existing codebase)
**Data:** Latest.json structure supports tag/category metadata
**Styling:** CSS/Tailwind for color system, layout, responsive design
**No backend changes required** — filtering and display logic runs client-side

**Critical Clarifications:**
- **Filters apply to Latest News feed only** — Daily Brief is editorial and stays fixed regardless of filter state
- **Filter scope:** Daily Brief shows top 6 from all 50; Latest News shows all 50 (with "Top Pick" badge for daily picks); both use same source data
- **OR vs AND logic:** Multiple tags within one dimension (category) = OR; across dimensions (category + tags) = AND
- **Line-length:** Pin to single value (e.g., `max-width: 70ch`), not a range
- **URL state:** Filter state in query params must survive back/forward navigation; use `useSearchParams` + shallow routing (client-side for SSG)
- **Dynamic counts:** "Showing X of Y articles" where Y changes daily; not hardcoded to 50
- **Sample data indicator:** While in sample mode, show quiet "sample data" suffix near stats bar (not alarming style)

---

## Known Limitations & Future Work

- Filter persistence: URL-based (no DB storage needed)
- Mobile responsiveness: Tested on common breakpoints
- Accessibility: WCAG AA compliance for colors and interactive elements
- Analytics: Track filter clicks to understand user interests (future)

---

## Deliverables

1. ✅ Information Architecture (Daily, Weekly, Monthly, About pages)
2. ✅ Visual Design System (colors, components, spacing)
3. ✅ Pipeline Positioning (Stats bar, About page content)
4. ✅ Interactive Features (tag filtering, clear filters)
5. ✅ Content Refinement (close gaps, improve spacing)

**Status:** Ready for implementation plan and execution.
