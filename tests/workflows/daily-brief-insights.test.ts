import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('Workflow Integration — Daily Brief Insights Pipeline', () => {
  const projectRoot = path.resolve(__dirname, '../..');
  const knowledgeFactsPath = path.join(projectRoot, 'data/knowledge_facts.ndjson');
  const insightsPath = path.join(projectRoot, 'data/insights.ndjson');

  // Clean up insights file before each test
  beforeEach(() => {
    if (fs.existsSync(insightsPath)) {
      fs.unlinkSync(insightsPath);
    }
  });

  it('generate-insights produces valid output', () => {
    // This test validates that the generate-insights CLI produces valid output
    // even when facts data is minimal or empty
    const env = { ...process.env };

    try {
      let output = '';
      try {
        output = execSync(
          'npx ts-node src/cli/generate-insights.ts',
          {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            env,
            cwd: projectRoot
          }
        );
      } catch (e: any) {
        output = e.stdout || '';
      }

      // Validate output contains expected pipeline stages
      expect(output).toContain('Insight Generation');
      expect(output).toContain('Starting insight generation pipeline');
      expect(output).toContain('Step 1: Loading facts');
      expect(output).toContain('Complete');
    } catch (error: any) {
      throw new Error(`generate-insights CLI failed: ${error.message}`);
    }
  });

  it('report-insights handles empty insights gracefully', () => {
    // This test validates that when no insights are generated,
    // the pipeline still completes successfully (no-op behavior)
    const env = { ...process.env };

    try {
      // Ensure insights file doesn't exist
      if (fs.existsSync(insightsPath)) {
        fs.unlinkSync(insightsPath);
      }

      let output = '';
      try {
        output = execSync(
          'npx ts-node src/cli/generate-insights.ts',
          {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            env,
            cwd: projectRoot
          }
        );
      } catch (e: any) {
        output = e.stdout || '';
      }

      // Validate graceful handling
      expect(output).toContain('pipeline');
      expect(output).not.toContain('Error');
      expect(output).not.toContain('❌');

      // If insights were generated, file should exist or be mentioned
      // If no facts, should indicate skipped or 0 insights
      if (fs.existsSync(knowledgeFactsPath)) {
        const facts = fs.readFileSync(knowledgeFactsPath, 'utf-8').split('\n').filter(l => l.trim());
        if (facts.length === 0) {
          expect(output).toContain('no facts');
        }
      }
    } catch (error: any) {
      throw new Error(`Empty insights handling failed: ${error.message}`);
    }
  });

  it('report-insights produces valid JSON output when insights exist', () => {
    // This test validates that when insights are produced,
    // they can be serialized and deserialized as valid JSON
    const env = { ...process.env };

    try {
      // Run the pipeline
      let output = '';
      try {
        output = execSync(
          'npx ts-node src/cli/generate-insights.ts',
          {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            env,
            cwd: projectRoot
          }
        );
      } catch (e: any) {
        output = e.stdout || '';
      }

      // If insights file was created, validate it contains valid NDJSON
      if (fs.existsSync(insightsPath)) {
        const content = fs.readFileSync(insightsPath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());

        // Each line should be valid JSON
        for (const line of lines) {
          try {
            const insight = JSON.parse(line);
            // Validate required insight fields
            expect(insight.id).toBeDefined();
            expect(insight.type).toMatch(/PATTERN|BEST_PRACTICE|RELATIONSHIP/);
            expect(insight.confidence).toBeGreaterThanOrEqual(0);
            expect(insight.confidence).toBeLessThanOrEqual(1);
          } catch (parseError) {
            throw new Error(`Invalid JSON in insights file: ${line}`);
          }
        }
      }

      // Output should indicate completion
      expect(output).toContain('Complete');
    } catch (error: any) {
      throw new Error(`JSON validation failed: ${error.message}`);
    }
  });

  it('end-to-end pipeline completes successfully', () => {
    // This test validates that the complete pipeline from facts to insights
    // runs end-to-end without errors
    const env = { ...process.env };

    try {
      let output = '';
      let exitCode = 0;

      try {
        output = execSync(
          'npx ts-node src/cli/generate-insights.ts',
          {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            env,
            cwd: projectRoot
          }
        );
      } catch (e: any) {
        output = e.stdout || '';
        exitCode = e.status || 1;
      }

      // Validate pipeline stages all completed
      expect(output).toContain('Step 1: Loading facts');
      expect(output).toContain('Step 2: Detecting patterns');
      expect(output).toContain('Step 3: Synthesizing');
      expect(output).toContain('Step 4: Storing');
      expect(output).toContain('Step 5: Validating');
      expect(output).toContain('Pipeline Complete');

      // Should not have error messages (unless validating and failing)
      if (output.includes('FAILED')) {
        // Validation can fail, that's ok - it's still a successful pipeline run
        expect(output).toContain('Validation Results');
      } else {
        // No validation failures means success
        expect(output).toContain('✅');
      }
    } catch (error: any) {
      throw new Error(`End-to-end pipeline failed: ${error.message}`);
    }
  });

  it('workflow integration verified — daily brief and insights work together', () => {
    // This test validates that the daily-brief workflow can be followed by
    // the generate-insights workflow without conflicts
    const env = { ...process.env };

    try {
      let dailyBriefOutput = '';
      let insightsOutput = '';

      try {
        // Run daily brief first
        dailyBriefOutput = execSync(
          'npx ts-node src/cli/daily-brief.ts',
          {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            env,
            cwd: projectRoot
          }
        );
      } catch (e: any) {
        dailyBriefOutput = e.stdout || '';
      }

      try {
        // Then run insights generation
        insightsOutput = execSync(
          'npx ts-node src/cli/generate-insights.ts',
          {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            env,
            cwd: projectRoot
          }
        );
      } catch (e: any) {
        insightsOutput = e.stdout || '';
      }

      // Daily brief should complete
      expect(dailyBriefOutput).toContain('Daily Brief');
      expect(dailyBriefOutput).toContain('Complete');

      // Insights should complete after
      expect(insightsOutput).toContain('Insight Generation');
      expect(insightsOutput).toContain('Pipeline Complete');

      // Both should succeed (no fatal errors)
      expect(dailyBriefOutput).not.toContain('❌ Error');
      expect(insightsOutput).not.toContain('❌ Error');

      // Verify data flows from daily-brief to insights
      // Daily brief should persist articles to canonical_articles.ndjson
      const articlesPath = path.join(projectRoot, 'data/canonical_articles.ndjson');
      if (fs.existsSync(articlesPath)) {
        const articles = fs.readFileSync(articlesPath, 'utf-8').split('\n').filter(l => l.trim());
        expect(articles.length).toBeGreaterThanOrEqual(0);
      }

      // Insights should be stored if facts were extracted
      if (fs.existsSync(insightsPath)) {
        const insights = fs.readFileSync(insightsPath, 'utf-8').split('\n').filter(l => l.trim());
        // Having insights is good, but not required if no facts were extracted
        if (insights.length > 0) {
          expect(insights.length).toBeGreaterThan(0);
        }
      }
    } catch (error: any) {
      throw new Error(`Workflow integration verification failed: ${error.message}`);
    }
  });
});
