# Scoring Strategy & Thresholds for PAIOS Knowledge Layer

**Task**: B3 - Finalize dedup & score logic, add monitoring/scoring documentation  
**Status**: DOCUMENTED  
**Date**: 2026-07-13  

---

## Overview

The PAIOS Knowledge Layer uses a **0–100 relevance scoring system** to rank articles by quality and applicability to QA practice. Scores are assigned during the M3 pipeline and used to filter and prioritize articles for export to qa-news/latest.json.

**Key principle**: Articles with score >= 50 represent *actionable knowledge* for QA practitioners.

---

## Score Range & Interpretation

### Complete Score Spectrum

| Score Range | Category | Meaning | Action |
|---|---|---|---|
| **0–20** | Low relevance | Off-topic, noise, not applicable to QA | Archive only (exclude from export) |
| **21–50** | Moderate relevance | Tangential context, educational but not immediately actionable | Archive + optional export (low priority) |
| **51–79** | High relevance | Directly applicable, actionable for QA teams | Primary export target (main feed) |
| **80–100** | Critical relevance | Must-read, high impact, addresses active pain points | Priority alert (featured/promoted) |

### Export Filtering

**Current implementation** (export-latest-news.json, line 30):
```sql
SELECT * FROM canonical_articles 
WHERE (jsonData->>'score')::INTEGER >= 50 
ORDER BY publishedAt DESC 
LIMIT 100
```

**Implication**: 
- Articles with score 0–49: **excluded** from latest.json
- Articles with score 50–100: **included** in latest.json
- No within-export ranking by score (ordered by publishedAt instead)

**Future enhancement**: Secondary sort by score within export (most relevant first)

---

## Score Ranges in Detail

### 0–20: Low Relevance (Archive Only)

**Definition**: Off-topic articles that don't apply to PAIOS knowledge areas.

**Examples**:
- "How to Deploy Your Website on WordPress" (not QA-focused)
- "Best Coffee Machines for Office" (general lifestyle)
- "Market Analysis: Tech Stocks" (not technical practice)
- "Cloud Provider Pricing Comparison" (too generic, no QA angle)

**Why exclude from export**: Clutters feed with noise; readers expect QA-relevant content.

**Handling**:
- Inserted into canonical_articles (for record-keeping)
- Excluded from export
- May be surfaced in future "archived knowledge" feature
- Useful for trending analysis (e.g., "why are 40% of ingested articles off-topic?")

**Example Record**:
```json
{
  "id": "article-001",
  "title": "How to Deploy Your Website on WordPress",
  "score": 15,
  "category": "other",
  "source": "Medium",
  "status": "archived_only"
}
```

---

### 21–50: Moderate Relevance (Optional Export)

**Definition**: Tangential or educational content; useful context but not immediately actionable.

**Examples**:
- "The History of Software Testing" (educational, not actionable)
- "Introduction to DevOps for Beginners" (tangential, assumes no QA context)
- "What is Agile?" (foundational, not specialized to QA)
- "General Guide to Problem-Solving" (applies broadly, no QA specificity)

**Why low priority**: Readers come for specific, actionable knowledge. General articles are useful only when deeply specialized.

**Handling**:
- Inserted into canonical_articles
- **Currently excluded** from export (score < 50 filter)
- Could be exported in separate "educational" or "foundations" feed (future)
- Useful for onboarding/learning paths

**Future approach**: 
- Create separate "learning-path" export for scores 21–50
- Tag articles as "educational" vs "operational"
- Allow users to subscribe to educational feed separately

**Example Record**:
```json
{
  "id": "article-002",
  "title": "The History of Software Testing",
  "score": 35,
  "category": "qa-practice",
  "source": "Blog",
  "tags": "educational,history"
}
```

---

### 51–79: High Relevance (Primary Export)

**Definition**: Directly applicable, actionable articles addressing current QA practice.

**Examples** (score 51–79):
- "Reducing Test Flakiness in Cypress" — score 72
  - Specific problem (test flakiness)
  - Specific tool (Cypress)
  - Actionable solutions
  
- "AI-Powered Test Case Generation" — score 68
  - Emerging technique relevant to QA
  - Practical guidance on implementation
  - Addresses pain point (test coverage)
  
- "Database Testing Best Practices in PostgreSQL" — score 75
  - Specific tech stack
  - Best practices with clear guidance
  - Operational value
  
- "Continuous Integration Pipeline Optimization" — score 65
  - DevOps + QA intersection
  - Improves testing throughput
  - Measurable business impact

**Why primary target**: These articles directly improve QA workflows and solve real problems.

**Handling**:
- Inserted into canonical_articles
- **Included** in export (score >= 50)
- Sorted by publishedAt (newest first)
- This is the core of latest.json

**Expected distribution**: In a healthy Knowledge Layer, ~70–80% of exported articles should be in this range.

**Example Record**:
```json
{
  "id": "article-003",
  "title": "Reducing Test Flakiness in Cypress",
  "score": 72,
  "category": "test-automation",
  "source": "Dev.to",
  "seenCount": 2,
  "tags": "cypress,testing,flakiness"
}
```

---

### 80–100: Critical Relevance (Priority Alert)

**Definition**: Must-read articles; addresses urgent pain points or introduces paradigm-shifting techniques.

**Examples** (score 80–100):
- "New TypeScript 5.2 Features for Type Safety" — score 88
  - Major language release
  - Direct impact on testing code quality
  - Time-sensitive (best to learn early)
  
- "Resolving Critical Performance Bottleneck in CI/CD" — score 92
  - Directly solves active team problem
  - High business impact
  - Rare, valuable knowledge
  
- "GitHub Actions vs. n8n for QA Automation" — score 85
  - Strategic comparison
  - Affects team tool selection
  - Informs infrastructure decisions
  
- "Breakthrough: AI for Auto-Generated Test Cases" — score 95
  - Paradigm shift
  - Cutting-edge technique
  - Potential major impact on efficiency

**Why priority alert**: These articles warrant immediate attention; delaying read could mean opportunity loss or missing critical updates.

**Handling**:
- Inserted into canonical_articles
- **Included** in export (score >= 50)
- **Future enhancement**: flag for priority/featured display
- Could trigger Slack/email alert to team

**Expected distribution**: In a healthy Knowledge Layer, ~5–10% of exported articles should be score 80+.

**Example Record**:
```json
{
  "id": "article-004",
  "title": "GitHub Actions vs. n8n for QA Automation",
  "score": 85,
  "category": "tooling",
  "source": "GitHub Blog",
  "seenCount": 3,
  "tags": "github-actions,automation,infrastructure,comparison"
}
```

---

## How Articles Are Scored (M3 Pipeline)

### Scoring Heuristics

The M3 pipeline assigns scores based on multiple signals:

**1. Keyword Matching** (primary signal)
- Strong keywords: "test", "automation", "QA", "CI/CD" → +15–25 points
- Medium keywords: "performance", "deployment", "monitoring" → +8–15 points
- Weak keywords: "development", "architecture", "tool" → +5–8 points
- Presence of multiple keywords → multiplicative boost

**2. Source Weight** (source reputation)
- High-trust sources (GitHub Official, TypeScript Blog): +10 points
- Medium-trust sources (Dev.to, Medium, Official Blogs): +5 points
- Community sources (Reddit, HackerNews): +0 to +5 points
- Low-trust sources (generic blogs, noisy feeds): -5 points

**3. Freshness Boost** (publication date)
- Published today: +5 points
- Published this week: +3 points
- Published this month: +1 point
- Older: +0 points

**4. Cross-Source Signal** (seenCount)
- seenCount = 1: +0 points (first appearance)
- seenCount = 2: +5 points (appeared in 2 sources)
- seenCount >= 3: +10 points (high cross-platform relevance)

**5. Content Quality Signals** (estimated)
- Article length > 1000 words: +3 points (substantial)
- Has structured examples/code: +5 points
- Has author credibility indicators: +3 points

### Scoring Algorithm (Pseudocode)

```javascript
function scoreArticle(article) {
  let score = 50; // baseline
  
  // 1. Keyword matching
  const keywords = {
    'test': 25, 'testing': 25, 'automation': 25, 'qa': 20, 'ci/cd': 25,
    'performance': 10, 'deployment': 8, 'monitoring': 8,
    'tool': 5, 'framework': 5, 'library': 3
  };
  
  const textToSearch = `${article.title} ${article.content}`.toLowerCase();
  let keywordScore = 0;
  for (const [keyword, points] of Object.entries(keywords)) {
    if (textToSearch.includes(keyword)) {
      keywordScore += points;
    }
  }
  score += Math.min(keywordScore, 40); // cap keyword bonus at +40
  
  // 2. Source weight
  const sourceWeights = {
    'GitHub': 10,
    'TypeScript': 10,
    'Dev.to': 5,
    'Medium': 5,
    'Reddit': 2
  };
  score += sourceWeights[article.source] || 0;
  
  // 3. Freshness (bonus for recent articles)
  const daysSincePublish = Math.floor((Date.now() - article.publishedAt) / (1000 * 60 * 60 * 24));
  if (daysSincePublish === 0) score += 5;
  else if (daysSincePublish <= 7) score += 3;
  else if (daysSincePublish <= 30) score += 1;
  
  // 4. Content quality indicators
  if (article.content.length > 1000) score += 3;
  if (article.content.includes('code') || article.content.includes('```')) score += 5;
  
  // Clamp to 0-100 range
  return Math.max(0, Math.min(100, score));
}
```

### Example Scoring Breakdown

**Article**: "Reducing Test Flakiness in Cypress: A Comprehensive Guide"

```
Base score:                           50
+ Keywords (test, flakiness, guide):  +22
+ Source (Dev.to):                    +5
+ Freshness (published 2 days ago):   +3
+ Content length (>1000 words):       +3
+ Code examples (test code snippets): +5
───────────────────────────────────────
Final score:                          88
```

Wait, that's 88—let me recalculate:
- Base: 50
- Keywords: test(25) + flakiness (not in list, but related to testing) = let's say +20
- Source: +5
- Freshness: +3
- Content: +3
- Code: +5
- Total: 50+20+5+3+3+5 = 86

Actually, with seenCount=2 (appeared in Cypress blog + Dev.to): +5
- Total: 86+5 = 91 (but cap at 100, so 91)

**Interpretation**: Highly relevant, directly applicable, multi-source validation → definitely include in export as priority article.

---

## seenCount Impact on Scoring

### Current Approach

**seenCount**: Used to detect duplicates; not currently used in score calculation.

**Effect**: Two identical articles with seenCount=1 and seenCount=3 have the same score.

**Implication**: Duplication signal is separate from relevance signal.

### Future Enhancement: Relevance Boosting

**Proposed**: Boost score based on seenCount to reflect cross-platform validation.

**Formula**:
```
adjusted_score = min(100, original_score + (seenCount - 1) * 5)
```

**Example**:
```
Article "Cypress Testing Best Practices"
  Original score:    72
  seenCount:         1 (first appearance)
  Adjusted score:    72 (unchanged)
  
Day 2: Same article found in another source
  Original score:    72
  seenCount:         2 (incremented)
  Adjusted score:    77 (72 + (2-1)*5)
  
Day 3: Third source has article
  Original score:    72
  seenCount:         3
  Adjusted score:    82 (72 + (3-1)*5)
```

**Benefit**: Articles appearing across multiple sources naturally rise in export ranking, reflecting their importance.

---

## Score Distribution & Health Metrics

### Target Distribution (in canonical_articles)

For a healthy Knowledge Layer, expected score distribution:

| Score Range | % of Total | Action |
|---|---|---|
| 0–20 | 5–10% | Noise; normal |
| 21–50 | 10–20% | Learning material; acceptable |
| 51–79 | **60–75%** | **Core exported content** |
| 80–100 | **5–10%** | **Priority articles** |

### Health Indicators

**Check**: Weekly distribution query

```sql
SELECT
  CASE
    WHEN score <= 20 THEN 'Low (0-20)'
    WHEN score <= 50 THEN 'Moderate (21-50)'
    WHEN score <= 79 THEN 'High (51-79)'
    ELSE 'Critical (80+)'
  END as score_range,
  COUNT(*) as article_count,
  ROUND(COUNT(*)::float / (SELECT COUNT(*) FROM canonical_articles WHERE addedAt > now() - interval '7 days') * 100, 2) as percentage
FROM canonical_articles
WHERE addedAt > now() - interval '7 days'
GROUP BY score_range
ORDER BY score_range;
```

**Expected output**:
```
score_range        | article_count | percentage
──────────────────────────────────────────────
Low (0-20)         |      42       |    6.5%
Moderate (21-50)   |     105       |   16.3%
High (51-79)       |     455       |   70.6%
Critical (80+)     |      47       |    7.3%
```

### Warning Signs

- **Too many low-score articles** (>20% score 0–20)
  - Possible cause: Sources are noisy or keyword matching is broken
  - Action: Review source feeds, adjust keyword weights

- **Not enough high-score articles** (<50% score 51–79)
  - Possible cause: Scoring algorithm too conservative
  - Action: Adjust scoring thresholds, add new keywords

- **Too many critical articles** (>15% score 80+)
  - Possible cause: Scoring algorithm too generous
  - Action: Tighten keyword requirements, increase base thresholds

---

## Threshold Rationale: Score >= 50

### Why 50, Not 70 or 80?

| Threshold | Pros | Cons |
|---|---|---|
| **>= 50** (Current) | Includes more learning material; broader knowledge base; balances quantity and quality | Less curated; some moderate-quality articles |
| **>= 60** | More curated; higher average quality | Fewer articles; may miss good tips; excludes some operational guidance |
| **>= 70** | Highly curated; only best-in-class | Very few articles; may not have daily updates; misses important but narrowly-applicable content |
| **>= 80** | Extreme curation; only critical content | Too restrictive; users will supplement with external sources anyway |

**Decision rationale for >= 50**:
- Includes both "high relevance (51–79)" and "critical (80+)" articles
- Excludes "moderate (21–50)" and "low (0–20)" articles
- Assumes QA practitioners want *actionable* knowledge, not general education
- Score 50 = "actionable for most QA teams"
- Score <50 = "nice to know, but not immediately useful"

### Filter Behavior in Export

**Implementation** (export-latest-news.json):
```sql
SELECT * FROM canonical_articles
WHERE score >= 50
ORDER BY publishedAt DESC
LIMIT 100
```

**Implication**:
- Articles 0–49: silently excluded (no warning)
- Articles 50–100: included in latest.json
- No export of "learning feed" (future enhancement)

---

## Adjusting Score Thresholds

### If too many articles in export (>50 articles/day)

**Problem**: Over-delivering content; users overwhelmed

**Solutions** (in priority order):
1. Increase threshold: Change `WHERE score >= 50` to `WHERE score >= 60`
   - Effect: exclude 51–59 range (moderate-high)
   - Expected result: 20–30% reduction in articles
   - Risk: miss some valuable content

2. Adjust M3 scoring algorithm: Reduce baseline or keyword bonuses
   - Effect: lower scores across the board
   - Expected result: fewer articles cross threshold naturally
   - More sustainable long-term

3. Reduce LIMIT: Change `LIMIT 100` to `LIMIT 50`
   - Effect: cap articles exported
   - Risk: arbitrary cutoff; latest/best articles arbitrarily excluded

### If too few articles in export (<10 articles/week)

**Problem**: Sparse feed; no daily content

**Solutions** (in priority order):
1. Lower threshold: Change `WHERE score >= 50` to `WHERE score >= 40`
   - Effect: include 40–49 range (learning material)
   - Risk: feed becomes less focused on actionable content

2. Add educational feed: Export score 21–49 separately
   - Effect: keep main feed strict, offer learning feed for students
   - Better UX; separate concerns

3. Adjust M3 scoring algorithm: Increase baseline or keyword bonuses
   - Effect: higher scores across the board
   - Expected result: more articles cross threshold
   - More sustainable

---

## Quality Assurance & Score Validation

### Manual Spot-Check Process

**Weekly (every Monday)**:

1. **Random sample**: Select 10 articles at random from latest.json
2. **Read each article**: Verify content matches score
   - Score 51–79: Is it directly actionable?
   - Score 80+: Is it critical/high-impact?
3. **Rate independently**: Score 0–100 based on subjective assessment
4. **Compare**: Calculate difference between algorithmic score and manual score
5. **Adjust if needed**: If average difference > 15 points, review scoring algorithm

### Scoring Algorithm Tuning (Quarterly)

**Q3 Review (every 3 months)**:

1. Collect last 90 days of articles
2. Sample 50 articles across all score ranges
3. Calculate distribution (0–20, 21–50, 51–79, 80+)
4. Interview team: "Did score >= 50 filter work?"
5. Adjust thresholds/weights based on feedback

---

## Summary Table

| Aspect | Details |
|---|---|
| **Score Range** | 0–100 (0=low relevance, 100=critical) |
| **Export Threshold** | >= 50 (includes 51–79 and 80+ ranges) |
| **Primary Range** | 51–79 (actionable, directly applicable) |
| **Priority Range** | 80–100 (must-read, high-impact) |
| **Archive Only** | 0–50 (noise, learning material, moderate relevance) |
| **Scoring Signals** | Keywords (primary), source weight, freshness, seenCount, content quality |
| **Export Limit** | 100 articles (LIMIT clause) |
| **Sort Order** | By publishedAt DESC (newest first) |
| **Target Distribution** | 70% high (51–79), 7% critical (80+), 23% archive (0–50) |

---

## Version History

- **v1.0** (2026-07-13): Initial scoring strategy documentation
  - 0–100 score range with interpretations
  - Export threshold >= 50 rationale
  - Score heuristics and algorithm
  - seenCount impact (current and future)
  - Health metrics and distribution targets
  - Threshold adjustment guidance
  - QA/validation processes

