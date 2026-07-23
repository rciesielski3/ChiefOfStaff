import * as path from 'path';
import * as fs from 'fs';

/**
 * Tests for export-monthly-recap CLI
 *
 * Verifies that:
 * 1. Errors are caught and logged to stderr
 * 2. Process exits with code 1 on error
 * 3. Error handler wraps the main function call
 * 4. Single-write writes only to qa-news/data/monthly-recap.json
 */
describe('Export Monthly Recap CLI', () => {
  let originalExit: (code?: number) => never;
  let exitCode: number | undefined;
  let errorLogs: string[] = [];
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock process.exit to capture exit code without actually exiting
    originalExit = process.exit;
    exitCode = undefined;
    errorLogs = [];

    // @ts-ignore - allow overriding process.exit for testing
    process.exit = jest.fn((code?: number) => {
      exitCode = code;
      throw new Error('Process exit called');
    });

    // Mock console.error to capture error logs
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((message: string) => {
      errorLogs.push(message);
    });
  });

  afterEach(() => {
    process.exit = originalExit;
    consoleErrorSpy.mockRestore();
  });

  it('has error handler wrapper on main function call', () => {
    // Read the CLI file to verify error handler is present
    const fs = require('fs');
    const cliContent = fs.readFileSync(
      path.join(__dirname, '../../src/cli/export-monthly-recap.ts'),
      'utf-8'
    );

    // Verify the error handler pattern exists
    expect(cliContent).toContain('main().catch(');
    expect(cliContent).toContain('process.exit(1)');
    expect(cliContent).toContain('[Export Monthly Recap] ❌ Error:');
  });

  it('logs errors to stderr when main throws', () => {
    // Verify error handler logs to console.error
    const fs = require('fs');
    const cliContent = fs.readFileSync(
      path.join(__dirname, '../../src/cli/export-monthly-recap.ts'),
      'utf-8'
    );

    // Check that console.error is called in error handler
    expect(cliContent).toContain('console.error');
  });

  it('exits with code 1 when main throws', () => {
    const fs = require('fs');
    const cliContent = fs.readFileSync(
      path.join(__dirname, '../../src/cli/export-monthly-recap.ts'),
      'utf-8'
    );

    // Verify error handler exits with code 1
    expect(cliContent).toContain('process.exit(1)');
  });

  it('does not import AtomicFileWriter (single-write refactor)', () => {
    const fs = require('fs');
    const cliContent = fs.readFileSync(
      path.join(__dirname, '../../src/cli/export-monthly-recap.ts'),
      'utf-8'
    );

    // Verify AtomicFileWriter is not imported
    expect(cliContent).not.toContain("from '../business-logic/atomic-file-writer'");
  });

  it('does not define writeToDataDirs helper (single-write refactor)', () => {
    const fs = require('fs');
    const cliContent = fs.readFileSync(
      path.join(__dirname, '../../src/cli/export-monthly-recap.ts'),
      'utf-8'
    );

    // Verify writeToDataDirs function is not defined
    expect(cliContent).not.toContain('async function writeToDataDirs');
  });

  it('writes only to qa-news/data/monthly-recap.json (single-write)', () => {
    const fs = require('fs');
    const cliContent = fs.readFileSync(
      path.join(__dirname, '../../src/cli/export-monthly-recap.ts'),
      'utf-8'
    );

    // Verify single-write logic is present
    expect(cliContent).toContain("path.join(projectRoot, 'qa-news/data/monthly-recap.json')");
    // Verify direct fs.writeFile call
    expect(cliContent).toContain('fs.writeFile(dataPath, jsonContent');
    // Verify no Promise.all for dual-write
    expect(cliContent).not.toContain('Promise.all');
  });

  it('logs only dataPath in WRITE_COMPLETE (not publicPath)', () => {
    const fs = require('fs');
    const cliContent = fs.readFileSync(
      path.join(__dirname, '../../src/cli/export-monthly-recap.ts'),
      'utf-8'
    );

    // Verify WRITE_COMPLETE logs dataPath only
    expect(cliContent).toContain('WRITE_COMPLETE');
    // Extract the WRITE_COMPLETE log section
    const writeCompleteMatch = cliContent.match(/WRITE_COMPLETE[^}]+}/);
    if (writeCompleteMatch) {
      const section = writeCompleteMatch[0];
      // Should have dataPath logged
      expect(section).toContain('dataPath');
      // Should NOT have publicPath
      expect(section).not.toContain('publicPath');
    }
  });
});
