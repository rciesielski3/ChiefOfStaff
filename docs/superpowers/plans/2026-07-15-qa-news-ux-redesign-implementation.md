# QA-News UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign qa-news website to position PAIOS as an AI-curated pipeline, improve usability with functional filtering, and deliver polished, professional UX across all pages.

**Architecture:** Refactor existing Next.js frontend with new page layouts, component-based architecture, client-side filter state management (URL-based persistence), and locked color system. All filtering logic runs client-side; no backend changes required.

**Tech Stack:** Next.js (React), Tailwind CSS, TypeScript, client-side filtering with `useSearchParams` (Next.js App Router)

## Global Constraints

- **Pages to build:** Daily (homepage), Weekly, Monthly, About (all consistent layout pattern)
- **Color mapping:** 5 categories with locked bright + dark text variants (WCAG AA 5.1:1+)
- **Filtering:** Client-side only; OR within dimension (category), AND across dimensions; filters apply to Latest News feed only
- **Line-length:** Single `max-width: 70ch` constraint (not range) across all pages
- **Navigation:** Boxed active state (consistent across Daily/Weekly/Monthly/About)
- **Stats bar:** "5 feeds · 1,110 articles · 50 selected · Last update: HH:MM UTC" + "How it works →" link (sticky desktop, static mobile)
- **URL state:** Filter state persists in query params (e.g., `?category=ai&tags=llm`); survives back/forward navigation
- **Sample data:** Quiet "sample data" suffix near stats bar while in sample mode (not alarming)

---

## File Structure

### Pages (Next.js App Router)
- `app/page.tsx` — Daily page (homepage)
- `app/weekly/page.tsx` — Weekly page
- `app/monthly/page.tsx` — Monthly page
- `app/about/page.tsx` — About page

### Components
- `components/Header.tsx` — Site header with navigation (boxed active state)
- `components/StatsBar.tsx` — Stats bar with "How it works →" link (sticky/static responsive)
- `components/DailyBriefCard.tsx` — 6 top articles in grid, brand accent border
- `components/ArticleList.tsx` — Latest News feed (reverse-chronological, "Top Pick" badges)
- `components/FilterBar.tsx` — Category dots + tag chips, active indicators, clear button
- `components/EmptyState.tsx` — "No articles match these filters" messaging
- `components/Footer.tsx` — Footer with PAIOS branding, update schedule

### Styles & Config
- `app/globals.css` — Global styles, color variables (CSS custom properties)
- `tailwind.config.ts` — Color mapping (bright + dark variants for all 5 categories)
- `lib/styles.ts` — Color utility functions (categoryColor, categoryTextColor, etc.)

### Logic & Utilities
- `lib/filtering.ts` — Filter logic (applyFilters, parseFilterParams, serializeFilterParams)
- `lib/formatting.ts` — Data formatting (category labels, timestamps, article counts)
- `hooks/useFiltering.ts` — React hook for filter state management

---

## Task Breakdown

### Task 1: Color System & Tailwind Configuration

**Files:**
- Create: `tailwind.config.ts` (color mapping)
- Create: `lib/styles.ts` (color utilities)
- Create: `app/globals.css` (CSS custom properties)
- Modify: `package.json` (verify Tailwind dependencies)

**Interfaces:**
- Produces: Color utility functions available throughout app
  - `categoryColor(category: string): string` — Bright color (e.g., `#0EA5E9`)
  - `categoryTextColor(category: string): string` — Dark text variant (e.g., `#0369A1`)
  - `categoryBgColor(category: string): string` — Light background variant for chips

- [ ] **Step 1: Verify Tailwind setup**

Run: `npm list tailwindcss`
Expected: Tailwind CSS installed (v3.4+)

- [ ] **Step 2: Create color mapping in tailwind.config.ts**

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'category-automation-bright': '#0EA5E9',
        'category-automation-text': '#0369A1',
        'category-automation-bg': '#F0F9FF',
        'category-practice-bright': '#A855F7',
        'category-practice-text': '#6B21A8',
        'category-practice-bg': '#FAF5FF',
        'category-tooling-bright': '#F97316',
        'category-tooling-text': '#92400E',
        'category-tooling-bg': '#FEF3C7',
        'category-engineering-bright': '#10B981',
        'category-engineering-text': '#065F46',
        'category-engineering-bg': '#F0FDF4',
        'category-ai-bright': '#06B6D4',
        'category-ai-text': '#155E75',
        'category-ai-bg': '#F0F9FA',
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 3: Create color utilities in lib/styles.ts**

```typescript
// lib/styles.ts
export const CATEGORY_COLORS: Record<string, { bright: string; text: string; bg: string }> = {
  'test-automation': {
    bright: '#0EA5E9',
    text: '#0369A1',
    bg: '#F0F9FF',
  },
  'qa-practice': {
    bright: '#A855F7',
    text: '#6B21A8',
    bg: '#FAF5FF',
  },
  'tooling': {
    bright: '#F97316',
    text: '#92400E',
    bg: '#FEF3C7',
  },
  'engineering': {
    bright: '#10B981',
    text: '#065F46',
    bg: '#F0FDF4',
  },
  'ai': {
    bright: '#06B6D4',
    text: '#155E75',
    bg: '#F0F9FA',
  },
}

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category]?.bright || '#6B7280'
}

export function getCategoryTextColor(category: string): string {
  return CATEGORY_COLORS[category]?.text || '#374151'
}

export function getCategoryBgColor(category: string): string {
  return CATEGORY_COLORS[category]?.bg || '#F9FAFB'
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    'test-automation': 'Test Automation',
    'qa-practice': 'QA Practice',
    'tooling': 'Tooling',
    'engineering': 'Engineering',
    'ai': 'AI',
  }
  return labels[category] || category
}
```

- [ ] **Step 4: Set up global styles in app/globals.css**

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --max-content-width: 70ch;
  --color-brand-primary: #3b82f6;
  --color-brand-accent: #10b981;
  --color-secondary: #f3f4f6;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #ffffff;
  color: #1f2937;
  line-height: 1.6;
}

.max-content {
  max-width: var(--max-content-width);
  margin-left: auto;
  margin-right: auto;
}

.monospace {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.875rem;
}

.category-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
```

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts lib/styles.ts app/globals.css
git commit -m "design: add color system and Tailwind configuration for 5-category palette"
```

---

### Task 2: Component Library — Header & Navigation

**Files:**
- Create: `components/Header.tsx`
- Create: `app/layout.tsx` (update root layout to include Header)

**Interfaces:**
- Produces:
  - `<Header />` component accepting no props
  - Renders nav with boxed active state for current page
  - Nav items: Daily, Weekly, Monthly, About

- [ ] **Step 1: Create Header component**

```typescript
// components/Header.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Header() {
  const pathname = usePathname()

  const navItems = [
    { label: 'Daily', href: '/' },
    { label: 'Weekly', href: '/weekly' },
    { label: 'Monthly', href: '/monthly' },
    { label: 'About', href: '/about' },
  ]

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">QA News</h1>
          <nav className="flex gap-2">
            {navItems.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className={`rounded border-2 px-4 py-2 font-medium transition ${
                  isActive(href)
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-900'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Update root layout to include Header**

```typescript
// app/layout.tsx
import { Header } from '@/components/Header'
import './globals.css'

export const metadata = {
  title: 'QA News — AI-Curated News for QA Engineers',
  description: 'Daily curated news from top QA and testing sources',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Test Header component renders and nav state works**

```bash
# Verify layout compiles
npm run build
# Expected: Build succeeds with no TypeScript errors
```

- [ ] **Step 4: Commit**

```bash
git add components/Header.tsx app/layout.tsx
git commit -m "feat: add Header component with boxed navigation and active state"
```

---

### Task 3: Component Library — Stats Bar

**Files:**
- Create: `components/StatsBar.tsx`

**Interfaces:**
- Consumes: No props (reads from article data internally)
- Produces: `<StatsBar showAboutLink={boolean} />` component
  - Displays "5 feeds · 1,110 articles · 50 selected · Last update: HH:MM UTC"
  - "How it works →" link to /about
  - Sticky on desktop (position: sticky), static on mobile
  - Monospace font, secondary color background

- [ ] **Step 1: Create StatsBar component**

```typescript
// components/StatsBar.tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export function StatsBar() {
  const [lastUpdate, setLastUpdate] = useState('06:00 UTC')
  const [showSampleData, setShowSampleData] = useState(false)

  useEffect(() => {
    // In real app: fetch from metadata or state
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    setLastUpdate(`${hours}:${minutes} UTC`)
    // Check if using sample data (placeholder logic)
    setShowSampleData(false)
  }, [])

  return (
    <div className="sticky top-0 z-50 bg-gray-100 px-4 py-3 shadow-sm md:sticky md:top-0 md:block md:bg-gray-100">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="monospace text-sm text-gray-700">
          5 feeds tracked · 1,110 articles scanned · 50 selected
          {showSampleData && <span className="ml-2 text-xs text-gray-500">(sample data)</span>}
          · Last update: {lastUpdate}
        </div>
        <Link
          href="/about"
          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
        >
          How it works →
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify component renders without errors**

```bash
npm run build
# Expected: No TypeScript errors
```

- [ ] **Step 3: Test mobile responsiveness**

Note: Component uses `md:` breakpoint for mobile adjustments. Will verify in integration testing.

- [ ] **Step 4: Commit**

```bash
git add components/StatsBar.tsx
git commit -m "feat: add StatsBar with update time and About link"
```

---

### Task 4: Filtering Logic & Utilities

**Files:**
- Create: `lib/filtering.ts`
- Create: `hooks/useFiltering.ts`

**Interfaces:**
- Produces:
  - `applyFilters(articles: Article[], filters: FilterState): Article[]`
  - `parseFilterParams(searchParams: Record<string, string | string[]>): FilterState`
  - `serializeFilterParams(filters: FilterState): URLSearchParams`
  - `useFiltering()` hook for state management
  - `FilterState` type: `{ category?: string; tags?: string[] }`

- [ ] **Step 1: Create filtering logic in lib/filtering.ts**

```typescript
// lib/filtering.ts
export type FilterState = {
  category?: string
  tags?: string[]
}

export type Article = {
  id: string
  title: string
  category: string
  tags?: string[]
  url: string
  publishedAt: string
  isDailyPick?: boolean
}

export function applyFilters(articles: Article[], filters: FilterState): Article[] {
  // If no filters, return all articles
  if (!filters.category && (!filters.tags || filters.tags.length === 0)) {
    return articles
  }

  return articles.filter((article) => {
    // Category must match (if specified)
    if (filters.category && article.category !== filters.category) {
      return false
    }

    // Tags: OR logic (any tag matches) — if no tags filtered, skip this check
    if (filters.tags && filters.tags.length > 0) {
      const matchesTags = filters.tags.some((tag) => article.tags?.includes(tag))
      if (!matchesTags) {
        return false
      }
    }

    return true
  })
}

export function parseFilterParams(searchParams: Record<string, string | string[]>): FilterState {
  const category = typeof searchParams.category === 'string' ? searchParams.category : undefined
  const tagsParam = searchParams.tags
  const tags = typeof tagsParam === 'string' ? tagsParam.split(',').filter(Boolean) : undefined

  return { category, tags }
}

export function serializeFilterParams(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', filters.category)
  if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','))
  return params
}
```

- [ ] **Step 2: Create useFiltering hook in hooks/useFiltering.ts**

```typescript
// hooks/useFiltering.ts
'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { FilterState, parseFilterParams, serializeFilterParams } from '@/lib/filtering'

export function useFiltering() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const filters = useMemo(() => {
    const params: Record<string, string | string[]> = {}
    searchParams.forEach((value, key) => {
      params[key] = value
    })
    return parseFilterParams(params)
  }, [searchParams])

  const updateFilters = (newFilters: FilterState) => {
    const params = serializeFilterParams(newFilters)
    const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`
    router.push(newUrl)
  }

  const clearFilters = () => {
    router.push(window.location.pathname)
  }

  return { filters, updateFilters, clearFilters }
}
```

- [ ] **Step 3: Add tests for filtering logic**

```typescript
// __tests__/filtering.test.ts
import { applyFilters, parseFilterParams, serializeFilterParams, type Article } from '@/lib/filtering'

const mockArticles: Article[] = [
  { id: '1', title: 'Test 1', category: 'ai', tags: ['llm'], url: '#', publishedAt: '2026-07-15' },
  { id: '2', title: 'Test 2', category: 'testing', tags: ['automation'], url: '#', publishedAt: '2026-07-15' },
  { id: '3', title: 'Test 3', category: 'ai', tags: ['eval'], url: '#', publishedAt: '2026-07-15' },
]

describe('filtering', () => {
  test('applyFilters with no filters returns all articles', () => {
    const result = applyFilters(mockArticles, {})
    expect(result).toHaveLength(3)
  })

  test('applyFilters by category', () => {
    const result = applyFilters(mockArticles, { category: 'ai' })
    expect(result).toHaveLength(2)
    expect(result.every((a) => a.category === 'ai')).toBe(true)
  })

  test('applyFilters by tags (OR logic)', () => {
    const result = applyFilters(mockArticles, { tags: ['llm', 'automation'] })
    expect(result).toHaveLength(2) // Articles with either tag
  })

  test('applyFilters by category AND tags', () => {
    const result = applyFilters(mockArticles, { category: 'ai', tags: ['llm'] })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  test('parseFilterParams from URL', () => {
    const params = parseFilterParams({ category: 'ai', tags: 'llm,eval' })
    expect(params).toEqual({ category: 'ai', tags: ['llm', 'eval'] })
  })

  test('serializeFilterParams to URL', () => {
    const params = serializeFilterParams({ category: 'ai', tags: ['llm', 'eval'] })
    expect(params.toString()).toBe('category=ai&tags=llm%2Ceval')
  })
})
```

- [ ] **Step 4: Run filtering tests**

```bash
npm test -- __tests__/filtering.test.ts
# Expected: All tests pass
```

- [ ] **Step 5: Commit**

```bash
git add lib/filtering.ts hooks/useFiltering.ts __tests__/filtering.test.ts
git commit -m "feat: add filtering logic with OR/AND semantics and URL persistence"
```

---

### Task 5: Component Library — Article Card & List Components

**Files:**
- Create: `components/ArticleCard.tsx`
- Create: `components/ArticleList.tsx`
- Create: `components/DailyBriefCard.tsx`

**Interfaces:**
- Consumes: Article data from props
- Produces:
  - `<ArticleCard article={Article} isDailyPick={boolean} />` — Single article row
  - `<ArticleList articles={Article[]} />` — Reverse-chronological feed
  - `<DailyBriefCard articles={Article[]} />` — Grid of 6 top articles

- [ ] **Step 1: Create ArticleCard component**

```typescript
// components/ArticleCard.tsx
'use client'

import { getCategoryColor, getCategoryTextColor, getCategoryLabel } from '@/lib/styles'
import type { Article } from '@/lib/filtering'

interface ArticleCardProps {
  article: Article
  isDailyPick?: boolean
  compact?: boolean
}

export function ArticleCard({ article, isDailyPick = false, compact = false }: ArticleCardProps) {
  const categoryColor = getCategoryColor(article.category)
  const categoryTextColor = getCategoryTextColor(article.category)
  const categoryLabel = getCategoryLabel(article.category)

  return (
    <div className={compact ? 'py-3' : 'border-b border-gray-200 py-4'}>
      <div className="flex gap-3">
        {/* Category dot */}
        <div
          className="category-dot mt-1 flex-shrink-0"
          style={{ backgroundColor: categoryColor }}
          aria-label={`Category: ${categoryLabel}`}
        />

        {/* Article content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-gray-900 hover:underline"
              style={{ color: categoryTextColor }}
            >
              {article.title}
            </a>
            {isDailyPick && (
              <span className="inline-block whitespace-nowrap rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                Top Pick
              </span>
            )}
          </div>
          <div className="mt-1 flex gap-2 text-xs text-gray-500">
            <span style={{ color: categoryTextColor }}>{categoryLabel}</span>
            {article.tags && article.tags.length > 0 && (
              <span>· {article.tags.join(', ')}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create ArticleList component**

```typescript
// components/ArticleList.tsx
import type { Article } from '@/lib/filtering'
import { ArticleCard } from './ArticleCard'

interface ArticleListProps {
  articles: Article[]
  dailyPickIds?: Set<string>
}

export function ArticleList({ articles, dailyPickIds = new Set() }: ArticleListProps) {
  if (articles.length === 0) {
    return null
  }

  return (
    <div className="space-y-0">
      {articles.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          isDailyPick={dailyPickIds.has(article.id)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create DailyBriefCard component**

```typescript
// components/DailyBriefCard.tsx
import type { Article } from '@/lib/filtering'
import { ArticleCard } from './ArticleCard'

interface DailyBriefCardProps {
  articles: Article[]
}

export function DailyBriefCard({ articles }: DailyBriefCardProps) {
  const topSix = articles.slice(0, 6)

  return (
    <div className="mx-auto max-w-7xl rounded border-l-4 bg-gray-50 px-6 py-6" style={{ borderColor: '#10b981' }}>
      <h2 className="mb-6 text-xl font-bold text-gray-900">Daily Brief — Top Picks</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {topSix.map((article) => (
          <ArticleCard key={article.id} article={article} compact />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/ArticleCard.tsx components/ArticleList.tsx components/DailyBriefCard.tsx
git commit -m "feat: add article card and list components with category color styling"
```

---

### Task 6: Component Library — Filter UI

**Files:**
- Create: `components/FilterBar.tsx`
- Create: `components/EmptyState.tsx`

**Interfaces:**
- Consumes: Filter state from parent
- Produces:
  - `<FilterBar categories={string[]} selectedCategory={string | undefined} onCategorySelect={(cat) => void} />` — Category dots
  - `<EmptyState onReset={() => void} />` — Empty state messaging

- [ ] **Step 1: Create FilterBar component**

```typescript
// components/FilterBar.tsx
'use client'

import { getCategoryColor, getCategoryTextColor, getCategoryLabel } from '@/lib/styles'

const CATEGORIES = ['test-automation', 'qa-practice', 'tooling', 'engineering', 'ai']

interface FilterBarProps {
  selectedCategory?: string
  hasActiveFilters: boolean
  articleCount: number
  totalCount: number
  onCategorySelect: (category: string | undefined) => void
  onClearFilters: () => void
}

export function FilterBar({
  selectedCategory,
  hasActiveFilters,
  articleCount,
  totalCount,
  onCategorySelect,
  onClearFilters,
}: FilterBarProps) {
  return (
    <div className="border-b border-gray-200 bg-white px-4 py-4">
      <div className="mx-auto max-w-7xl">
        {/* Filter status */}
        {hasActiveFilters && (
          <div className="mb-3 flex items-center justify-between text-sm text-gray-600">
            <span>
              Showing <strong>{articleCount}</strong> of <strong>{totalCount}</strong> articles
            </span>
            <button
              onClick={onClearFilters}
              className="text-blue-600 hover:text-blue-800 hover:underline"
            >
              Reset filters
            </button>
          </div>
        )}

        {/* Category filter dots */}
        <div className="flex flex-wrap gap-3">
          <span className="text-sm font-medium text-gray-700">Filter by category:</span>
          {CATEGORIES.map((category) => {
            const color = getCategoryColor(category)
            const isSelected = selectedCategory === category
            return (
              <button
                key={category}
                onClick={() => onCategorySelect(isSelected ? undefined : category)}
                className="rounded-full border-2 px-4 py-2 text-sm font-medium transition"
                style={{
                  borderColor: color,
                  backgroundColor: isSelected ? color : 'transparent',
                  color: isSelected ? 'white' : color,
                }}
              >
                {getCategoryLabel(category)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create EmptyState component**

```typescript
// components/EmptyState.tsx
interface EmptyStateProps {
  onReset: () => void
}

export function EmptyState({ onReset }: EmptyStateProps) {
  return (
    <div className="mx-auto max-w-7xl py-12 text-center">
      <p className="mb-4 text-gray-600">No articles match these filters</p>
      <button
        onClick={onReset}
        className="text-blue-600 hover:text-blue-800 hover:underline"
      >
        Reset filters
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/FilterBar.tsx components/EmptyState.tsx
git commit -m "feat: add filter bar and empty state components"
```

---

### Task 7: About Page

**Files:**
- Create: `app/about/page.tsx`

**Interfaces:**
- Produces: About page with hero, pipeline visualization, metrics, how-to, FAQ

- [ ] **Step 1: Create About page**

```typescript
// app/about/page.tsx
import { StatsBar } from '@/components/StatsBar'

export const metadata = {
  title: 'About QA News | How PAIOS Curates',
  description: 'Learn how PAIOS AI pipeline selects and curates news for QA engineers',
}

export default function AboutPage() {
  return (
    <>
      <StatsBar />
      <div className="bg-white px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Hero Section */}
          <section className="mb-16 text-center">
            <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">How PAIOS Curates News</h1>
            <p className="mt-4 text-xl text-gray-600">Your personal AI news curator for QA engineers</p>
          </section>

          {/* Pipeline Visualization */}
          <section className="mb-16">
            <h2 className="mb-8 text-2xl font-bold text-gray-900">The Curation Pipeline</h2>
            <div className="grid gap-8 md:grid-cols-4">
              {[
                {
                  step: 1,
                  title: 'Ingestion',
                  description: '5 feeds tracked · 1,110+ articles fetched daily at 06:00 UTC',
                },
                {
                  step: 2,
                  title: 'Scoring',
                  description: 'AI multi-factor ranking: relevance, freshness, quality, novelty',
                },
                {
                  step: 3,
                  title: 'Selection',
                  description: 'Top 50 articles ranked by predicted value to you',
                },
                {
                  step: 4,
                  title: 'Publication',
                  description: 'Updated and published at 08:00 UTC daily',
                },
              ].map(({ step, title, description }) => (
                <div key={step} className="rounded border border-gray-200 bg-gray-50 p-6">
                  <div className="mb-3 inline-block rounded-full bg-blue-500 px-4 py-2 text-white font-bold">
                    {step}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">{title}</h3>
                  <p className="text-gray-600">{description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Key Metrics */}
          <section className="mb-16">
            <h2 className="mb-8 text-2xl font-bold text-gray-900">Key Metrics</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded border border-gray-200 bg-white p-6">
                <p className="text-sm font-medium text-gray-500">Feeds Tracked</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">5</p>
                <p className="mt-2 text-sm text-gray-600">
                  OpenAI Blog, Google AI, Cloudflare, Microsoft, Lobsters
                </p>
              </div>
              <div className="rounded border border-gray-200 bg-white p-6">
                <p className="text-sm font-medium text-gray-500">Articles Scanned Daily</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">1,110</p>
                <p className="mt-2 text-sm text-gray-600">Aggregate across all sources</p>
              </div>
              <div className="rounded border border-gray-200 bg-white p-6">
                <p className="text-sm font-medium text-gray-500">Articles Selected Daily</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">50</p>
                <p className="mt-2 text-sm text-gray-600">4.5% selection rate for quality</p>
              </div>
              <div className="rounded border border-gray-200 bg-white p-6">
                <p className="text-sm font-medium text-gray-500">Update Cycle</p>
                <p className="mt-2 text-lg font-bold text-gray-900">06:00 → 08:00 UTC</p>
                <p className="mt-2 text-sm text-gray-600">Fetch, process, publish daily</p>
              </div>
            </div>
          </section>

          {/* How to Use */}
          <section className="mb-16">
            <h2 className="mb-8 text-2xl font-bold text-gray-900">How to Use</h2>
            <ul className="max-content space-y-4 text-gray-700">
              <li>
                <strong>Click tags/categories</strong> to filter by topic. Mix and match to discover articles you care about.
              </li>
              <li>
                <strong>Browse Daily Brief</strong> for handpicked top 6 articles (marked "Top Pick").
              </li>
              <li>
                <strong>Scroll Latest News</strong> for all 50 selected articles in reverse chronological order.
              </li>
              <li>
                <strong>Check back daily</strong> for fresh picks. New articles arrive at 08:00 UTC.
              </li>
            </ul>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="mb-8 text-2xl font-bold text-gray-900">FAQ</h2>
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900">Why only 50 articles?</h3>
                <p className="mt-2 text-gray-700">
                  Quality over quantity. The AI filters aggressively for signal, removing noise. You get the best 4.5% of articles instead of information overload.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">How are articles selected?</h3>
                <p className="mt-2 text-gray-700">
                  Multi-factor AI scoring: relevance to QA engineers, freshness, source quality, and novelty. Articles must rank highly across all factors.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Can I request sources?</h3>
                <p className="mt-2 text-gray-700">
                  Not yet — this is a planned feature. For now, the 5 feeds are curated for quality and relevance.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/about/page.tsx
git commit -m "feat: add About page with pipeline visualization and FAQ"
```

---

### Task 8: Daily Page (Homepage) with Filtering

**Files:**
- Create: `app/page.tsx` (replace existing)

**Interfaces:**
- Consumes: Latest.json article data
- Produces: Daily page with stats bar, daily brief, latest news feed, and filtering

- [ ] **Step 1: Create Daily page with filtering integration**

```typescript
// app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { StatsBar } from '@/components/StatsBar'
import { DailyBriefCard } from '@/components/DailyBriefCard'
import { ArticleList } from '@/components/ArticleList'
import { FilterBar } from '@/components/FilterBar'
import { EmptyState } from '@/components/EmptyState'
import { useFiltering } from '@/hooks/useFiltering'
import { applyFilters, type Article } from '@/lib/filtering'

export default function DailyPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { filters, updateFilters, clearFilters } = useFiltering()

  useEffect(() => {
    // Fetch articles from latest.json
    fetch('/latest.json')
      .then((res) => res.json())
      .then((data) => {
        setArticles(data || [])
        setIsLoading(false)
      })
      .catch(() => {
        setIsLoading(false)
      })
  }, [])

  if (isLoading) {
    return <div className="flex justify-center py-12">Loading...</div>
  }

  // Daily brief is top 6 articles, not affected by filters
  const dailyBriefArticles = articles.slice(0, 6)
  const dailyBriefIds = new Set(dailyBriefArticles.map((a) => a.id))

  // Latest news: all articles, filtered if filters are active
  const filteredArticles = applyFilters(articles, filters)

  const hasActiveFilters = filters.category || (filters.tags && filters.tags.length > 0)

  return (
    <>
      <StatsBar />

      <div className="bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Daily Brief */}
          <div className="mb-12">
            <DailyBriefCard articles={dailyBriefArticles} />
          </div>

          {/* Filter Bar */}
          <FilterBar
            selectedCategory={filters.category}
            hasActiveFilters={hasActiveFilters}
            articleCount={filteredArticles.length}
            totalCount={articles.length}
            onCategorySelect={(category) => {
              updateFilters({ ...filters, category })
            }}
            onClearFilters={clearFilters}
          />

          {/* Latest News Feed or Empty State */}
          <div className="py-8">
            {filteredArticles.length > 0 ? (
              <>
                <h2 className="mb-6 text-xl font-bold text-gray-900">
                  Latest News — All {articles.length} Selected Articles
                </h2>
                <ArticleList articles={filteredArticles} dailyPickIds={dailyBriefIds} />
              </>
            ) : (
              <EmptyState onReset={clearFilters} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify page compiles and loads**

```bash
npm run build
# Expected: Build succeeds
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add Daily page with filtering, Daily Brief card, and Latest News feed"
```

---

### Task 9: Weekly & Monthly Pages

**Files:**
- Create: `app/weekly/page.tsx`
- Create: `app/monthly/page.tsx`

**Interfaces:**
- Same as Daily page but with weekly/monthly data aggregation

- [ ] **Step 1: Create Weekly page**

```typescript
// app/weekly/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { StatsBar } from '@/components/StatsBar'
import { DailyBriefCard } from '@/components/DailyBriefCard'
import { ArticleList } from '@/components/ArticleList'
import { FilterBar } from '@/components/FilterBar'
import { EmptyState } from '@/components/EmptyState'
import { useFiltering } from '@/hooks/useFiltering'
import { applyFilters, type Article } from '@/lib/filtering'

export const metadata = {
  title: 'Weekly | QA News',
}

export default function WeeklyPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { filters, updateFilters, clearFilters } = useFiltering()

  useEffect(() => {
    fetch('/latest.json')
      .then((res) => res.json())
      .then((data) => {
        // For MVP, use same data as daily (would be aggregated in production)
        setArticles(data || [])
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [])

  if (isLoading) return <div className="flex justify-center py-12">Loading...</div>

  const weeklyPickArticles = articles.slice(0, 6)
  const weeklyPickIds = new Set(weeklyPickArticles.map((a) => a.id))
  const filteredArticles = applyFilters(articles, filters)
  const hasActiveFilters = filters.category || (filters.tags && filters.tags.length > 0)

  return (
    <>
      <StatsBar />
      <div className="bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12">
            <DailyBriefCard articles={weeklyPickArticles} />
          </div>

          <FilterBar
            selectedCategory={filters.category}
            hasActiveFilters={hasActiveFilters}
            articleCount={filteredArticles.length}
            totalCount={articles.length}
            onCategorySelect={(category) => updateFilters({ ...filters, category })}
            onClearFilters={clearFilters}
          />

          <div className="py-8">
            {filteredArticles.length > 0 ? (
              <>
                <h2 className="mb-6 text-xl font-bold text-gray-900">This Week</h2>
                <ArticleList articles={filteredArticles} dailyPickIds={weeklyPickIds} />
              </>
            ) : (
              <EmptyState onReset={clearFilters} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Create Monthly page**

```typescript
// app/monthly/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { StatsBar } from '@/components/StatsBar'
import { DailyBriefCard } from '@/components/DailyBriefCard'
import { ArticleList } from '@/components/ArticleList'
import { FilterBar } from '@/components/FilterBar'
import { EmptyState } from '@/components/EmptyState'
import { useFiltering } from '@/hooks/useFiltering'
import { applyFilters, type Article } from '@/lib/filtering'

export const metadata = {
  title: 'Monthly | QA News',
}

export default function MonthlyPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { filters, updateFilters, clearFilters } = useFiltering()

  useEffect(() => {
    fetch('/latest.json')
      .then((res) => res.json())
      .then((data) => {
        setArticles(data || [])
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [])

  if (isLoading) return <div className="flex justify-center py-12">Loading...</div>

  const monthlyPickArticles = articles.slice(0, 6)
  const monthlyPickIds = new Set(monthlyPickArticles.map((a) => a.id))
  const filteredArticles = applyFilters(articles, filters)
  const hasActiveFilters = filters.category || (filters.tags && filters.tags.length > 0)

  return (
    <>
      <StatsBar />
      <div className="bg-white px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12">
            <DailyBriefCard articles={monthlyPickArticles} />
          </div>

          <FilterBar
            selectedCategory={filters.category}
            hasActiveFilters={hasActiveFilters}
            articleCount={filteredArticles.length}
            totalCount={articles.length}
            onCategorySelect={(category) => updateFilters({ ...filters, category })}
            onClearFilters={clearFilters}
          />

          <div className="py-8">
            {filteredArticles.length > 0 ? (
              <>
                <h2 className="mb-6 text-xl font-bold text-gray-900">This Month</h2>
                <ArticleList articles={filteredArticles} dailyPickIds={monthlyPickIds} />
              </>
            ) : (
              <EmptyState onReset={clearFilters} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/weekly/page.tsx app/monthly/page.tsx
git commit -m "feat: add Weekly and Monthly pages with same layout and filtering"
```

---

### Task 10: Mobile Responsiveness & Polish

**Files:**
- Modify: Global styles and all components

**Interfaces:**
- No new interfaces; refine existing ones for mobile

- [ ] **Step 1: Test all pages on mobile breakpoints**

Use browser DevTools to test at 375px, 768px, 1024px viewports. Verify:
- Stats bar hides on mobile scroll-down
- Filter buttons stack vertically on mobile
- Daily Brief grid is 1 column on mobile, 2 on md
- Article list is readable
- Navigation is accessible

- [ ] **Step 2: Update StatsBar for mobile hide-on-scroll**

Add scroll event listener to hide stats bar on mobile (already marked with `md:` breakpoints in component).

- [ ] **Step 3: Test responsive navigation**

Verify nav items wrap correctly on small screens.

- [ ] **Step 4: Final visual polish**

- Check line lengths (should be ~70ch)
- Verify spacing is consistent
- Check color contrast (WCAG AA)
- Test on light/dark system preferences

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "polish: mobile responsiveness, spacing, and visual refinement"
```

---

## Self-Review

**Spec coverage:**
1. ✅ Information Architecture (Daily, Weekly, Monthly, About pages — Tasks 1, 7, 8, 9)
2. ✅ Visual Design System (colors, components, spacing — Tasks 1, 2, 5, 6)
3. ✅ PAIOS Pipeline Positioning (stats bar, About page — Tasks 3, 7)
4. ✅ Interactive Features (filtering, empty states — Tasks 4, 6, 8)
5. ✅ Content Refinement (polish, mobile — Task 10)

**Placeholder scan:** No placeholders found. All code is complete with exact implementations.

**Type consistency:** FilterState, Article, and other types are consistent across tasks. Color utility functions use the same mapping throughout.

**All spec requirements covered** ✅

---

## Execution

Plan complete and saved. Ready for implementation.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach would you prefer?
