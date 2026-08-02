import { RawArticle } from './rss-fetch';
import { SourceConfig } from '../sources/sources';
import { APIClient } from '../utils/api-client';
import { mapHackerNewsArticles } from './hacker-news-mapper';
import { mapGitHubTrendingArticles } from './github-trending-mapper';
import { mapDevToArticles } from './devto-mapper';
import { mapGitHubAIArticles } from './github-ai-mapper';

/**
 * Result of fetching from a single API source
 */
export interface APIFetchResult {
  source: string;
  success: boolean;
  count: number;
  error?: string;
}

/**
 * Aggregate result of fetching from all configured API sources
 */
export interface FetchAllAPIsResult {
  articles: RawArticle[];
  results: APIFetchResult[];
  successCount: number;
  failureCount: number;
}

/**
 * Fetch articles from all configured API sources, isolating per-source failures.
 *
 * Algorithm:
 * 1. For each enabled API config:
 *    - Create API client with configured timeout and retries
 *    - Call appropriate mapper (hacker-news, github-trending, devto, github-ai)
 *    - Catch errors and log
 *    - Track success/failure with article count
 * 2. Return combined articles + results summary
 * 3. Log summary with success/failure counts
 *
 * A single bad API never aborts the fetch of the other APIs.
 *
 * @param configs - API source configurations to fetch from
 * @returns Combined articles, per-source results, and success/failure counts
 */
export async function fetchAllAPIs(
  configs: SourceConfig[]
): Promise<FetchAllAPIsResult> {
  const articles: RawArticle[] = [];
  const results: APIFetchResult[] = [];

  for (const config of configs) {
    if (!config.enabled) {
      continue;
    }

    try {
      console.log(`[Daily Brief] Fetching from ${config.name}...`);

      // Create API client with source-specific settings
      const client = new APIClient(config.timeout, config.maxRetries);

      // Call appropriate mapper based on mapper field
      let sourceArticles: RawArticle[] = [];

      switch (config.mapper) {
        case 'hacker-news':
          sourceArticles = await mapHackerNewsArticles(client, 30);
          break;
        case 'github-trending':
          sourceArticles = await mapGitHubTrendingArticles(client, 20);
          break;
        case 'devto':
          sourceArticles = await mapDevToArticles(client, 20);
          break;
        case 'github-ai':
          sourceArticles = await mapGitHubAIArticles(client, 20);
          break;
        default:
          throw new Error(`Unknown API source type: ${config.mapper}`);
      }

      articles.push(...sourceArticles);

      results.push({
        source: config.name,
        success: true,
        count: sourceArticles.length
      });

      console.log(`[Daily Brief] ✅ ${config.name}: ${sourceArticles.length} articles`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      results.push({
        source: config.name,
        success: false,
        count: 0,
        error: message
      });

      console.warn(`[Daily Brief] ⚠️  Failed to fetch from ${config.name}: ${message}`);
      // Continue to next API instead of throwing
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  return { articles, results, successCount, failureCount };
}
