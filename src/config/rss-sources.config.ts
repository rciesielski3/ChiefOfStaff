import { RSSSourceConfig } from '../business-logic/rss-fetch';

/**
 * Central registry of all RSS sources used by the application.
 * All sources are enabled by default.
 */
export const RSS_SOURCES: RSSSourceConfig[] = [
  {
    name: 'Ministry of Testing',
    url: 'https://www.ministryoftesting.com/contents/rss',
  },
  {
    name: 'Google Testing Blog',
    url: 'https://testing.googleblog.com/feeds/posts/default',
  },
  {
    name: 'InfoQ',
    url: 'https://feed.infoq.com/',
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
];

/**
 * Get all enabled RSS sources.
 * Returns sources where enabled !== false (undefined defaults to true).
 */
export function getEnabledSources(): RSSSourceConfig[] {
  return RSS_SOURCES.filter(source => (source as any).enabled !== false);
}
