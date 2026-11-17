import { Article, withResolvedId } from './normalize-article';
import { ArticleStore, RETENTION_DAYS } from './article-store';
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
 * Identity of a story: source plus URL without fragment and `utm_*` tracking
 * parameters. InfoQ posts one story twice with different tracking parameters
 * or title case, and the store can hold one URL under an old and a new ID.
 * Keying on the URL (not the title) keeps different stories that share a
 * recurring title, and different projects' "v1.8.3" releases, apart.
 */
function storyKey(article: Article): string {
  let url = String(article.url ?? '');
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    for (const param of [...parsed.searchParams.keys()]) {
      if (param.toLowerCase().startsWith('utm_')) parsed.searchParams.delete(param);
    }
    url = parsed.toString();
  } catch {
    // Not an absolute URL: compare it as written.
  }
  return `${article.source}\u0000${url}`;
}

/**
 * Keep one article per story (see storyKey). Expects newest-first input and
 * keeps the first (newest) article of each story.
 */
function dropRepeatedStories(articles: Article[]): Article[] {
  const seen = new Set<string>();
  return articles.filter(article => {
    const key = storyKey(article);
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
 * 3. Drop articles older than RETENTION_DAYS and repeated stories (same
 *    source + URL), keeping the newest
 * 4. Keep the newest `limit` articles; without a limit keep all of them
 * 5. Return with metadata (export date/time)
 *
 * QA-News derives its today / week / month views from this one export, so
 * the default is the whole retention window. Retention is applied here too:
 * the store only prunes when the daily brief writes, so after missed runs it
 * can still hold older articles.
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

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const recent = sorted.filter(article => new Date(article.publishedAt).getTime() >= cutoff);
  const unique = dropRepeatedStories(recent);
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
