import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execSync } from 'child_process';

/**
 * Tests for generate-insights CLI non-blocking validation
 *
 * Verifies that:
 * 1. CLI exits with code 0 on valid data
 * 2. CLI exits with code 0 when no facts are available
 * 3. CLI exits with code 0 on validation failures (non-blocking)
 *
 * Key behavior: Validation failures are non-blocking. The pipeline completes
 * successfully even when validation detects issues, logging warnings but not
 * exiting with error code.
 *
 * Implementation: Uses temp fixtures via KNOWLEDGE_FACTS_PATH and INSIGHTS_PATH
 * environment variables to avoid mutating git-tracked data files.
 */
describe('Generate Insights CLI - Non-Blocking Validation', () => {
  const projectRoot = path.resolve(__dirname, '../../');
  let tempDir: string;

  beforeEach(() => {
    // Create a unique temp directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-insights-test-'));
  });

  afterEach(() => {
    // Clean up temp directory and files
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(tempDir, file));
      });
      fs.rmdirSync(tempDir);
    }
  });

  /**
   * Test 1: Basic non-blocking behavior
   *
   * Verifies:
   * - CLI exits with code 0 when processing valid knowledge facts
   * - Pipeline completes successfully
   * - No git-tracked files are mutated
   */
  it('CLI runs without error on valid data (temp fixtures)', () => {
    // Create temp facts file with 3 valid facts
    const tempFactsPath = path.join(tempDir, 'facts.ndjson');
    const factContent = [
      { id: 'fact-1', article_id: 'art-1', content: 'This is a detailed fact about AI development that contains sufficient content to meet the minimum length requirement for a fact entry.', type: 'DEFINITION', confidence: 0.95, extraction_method: 'claude', extracted_at: '2026-07-23T00:00:00Z', version: 1, status: 'active' },
      { id: 'fact-2', article_id: 'art-2', content: 'Another important fact about machine learning practices that should be at least fifty characters long for validity in the knowledge system.', type: 'TECHNIQUE', confidence: 0.88, extraction_method: 'claude', extracted_at: '2026-07-23T00:00:00Z', version: 1, status: 'active' },
      { id: 'fact-3', article_id: 'art-3', content: 'A benchmark measurement showing that system performance improved significantly in the latest release with substantial gains across all metrics.', type: 'BENCHMARK', confidence: 0.92, extraction_method: 'claude', extracted_at: '2026-07-23T00:00:00Z', version: 1, status: 'active' },
    ];
    factContent.forEach(fact => {
      fs.appendFileSync(tempFactsPath, JSON.stringify(fact) + '\n');
    });

    // Create empty temp insights file (insights will be generated)
    const tempInsightsPath = path.join(tempDir, 'insights.ndjson');
    fs.writeFileSync(tempInsightsPath, '');

    let exitCode = 0;
    let output = '';

    try {
      // Redirect stderr to stdout to capture console.warn output
      output = execSync('npx ts-node src/cli/generate-insights.ts 2>&1', {
        cwd: projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
        env: {
          ...process.env,
          KNOWLEDGE_FACTS_PATH: tempFactsPath,
          INSIGHTS_PATH: tempInsightsPath,
        },
      });
    } catch (e) {
      if (e instanceof Error && 'status' in e) {
        exitCode = (e as any).status || 1;
      } else {
        throw e;
      }
    }

    // Should exit cleanly with code 0
    expect(exitCode).toBe(0);
    // Verify pipeline ran to completion
    expect(output).toContain('Pipeline Complete');
  });

  /**
   * Test 2: Validation failure path - CRITICAL TEST
   *
   * Verifies through integration test:
   * - The validation failure handling code (lines 230-236) executes
   * - Validation detects hallucinations (insights referencing non-existent facts)
   * - Warnings are logged via console.warn
   * - Pipeline completes with exit code 0 (non-blocking validation)
   *
   * This test exercises the warning branch by creating insights that reference
   * fact IDs that don't exist in the facts file, triggering hallucination detection.
   * This test specifically verifies that lines 230-236 of generate-insights.ts execute.
   */
  it('validates and logs warnings on hallucinated fact references (temp fixtures)', () => {
    // Create temp facts file with 3 valid facts
    const tempFactsPath = path.join(tempDir, 'facts.ndjson');
    const factContent = [
      { id: 'fact-1', article_id: 'art-1', content: 'This is a detailed fact about AI development that contains sufficient content to meet the minimum length requirement for a fact entry.', type: 'DEFINITION', confidence: 0.95, extraction_method: 'claude', extracted_at: '2026-07-23T00:00:00Z', version: 1, status: 'active' },
      { id: 'fact-2', article_id: 'art-2', content: 'Another important fact about machine learning practices that should be at least fifty characters long for validity in the knowledge system.', type: 'TECHNIQUE', confidence: 0.88, extraction_method: 'claude', extracted_at: '2026-07-23T00:00:00Z', version: 1, status: 'active' },
      { id: 'fact-3', article_id: 'art-3', content: 'A benchmark measurement showing that system performance improved significantly in the latest release with substantial gains across all metrics.', type: 'BENCHMARK', confidence: 0.92, extraction_method: 'claude', extracted_at: '2026-07-23T00:00:00Z', version: 1, status: 'active' },
    ];
    factContent.forEach(fact => {
      fs.appendFileSync(tempFactsPath, JSON.stringify(fact) + '\n');
    });

    // Create temp insights file with an insight that references a non-existent fact (fact-999)
    // This will cause the validator to detect a hallucination and add a failure
    const tempInsightsPath = path.join(tempDir, 'insights.ndjson');
    const insightWithHallucination = {
      id: 'insight-hallucination-test',
      type: 'SYNTHESIS',
      title: 'Hallucinated insight for testing validation warnings',
      summary: 'This insight references a fact that does not exist in the knowledge base',
      confidence: 0.75,
      relatedFactIds: ['fact-1', 'fact-999'], // fact-999 does not exist, will trigger hallucination detection
      domains: ['test'],
      tags: ['test', 'validation'],
      supportingEvidence: ['test evidence'],
      evolutionStage: 'new',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(tempInsightsPath, JSON.stringify(insightWithHallucination) + '\n');

    let exitCode = 0;
    let output = '';

    try {
      // Redirect stderr to stdout to capture console.warn output (for validation warnings)
      output = execSync('npx ts-node src/cli/generate-insights.ts 2>&1', {
        cwd: projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
        env: {
          ...process.env,
          KNOWLEDGE_FACTS_PATH: tempFactsPath,
          INSIGHTS_PATH: tempInsightsPath,
        },
      });
    } catch (e) {
      if (e instanceof Error && 'status' in e) {
        exitCode = (e as any).status || 1;
      } else {
        throw e;
      }
    }

    // Verify exit code is 0 (validation is non-blocking)
    expect(exitCode).toBe(0);

    // Verify validation stage ran and detected the failure
    expect(output).toContain('VALIDATION_COMPLETE');
    expect(output).toContain('Validation warnings detected');

    // Verify the specific hallucination was detected
    expect(output).toContain('references non-existent fact');

    // Verify pipeline continued despite validation failure
    expect(output).toContain('Pipeline Complete');
  });

  /**
   * Test 3: Empty facts case
   *
   * Verifies:
   * - CLI handles the case when no facts are available
   * - Pipeline skips gracefully without error
   * - Exit code is 0 (no error)
   */
  it('CLI exits 0 when no facts are available (temp fixtures)', () => {
    // Create empty temp facts file
    const tempFactsPath = path.join(tempDir, 'facts.ndjson');
    fs.writeFileSync(tempFactsPath, '');

    // Create empty temp insights file
    const tempInsightsPath = path.join(tempDir, 'insights.ndjson');
    fs.writeFileSync(tempInsightsPath, '');

    let exitCode = 0;
    let output = '';

    try {
      // Redirect stderr to stdout to capture console.warn output
      output = execSync('npx ts-node src/cli/generate-insights.ts 2>&1', {
        cwd: projectRoot,
        encoding: 'utf-8',
        stdio: 'pipe',
        env: {
          ...process.env,
          KNOWLEDGE_FACTS_PATH: tempFactsPath,
          INSIGHTS_PATH: tempInsightsPath,
        },
      });
    } catch (e) {
      if (e instanceof Error && 'status' in e) {
        exitCode = (e as any).status || 1;
      } else {
        throw e;
      }
    }

    // Should exit cleanly with code 0 even with no facts
    expect(exitCode).toBe(0);

    // Verify pipeline skipped gracefully
    expect(output).toContain('PIPELINE_SKIPPED');
    expect(output).toContain('No facts found');
  });
});
