import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { REPO_ROOT, RSS_STUB, TS_NODE_BIN, useTempProjectRoot } from '../helpers/temp-project-root';

// Runs the real CLI against a temp project root (CHIEF_OF_STAFF_ROOT) with RSS
// fetching stubbed, so the test needs no network and never writes repo files.
function runRebuild(args: string[] = []): string {
  return execFileSync(
    TS_NODE_BIN,
    ['-r', RSS_STUB, path.join(REPO_ROOT, 'src/cli/rebuild-qa-news.ts'), ...args],
    {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: REPO_ROOT,
      env: process.env,
      timeout: 60000,
    },
  );
}

describe('rebuild-qa-news CLI — Integration Tests', () => {
  const projectRoot = useTempProjectRoot();

  it('should run successfully with --verbose flag and output progress messages', () => {
    const output = runRebuild(['--verbose']);

    // Verify output contains progress messages
    expect(output).toContain('[Rebuild QA News]');
    expect(output).toContain('Fetching RSS feeds');
    expect(output).toContain('Normalizing articles');
    expect(output).toContain('Scoring articles');
    expect(output).toContain('Exporting articles');
    expect(output).toContain('Writing exports');
    expect(output).toContain('Rebuild complete');

    // Verify structured logging
    expect(output).toContain('WORKFLOW_START');
    expect(output).toContain('FETCH_START');
    expect(output).toContain('FETCH_COMPLETE');
    expect(output).toContain('NORMALIZE_COMPLETE');
    expect(output).toContain('SCORE_COMPLETE');
    expect(output).toContain('EXPORT_COMPLETE');
    expect(output).toContain('WRITE_COMPLETE');
    expect(output).toContain('WORKFLOW_COMPLETE');
  });

  it('should regenerate the latest export (latest-news.json)', () => {
    // Run rebuild
    runRebuild();

    // Verify the export file was created
    const latestPath = path.join(projectRoot(), 'qa-news/data/latest-news.json');

    expect(fs.existsSync(latestPath)).toBe(true);

    // Verify file is valid JSON
    const latest = JSON.parse(fs.readFileSync(latestPath, 'utf-8'));

    // Verify structure
    expect(latest).toHaveProperty('date');
    expect(latest).toHaveProperty('updatedAt');
    expect(latest).toHaveProperty('items');
    expect(Array.isArray(latest.items)).toBe(true);

    // Verify we have content (assuming RSS sources have articles)
    if (latest.items.length > 0) {
      expect(latest.items[0]).toHaveProperty('id');
      expect(latest.items[0]).toHaveProperty('title');
      expect(latest.items[0]).toHaveProperty('url');
    }
  });
});
