import { Article } from './normalize-article';
import { ArticleStore } from './article-store';

/**
 * Persist articles to the canonical store with deduplication and merging
 *
 * Algorithm:
 * 1. Read existing articles from store
 * 2. Deduplicate new articles against existing
 * 3. Merge both sets
 * 4. Retain only articles from last 30 days
 * 5. Write merged articles back to store
 *
 * @param articles - New articles to persist
 * @param store - Article store to write to
 */
export async function persistArticles(articles: Article[], store: ArticleStore): Promise<void> {
  // Use store's dedupAndMerge which handles all persistence logic
  const merged = await store.dedupAndMerge(articles);

  // Note: dedupAndMerge already writes to store, but this is explicit
  // for clarity on the contract: persist = deduplicate + merge + write
  await store.write(merged);
}
