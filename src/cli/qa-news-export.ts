import { fetchRSS } from '../business-logic/rss-fetch';
import { normalizeArticle } from '../business-logic/normalize-article';
import { Article } from '../business-logic/normalize-article';
import { exportQANews } from '../business-logic/export-qa-news';
import { QA_NEWS_FEEDS } from './qa-news-feeds';

/**
 * Generate QA-News article export
 *
 * Algorithm:
 * 1. Fetch articles from all QA-specific RSS feeds
 * 2. Normalize to Article schema
 * 3. Categorize for QA News
 * 4. Export top 50 as QA-News JSON
 * 5. Return as string (ready to write to file)
 *
 * @returns JSON string of QA-News export
 */
export async function generateQANewsExport(): Promise<string> {
  console.log(`Fetching ${QA_NEWS_FEEDS.length} QA News feeds...`);

  const allArticles: Article[] = [];

  for (const feed of QA_NEWS_FEEDS) {
    try {
      console.log(`  Fetching ${feed.name}...`);
      const rawArticles = await fetchRSS(feed.url, feed.name);

      const normalized = rawArticles.map(raw => normalizeArticle(raw));

      allArticles.push(...normalized);
    } catch (error) {
      console.warn(`  Failed to fetch ${feed.name}: ${(error as Error).message}`);
      // Continue with other feeds
    }
  }

  console.log(`Fetched ${allArticles.length} total articles`);

  const export_ = exportQANews(allArticles, 50);
  return JSON.stringify(export_, null, 2);
}

// Main entry point for CLI
if (require.main === module) {
  generateQANewsExport()
    .then(json => {
      console.log(json);
    })
    .catch(error => {
      console.error('Failed to generate QA News export:', error);
      process.exit(1);
    });
}
