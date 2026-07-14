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
      'breaking': 35,
      'security': 40,
      'migration': 25,
      'playwright': 20,
      'typescript': 15,
      'mcp': 25,
      'agent': 20,
      'testing': 15,
      'automation': 15,
      'qa': 10,
      'ci/cd': 15,
      'performance': 15,
      'release': 20
    },
    sources: {
      'github-release': 35,
      'github-trending': 25,
      'hacker-news': 20,
      'ai-radar': 30,
      'devto': 15,
      'openai': 25,
      'google': 20,
      'cloudflare': 15,
      'github': 15,
      'playwright': 20,
      'lobsters': 18
    }
  },
  priority: {
    critical: 90,
    high: 70,
    medium: 45
  }
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
 * 4. Apply freshness bonus: newer articles get +5 per day (max 20)
 * 5. Classify priority based on score thresholds
 * 6. Track scoring reasons for transparency
 *
 * @param article - Article to score
 * @param config - Scoring configuration (defaults to DEFAULT_CONFIG)
 * @returns Scored article with score, priority, and reason
 */
export function scoreArticle(article: Article, config: ScoringConfig = DEFAULT_CONFIG): ScoredArticle {
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

  // Match source name and add weight
  const sourceUpper = article.source.toLowerCase();
  for (const [sourceName, weight] of Object.entries(config.weights.sources)) {
    if (sourceUpper.includes(sourceName)) {
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
    score >= config.priority.critical ? 'CRITICAL' :
    score >= config.priority.high ? 'HIGH' :
    score >= config.priority.medium ? 'MEDIUM' :
    'LOW';

  // Deduplicate reasons
  const uniqueReasons = [...new Set(reason)];

  return {
    ...article,
    score,
    priority,
    reason: uniqueReasons
  };
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
  config: ScoringConfig = DEFAULT_CONFIG
): ScoredArticle[] {
  return articles
    .map(article => scoreArticle(article, config))
    .sort((a, b) => b.score - a.score);
}
