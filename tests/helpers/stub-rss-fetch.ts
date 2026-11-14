/**
 * Preload for CLI tests: `ts-node -r tests/helpers/stub-rss-fetch.ts src/cli/<cli>.ts`.
 *
 * Replaces the RSS fetch functions with fixture articles so CLI tests do not
 * depend on the network or on live feeds. The CLIs call these through the
 * module's exports object, so patching the exports is enough.
 */
import type { RawArticle, RSSSourceConfig, FetchAllSourcesResult } from '../../src/business-logic/rss-fetch';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rssFetch = require('../../src/business-logic/rss-fetch');

const now = Date.now();

function fixtureArticles(source: string): RawArticle[] {
  return [0, 1].map(i => ({
    link: `https://example.com/${encodeURIComponent(source)}/stub-${i}`,
    title: `${source} stub article ${i} about test automation`,
    pubDate: new Date(now - i * 60 * 60 * 1000).toUTCString(),
    content: 'Fixture article about test automation, CI pipelines and quality engineering.',
    source,
  }));
}

rssFetch.fetchRSS = async (_url: string, sourceName: string): Promise<RawArticle[]> =>
  fixtureArticles(sourceName);

rssFetch.fetchAllSources = async (sources: RSSSourceConfig[]): Promise<FetchAllSourcesResult> => {
  const articles = sources.flatMap(s => fixtureArticles(s.name));
  return {
    articles,
    results: sources.map(s => ({ source: s.name, success: true, count: 2 })),
    successCount: sources.length,
    failureCount: 0,
  };
};
