# QA-News Curation Rules & RSS Source Audit

> **Goal:** Audit current RSS sources, propose QA/testing-focused alternatives, and implement keyword-based curation rules to focus QA-News on test automation, QA engineering, and software quality topics.

**Status:** Design & Audit Complete  
**Date:** 2026-07-22

---

## Part 1: Current RSS Sources Audit

### Current Sources (5 total)

| Source | URL | Topic | QA-Focus? | Issue |
|--------|-----|-------|-----------|-------|
| OpenAI | openai.com/news/rss.xml | AI/LLM News | ⭐⭐ | Too broad (not QA-specific) |
| Google AI | blog.google/technology/ai/ | AI/ML News | ⭐⭐ | Too broad (not QA-specific) |
| Cloudflare | blog.cloudflare.com/rss/ | Infrastructure/Security | ⭐ | Tangential (some DevOps/security) |
| Microsoft DevBlogs | devblogs.microsoft.com/feed/ | Development/Cloud | ⭐ | Broad coverage, low QA signal |
| Lobsters | lobste.rs/rss | General Tech News | ⭐ | Very broad (programming, sysadmin, hardware, etc.) |

### Finding: Current sources lack QA/Testing focus

**Evidence from latest.json (2026-07-22):**
- "ECC and DDR5" — Hardware (not QA)
- "LG to Ban Residential Proxies from Smart TV Apps" — IoT/ads (not QA)
- "Some more things about Django I've been enjoying" — Web framework (not QA)
- Few articles on testing, QA, test automation, or software quality

**Root Cause:** RSS sources are AI-focused + general tech. Need specialized QA sources.

---

## Part 2: Proposed QA/Testing-Focused RSS Sources

### Tier 1: QA & Test Automation (HIGH PRIORITY)

| Source | URL | Focus | Target Signal |
|--------|-----|-------|----------------|
| **Ministry of Testing Blog** | ministryoftesting.com/feed.xml | Test Strategy, QA Best Practices | Test automation, QA careers, testing trends |
| **Sauce Labs Blog** | saucelabs.com/blog/rss | Continuous Testing, Automation | CI/CD, selenium, cross-browser testing |
| **TestProject Blog** | testproject.io/blog/rss | No-code Testing, Automation | Test automation, AI testing, cloud testing |
| **QA Blog (SmartBear)** | smartbear.com/blog/rss | Software Quality, Test Tools | Test automation, performance testing, QA metrics |
| **Cypress Blog** | cypress.io/blog/rss | E2E Testing | Frontend testing, JavaScript testing, CI/CD |
| **Playwright Updates** | github.com/microsoft/playwright/releases.atom | Browser Automation | Web testing, API testing, playwright releases |

### Tier 2: Software Quality & DevOps (MEDIUM PRIORITY)

| Source | URL | Focus | Target Signal |
|--------|-----|-------|----------------|
| **Dev.to - Testing Tag** | dev.to/api/articles?tag=testing&top=7 | Community Testing Articles | Testing tips, tools, strategies |
| **HashiCorp Blog** | hashicorp.com/blog.json | Infrastructure Testing | IaC testing, config management |
| **GitLab Blog - DevOps** | about.gitlab.com/blog/ | DevOps/CI-CD Best Practices | Pipeline testing, security testing |
| **GitHub - Testing & CI** | github.blog/ | GitHub Actions, Testing | Testing on GitHub, CI/CD automation |
| **Stack Overflow - Testing** | stackexchange.com/feeds/taginfo/testing | Community Q&A on Testing | Testing problems, solutions, discussions |

### Tier 3: Performance & Security Testing (MEDIUM PRIORITY)

| Source | URL | Focus | Target Signal |
|--------|-----|-------|----------------|
| **Apache JMeter Blog** | jmeter.apache.org/news.xml | Performance Testing | Load testing, stress testing, JMeter |
| **OWASP Blog** | owasp.org/blog/ | Security Testing | Security testing, vulnerability testing |
| **Veracode Blog** | veracode.com/blog | Application Security | SAST/DAST testing, code analysis |

### Replacement Strategy

**Remove:** Microsoft DevBlogs (too broad)  
**Replace with:** Ministry of Testing, TestProject, Cypress, Playwright (core QA sources)

**Keep:** Lobsters (for general tech context, but apply stricter keyword filtering)

**Tier sources:** Implement Tier 1 first (immediate impact), Tier 2 next (gradual expansion)

---

## Part 3: Curation Rules & Keyword Filters

### Current Keyword Scoring (from score-article.ts)

```typescript
keywords: {
  'breaking': 35,
  'security': 40,
  'migration': 25,
  'playwright': 20,
  'typescript': 15,
  'mcp': 25,
  'agent': 20,
  'testing': 15,         // ⚠️ LOW WEIGHT
  'automation': 15,      // ⚠️ LOW WEIGHT
  'qa': 10,              // ⚠️ VERY LOW WEIGHT
  'ci/cd': 15,
  'performance': 15,
  'release': 20
}
```

### Proposed New Scoring Rules

#### Rule 1: QA/Testing Keyword Boosting

**Rationale:** Current weights favor AI/ML/tooling over testing. Boost QA-specific keywords.

```typescript
keywords: {
  // QA/Testing (HIGH WEIGHT - Core mission)
  'test automation': 50,        // NEW: Highest boost
  'qa engineering': 45,         // NEW: Highest boost
  'testing strategy': 40,       // NEW: Highest boost
  'e2e testing': 35,           // NEW: High boost
  'unit testing': 30,          // NEW: High boost
  'integration testing': 30,   // NEW: High boost
  'test framework': 30,        // NEW: High boost
  'automated testing': 35,     // NEW: High boost
  'testing best practices': 35, // NEW: High boost
  'test coverage': 25,         // NEW: Medium boost
  'testing tools': 25,         // NEW: Medium boost
  'continuous testing': 30,    // NEW: High boost
  
  // Existing (adjusted down)
  'testing': 25,               // UP from 15
  'automation': 25,            // UP from 15
  'qa': 20,                    // UP from 10
  
  // Performance/Security Testing
  'performance testing': 30,   // NEW: Related to QA
  'load testing': 28,          // NEW: Related to QA
  'security testing': 32,      // NEW: Related to QA
  'penetration testing': 30,   // NEW: Related to QA
  
  // Existing (keep)
  'breaking': 35,
  'security': 40,
  'migration': 25,
  'playwright': 20,
  'typescript': 15,
  'mcp': 25,
  'agent': 20,
  'ci/cd': 15,
  'release': 20
}
```

#### Rule 2: Negative Keywords (Exclusion Filter)

**Rationale:** Automatically downgrade articles not related to QA.

Create **negative_keywords** in config:

```typescript
negative_keywords: {
  // Hardware/IoT (not QA)
  'cpu': -40,
  'gpu': -40,
  'ddr5': -40,
  'memory': -30,
  'processor': -30,
  'hardware': -30,
  'smart tv': -40,
  'proxies': -20,
  
  // Non-tech topics
  'ecc': -20,           // If not in context of error correction testing
  'ipv6': -15,          // Infrastructure, not testing
  'networking': -20,    // Infrastructure focus
  
  // Irrelevant web frameworks (unless testing-focused)
  'django orm': -20,    // ORM tutorial, not testing-related
  'ruby on rails': -20, // Framework tutorial, not testing-related
  'node.js tips': -20   // General programming tips
}
```

**Algorithm:** If negative score > positive score, exclude article or downrank it.

#### Rule 3: Source-Based Boosting

**Rationale:** Boost weight for specialized QA sources.

```typescript
sources: {
  // QA/Testing sources (HIGH WEIGHT)
  'Ministry of Testing': 50,
  'TestProject': 45,
  'Sauce Labs': 40,
  'Cypress': 40,
  'Playwright': 45,
  'SmartBear': 35,
  
  // DevOps/CI-CD (MEDIUM WEIGHT)
  'GitHub': 25,
  'GitLab': 25,
  'HashiCorp': 20,
  
  // Existing
  'github-release': 35,
  'github-trending': 25,
  'hacker-news': 20,    // Lower from 20 → general tech
  'ai-radar': 30,
  'devto': 15,
  'openai': 25,
  'google': 20,
  'cloudflare': 15,
  'lobsters': 10        // Lower from 18 → very general
}
```

#### Rule 4: Content-Based Filtering

**Rationale:** Check article content for QA-relevant markers.

```typescript
qualitySignals: {
  hasCodeSnippet: +10,           // Testing code samples
  hasToolName: +15,              // Mentions specific test tools
  hasMetrics: +10,               // Discusses metrics/coverage
  hasBestPractices: +15,         // "best practices", "how to"
  hasComparison: +12,            // Tool/framework comparison
  hasTutorial: +12,              // "tutorial", "guide", "walkthrough"
  hasCase Study: +20,            // Real-world testing story
  hasOpenSourceTool: +18,        // References open-source test tools
}
```

#### Rule 5: Freshness Bonus (Preserve)

Keep existing freshness logic but cap at +10 (not +20):
- Articles published today: +10
- Articles from 1 day ago: +8
- Articles from 2 days ago: +6
- Articles from 3+ days ago: +2

**Rationale:** Test automation best practices change, but older foundational content still valuable. Don't over-penalize.

---

## Part 4: Implementation Tasks

### Task 1: Update RSS Sources

**File:** `src/cli/daily-brief.ts` (lines 15-36)

**Current:**
```typescript
const RSS_SOURCES = [
  { url: 'https://openai.com/news/rss.xml', name: 'OpenAI' },
  { url: 'https://blog.google/technology/ai/rss/', name: 'Google AI' },
  { url: 'https://blog.cloudflare.com/rss/', name: 'Cloudflare' },
  { url: 'https://devblogs.microsoft.com/feed/', name: 'Microsoft DevBlogs' },
  { url: 'https://lobste.rs/rss', name: 'Lobsters' }
];
```

**New (Tier 1 only):**
```typescript
const RSS_SOURCES = [
  // Tier 1: QA & Test Automation (PRIMARY FOCUS)
  { url: 'https://ministryoftesting.com/feed.xml', name: 'Ministry of Testing' },
  { url: 'https://saucelabs.com/blog/rss', name: 'Sauce Labs' },
  { url: 'https://testproject.io/blog/rss', name: 'TestProject' },
  { url: 'https://smartbear.com/blog/rss', name: 'SmartBear' },
  { url: 'https://cypress.io/blog/rss', name: 'Cypress' },
  { url: 'https://github.com/microsoft/playwright/releases.atom', name: 'Playwright' },
  
  // Existing (Context & AI updates, lower priority)
  { url: 'https://openai.com/news/rss.xml', name: 'OpenAI' },
  { url: 'https://blog.cloudflare.com/rss/', name: 'Cloudflare' },
  { url: 'https://lobste.rs/rss', name: 'Lobsters' }
];
```

### Task 2: Update Scoring Configuration

**File:** `src/business-logic/score-article.ts` (lines 22-59)

Replace `DEFAULT_CONFIG` weights with proposed keyword/source scoring above.

### Task 3: Implement Negative Keywords Filter

**File:** `src/business-logic/score-article.ts`

Add function:
```typescript
export function applyNegativeKeywords(article: Article, score: number, config: ScoringConfig): number {
  const text = `${article.title} ${article.summary}`.toLowerCase();
  
  if (config.weights.negativeKeywords) {
    for (const [keyword, penalty] of Object.entries(config.weights.negativeKeywords)) {
      if (text.includes(keyword)) {
        score += penalty; // penalty is negative
      }
    }
  }
  
  // If score drops below 30, downrank heavily or exclude
  return Math.max(score, 0);
}
```

### Task 4: Add Quality Signals Detection

**File:** `src/business-logic/score-article.ts`

Add function to detect quality signals (code snippets, tool names, metrics, tutorials).

### Task 5: Test & Validate

Run daily-brief CLI with new sources and scoring:
```bash
npm run daily-brief
```

Verify:
- ✅ Only QA/testing-focused articles in top 10
- ✅ No off-topic articles (hardware, non-tech, general programming)
- ✅ Consistent scoring across categories

---

## Metrics for Success

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| QA-related articles in top 10 | ~20% (1/5) | ≥80% (8/10) | Review daily-brief output |
| Average keyword relevance | Low | High | Sample scoring reasons |
| Off-topic articles | ~60% | <5% | Manual review of latest.json |
| Source diversity (QA vs AI) | 20% QA, 80% AI | 70% QA, 30% context | Check RSS source weights |

---

## Implementation Timeline

**Phase 1 (This Week):** Update RSS sources to Tier 1 QA-focused sources  
**Phase 2 (Next Week):** Implement keyword/negative keyword filtering  
**Phase 3 (Week 3):** Add quality signals detection  
**Phase 4 (Ongoing):** Monitor and refine based on daily output  

---

## Related Documents

- `/docs/project/project_status.md` — P1.0 status (M3 Daily Brief operationalized)
- `src/business-logic/score-article.ts` — Current scoring implementation
- `src/cli/daily-brief.ts` — Current RSS feed configuration
- `/CLAUDE.md` — Project architecture and guidelines

---

**Status:** Audit & Plan Complete. Ready for implementation.
