import { Article } from './normalize-article';
import { SummaryGenerator } from './summary-generator';

/**
 * A single week's highlight collection with summary and articles
 *
 * Properties:
 * - weekOf: ISO date of the Monday starting this week (YYYY-MM-DD)
 * - summary: 1-2 sentence summary of the week's key themes (populated by Task 6)
 * - items: ALL articles published in this week, sorted by date (newest first)
 */
export interface WeeklyHighlight {
  weekOf: string;     // Monday of week in ISO format: YYYY-MM-DD
  summary: string;    // Will be populated by Task 6; for now, empty string
  items: Article[];   // ALL articles from that week, sorted newest first
}

/**
 * Export format for weekly highlights
 *
 * Properties:
 * - weeks: Array of weekly collections, sorted chronologically (newest first)
 */
export interface WeeklyHighlightsExport {
  weeks: WeeklyHighlight[];
}

/**
 * Get the Monday of the week containing the given date
 *
 * Algorithm:
 * 1. Get the day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * 2. If Sunday (0), subtract 6 days to get previous Monday
 * 3. If any other day, subtract (day - 1) to get this week's Monday
 * 4. Return new Date with time set to 00:00:00
 *
 * @param date - Date to find the Monday for
 * @returns New Date representing the Monday of that week
 */
function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();

  // Calculate days to subtract to get to Monday
  const daysToMonday = day === 0 ? 6 : day - 1;

  // Subtract days to get to Monday
  d.setDate(d.getDate() - daysToMonday);

  // Reset time to midnight
  d.setHours(0, 0, 0, 0);

  return d;
}

/**
 * Get the week key for grouping (ISO format of Monday)
 *
 * Algorithm:
 * 1. Get the Monday of the week
 * 2. Format as YYYY-MM-DD
 *
 * @param date - Date to get week key for
 * @returns Week key in format YYYY-MM-DD
 */
function getWeekKey(date: Date): string {
  const monday = getMondayOfWeek(date);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const day = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Export articles grouped by week with summaries for later generation
 *
 * Algorithm:
 * 1. Group articles into Map<weekKey, Article[]>
 * 2. For each week: sort articles by publishedAt DESC (newest first)
 * 3. Create WeeklyHighlight for each week with empty summary
 * 4. Sort weeks by weekOf DESC (newest first)
 * 5. Return { weeks: [...] }
 *
 * @param articles - Array of normalized articles to group
 * @returns Export object with weeks grouped and sorted
 */
export function exportWeeklyHighlights(articles: Article[]): WeeklyHighlightsExport {
  // Step 1: Group articles by week key
  const weekMap = new Map<string, Article[]>();

  for (const article of articles) {
    const weekKey = getWeekKey(new Date(article.publishedAt));

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, []);
    }

    weekMap.get(weekKey)!.push(article);
  }

  // Step 2 & 3: Create WeeklyHighlight objects
  const weeks: WeeklyHighlight[] = [];

  for (const [weekOf, items] of weekMap.entries()) {
    // Sort articles within week by publishedAt DESC (newest first)
    items.sort((a, b) => {
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    weeks.push({
      weekOf,
      summary: '',  // Empty for now; will be populated by Task 6
      items
    });
  }

  // Step 4: Sort weeks by weekOf DESC (newest first)
  weeks.sort((a, b) => {
    return b.weekOf.localeCompare(a.weekOf);
  });

  // Step 5: Return export object
  return {
    weeks
  };
}

/**
 * Export articles grouped by week and generate summaries for each week
 *
 * Algorithm:
 * 1. Call exportWeeklyHighlights(articles) to get grouped weeks
 * 2. For each week, call summaryGenerator.generateSummary(week.items) if available
 * 3. If summaryGenerator not provided or generation fails, use fallback summary text
 * 4. Return export with summaries populated
 *
 * @param articles - Array of normalized articles to group and summarize
 * @param summaryGenerator - SummaryGenerator instance for generating summaries (optional)
 * @returns Export object with weeks and summaries
 */
export async function exportWeeklyHighlightsWithSummaries(
  articles: Article[],
  summaryGenerator?: SummaryGenerator
): Promise<WeeklyHighlightsExport> {
  // Call existing exportWeeklyHighlights(articles)
  const export_ = exportWeeklyHighlights(articles);

  // For each week, generate summary
  for (const week of export_.weeks) {
    try {
      if (summaryGenerator) {
        week.summary = await summaryGenerator.generateSummary(week.items);
      } else {
        week.summary = `Week of ${week.weekOf}: ${week.items.length} articles`;
      }
    } catch (error) {
      console.warn(`Failed to generate summary for week ${week.weekOf}: ${error}`);
      week.summary = `Week of ${week.weekOf}: ${week.items.length} articles`;
    }
  }

  return export_;
}
