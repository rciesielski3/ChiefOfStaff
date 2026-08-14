import { Article } from './normalize-article';
import { ArticleStore } from './article-store';
import { promises as fs } from 'fs';
import { dirname } from 'path';

/**
 * Export format for daily brief
 *
 * Contains:
 * - date: ISO date (YYYY-MM-DD) when brief was generated
 * - updatedAt: Full ISO timestamp of export
 * - sourcesScanned: Number of RSS sources scanned
 * - storiesSelected: Number of top stories selected
 * - lede: Brief summary/lede of the day's highlights
 * - items: Top articles for the day
 */
export interface DailyBriefExport {
  date: string;
  updatedAt: string;
  sourcesScanned: number;
  storiesSelected: number;
  lede: string;
  items: Article[];
}

/**
 * Export daily brief articles from store as JSON for QA News
 *
 * Algorithm:
 * 1. Read all articles from store
 * 2. Filter articles from today
 * 3. Sort by score (descending)
 * 4. Slice to top N articles (default 10)
 * 5. Return with metadata
 *
 * @param store - Article store to read from
 * @param limit - Number of articles to export (default: 10)
 * @param sourceCount - Number of sources scanned (optional metadata)
 * @returns Export object with metadata and articles
 */
export async function exportDailyBrief(
  store: ArticleStore,
  limit: number = 10,
  sourceCount: number = 0
): Promise<DailyBriefExport> {
  // Read all articles from store
  const articles = await store.read();

  // Get today's date for filtering
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Filter articles from today (published today or after)
  const todaysArticles = articles.filter(article => {
    const pubDate = new Date(article.publishedAt);
    return pubDate >= today && pubDate < tomorrow;
  });

  // If no articles from today, use latest articles instead
  const articlesToUse = todaysArticles.length > 0 ? todaysArticles : articles;

  // Sort by score descending (highest score first)
  const sorted = articlesToUse.sort((a, b) => {
    const scoreA = a.score || 0;
    const scoreB = b.score || 0;
    return scoreB - scoreA;
  });

  // Take top N articles
  const topArticles = sorted.slice(0, limit);

  // Generate export metadata
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const updatedAt = now.toISOString(); // Full ISO timestamp

  // Generate a simple lede based on top article categories
  const categories = [...new Set(topArticles.map(a => a.category))];
  const lede = categories.length > 0
    ? `Daily brief highlighting ${categories.slice(0, 2).join(' and ')} topics`
    : 'Daily brief of top stories';

  return {
    date,
    updatedAt,
    sourcesScanned: sourceCount,
    storiesSelected: topArticles.length,
    lede,
    items: topArticles
  };
}

/**
 * Write export data to a JSON file
 *
 * @param data - Export data to write
 * @param filePath - Path to write JSON file
 */
export async function writeDailyBrief(
  data: DailyBriefExport,
  filePath: string
): Promise<void> {
  const dir = dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}
