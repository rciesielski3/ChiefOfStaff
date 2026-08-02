import { RawArticle } from './rss-fetch';
import { APIClient } from '../utils/api-client';
import { GitHubSearchResponse } from './github-api-types';

/**
 * Keywords to filter GitHub repos by relevance to QA/Testing
 */
const RELEVANT_KEYWORDS = [
  'test',
  'automation',
  'qa',
  'testing',
  'ci-cd',
  'quality',
  'ci/cd',
  'e2e',
  'performance',
  'validation',
  'release'
];

/**
 * Fetch and parse GitHub trending repositories
 *
 * Algorithm:
 * 1. Query GitHub Search API for repos created in past 7 days, sorted by stars
 * 2. Filter by relevance keywords in description
 * 3. Limit to top 20 by stars
 * 4. Map to RawArticle format
 *
 * Note: GitHub Search API has 30 req/min unauthenticated rate limit.
 *
 * @param client - API client instance
 * @param limit - Maximum number of repos to return (default: 20)
 * @returns Array of normalized raw articles
 */
export async function mapGitHubTrendingArticles(
  client: APIClient,
  limit: number = 20
): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];

  try {
    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const createdAfter = sevenDaysAgo.toISOString().split('T')[0];

    // GitHub Search API query for trending repos
    const query = `created:>=${createdAfter} sort:stars order:desc per_page=${limit}`;
    const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}`;

    const response = await client.get<GitHubSearchResponse>(searchUrl);

    // Map repositories to RawArticles
    for (const repo of response.items) {
      // Filter by relevance keywords in description
      if (!repo.description) {
        continue;
      }

      const descLower = repo.description.toLowerCase();
      const isRelevant = RELEVANT_KEYWORDS.some(keyword =>
        descLower.includes(keyword)
      );

      if (!isRelevant) {
        continue;
      }

      const article: RawArticle = {
        link: repo.html_url,
        title: `${repo.full_name} - ${repo.description}`,
        pubDate: repo.created_at,
        content: repo.description || '',
        source: 'GitHub Trending'
      };

      articles.push(article);
    }

    return articles.slice(0, limit);
  } catch (error) {
    console.error('Failed to fetch GitHub trending articles:', error);
    return []; // Graceful degradation: return empty array on API failure
  }
}
