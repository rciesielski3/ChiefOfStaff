import { Article } from './normalize-article';
import { categorizeForQANews } from './categorize-article';

/**
 * Article format for QA News
 * Maps from ChiefofStaff Article to QA-News display format
 */
export interface QANewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: string; // Primary category (first from categorizeForQANews)
  publishedAt: string;
  tags: string[];
}

/**
 * Export envelope for QA News
 */
export interface QANewsExport {
  articles: QANewsArticle[];
}

/**
 * Convert ChiefofStaff Article to QA-News format
 *
 * Algorithm:
 * 1. Categorize article using QA-specific rules
 * 2. Use first category as primary (for display)
 * 3. Extract summary from article content or use fallback
 * 4. Return in QA-News JSON schema
 *
 * @param article - Article from ChiefofStaff
 * @returns QA-News formatted article
 */
export function articleToQANews(article: Article): QANewsArticle {
  const categories = categorizeForQANews(article);
  const primaryCategory = categories[0] || 'engineering';

  return {
    id: article.id,
    title: article.title,
    summary: article.summary,
    url: article.url,
    source: article.source,
    category: primaryCategory,
    publishedAt: article.publishedAt,
    tags: article.tags || []
  };
}

/**
 * Export top N articles in QA-News format
 *
 * Algorithm:
 * 1. Filter articles: only keep those with valid URLs (not example.com)
 * 2. Sort by publishedAt descending (newest first)
 * 3. Convert to QA-News format
 * 4. Take top N (default 50)
 *
 * @param articles - All articles from ChiefofStaff store
 * @param limit - Number of articles to export (default: 50)
 * @returns QA-News export envelope
 */
export function exportQANews(articles: Article[], limit: number = 50): QANewsExport {
  const validArticles = articles.filter(a => {
    // Filter out placeholder URLs
    return !a.url.includes('example.com') && a.url.startsWith('http');
  });

  const sorted = validArticles.sort((a, b) => {
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  const latest = sorted.slice(0, limit);

  return {
    articles: latest.map(articleToQANews)
  };
}
