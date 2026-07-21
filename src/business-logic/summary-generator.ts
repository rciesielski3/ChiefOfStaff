import Anthropic from '@anthropic-ai/sdk';
import { Article } from './normalize-article';

/**
 * SummaryGenerator service that uses Claude to generate 1-2 sentence summaries
 * of article collections, capturing key themes from the period.
 */
export class SummaryGenerator {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Generate a 1-2 sentence summary from a collection of articles.
   *
   * Algorithm:
   * 1. Short-circuit on empty articles array (return empty string)
   * 2. Extract titles and categories from articles
   * 3. Call Claude with prompt asking for 1-2 sentence summary
   * 4. Return trimmed text or empty string on error
   *
   * @param articles - Array of normalized articles to summarize
   * @returns A 1-2 sentence summary (20-300 chars) or empty string
   */
  async generateSummary(articles: Article[]): Promise<string> {
    // Short-circuit: empty articles array returns empty string immediately
    if (!articles || articles.length === 0) {
      return '';
    }

    try {
      // Extract titles and categories from articles
      const titles = articles.map(a => a.title);
      const categories = [...new Set(articles.map(a => a.category))];

      // Build the prompt
      const articlesText = titles.map((title, i) => `${i + 1}. ${title}`).join('\n');
      const prompt = `Given these article titles from the current news cycle:

${articlesText}

Write a concise 1-2 sentence summary that captures the key themes and topics from this period. Focus on the main topics covered (${categories.join(', ')}).`;

      // Call Claude API
      const message = await this.client.messages.create({
        model: 'claude-opus-4-1-20250805',
        max_tokens: 150,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      // Extract text from response
      const content = message.content[0];
      if (content.type === 'text') {
        return content.text.trim();
      }

      return '';
    } catch (error) {
      // On error, return empty string
      console.error('Error generating summary:', error);
      return '';
    }
  }
}
