import Parser from 'rss-parser';

/**
 * Raw article parsed directly from RSS feed
 */
export interface RawArticle {
  link: string;
  title: string;
  pubDate: string;
  content: string;
  source: string;
}

/**
 * Fetch articles from an RSS feed source
 *
 * Algorithm:
 * 1. Initialize RSS parser
 * 2. Parse URL to get feed items
 * 3. Map feed items to RawArticle interface
 * 4. Handle missing fields with defaults
 *
 * @param sourceUrl - URL of RSS feed
 * @param sourceName - Human-readable name of the source (e.g., "OpenAI Blog")
 * @returns Array of normalized raw articles
 * @throws Error if feed cannot be parsed
 */
export async function fetchRSS(sourceUrl: string, sourceName: string): Promise<RawArticle[]> {
  const parser = new Parser({
    customFields: {
      item: [
        ['content:encoded', 'content']
      ]
    }
  });

  try {
    const feed = await parser.parseURL(sourceUrl);

    return (feed.items || []).map(item => ({
      link: item.link || '',
      title: item.title || '',
      pubDate: item.pubDate || new Date().toISOString(),
      content: (item as any).content || item.contentSnippet || (item as any).description || '',
      source: sourceName
    }));
  } catch (error) {
    console.error(`Failed to fetch RSS from ${sourceUrl}:`, error);
    throw error;
  }
}
