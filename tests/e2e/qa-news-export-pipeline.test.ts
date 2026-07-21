import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('QA-News Export Pipeline (E2E)', () => {
  const projectRoot = path.resolve(__dirname, '../../');

  /**
   * Test 1: Weekly highlights CLI is callable and produces valid JSON
   */
  test('weekly CLI is callable and produces valid JSON', () => {
    try {
      const output = execSync(
        'npx ts-node src/cli/export-weekly-highlights.ts',
        {
          cwd: projectRoot,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']  // Capture stdout and stderr separately
        }
      );

      // Parse the JSON output
      const parsed = JSON.parse(output);

      // Verify structure
      expect(parsed).toHaveProperty('weeks');
      expect(Array.isArray(parsed.weeks)).toBe(true);

      // If there are weeks, verify each week has the expected structure
      if (parsed.weeks.length > 0) {
        parsed.weeks.forEach((week: any) => {
          expect(week).toHaveProperty('weekOf');
          expect(week).toHaveProperty('summary');
          expect(Array.isArray(week.items)).toBe(true);

          // Verify week format (YYYY-MM-DD)
          expect(/^\d{4}-\d{2}-\d{2}$/.test(week.weekOf)).toBe(true);
        });
      }
    } catch (error: any) {
      // If the data store is empty, exit code 1 is expected
      if (error.status === 1) {
        expect(error.stderr || error.message).toContain('empty_export');
      } else {
        throw new Error(`Weekly CLI failed with unexpected error: ${error.message}`);
      }
    }
  });

  /**
   * Test 2: Monthly recap CLI is callable and produces valid JSON
   */
  test('monthly CLI is callable and produces valid JSON', () => {
    try {
      const output = execSync(
        'npx ts-node src/cli/export-monthly-recap.ts',
        {
          cwd: projectRoot,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']  // Capture stdout and stderr separately
        }
      );

      // Parse the JSON output
      const parsed = JSON.parse(output);

      // Verify structure
      expect(parsed).toHaveProperty('months');
      expect(Array.isArray(parsed.months)).toBe(true);

      // If there are months, verify each month has the expected structure
      if (parsed.months.length > 0) {
        parsed.months.forEach((month: any) => {
          expect(month).toHaveProperty('monthOf');
          expect(month).toHaveProperty('summary');
          expect(Array.isArray(month.items)).toBe(true);

          // Verify month format (YYYY-MM-01)
          expect(/^\d{4}-\d{2}-01$/.test(month.monthOf)).toBe(true);
        });
      }
    } catch (error: any) {
      // If the data store is empty, exit code 1 is expected
      if (error.status === 1) {
        expect(error.stderr || error.message).toContain('empty_export');
      } else {
        throw new Error(`Monthly CLI failed with unexpected error: ${error.message}`);
      }
    }
  });

  /**
   * Test 3: All three exports (weekly and monthly) can run together
   * Note: weekly and monthly CLIs output JSON to stdout for pipeline use
   */
  test('all three exports (latest, weekly, monthly) can run together', () => {
    try {
      // Note: export-latest-news writes to file, so we just verify it runs
      execSync(
        'npx ts-node src/cli/export-latest-news.ts',
        {
          cwd: projectRoot,
          stdio: ['pipe', 'pipe', 'pipe']
        }
      );

      // Run weekly and monthly CLIs which output JSON to stdout
      const weeklyOutput = execSync(
        'npx ts-node src/cli/export-weekly-highlights.ts',
        {
          cwd: projectRoot,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        }
      );

      const monthlyOutput = execSync(
        'npx ts-node src/cli/export-monthly-recap.ts',
        {
          cwd: projectRoot,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe']
        }
      );

      // Parse weekly and monthly outputs
      const weekly = JSON.parse(weeklyOutput);
      const monthly = JSON.parse(monthlyOutput);

      // Verify structure
      expect(weekly).toHaveProperty('weeks');
      expect(monthly).toHaveProperty('months');
      expect(Array.isArray(weekly.weeks)).toBe(true);
      expect(Array.isArray(monthly.months)).toBe(true);
    } catch (error: any) {
      // If the data store is empty, all three would exit 1
      if (error.status === 1) {
        expect(error.stderr || error.message).toContain('empty_export');
      } else {
        throw new Error(`Export pipeline failed with unexpected error: ${error.message}`);
      }
    }
  });

  /**
   * Test 4: Verify exit codes are correct
   */
  test('CLIs exit with code 0 on success or 1 on empty export', () => {
    // Test latest
    try {
      execSync(
        'npx ts-node src/cli/export-latest-news.ts',
        { cwd: projectRoot, stdio: 'pipe' }
      );
      expect(true).toBe(true);  // Success case
    } catch (error: any) {
      expect(error.status).toBe(1);  // Expected exit code for empty export
    }

    // Test weekly
    try {
      execSync(
        'npx ts-node src/cli/export-weekly-highlights.ts',
        { cwd: projectRoot, stdio: 'pipe' }
      );
      expect(true).toBe(true);  // Success case
    } catch (error: any) {
      expect(error.status).toBe(1);  // Expected exit code for empty export
    }

    // Test monthly
    try {
      execSync(
        'npx ts-node src/cli/export-monthly-recap.ts',
        { cwd: projectRoot, stdio: 'pipe' }
      );
      expect(true).toBe(true);  // Success case
    } catch (error: any) {
      expect(error.status).toBe(1);  // Expected exit code for empty export
    }
  });
});
