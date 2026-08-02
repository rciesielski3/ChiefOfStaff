import { RawArticle } from './rss-fetch';
import { APIClient } from '../utils/api-client';
import { GitHubSearchResponse } from './github-api-types';

/**
 * Keywords to filter GitHub AI repos by relevance to testing/validation
 */
const RELEVANT_KEYWORDS = [
  'test',
  'quality',
  'validation',
  'eval',
  'evaluation',
  'benchmark',
  'assess',
  'verify'
];

/**
 * Fetch and parse GitHub AI/ML repositories
 *
 * Algorithm:
 * 1. Query GitHub Search API for repos with AI/ML topics
 * 2. Filter by relevance keywords related to testing/validation
 * 3. Limit to top 20 by stars
 * 4. Map to RawArticle format
 *
 * @param client - API client instance
 * @param limit - Maximum number of repos to return (default: 20)
 * @returns Array of normalized raw articles
 */
export async function mapGitHubAIArticles(
  client: APIClient,
  limit: number = 20
): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];

  try {
    // GitHub Search API query for AI-related repos
    const query = 'topic:ai OR topic:machine-learning OR topic:llm sort:stars order:desc';
    const searchUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${limit}`;

    const response = await client.get<GitHubSearchResponse>(searchUrl);

    // Map repositories to RawArticles
    for (const repo of response.items) {
      // Filter by relevance keywords in description (testing/quality related)
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
        title: `${repo.full_name} - AI Project`,
        pubDate: repo.created_at,
        content: repo.description || '',
        source: 'GitHub AI Projects'
      };

      articles.push(article);
    }

    return articles.slice(0, limit);
  } catch (error) {
    console.error('Failed to fetch GitHub AI articles:', error);
    return []; // Graceful degradation: return empty array on API failure
  }
}
