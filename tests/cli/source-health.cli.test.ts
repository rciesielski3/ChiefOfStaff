import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { REPO_ROOT, RSS_STUB, TS_NODE_BIN, useTempProjectRoot } from '../helpers/temp-project-root';
import { getEnabledSources } from '../../src/config/rss-sources.config';
import { RETENTION_DAYS } from '../../src/business-logic/article-store';

/**
 * Runs the source-health CLI against a temp project root holding one stored
 * article. No network: either --no-fetch, or the RSS stub preload.
 */
describe('source-health CLI', () => {
  const getRoot = useTempProjectRoot([]);
  const CLI = path.join(REPO_ROOT, 'src/cli/source-health.ts');
  const NOW = '2026-11-14T12:00:00.000Z';
  const enabled = getEnabledSources().map((s) => s.name);
  const [busy, quiet] = enabled;

  beforeAll(() => {
    const line = JSON.stringify({ source: busy, publishedAt: '2026-11-13T00:00:00.000Z' });
    fs.writeFileSync(path.join(getRoot(), 'data/canonical_articles.ndjson'), line + '\n');
  });

  function run(args: string[], preload: string[] = []): string {
    return execFileSync(TS_NODE_BIN, [...preload, CLI, '--now', NOW, ...args], {
      cwd: REPO_ROOT,
      env: process.env,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  }

  it('with --no-fetch, reports zero sources via store retention and exits 0', () => {
    const out = run(['--no-fetch']);

    expect(out).toContain(`1 ${busy}`);
    expect(out).toContain(
      `⚠️ 0 ${quiet} (no articles in last ${RETENTION_DAYS} days, store retention)`,
    );
    expect(out).not.toContain('never');
  });

  it('fetches zero-count sources and reports them as alive', () => {
    const out = run([], ['-r', RSS_STUB]);
    expect(out).toContain(`1 ${busy}`);
    // The stub's fixture articles are dated "now".
    expect(out).toContain(`⚠️ 0 ${quiet} (feed OK, newest item `);
    expect(out).toMatch(/newest item \d{4}-\d{2}-\d{2}\)/);
    expect(out).not.toContain('store retention');
  });
});
