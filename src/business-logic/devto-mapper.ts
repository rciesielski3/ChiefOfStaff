import { RawArticle } from './rss-fetch';
import { APIClient } from '../utils/api-client';

/**
 * Dev.to API article response
 */
interface DevToArticle {
  id: number;
  title: string;
  description?: string;
  url: string;
  published_at: string;
  body_markdown?: string;
}

/**
 * Fetch and parse Dev.to articles
 *
 * Algorithm:
 * 1. Query Dev.to API for top articles by week from QA/testing categories
 * 2. Filter by tags: testing, automation, qa, devops, performance
 * 3. Limit to top 20
 * 4. Map to RawArticle format
 *
 * @param client - API client instance
 * @param limit - Maximum number of articles to return (default: 20)
 * @returns Array of normalized raw articles
 */
export async function mapDevToArticles(
  client: APIClient,
  limit: number = 20
): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];

  try {
    // Dev.to API endpoint with tag filters
    const query = 'tag_list=testing,automation,qa,devops,performance';
    const devToUrl = `https://dev.to/api/articles?${query}&per_page=${limit}&sort_by=top&top=week`;

    const response = await client.get<DevToArticle[]>(devToUrl);

    // Map articles to RawArticles
    for (const article of response) {
      if (!article.title || !article.url) {
        continue;
      }

      // Extract summary from description or body
      let content = article.description || '';
      if (!content && article.body_markdown) {
        content = article.body_markdown.slice(0, 200);
      }

      const rawArticle: RawArticle = {
        link: article.url,
        title: article.title,
        pubDate: article.published_at,
        content: content,
        source: 'Dev.to'
      };

      articles.push(rawArticle);
    }

    return articles.slice(0, limit);
  } catch (error) {
    console.error('Failed to fetch Dev.to articles:', error);
    return []; // Graceful degradation: return empty array on API failure
  }
}
