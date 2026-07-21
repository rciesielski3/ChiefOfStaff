import { Article } from './normalize-article';

/**
 * A single month's curated collection with summary and articles
 *
 * Properties:
 * - monthOf: First day of month in ISO format (YYYY-MM-01)
 * - summary: 1-2 sentence summary of the month's key themes (populated by Task 6)
 * - items: Top N articles from this month, sorted by date (newest first)
 */
export interface MonthlyRecap {
  monthOf: string;     // First day of month in ISO format: YYYY-MM-01
  summary: string;     // Will be populated by Task 6; for now, empty string
  items: Article[];    // Top 25 articles (or custom limit), sorted newest first
}

/**
 * Export format for monthly recaps
 *
 * Properties:
 * - months: Array of monthly collections, sorted chronologically (newest first)
 */
export interface MonthlyRecapExport {
  months: MonthlyRecap[];
}

/**
 * Get the month key for grouping (first day of month)
 *
 * Algorithm:
 * 1. Extract year and month from date
 * 2. Format as YYYY-MM-01 (always first day of month)
 *
 * @param date - Date to get month key for
 * @returns Month key in format YYYY-MM-01
 */
function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

/**
 * Export articles grouped by month with curation to top N articles
 *
 * Algorithm:
 * 1. Group articles into Map<monthKey, Article[]>
 * 2. For each month: sort articles by publishedAt DESC (newest first)
 * 3. Slice to curateLimit (default 25)
 * 4. Create MonthlyRecap for each month with empty summary
 * 5. Sort months by monthOf DESC (newest first)
 * 6. Return { months: [...] }
 *
 * @param articles - Array of normalized articles to group
 * @param curateLimit - Maximum articles per month (default 25)
 * @returns Export object with months grouped and curated
 */
export function exportMonthlyRecap(
  articles: Article[],
  curateLimit: number = 25
): MonthlyRecapExport {
  // Step 1: Group articles by month key
  const monthMap = new Map<string, Article[]>();

  for (const article of articles) {
    const monthKey = getMonthKey(new Date(article.publishedAt));

    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, []);
    }

    monthMap.get(monthKey)!.push(article);
  }

  // Step 2, 3 & 4: Create MonthlyRecap objects
  const months: MonthlyRecap[] = [];

  for (const [monthOf, items] of monthMap.entries()) {
    // Sort articles within month by publishedAt DESC (newest first)
    items.sort((a, b) => {
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    // Slice to curateLimit
    const curatedItems = items.slice(0, curateLimit);

    months.push({
      monthOf,
      summary: '',  // Empty for now; will be populated by Task 6
      items: curatedItems
    });
  }

  // Step 5: Sort months by monthOf DESC (newest first)
  months.sort((a, b) => {
    return b.monthOf.localeCompare(a.monthOf);
  });

  // Step 6: Return export object
  return {
    months
  };
}
