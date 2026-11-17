import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { useTempProjectRoot } from '../helpers/temp-project-root';

describe('export-qa-news CLI — Exit Codes', () => {
  // Each suite gets its own temp copy of the data; the CLI reads and writes there.
  const projectRoot = useTempProjectRoot();

  it('should exit with code 0 on successful export', () => {
    try {
      const output = execSync(
        'npx ts-node -r ./tests/helpers/stub-anthropic.ts src/cli/export-weekly-highlights.ts',
        {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, ANTHROPIC_API_KEY: 'test-key' },
        },
      );
      // No exception thrown = exit code was 0
      expect(output).toBeDefined();
    } catch (error: any) {
      // If we get here, an error was thrown. Expect status to be 0.
      if (error.status !== 0) {
        throw new Error(`Expected exit code 0, got ${error.status}`);
      }
    }
  });

  it('should exit with code 1 when export fails (empty data)', () => {
    // Empty this suite's temp copy of the store, never the real data file.
    // (Truncating the real file raced with other suites reading it in parallel.)
    fs.writeFileSync(path.join(projectRoot(), 'data/canonical_articles.ndjson'), '');

    let exitCode: number | undefined;
    try {
      execSync(
        'npx ts-node -r ./tests/helpers/stub-anthropic.ts src/cli/export-weekly-highlights.ts',
        {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          env: process.env,
        },
      );
      exitCode = 0;
    } catch (error: any) {
      exitCode = error.status;
    }
    expect(exitCode).toBe(1);
  });
});
