import { createHash } from 'crypto';
import { RawArticle } from './rss-fetch';

/**
 * Normalized article ready for scoring and display
 */
export interface Article {
  id: string;
  title: string;
  summary: string;
  description?: string;
  url: string;
  source: string;
  category: string;
  publishedAt: string;
  tags: string[];
  score?: number;
}

/**
 * Build a stable, collision-resistant article ID: "<source-slug>-<sha256(link) prefix>".
 * Exported so export layers can derive the same ID for articles stored with the legacy format.
 */
export function buildArticleId(source: string, link: string): string {
  const linkHash = createHash('sha256').update(link).digest('hex').slice(0, 16);
  return `${source.toLowerCase().replace(/\s+/g, '-')}-${linkHash}`;
}

/**
 * Legacy ID formula used before collisions were fixed: "<source-slug>-<first 12 base64 chars of link>".
 * Only used to recognise IDs stored in the old format.
 */
export function buildLegacyArticleId(source: string, link: string): string {
  return `${source.toLowerCase().replace(/\s+/g, '-')}-${Buffer.from(link).toString('base64').slice(0, 12)}`;
}

/**
 * Return the canonical ID for an article. Legacy stored IDs (host-prefix collisions)
 * are recomputed from source+url; all other IDs are returned unchanged.
 */
export function resolveArticleId(article: Pick<Article, 'id' | 'source' | 'url'>): string {
  const isLegacy = article.id === buildLegacyArticleId(article.source, article.url);
  return isLegacy ? buildArticleId(article.source, article.url) : article.id;
}

/**
 * Apply resolveArticleId at export boundaries. Exports must never write this back to the store.
 */
export function withResolvedId<T extends Article>(article: T): T {
  return { ...article, id: resolveArticleId(article) };
}

/**
 * Throw if two different URLs share one article ID. The same URL repeated is allowed.
 * Export layers call this so a collision fails the run instead of silently overwriting an article.
 */
export function assertUniqueArticleIds(articles: Array<Pick<Article, 'id' | 'url'>>): void {
  const urlById = new Map<string, string>();
  for (const article of articles) {
    const seenUrl = urlById.get(article.id);
    if (seenUrl === undefined) {
      urlById.set(article.id, article.url);
    } else if (seenUrl !== article.url) {
      throw new Error(`Article ID collision: "${article.id}" maps to both ${seenUrl} and ${article.url}`);
    }
  }
}

const DESCRIPTION_MAX_LENGTH = 400;
const ELLIPSIS = '...';

/**
 * Truncate already-cleaned text to at most `maxLength` characters.
 * Prefers the last sentence end (. ! ?) that fits; otherwise cuts at the last
 * whitespace before the limit and appends "...". Pure function.
 *
 * @param text - Cleaned text (single spaces, trimmed)
 * @param maxLength - Maximum length of the returned string
 */
export function truncateDescription(text: string, maxLength: number = DESCRIPTION_MAX_LENGTH): string {
  if (text.length <= maxLength) return text;
  if (maxLength < ELLIPSIS.length) return text.slice(0, Math.max(0, maxLength));

  // A sentence end counts only when followed by whitespace, so "3.14" or "v1.2" are not cut.
  // It must also sit at or past half the limit, so an early period cannot collapse the description.
  const minSentenceEnd = Math.floor(maxLength / 2);
  for (let i = maxLength - 1; i >= minSentenceEnd; i--) {
    if (/[.!?]/.test(text[i]) && /\s/.test(text[i + 1] ?? '')) {
      return text.slice(0, i + 1);
    }
  }

  // No sentence end fits: cut at the last whitespace within the room left for the ellipsis.
  const window = text.slice(0, maxLength - ELLIPSIS.length);
  const lastSpace = window.lastIndexOf(' ');
  if (lastSpace > 0) return window.slice(0, lastSpace).trimEnd() + ELLIPSIS;

  // Hard cut: never leave a lone high surrogate at the end.
  let end = window.length;
  const lastCode = window.charCodeAt(end - 1);
  if (end > 0 && lastCode >= 0xd800 && lastCode <= 0xdbff) end--;
  return window.slice(0, end).trimEnd() + ELLIPSIS;
}

/**
 * Thrown when a raw article has no parseable publish date. Such articles are rejected,
 * never stamped with the current time (that would give crawl times a false "recent" score).
 */
export class InvalidPublishDateError extends Error {
  constructor(public readonly link: string, public readonly pubDate: string) {
    super(`Invalid publish date "${pubDate}" for ${link}`);
    this.name = 'InvalidPublishDateError';
  }
}

/**
 * Normalize a raw RSS article to standard Article format
 *
 * Algorithm:
 * 1. Generate unique ID from source + link hash
 * 2. Extract title (required)
 * 3. Extract summary from content (first 200 chars, strip HTML) and description (up to 400 chars, sentence-aware)
 * 4. Preserve URL
 * 5. Store source name
 * 6. Infer category from source name (heuristic)
 * 7. Parse publish date; throws InvalidPublishDateError if it is missing or invalid
 * 8. Extract tags from content keywords
 *
 * @param raw - Raw article from RSS feed
 * @returns Normalized Article
 * @throws InvalidPublishDateError when raw.pubDate is not a valid date
 */
export function normalizeArticle(raw: RawArticle): Article {
  // Generate ID from source and link (simple hash-like approach)
  const id = buildArticleId(raw.source, raw.link);

  // Clean summary from content: strip HTML tags and truncate
  const cleanContent = raw.content
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  const summary = cleanContent.length > 200
    ? cleanContent.substring(0, 200) + '...'
    : cleanContent;

  const description = truncateDescription(cleanContent);

  // Infer category from source name
  const sourceUpper = raw.source.toLowerCase();
  let category = 'news';
  if (sourceUpper.includes('github') || sourceUpper.includes('release')) category = 'release';
  else if (sourceUpper.includes('blog')) category = 'article';
  else if (sourceUpper.includes('news')) category = 'news';
  else if (sourceUpper.includes('tutorial')) category = 'tutorial';

  // Parse published date
  const publishedMs = Date.parse(raw.pubDate);
  if (Number.isNaN(publishedMs)) {
    throw new InvalidPublishDateError(raw.link, raw.pubDate);
  }
  const publishedAt = new Date(publishedMs).toISOString();

  // Extract tags: look for common technical terms in title
  const tags = extractTags(raw.title, raw.content);

  return {
    id,
    title: raw.title,
    summary,
    ...(description ? { description } : {}),
    url: raw.link,
    source: raw.source,
    category,
    publishedAt,
    tags
  };
}

/**
 * Normalize a batch of raw articles. Articles with an invalid publish date are dropped
 * and logged; every other error propagates.
 */
export function normalizeArticles(raws: RawArticle[]): Article[] {
  const articles: Article[] = [];
  for (const raw of raws) {
    try {
      articles.push(normalizeArticle(raw));
    } catch (error) {
      if (error instanceof InvalidPublishDateError) {
        console.warn(`[Normalize] Rejected article with invalid publish date: ${error.message}`);
        continue;
      }
      throw error;
    }
  }
  return articles;
}

/**
 * Extract tags from article title and content
 * Looks for common technical keywords
 */
function extractTags(title: string, content: string): string[] {
  const text = (title + ' ' + content).toLowerCase();
  const commonTags = [
    'typescript',
    'javascript',
    'react',
    'node.js',
    'python',
    'testing',
    'playwright',
    'cypress',
    'jest',
    'vitest',
    'automation',
    'ci/cd',
    'github',
    'devops',
    'docker',
    'kubernetes',
    'api',
    'rest',
    'graphql',
    'database',
    'sql',
    'performance',
    'security',
    'release',
    'update',
    'feature',
    'bug',
    'ai',
    'llm',
    'machine-learning'
  ];

  return commonTags.filter(tag => text.includes(tag));
}
