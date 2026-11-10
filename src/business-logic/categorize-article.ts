import { Article } from './normalize-article';
import categoryConfig from '../config/qa-news-categories.json';

interface CategoryRules {
  keywords: string[];
  sourceMatches: string[];
}

/**
 * Case-insensitive whole-word match of `term` inside `text`.
 * "AI" matches "AI Weekly" but not "Email Weekly" or "Maintainers Weekly".
 */
function matchesWholeWord(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

/**
 * Text used for keyword matching: title, summary and tags. Source names are
 * deliberately excluded here so that they cannot override the article content.
 */
function contentText(article: Article): string {
  return `${article.title} ${article.summary} ${(article.tags ?? []).join(' ')}`.toLowerCase();
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
  const text = contentText(article);
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
        if (matchesWholeWord(article.source, sourceMatch)) {
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

/**
 * Pick one display category for an article (used for UI filtering)
 *
 * Rule order:
 * 1. Keyword hits in title, summary and tags. The category with the most hits
 *    wins; ties go to config order.
 * 2. Only when no keyword hits, an exact whole-word source key (e.g. "Jest",
 *    "OpenAI") picks the category. Broad source words such as "Testing" are
 *    not in the config, so "Ministry of Testing" cannot force test-automation.
 * 3. Otherwise the configured default (engineering).
 *
 * @param article - Article to categorize
 * @returns Single category ID
 */
export function primaryQANewsCategory(article: Article): string {
  const text = contentText(article);
  const config = categoryConfig as any;

  let bestCategory: string | undefined;
  let bestHits = 0;
  for (const [categoryId, rules] of Object.entries(config.categories)) {
    const { keywords } = rules as CategoryRules;
    const hits = keywords.filter(keyword =>
      new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)
    ).length;
    if (hits > bestHits) {
      bestHits = hits;
      bestCategory = categoryId;
    }
  }
  if (bestCategory) {
    return bestCategory;
  }

  for (const [categoryId, rules] of Object.entries(config.categories)) {
    const { sourceMatches } = rules as CategoryRules;
    if (sourceMatches.some(match => matchesWholeWord(article.source, match))) {
      return categoryId;
    }
  }

  return config.defaults.fallbackCategory;
}
