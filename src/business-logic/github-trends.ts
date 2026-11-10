import { Article, buildArticleId } from './normalize-article';

/**
 * Fast-growing GitHub repositories for QA and AI-testing topics.
 * To add a topic, append it here and map it to a category in TOPIC_CATEGORY.
 */
export const GITHUB_TREND_TOPICS = ['test-automation', 'llm-evaluation'] as const;
export type GitHubTrendTopic = (typeof GITHUB_TREND_TOPICS)[number];

const TOPIC_CATEGORY: Record<GitHubTrendTopic, string> = {
  'test-automation': 'test-automation',
  'llm-evaluation': 'ai'
};

export const GITHUB_TREND_MIN_STARS = 50;
export const GITHUB_TREND_WINDOW_DAYS = 30;
export const GITHUB_TREND_PER_PAGE = 20;
const SEARCH_URL = 'https://api.github.com/search/repositories';
const USER_AGENT = 'qa-news-trends/1.0';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Subset of a GitHub search API repository item used by this module. */
export interface GitHubRepo {
  name: string;
  html_url: string;
  description: string | null;
  created_at: string;
  stargazers_count: number;
  owner: { login: string };
}

/** Format a date as YYYY-MM-DD (UTC), the form the GitHub search `created:` qualifier expects. */
export function formatSearchDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Start of the creation window: `days` before `now`. */
export function windowStart(now: Date, days: number = GITHUB_TREND_WINDOW_DAYS): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

/** Build the repository search query for one topic. */
export function buildTrendQuery(topic: GitHubTrendTopic, since: Date, minStars: number = GITHUB_TREND_MIN_STARS): string {
  return `topic:${topic} created:>${formatSearchDate(since)} stars:>=${minStars}`;
}

/** Map one GitHub repository to an Article. Pure. */
export function repoToArticle(repo: GitHubRepo, topic: GitHubTrendTopic): Article {
  const title = `${repo.owner.login}/${repo.name}`;
  const description = repo.description ?? '';
  return {
    id: buildArticleId('GitHub', repo.html_url),
    title,
    summary: description,
    ...(description ? { description } : {}),
    url: repo.html_url,
    source: 'GitHub',
    category: TOPIC_CATEGORY[topic],
    publishedAt: repo.created_at,
    tags: [topic, `stars:${repo.stargazers_count}`]
  };
}

/** Keep the first article for each URL, preserving order. Pure. */
export function dedupeByUrl(articles: Article[]): Article[] {
  const seen = new Set<string>();
  return articles.filter(article => {
    if (seen.has(article.url)) return false;
    seen.add(article.url);
    return true;
  });
}

export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
}>;

export interface FetchTrendsOptions {
  now?: Date;
  token?: string;
  fetchImpl?: FetchLike;
}

/** Query GitHub search for one topic. Throws with status code on HTTP errors. Never includes the token in errors. */
async function searchTopic(topic: GitHubTrendTopic, since: Date, opts: FetchTrendsOptions): Promise<GitHubRepo[]> {
  const fetchImpl = opts.fetchImpl ?? (fetch as unknown as FetchLike);
  const params = new URLSearchParams({
    q: buildTrendQuery(topic, since),
    sort: 'stars',
    order: 'desc',
    per_page: String(GITHUB_TREND_PER_PAGE)
  });
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/vnd.github+json'
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const response = await fetchImpl(`${SEARCH_URL}?${params.toString()}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub search failed for topic "${topic}": HTTP ${response.status} ${response.statusText}`);
  }
  const body = (await response.json()) as { items?: GitHubRepo[] };
  return body.items ?? [];
}

/**
 * Fetch fast-growing repositories for every configured topic (sequentially, to stay
 * within the search rate limit), map them to Articles and dedupe by URL.
 */
export async function fetchGitHubTrends(opts: FetchTrendsOptions = {}): Promise<Article[]> {
  const since = windowStart(opts.now ?? new Date());
  const articles: Article[] = [];
  for (const topic of GITHUB_TREND_TOPICS) {
    const repos = await searchTopic(topic, since, opts);
    articles.push(...repos.map(repo => repoToArticle(repo, topic)));
  }
  return dedupeByUrl(articles);
}
