import { Article } from './normalize-article';
import categoryConfig from '../config/qa-news-categories.json';

interface CategoryRules {
  keywords: string[];
  sourceMatches: string[];
}

/**
 * Map article content to QA News categories using configurable keywords
 *
 * Algorithm:
 * 1. Combine title + summary text
 * 2. For each category, check if any keywords match (case-insensitive, word boundary)
 * 3. For each category, check if source matches configured source patterns
 * 4. Return all matching categories
 * 5. If no matches, use fallback category (engineering)
 *
 * @param article - Article to categorize
 * @returns Array of matching category IDs
 */
export function categorizeForQANews(article: Article): string[] {
  const text = `${article.title} ${article.summary}`.toLowerCase();
  const categories = new Set<string>();

  const config = categoryConfig as any;

  // Check each category's rules
  for (const [categoryId, rules] of Object.entries(config.categories)) {
    const categoryRules = rules as CategoryRules;

    // Check keyword matches
    for (const keyword of categoryRules.keywords) {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(text)) {
        categories.add(categoryId);
        break; // Match found for this category, move to next
      }
    }

    // Check source name matches
    if (!categories.has(categoryId)) {
      for (const sourceMatch of categoryRules.sourceMatches) {
        if (article.source.toLowerCase().includes(sourceMatch.toLowerCase())) {
          categories.add(categoryId);
          break;
        }
      }
    }
  }

  // Use fallback if no categories matched
  if (categories.size === 0) {
    categories.add(config.defaults.fallbackCategory);
  }

  return Array.from(categories);
}
