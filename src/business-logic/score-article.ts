import { Article } from './normalize-article';

/**
 * Scoring configuration - mirrors Config Tech n8n workflow
 */
export interface ScoringConfig {
  weights: {
    base: number;
    keywords: Record<string, number>;
    sources: Record<string, number>;
  };
  priority: {
    critical: number;
    high: number;
    medium: number;
  };
}

/**
 * Default scoring configuration
 */
export const DEFAULT_CONFIG: ScoringConfig = {
  weights: {
    base: 50,
    keywords: {
      // QA/Testing (HIGH WEIGHT - Primary mission)
      'test automation': 50,
      'qa engineering': 45,
      'testing strategy': 40,
      'e2e testing': 35,
      'unit testing': 30,
      'integration testing': 30,
      'test framework': 30,
      'automated testing': 35,
      'testing best practices': 35,
      'continuous testing': 30,
      'testing tools': 25,
      'test coverage': 25,
      testing: 25,
      automation: 25,
      qa: 20,

      // Performance/Security Testing
      'performance testing': 30,
      'load testing': 28,
      'security testing': 32,
      'penetration testing': 30,

      // Existing (keep)
      breaking: 35,
      security: 30, // lowered from 40: the CVE stream saturated top picks
      migration: 25,
      playwright: 20,
      typescript: 15,
      mcp: 25,
      agent: 20,
      'ci/cd': 15,
      release: 20,

      // Engineering practice (site scope: QA + AI + engineering).
      // Substring-matched: avoid bare 'eval' ('retrieval') and bare 'ai'.
      'code review': 20,
      observability: 20,
      reliab: 20, // stem: reliable / reliably / reliability
      incident: 20,
      refactoring: 20,
      'developer experience': 20,
      architecture: 15,
      'software engineering': 15,
      tdd: 20,

      // AI engineering
      'ai testing': 40,
      flaky: 30,
      evals: 25,
      llm: 20,
    },
    // Source weights are a small prior about source quality, NOT a ranking driver:
    // every value stays well below the strongest keyword weight (a third at most),
    // so keyword relevance decides. Keys are substring-matched against the article
    // source (case-insensitive). Sources without a key get no bonus.
    sources: {
      // Official project / editorial QA voices
      'Google Testing': 10,
      'Martin Fowler': 10,
      Cypress: 10,
      Playwright: 10,
      // High signal, but ~44% of the corpus: volume already supplies candidates,
      // so the prior is deliberately the smallest.
      'Ministry of Testing': 5,
    },
  },
  priority: {
    critical: 90,
    high: 70,
    medium: 45,
  },
};

export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Result of scoring an article
 */
export interface ScoredArticle extends Article {
  score: number;
  priority: Priority;
  reason: string[];
}

/**
 * Score an article based on keywords, content, source, and freshness
 *
 * Algorithm:
 * 1. Start with base score (50)
 * 2. Add keyword weights if found in title/summary
 * 3. Add source weight based on source name
 * 4. Apply freshness bonus: articles under 24h old get up to +4 points
 *    (ceil((24 - ageHours) / 6)); older articles get none
 * 5. Classify priority based on score thresholds
 * 6. Track scoring reasons for transparency
 *
 * @param article - Article to score
 * @param config - Scoring configuration (defaults to DEFAULT_CONFIG)
 * @returns Scored article with score, priority, and reason
 */
export function scoreArticle(
  article: Article,
  config: ScoringConfig = DEFAULT_CONFIG,
): ScoredArticle {
  let score = config.weights.base;
  const reason: string[] = [];

  // Combine title and summary for keyword matching
  const text = `${article.title} ${article.summary}`.toLowerCase();

  // Match keywords and add weights
  for (const [keyword, weight] of Object.entries(config.weights.keywords)) {
    if (text.includes(keyword)) {
      score += weight;
      reason.push(keyword);
    }
  }

  // Match source name and add weight.
  // Both the article source and the configured keys are normalised (lowercase +
  // trim). Matching stays SUBSTRING-based on purpose: keys like 'Google Testing'
  // must match the real source 'Google Testing Blog', and existing tests/config
  // rely on 'openai' matching 'OpenAI Blog'. Exact matching would break both.
  const normalizedSource = article.source.toLowerCase().trim();
  for (const [sourceName, weight] of Object.entries(config.weights.sources)) {
    const key = sourceName.toLowerCase().trim();
    if (key && normalizedSource.includes(key)) {
      score += weight;
      if (!reason.includes(sourceName)) {
        reason.push(sourceName);
      }
    }
  }

  // Freshness bonus: articles from last 24 hours get extra points
  const publishDate = new Date(article.publishedAt).getTime();
  const now = new Date().getTime();
  const ageMs = now - publishDate;
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours < 24) {
    const freshnessBonus = Math.ceil((24 - ageHours) / 6); // Max 4 points
    score += freshnessBonus;
    if (freshnessBonus > 0) {
      reason.push('recent');
    }
  }

  // Classify priority
  const priority: Priority =
    score >= config.priority.critical
      ? 'CRITICAL'
      : score >= config.priority.high
        ? 'HIGH'
        : score >= config.priority.medium
          ? 'MEDIUM'
          : 'LOW';

  // Deduplicate reasons
  const uniqueReasons = [...new Set(reason)];

  return {
    ...article,
    score,
    priority,
    reason: uniqueReasons,
  };
}

/**
 * Filter out non-QA articles using negative keywords
 *
 * Filters out articles about hardware/networking topics UNLESS they're explicitly
 * about QA/testing methodologies. Uses a QA keyword whitelist to determine context:
 * - memory/gpu/cpu/processor are "soft": kept when AI/infra context words
 *   (agent, llm, inference, engineering...) are present
 * - If article mentions negative keywords (ecc, ddr5, hardware, etc) but has QA keywords
 *   (playwright, testing, automation, etc), it's kept (testing context)
 * - If article mentions negative keywords without QA keywords, it's filtered out
 *
 * Examples:
 * - "ECC Memory Performance" -> filtered (hardware topic)
 * - "Testing GPU for Performance QA" -> kept (QA context)
 * - "Residential Proxies Ban" -> filtered (networking topic)
 * - "Playwright stress testing" -> kept (has QA framework keyword)
 */
export function hasNegativeKeywords(article: Article): boolean {
  const text = `${article.title} ${article.summary}`.toLowerCase();

  const negativeKeywords = [
    'ecc',
    'ddr5',
    'hardware',
    'smart tv',
    'iot device',
    'proxies',
    'ipv6',
    'networking',
    'router',
    'firewall',
  ];

  // QA/Testing keywords that override negative keyword filtering
  // If article has both a negative keyword AND one of these QA keywords,
  // it's in a testing context and should NOT be filtered
  const qaKeywords = [
    'test automation',
    'qa engineering',
    'testing strategy',
    'e2e testing',
    'unit testing',
    'integration testing',
    'test framework',
    'automated testing',
    'testing best practices',
    'continuous testing',
    'testing tools',
    'test coverage',
    'performance testing',
    'load testing',
    'security testing',
    'penetration testing',
    'playwright',
    'cypress',
    'jest',
    'vitest',
    'qa',
    'automation',
  ];

  // Hardware terms that are ambiguous: also used by AI/infra engineering posts
  // ('agent memory', 'GPU inference'). They only filter when no AI/infra context
  // word is present. Unambiguous hardware/networking spam stays unconditional.
  const softNegativeKeywords = ['memory', 'gpu', 'cpu', 'processor'];
  const aiInfraContext = [
    'agent',
    'llm',
    'inference',
    'engineering',
    'architecture',
    'machine learning',
    'container',
    'kubernetes',
  ];
  if (
    softNegativeKeywords.some((k) => text.includes(k)) &&
    !aiInfraContext.some((c) => text.includes(c)) &&
    !qaKeywords.some((qa) => text.includes(qa))
  ) {
    return true;
  }

  for (const keyword of negativeKeywords) {
    if (text.includes(keyword)) {
      // Check if this is in a QA/testing context
      const hasQaKeyword = qaKeywords.some((qa) => text.includes(qa));
      if (!hasQaKeyword) {
        return true; // Has negative keyword with no QA context -> filter out
      }
    }
  }

  return false; // No negative keywords found, or has QA context
}

/**
 * Score multiple articles and sort by score (descending)
 *
 * @param articles - Articles to score
 * @param config - Scoring configuration
 * @returns Sorted scored articles
 */
export function scoreArticles(
  articles: Article[],
  config: ScoringConfig = DEFAULT_CONFIG,
): ScoredArticle[] {
  // Score all articles
  const scoredArticles = articles.map((article) => scoreArticle(article, config));

  // Filter out negative keyword articles (unless they have QA keywords too)
  const filtered = scoredArticles.filter((article) => !hasNegativeKeywords(article));

  // Sort by score descending
  return filtered.sort((a, b) => b.score - a.score);
}
