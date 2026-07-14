import { Article } from './normalize-article';
import { ArticleStore } from './article-store';

/**
 * Export format for latest news articles
 *
 * Contains:
 * - date: ISO date (YYYY-MM-DD) when export was generated
 * - updatedAt: Full ISO timestamp of export
 * - items: Top N articles sorted by publish date (newest first)
 */
export interface LatestNewsExport {
  date: string;
  updatedAt: string;
  items: Article[];
}

/**
 * Export latest articles from store as JSON for QA News
 *
 * Algorithm:
 * 1. Read all articles from store
 * 2. Sort by publishedAt (newest first)
 * 3. Slice to top N articles (default 50)
 * 4. Return with metadata (export date/time)
 *
 * @param store - Article store to read from
 * @param limit - Number of articles to export (default: 50)
 * @returns Export object with metadata and articles
 */
export async function exportLatestNews(
  store: ArticleStore,
  limit: number = 50
): Promise<LatestNewsExport> {
  // Read all articles from store
  const articles = await store.read();

  // Sort by publishedAt descending (newest first)
  const sorted = articles.sort((a, b) => {
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  // Take top N articles
  const latest = sorted.slice(0, limit);

  // Generate export metadata
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const updatedAt = now.toISOString(); // Full ISO timestamp

  return {
    date,
    updatedAt,
    items: latest
  };
}
