/**
 * QA-specific RSS feed sources for QA News
 * Each source maps to one or more QA categories based on content type
 */

export interface QANewsFeedSource {
  url: string;
  name: string;
  categories: string[]; // One or more of: qa-practice, test-automation, tooling, engineering, ai
}

/**
 * Curated list of QA/testing industry RSS feeds
 * - Testing frameworks: Vitest, Jest, Cypress, Playwright
 * - QA practices: OWASP, Sauce Labs, BrowserStack
 * - Engineering: Stripe, GitHub, Vercel (how they test at scale)
 * - AI & LLMs: Anthropic, OpenAI (for LLM-based testing)
 */
export const QA_NEWS_FEEDS: QANewsFeedSource[] = [
  // Testing Frameworks
  {
    url: 'https://github.com/vitest-dev/vitest/releases.atom',
    name: 'Vitest Releases',
    categories: ['test-automation', 'tooling']
  },
  {
    url: 'https://github.com/jestjs/jest/releases.atom',
    name: 'Jest Releases',
    categories: ['test-automation', 'tooling']
  },
  {
    url: 'https://github.com/playwright-dev/playwright/releases.atom',
    name: 'Playwright Releases',
    categories: ['test-automation', 'tooling']
  },
  {
    url: 'https://github.com/cypress-io/cypress/releases.atom',
    name: 'Cypress Releases',
    categories: ['test-automation', 'tooling']
  },

  // QA Practices & Security
  {
    url: 'https://owasp.org/feed.xml',
    name: 'OWASP',
    categories: ['qa-practice', 'engineering']
  },
  {
    url: 'https://www.saucelabs.com/blog/feed',
    name: 'Sauce Labs Blog',
    categories: ['test-automation', 'qa-practice']
  },

  // Engineering @ Scale (testing practices)
  {
    url: 'https://stripe.com/blog/feed.xml',
    name: 'Stripe Blog',
    categories: ['engineering', 'test-automation']
  },
  {
    url: 'https://github.blog/engineering.atom',
    name: 'GitHub Engineering',
    categories: ['engineering', 'tooling']
  },
  {
    url: 'https://vercel.com/blog/feed.xml',
    name: 'Vercel Blog',
    categories: ['engineering', 'tooling']
  },

  // AI & LLM Testing
  {
    url: 'https://www.anthropic.com/feed.xml',
    name: 'Anthropic',
    categories: ['ai', 'qa-practice']
  },
  {
    url: 'https://openai.com/news/rss.xml',
    name: 'OpenAI',
    categories: ['ai', 'qa-practice']
  },

  // General Tech
  {
    url: 'https://lobste.rs/rss',
    name: 'Lobsters',
    categories: ['engineering', 'tooling', 'test-automation']
  }
];
