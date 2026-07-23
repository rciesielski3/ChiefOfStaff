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
 * Options controlling fetchWithRetry behavior
 */
export interface RetryOptions {
  /** Maximum number of attempts (including the first try). Default: 3 */
  maxAttempts?: number;
  /** Base delay in ms before the first retry. Doubles on each subsequent retry. Default: 100 */
  baseDelayMs?: number;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run an async operation with retry + exponential backoff.
 *
 * Algorithm:
 * 1. Attempt the operation.
 * 2. On success, return the result immediately.
 * 3. On failure, if attempts remain, wait `baseDelayMs * 2^(attempt-1)` ms
 *    then retry.
 * 4. If all attempts are exhausted, throw the last error encountered.
 *
 * @param fn - Async operation to run
 * @param options - Retry configuration (maxAttempts, baseDelayMs)
 * @returns Result of the operation
 * @throws The last error encountered if all attempts fail
 */
export async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(
          `Attempt ${attempt}/${maxAttempts} failed, retrying in ${delayMs}ms...`,
          error
        );
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Fetch articles from an RSS feed source
 *
 * Algorithm:
 * 1. Initialize RSS parser
 * 2. Parse URL to get feed items, retrying on failure with exponential backoff
 * 3. Map feed items to RawArticle interface
 * 4. Handle missing fields with defaults
 *
 * @param sourceUrl - URL of RSS feed
 * @param sourceName - Human-readable name of the source (e.g., "OpenAI Blog")
 * @returns Array of normalized raw articles
 * @throws Error if feed cannot be parsed after all retry attempts
 */
export async function fetchRSS(sourceUrl: string, sourceName: string): Promise<RawArticle[]> {
  const parser = new Parser({
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    customFields: {
      item: [
        ['content:encoded', 'content']
      ]
    }
  });

  try {
    const feed = await fetchWithRetry(() => parser.parseURL(sourceUrl));

    return (feed.items || []).map(item => ({
      link: item.link || '',
      title: item.title || '',
      pubDate: item.pubDate || new Date().toISOString(),
      content: (item as any).content || item.contentSnippet || (item as any).description || '',
      source: sourceName
    }));
  } catch (error) {
    console.error(`Failed to fetch RSS from ${sourceUrl} after retries:`, error);
    throw error;
  }
}
