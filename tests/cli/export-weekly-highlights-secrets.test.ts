import { execSync } from 'child_process';
import { useTempProjectRoot } from '../helpers/temp-project-root';

describe('export-weekly-highlights CLI — Environment Variable Handling', () => {
  // Each suite gets its own temp copy of the data; the CLI reads and writes there.
  useTempProjectRoot();

  it('should generate summaries when ANTHROPIC_API_KEY is set', () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key-for-unit-tests';

    try {
      const output = execSync('npx ts-node -r ./tests/helpers/stub-anthropic.ts src/cli/export-weekly-highlights.ts', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ANTHROPIC_API_KEY: 'test-key-for-unit-tests' }
      });

      const json = JSON.parse(output);
      expect(json.weeks).toBeDefined();
      expect(json.weeks.length).toBeGreaterThan(0);
      // Summaries should be generated (not empty) when key is present
      expect(json.weeks[0].summary).toBeDefined();
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
      const output = execSync('npx ts-node -r ./tests/helpers/stub-anthropic.ts src/cli/export-weekly-highlights.ts', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      const json = JSON.parse(output);
      expect(json.weeks).toBeDefined();
      // Deterministic summary (derived from items, not AI) when key missing
      expect(json.weeks[0].summary).toMatch(/^[0-9]+ stor(y|ies)\. Latest: /);
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
      const output = execSync('npx ts-node -r ./tests/helpers/stub-anthropic.ts src/cli/export-weekly-highlights.ts', {
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

  it('should produce valid JSON with deterministic summary when key missing', () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const output = execSync('npx ts-node -r ./tests/helpers/stub-anthropic.ts src/cli/export-weekly-highlights.ts', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      const json = JSON.parse(output);
      expect(json.weeks[0].summary).toMatch(/^[0-9]+ stor(y|ies)\. Latest: /);
      expect(json.weeks[0].items).toBeDefined();
      expect(Array.isArray(json.weeks[0].items)).toBe(true);
    } finally {
      if (originalKey) {
        process.env.ANTHROPIC_API_KEY = originalKey;
      }
    }
  });

  it('scenario: CLI invoked with secret key generates output', () => {
    const output = execSync('npx ts-node -r ./tests/helpers/stub-anthropic.ts src/cli/export-weekly-highlights.ts', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ANTHROPIC_API_KEY: 'test-key-for-scenario' }
    });

    const json = JSON.parse(output);
    expect(json.weeks).toBeDefined();
    expect(json.weeks.length).toBeGreaterThan(0);
  });

  it('scenario: CLI invoked without secret key falls back gracefully', () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;

    try {
      const output = execSync('npx ts-node -r ./tests/helpers/stub-anthropic.ts src/cli/export-weekly-highlights.ts', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env
      });

      const json = JSON.parse(output);
      expect(json.weeks).toBeDefined();
      expect(json.weeks[0].summary).toMatch(/^[0-9]+ stor(y|ies)\. Latest: /);
      // Fallback: articles should still be exported
      expect(json.weeks[0].items).toBeDefined();
    } finally {
      if (originalKey) {
        process.env.ANTHROPIC_API_KEY = originalKey;
      }
    }
  });
});
