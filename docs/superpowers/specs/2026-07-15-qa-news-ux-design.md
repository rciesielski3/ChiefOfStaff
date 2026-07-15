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
   - Content: "1,110 sources scanned · 50 articles selected · Updated 06:00 UTC"
   - Monospace font for technical feel
   - Clickable (links to About page)
   - Always visible/sticky on scroll

3. **Daily Brief Card** (distinct visual container)
   - Title: "Daily Brief — Top Picks"
   - Layout: Grid or card-based (6 curated articles)
   - Visual distinction: Border + light background + contained padding
   - Separated visually from Latest News below

4. **Latest News Feed**
   - Title: "Latest News — All Selected Articles"
   - Layout: Reverse-chronological list
   - Plain styling (no container, flows naturally)
   - Starts directly below Daily Brief card

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
   - Step 1: **Sources** — "1,110+ sources scanned daily (OpenAI, Google AI, Cloudflare, Microsoft, Lobsters)"
   - Step 2: **Fetching** — "Articles ingested and persisted to knowledge layer"
   - Step 3: **Selection Model** — "AI-powered scoring: relevance, freshness, quality"
   - Step 4: **Scoring** — "Articles ranked by predicted value"
   - Step 5: **Publication** — "Top 50 articles published daily at 08:00 UTC"

3. **Key Metrics Section**
   - Articles scanned per day: 1,110
   - Articles selected: 50 (4.5% selection rate)
   - Sources tracked: 5 major feeds
   - Update frequency: Daily at 08:00 UTC
   - Uptime: 100% (tracked)

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

| Category | Color | Hex Code |
|----------|-------|----------|
| test-automation | Blue | #0EA5E9 |
| qa-practice | Purple | #A855F7 |
| tooling | Orange | #F97316 |
| engineering | Green | #10B981 |
| ai | Cyan | #06B6D4 |

**Rule:** Every instance (dot, label text, link, border) uses the same hex value. No variation between pages.

### Component Styling

| Component | Style | Behavior |
|-----------|-------|----------|
| **Category Dots** | Solid circle, category color | Clickable (filters) |
| **Category Labels** | Text in same color as dot | Consistent 1:1 with dot |
| **Tag Chips** | Subtle pill buttons: light bg + category color border, hover state | Clickable to filter; clear affordance |
| **Stats Bar** | Secondary color background, monospace font | Always visible; links to About |
| **Daily Brief Card** | Border (category color) + light background + padding | Clear visual container |
| **Article Links** | Dark text, underline on hover | Standard link affordance |
| **Active Filter Indicator** | Colored background (matching category) | Shows which filters are active |
| **Clear Filters Button** | Secondary text link | Resets filters to show all |

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
- Click any tag or category dot/label → page filters to show only articles with that tag
- Multiple filters can be active simultaneously (AND logic)
- URL encodes filter state (e.g., `?category=ai&tag=llm`) for shareable filtered views

**Visual Feedback:**
- **Active filters:** Highlighted with category color background
- **Status text:** "Showing X of 50 articles" or similar
- **Clear button:** "Reset filters" link to return to full list
- **Scope:** Works on Daily, Weekly, Monthly pages

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
1. ✅ Dedup Daily/Latest (clear visual hierarchy: hero card vs. feed)
2. ✅ Surface PAIOS story (stats bar + About page pipeline explainer)
3. ✅ Functional filtering (tag/category clicks filter articles)
4. ✅ Consistent styling (1:1 color mapping, line-length, nav states)
5. ✅ Polish & fill gaps (metrics cards, proper spacing, affordances)

**Success Looks Like:**
- Visitor lands → immediately sees "AI-curated" positioning
- Explores About → understands how pipeline works
- Clicks tags/categories → filters articles intuitively
- Entire site feels intentional, polished, professional

---

## Implementation Notes

**Frontend:** Next.js with React components (existing codebase)
**Data:** Latest.json structure supports tag/category metadata
**Styling:** CSS/Tailwind for color system, layout, responsive design
**No backend changes required** — filtering and display logic runs client-side

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
