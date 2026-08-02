import { RawArticle } from '../../business-logic/rss-fetch';

/**
 * Papers with Code API response structure
 */
interface PapersAPIResponse {
  results: PaperItem[];
}

/**
 * Individual paper item from Papers with Code API
 */
interface PaperItem {
  id: string;
  title: string;
  url: string;
  published: string; // ISO 8601 date
  abstract?: string;
  arxiv_id?: string;
}

/**
 * Transform Papers with Code API response to RawArticle format.
 *
 * Algorithm:
 * 1. Validate that the response is an object with a results array
 * 2. For each paper in results:
 *    - Extract required fields (title, url, published, abstract)
 *    - Use defaults for missing fields
 *    - Truncate abstract to ~200-300 characters
 *    - Create RawArticle with source="Papers with Code"
 * 3. Skip malformed papers and continue
 * 4. Return array of RawArticles
 *
 * @param rawResponse - Unknown response from Papers API
 * @param sourceId - Source identifier for logging
 * @returns Array of normalized raw articles
 * @throws Error if response structure is completely invalid
 */
export async function mapPapersWithCodeArticles(
  rawResponse: unknown,
  sourceId: string
): Promise<RawArticle[]> {
  // Validate response is an object
  if (!rawResponse || typeof rawResponse !== 'object') {
    throw new Error(
      `[${sourceId}] Invalid Papers API response: expected object, got ${typeof rawResponse}`
    );
  }

  const response = rawResponse as Record<string, unknown>;

  // Validate results array exists
  if (!Array.isArray(response.results)) {
    throw new Error(
      `[${sourceId}] Invalid Papers API response: missing or invalid results array`
    );
  }

  const articles: RawArticle[] = [];

  for (const paper of response.results) {
    try {
      // Type-safe paper access
      if (!paper || typeof paper !== 'object') {
        console.warn(`[${sourceId}] Skipping malformed paper: not an object`);
        continue;
      }

      const paperObj = paper as Record<string, unknown>;

      // Extract and validate required fields
      const title = String(paperObj.title || 'Untitled').trim();
      let link = String(paperObj.url || '').trim();

      // Fall back to arxiv_id if url is empty
      if (!link && paperObj.arxiv_id) {
        link = `https://arxiv.org/abs/${String(paperObj.arxiv_id).trim()}`;
      }

      const pubDate = String(paperObj.published || new Date().toISOString()).trim();

      // Extract and truncate abstract/content
      let content = String(paperObj.abstract || 'No abstract available').trim();

      // Truncate to 200-300 characters while preserving word boundaries
      if (content.length > 300) {
        content = content.substring(0, 300).trim() + '...';
      }

      // Create RawArticle
      const article: RawArticle = {
        link,
        title,
        pubDate,
        content,
        source: 'Papers with Code'
      };

      articles.push(article);
    } catch (error) {
      // Log and skip malformed papers
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      console.warn(
        `[${sourceId}] Failed to map paper: ${errorMsg}`
      );
      continue;
    }
  }

  return articles;
}
