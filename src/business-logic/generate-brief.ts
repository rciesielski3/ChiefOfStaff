import { ScoredArticle } from './score-article';

/**
 * Generate a markdown Daily Brief from scored articles
 *
 * Algorithm:
 * 1. Sort articles by score (highest first)
 * 2. Select top N articles
 * 3. Group by priority (CRITICAL, HIGH, MEDIUM, LOW)
 * 4. Format as markdown with sections
 * 5. Include article links, summaries, and tags
 * 6. Add timestamp and footer
 *
 * @param articles - Scored articles (should already be sorted by score)
 * @param count - Number of articles to include (default: 10)
 * @returns Markdown-formatted brief
 */
export function generateBrief(articles: ScoredArticle[], count: number = 10): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  // Select top N articles
  const topArticles = articles.slice(0, count);

  // Group by priority
  const byPriority = {
    CRITICAL: topArticles.filter(a => a.priority === 'CRITICAL'),
    HIGH: topArticles.filter(a => a.priority === 'HIGH'),
    MEDIUM: topArticles.filter(a => a.priority === 'MEDIUM'),
    LOW: topArticles.filter(a => a.priority === 'LOW')
  };

  // Build markdown
  let markdown = `# Daily Brief — ${dateStr}\n\n`;
  markdown += `**${topArticles.length} stories selected from ${articles.length} total**\n\n`;

  // CRITICAL section
  if (byPriority.CRITICAL.length > 0) {
    markdown += `## 🔴 Critical (${byPriority.CRITICAL.length})\n\n`;
    markdown += formatArticleList(byPriority.CRITICAL);
  }

  // HIGH section
  if (byPriority.HIGH.length > 0) {
    markdown += `## 🟠 High Priority (${byPriority.HIGH.length})\n\n`;
    markdown += formatArticleList(byPriority.HIGH);
  }

  // MEDIUM section
  if (byPriority.MEDIUM.length > 0) {
    markdown += `## 🟡 Medium (${byPriority.MEDIUM.length})\n\n`;
    markdown += formatArticleList(byPriority.MEDIUM);
  }

  // LOW section
  if (byPriority.LOW.length > 0) {
    markdown += `## ⚪ Lower Priority (${byPriority.LOW.length})\n\n`;
    markdown += formatArticleList(byPriority.LOW);
  }

  // Footer
  markdown += `\n---\n\n`;
  markdown += `*Generated automatically by PAIOS at ${now.toISOString()}*\n`;

  return markdown;
}

/**
 * Format articles as markdown list items
 * @param articles - Articles to format
 * @returns Markdown list
 */
function formatArticleList(articles: ScoredArticle[]): string {
  return articles
    .map((article, index) => formatArticleItem(article, index + 1))
    .join('\n');
}

/**
 * Format a single article as markdown
 * @param article - Article to format
 * @param number - Item number in list
 * @returns Markdown article item
 */
function formatArticleItem(article: ScoredArticle, number: number): string {
  let item = `${number}. [${article.title}](${article.url})\n`;
  item += `   - Source: ${article.source} | Score: ${article.score}\n`;
  item += `   - ${article.summary}\n`;

  if (article.tags.length > 0) {
    item += `   - Tags: ${article.tags.map(t => `\`${t}\``).join(', ')}\n`;
  }

  item += `   - Reason: ${article.reason.join(', ')}\n`;

  return item;
}

/**
 * Generate a plain text version for Telegram (no markdown formatting)
 * Strips markdown symbols for better Telegram readability
 *
 * @param markdownBrief - Markdown-formatted brief
 * @returns Plain text version
 */
export function generatePlainTextBrief(markdownBrief: string): string {
  return markdownBrief
    .replace(/\*\*/g, '')           // Remove bold
    .replace(/#+\s/g, '')            // Remove heading markers
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Convert links to plain text
    .replace(/`/g, '')               // Remove code markers
    .replace(/[\n\n]+/g, '\n')       // Normalize line breaks
    .trim();
}
