import { execSync } from 'child_process';

describe('export-qa-news CLI — Exit Codes', () => {
  it('should exit with code 0 on successful export', () => {
    try {
      const output = execSync(
        'npx ts-node src/cli/export-weekly-highlights.ts',
        {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, ANTHROPIC_API_KEY: 'test-key' }
        }
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
    try {
      // Clear the data to force empty export
      const fs = require('fs');
      const path = require('path');
      const testDataPath = path.join(process.cwd(), 'data/canonical_articles.ndjson');

      // Temporarily back up and clear data
      const backupPath = testDataPath + '.backup';
      if (fs.existsSync(testDataPath)) {
        fs.copyFileSync(testDataPath, backupPath);
        fs.writeFileSync(testDataPath, '');
      }

      try {
        execSync(
          'npx ts-node src/cli/export-weekly-highlights.ts',
          {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe']
          }
        );
        // If we get here without exception, exit code was 0 (unexpected)
        throw new Error('Expected exit code 1, but got 0');
      } catch (error: any) {
        // We expect an error with status code 1
        expect(error.status).toBe(1);
        expect(error.message).toContain('');
      }
    } finally {
      // Restore data
      const fs = require('fs');
      const path = require('path');
      const testDataPath = path.join(process.cwd(), 'data/canonical_articles.ndjson');
      const backupPath = testDataPath + '.backup';
      if (require('fs').existsSync(backupPath)) {
        fs.copyFileSync(backupPath, testDataPath);
        fs.unlinkSync(backupPath);
      }
    }
  });
});
