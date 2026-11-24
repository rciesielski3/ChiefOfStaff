import { RSSSourceConfig } from '../business-logic/rss-fetch';

/**
 * Central registry of all RSS sources used by the application.
 * All sources are enabled by default.
 */
export const RSS_SOURCES: RSSSourceConfig[] = [
  {
    name: 'Ministry of Testing',
    url: 'https://www.ministryoftesting.com/contents/rss',
    // Glossary definitions, job listings and newsletter pages are not news.
    excludePathPrefixes: ['/glossary/', '/software-testing-glossary/', '/jobs/', '/newsletter/'],
  },
  {
    name: 'Google Testing Blog',
    url: 'https://testing.googleblog.com/feeds/posts/default',
  },
  {
    name: 'InfoQ',
    url: 'https://feed.infoq.com/',
    // Conference talks and podcast episodes are not news items.
    excludePathPrefixes: ['/presentations/', '/podcasts/'],
  },
  {
    name: 'Martin Fowler',
    url: 'https://martinfowler.com/feed.atom',
  },
  {
    name: 'Cypress',
    url: 'https://cypress.io/blog/rss',
  },
  {
    name: 'Playwright',
    url: 'https://github.com/microsoft/playwright/releases.atom',
  },
  {
    name: 'OpenAI',
    url: 'https://openai.com/news/rss.xml',
  },
  {
    name: 'Cloudflare',
    url: 'https://blog.cloudflare.com/rss/',
  },
  {
    name: 'On Test Automation',
    url: 'https://www.ontestautomation.com/feed.xml',
  },
  {
    name: 'Ultimate QA',
    url: 'https://ultimateqa.com/feed',
  },
  {
    name: 'LogiGear Blog',
    url: 'https://www.logigear.com/blogs/feed.xml',
    // Cloudflare answers the fetcher with 403 (every daily-brief run since it was added).
    enabled: false,
  },
  {
    name: 'Vitest Releases',
    url: 'https://github.com/vitest-dev/vitest/releases.atom',
  },
  {
    name: 'Selenium Releases',
    url: 'https://github.com/SeleniumHQ/selenium/releases.atom',
  },
  {
    name: 'Grafana k6 Releases',
    url: 'https://github.com/grafana/k6/releases.atom',
  },
  {
    name: 'WebdriverIO Releases',
    url: 'https://github.com/webdriverio/webdriverio/releases.atom',
  },
  {
    name: 'Jest Releases',
    url: 'https://github.com/jestjs/jest/releases.atom',
  },
  {
    name: 'Storybook Releases',
    url: 'https://github.com/storybookjs/storybook/releases.atom',
  },
  // --- QA / test automation ---
  {
    name: 'Test Guild',
    url: 'https://testguild.com/feed/',
  },
  {
    name: 'DevelopSense',
    url: 'https://developsense.com/blog/feed',
  },
  {
    name: 'Checkly',
    url: 'https://www.checklyhq.com/rss.xml',
  },
  // --- AI engineering ---
  {
    name: 'Simon Willison',
    // entries only: /atom/everything/ adds ~23 link/quote posts a month
    url: 'https://simonwillison.net/atom/entries/',
  },
  {
    name: 'GitHub Blog',
    url: 'https://github.blog/feed/',
    // company news is not engineering content
    excludePathPrefixes: ['/news-insights/'],
  },
  {
    name: 'MCP Blog',
    url: 'https://blog.modelcontextprotocol.io/index.xml',
  },
  // --- Engineering practice ---
  {
    name: 'Pragmatic Engineer',
    url: 'https://newsletter.pragmaticengineer.com/feed',
  },
  {
    name: 'Netflix TechBlog',
    url: 'https://netflixtechblog.com/feed',
  },
  {
    name: 'Kent Beck',
    // 301 target of tidyfirst.substack.com/feed
    url: 'https://newsletter.kentbeck.com/feed',
  },
];

/**
 * Get all enabled RSS sources.
 * Returns sources where enabled !== false (undefined defaults to true).
 */
export function getEnabledSources(): RSSSourceConfig[] {
  return RSS_SOURCES.filter((source) => source.enabled !== false);
}

/** Tag and category that QA-News uses for tool releases. */
export const RELEASE_TAG = 'release';

/**
 * True when the named source is a GitHub releases feed (URL ends in
 * /releases.atom). Its items are tool releases, not articles.
 */
export function isReleaseSource(sourceName: string): boolean {
  return RSS_SOURCES.some(
    (source) => source.name === sourceName && /\/releases\.atom$/.test(source.url),
  );
}
