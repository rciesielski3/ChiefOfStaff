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
];

/**
 * Get all enabled RSS sources.
 * Returns sources where enabled !== false (undefined defaults to true).
 */
export function getEnabledSources(): RSSSourceConfig[] {
  return RSS_SOURCES.filter(source => (source as any).enabled !== false);
}
