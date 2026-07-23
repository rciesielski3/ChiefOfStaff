import { execSync } from 'child_process';
import * as path from 'path';

describe('export-monthly-recap CLI — Environment Variable Handling', () => {
  const dataDir = path.join(process.cwd(), 'data');
  const outputFile = path.join(process.cwd(), 'qa-news/public/monthly.json');

  beforeEach(() => {
    // Ensure test data exists
    const testDataPath = path.join(dataDir, 'qa-news-latest.ndjson');
    if (!require('fs').existsSync(testDataPath)) {
      require('fs').writeFileSync(testDataPath, '');
    }
  });

  it('should generate summaries when ANTHROPIC_API_KEY is set', () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key-for-unit-tests';

    try {
      const output = execSync('npx ts-node src/cli/export-monthly-recap.ts', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ANTHROPIC_API_KEY: 'test-key-for-unit-tests' }
      });

      const json = JSON.parse(output);
      expect(json.months).toBeDefined();
      expect(json.months.length).toBeGreaterThan(0);
      // Summaries should be generated (not empty) when key is present
      expect(json.months[0].summary).toBeDefined();
    } finally {
      if (originalKey) {
        process.env.ANTHROPIC_API_KEY = originalKey;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    }
  });

  it('should skip summaries when ANTHROPIC_API_KEY is missing', () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const output = execSync('npx ts-node src/cli/export-monthly-recap.ts', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      const json = JSON.parse(output);
      expect(json.months).toBeDefined();
      // Summaries should be empty or fallback text when key missing
      expect(json.months[0].summary).toBe('');
    } finally {
      if (originalKey) {
        process.env.ANTHROPIC_API_KEY = originalKey;
      }
    }
  });

  it('should exit with code 0 when ANTHROPIC_API_KEY is missing', () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const output = execSync('npx ts-node src/cli/export-monthly-recap.ts', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });
      // If no error thrown, exit code was 0
      expect(output).toBeDefined();
    } catch (error: any) {
      // Exit code 0 means no exception; if we get here, exit code was not 0
      expect(error.status).toBe(0);
    } finally {
      if (originalKey) {
        process.env.ANTHROPIC_API_KEY = originalKey;
      }
    }
  });

  it('should produce valid JSON with empty summary field when key missing', () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const output = execSync('npx ts-node src/cli/export-monthly-recap.ts', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      const json = JSON.parse(output);
      expect(json.months[0].summary).toBe('');
      expect(json.months[0].items).toBeDefined();
      expect(Array.isArray(json.months[0].items)).toBe(true);
    } finally {
      if (originalKey) {
        process.env.ANTHROPIC_API_KEY = originalKey;
      }
    }
  });

  it('scenario: CLI invoked with secret key generates output', () => {
    const output = execSync('npx ts-node src/cli/export-monthly-recap.ts', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ANTHROPIC_API_KEY: 'test-key-for-scenario' }
    });

    const json = JSON.parse(output);
    expect(json.months).toBeDefined();
    expect(json.months.length).toBeGreaterThan(0);
  });

  it('scenario: CLI invoked without secret key falls back gracefully', () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;

    try {
      const output = execSync('npx ts-node src/cli/export-monthly-recap.ts', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env
      });

      const json = JSON.parse(output);
      expect(json.months).toBeDefined();
      expect(json.months[0].summary).toBe('');
      // Fallback: articles should still be exported
      expect(json.months[0].items).toBeDefined();
    } finally {
      if (originalKey) {
        process.env.ANTHROPIC_API_KEY = originalKey;
      }
    }
  });
});
