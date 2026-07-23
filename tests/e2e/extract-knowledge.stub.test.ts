import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('Extract-Knowledge CLI (E2E Stubs)', () => {
  const testDataDir = 'data/test-e2e';

  beforeAll(() => {
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true });
    }
  });

  test('CLI is callable: --help option', () => {
    const output = execSync(
      'npx ts-node src/cli/extract-knowledge.ts --help',
      { encoding: 'utf-8' }
    );

    expect(output).toContain('extract-knowledge');
    expect(output).toContain('Options:');
  });

  test('CLI callable with basic invocation (returns exit code 0)', () => {
    try {
      const output = execSync(
        'npx ts-node src/cli/extract-knowledge.ts --version',
        { encoding: 'utf-8' }
      );

      expect(output).toBeDefined();
    } catch (error: any) {
      fail(`CLI should exit with 0, got: ${error.message}`);
    }
  });

  test('CLI validates required arguments (exit 1 on missing input)', () => {
    try {
      execSync(
        'npx ts-node src/cli/extract-knowledge.ts',
        { encoding: 'utf-8' }
      );
      fail('Should have exited with error');
    } catch (error: any) {
      expect(error.status).toBe(1);
      expect(error.stderr || error.message).toContain('require');
    }
  });

  test('CLI processes sample articles and produces NDJSON output', () => {
    const sampleArticles = [
      {
        id: 'a1',
        title: 'Kubernetes Guide',
        content: 'Kubernetes simplifies container orchestration',
      },
    ];

    const inputPath = path.join(testDataDir, 'sample.ndjson');
    fs.writeFileSync(
      inputPath,
      sampleArticles.map(a => JSON.stringify(a)).join('\n')
    );

    const outputPath = path.join(testDataDir, 'output.ndjson');

    try {
      execSync(
        `npx ts-node src/cli/extract-knowledge.ts --input ${inputPath} --output ${outputPath}`,
        { encoding: 'utf-8' }
      );

      expect(fs.existsSync(outputPath)).toBe(true);

      const output = fs.readFileSync(outputPath, 'utf-8');
      const lines = output.split('\n').filter(l => l.trim());
      expect(lines.length).toBeGreaterThan(0);

      lines.forEach(line => {
        const parsed = JSON.parse(line);
        expect(parsed).toHaveProperty('id');
        expect(parsed).toHaveProperty('content');
      });
    } catch (error) {
      console.error('CLI execution failed:', error);
      fail('CLI should process articles and produce NDJSON');
    }
  });

  test('CLI exit code validation: success path (exit 0)', () => {
    const inputPath = path.join(testDataDir, 'sample.ndjson');
    const outputPath = path.join(testDataDir, 'output.ndjson');

    if (!fs.existsSync(inputPath)) {
      fs.writeFileSync(
        inputPath,
        JSON.stringify({ id: 'a1', title: 'Test', content: 'Test content' })
      );
    }

    try {
      execSync(
        `npx ts-node src/cli/extract-knowledge.ts --input ${inputPath} --output ${outputPath}`
      );
      expect(true).toBe(true);
    } catch (error: any) {
      fail(`Expected exit code 0, got ${error.status}`);
    }
  });

  test('CLI documentation: E2E stubs verify callable, full E2E in future', () => {
    const docPath = 'docs/knowledge/cli-testing-gaps.md';
    expect(fs.existsSync(docPath)).toBe(true);

    const doc = fs.readFileSync(docPath, 'utf-8');
    expect(doc).toContain('E2E Stubs');
    expect(doc).toContain('Full E2E');
  });
});
