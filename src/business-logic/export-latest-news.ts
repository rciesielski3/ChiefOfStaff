import { Article, withResolvedId } from './normalize-article';
import { ArticleStore } from './article-store';
import { promises as fs } from 'fs';
import { dirname } from 'path';

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
 * Keep one article per story. Some feeds publish the same story twice (InfoQ
 * with a different tracking URL or title case), and the store can hold the
 * same URL under an old and a new ID. A story is identified by its source
 * plus its title, trimmed and lowercased; the source keeps different
 * projects' releases with the same version title ("v1.8.3") apart.
 * Expects newest-first input and keeps the first (newest) of each story.
 */
function dropRepeatedStories(articles: Article[]): Article[] {
  const seen = new Set<string>();
  return articles.filter(article => {
    const key = `${article.source}\u0000${article.title.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Export latest articles from store as JSON for QA News
 *
 * Algorithm:
 * 1. Read all articles from store
 * 2. Sort by publishedAt (newest first)
 * 3. Drop repeated stories (same source + title), keeping the newest
 * 4. Keep the newest `limit` articles; without a limit keep all of them
 * 5. Return with metadata (export date/time)
 *
 * QA-News derives its today / week / month views from this one export, so
 * the default is the whole store (the store keeps 30 days, RETENTION_DAYS).
 *
 * @param store - Article store to read from
 * @param limit - Maximum number of articles to export (default: all)
 * @returns Export object with metadata and articles
 */
export async function exportLatestNews(
  store: ArticleStore,
  limit?: number
): Promise<LatestNewsExport> {
  // Read all articles from store
  const articles = await store.read();

  // Sort by publishedAt descending (newest first)
  const sorted = articles.sort((a, b) => {
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  const unique = dropRepeatedStories(sorted);
  const latest = limit === undefined ? unique : unique.slice(0, limit);

  // Generate export metadata
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const updatedAt = now.toISOString(); // Full ISO timestamp

  return {
    date,
    updatedAt,
    items: latest.map(withResolvedId)
  };
}

/**
 * Transform export format to public format
 *
 * The export format uses 'items' key for internal consistency,
 * but the qa-news app expects 'articles' key.
 * This transformer performs a simple rename with no data loss.
 *
 * @param exportData - Export with items array
 * @returns Public format with articles array (same Article objects)
 */
export function transformToPublicFormat(
  exportData: LatestNewsExport
): { date: string; updatedAt: string; articles: Article[] } {
  return {
    date: exportData.date,
    updatedAt: exportData.updatedAt,
    articles: exportData.items
  };
}

/**
 * Write export to public directory for GitHub Pages deployment
 *
 * The qa-news app reads from public/latest.json for the deployed site.
 * This function ensures fresh data reaches the deployed site via GitHub Pages.
 *
 * @param filePath - Destination path (e.g., 'qa-news/public/latest.json')
 * @param exportData - Export data to write
 */
export async function writePublicLatestNews(
  filePath: string,
  exportData: LatestNewsExport
): Promise<void> {
  // Transform to public format
  const publicData = transformToPublicFormat(exportData);

  // Ensure directory exists
  const dir = dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  // Write JSON
  await fs.writeFile(filePath, JSON.stringify(publicData, null, 2));
}
