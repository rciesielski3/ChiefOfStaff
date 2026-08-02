import { RawArticle } from './rss-fetch';
import { APIClient } from '../utils/api-client';

/**
 * Hacker News API response for a story item
 */
interface HackerNewsStory {
  id: number;
  title: string;
  url?: string;
  text?: string;
  time: number; // Unix timestamp
  type: string;
  by?: string;
  score?: number;
  descendants?: number;
}

/**
 * Keywords to filter Hacker News stories by relevance to QA/Testing
 */
const RELEVANT_KEYWORDS = [
  'test',
  'qa',
  'automation',
  'python',
  'javascript',
  'ai',
  'devops',
  'cypress',
  'playwright',
  'testing',
  'quality',
  'bug',
  'performance',
  'ci/cd',
  'github',
  'release'
];

/**
 * Fetch and parse Hacker News top stories
 *
 * Algorithm:
 * 1. Fetch top 30 story IDs from HN API
 * 2. For each ID, fetch story details
 * 3. Filter by relevance keywords
 * 4. Map to RawArticle format
 *
 * @param client - API client instance
 * @param limit - Maximum number of stories to fetch (default: 30)
 * @returns Array of normalized raw articles
 */
export async function mapHackerNewsArticles(
  client: APIClient,
  limit: number = 30
): Promise<RawArticle[]> {
  const articles: RawArticle[] = [];

  try {
    // Fetch top story IDs
    const topStoriesUrl = 'https://hacker-news.firebaseio.com/v0/topstories.json';
    const storyIds = await client.get<number[]>(topStoriesUrl);

    // Limit to requested count
    const idsToFetch = storyIds.slice(0, limit);

    // Fetch details for each story
    for (const id of idsToFetch) {
      try {
        const storyUrl = `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
        const story = await client.get<HackerNewsStory>(storyUrl);

        // Skip if not a story or if it lacks essential fields
        if (!story || story.type !== 'story' || !story.title) {
          continue;
        }

        // Filter by relevance keywords
        const titleLower = story.title.toLowerCase();
        const contentLower = (story.text || '').toLowerCase();
        const isRelevant = RELEVANT_KEYWORDS.some(
          keyword =>
            titleLower.includes(keyword) || contentLower.includes(keyword)
        );

        if (!isRelevant) {
          continue;
        }

        // Map to RawArticle
        const article: RawArticle = {
          link: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
          title: story.title,
          pubDate: new Date(story.time * 1000).toISOString(),
          content: story.text || '',
          source: 'Hacker News'
        };

        articles.push(article);
      } catch (error) {
        // Skip individual story fetch failures and continue with next
        console.warn(`Failed to fetch HN story ${id}:`, error);
      }
    }

    return articles;
  } catch (error) {
    console.error('Failed to fetch Hacker News articles:', error);
    return []; // Graceful degradation: return empty array on API failure
  }
}
