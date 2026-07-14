import { RawArticle } from './rss-fetch';

/**
 * Normalized article ready for scoring and display
 */
export interface Article {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: string;
  publishedAt: string;
  tags: string[];
  score?: number;
}

/**
 * Normalize a raw RSS article to standard Article format
 *
 * Algorithm:
 * 1. Generate unique ID from source + link hash
 * 2. Extract title (required)
 * 3. Extract summary from content (first 200 chars, strip HTML)
 * 4. Preserve URL
 * 5. Store source name
 * 6. Infer category from source name (heuristic)
 * 7. Parse publish date, default to now
 * 8. Extract tags from content keywords
 *
 * @param raw - Raw article from RSS feed
 * @returns Normalized Article
 */
export function normalizeArticle(raw: RawArticle): Article {
  // Generate ID from source and link (simple hash-like approach)
  const id = `${raw.source.toLowerCase().replace(/\s+/g, '-')}-${Buffer.from(raw.link).toString('base64').slice(0, 12)}`;

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

  // Infer category from source name
  const sourceUpper = raw.source.toLowerCase();
  let category = 'news';
  if (sourceUpper.includes('github') || sourceUpper.includes('release')) category = 'release';
  else if (sourceUpper.includes('blog')) category = 'article';
  else if (sourceUpper.includes('news')) category = 'news';
  else if (sourceUpper.includes('tutorial')) category = 'tutorial';

  // Parse published date
  let publishedAt: string;
  try {
    publishedAt = new Date(raw.pubDate).toISOString();
  } catch {
    publishedAt = new Date().toISOString();
  }

  // Extract tags: look for common technical terms in title
  const tags = extractTags(raw.title, raw.content);

  return {
    id,
    title: raw.title,
    summary,
    url: raw.link,
    source: raw.source,
    category,
    publishedAt,
    tags
  };
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
