import { Article } from './normalize-article';
import { primaryQANewsCategory } from './categorize-article';

export const EMPTY_PERIOD_SUMMARY = 'No stories in this period.';

const MAX_TOP_TITLES = 3;
const MAX_TOP_CATEGORIES = 3;

/**
 * Build a deterministic, non-AI summary for a period (week or month).
 *
 * Derived only from the items: story count, the first titles (items are
 * expected newest first), and the most frequent categories. It is NOT an AI
 * summary and must never be presented as one.
 *
 * Empty periods return an explicit empty-state sentence, not a fake summary.
 *
 * @param items - Articles in the period, newest first
 * @returns Summary text, never empty
 */
export function buildDeterministicSummary(items: Article[]): string {
  if (items.length === 0) {
    return EMPTY_PERIOD_SUMMARY;
  }

  const count = items.length;
  const topTitles = items.slice(0, MAX_TOP_TITLES).map(a => a.title);

  // Use the same QA-News category labels the export writes to items
  const categoryCounts = new Map<string, number>();
  for (const item of items) {
    const category = primaryQANewsCategory(item);
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }
  const topCategories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_TOP_CATEGORIES)
    .map(([category, n]) => `${category} (${n})`);

  const storyLabel = count === 1 ? 'story' : 'stories';
  return `${count} ${storyLabel}. Top stories: ${topTitles.join('; ')}. Top categories: ${topCategories.join(', ')}.`;
}
