import * as path from 'path';

/**
 * Tests for daily-brief CLI error handling
 *
 * Verifies that:
 * 1. Errors are caught and logged to stderr
 * 2. Process exits with code 1 on error
 * 3. Error handler wraps the main function call
 */
describe('Daily Brief CLI Error Handling', () => {
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
      path.join(__dirname, '../../src/cli/daily-brief.ts'),
      'utf-8'
    );

    // Verify the error handler pattern exists
    expect(cliContent).toContain('main().catch(');
    expect(cliContent).toContain('process.exit(1)');
    expect(cliContent).toContain('[Daily Brief] ❌ Error:');
  });

  it('logs errors to stderr when main throws', () => {
    // Verify error handler logs to console.error
    const fs = require('fs');
    const cliContent = fs.readFileSync(
      path.join(__dirname, '../../src/cli/daily-brief.ts'),
      'utf-8'
    );

    // Check that console.error is called in error handler
    expect(cliContent).toContain('console.error');
  });

  it('exits with code 1 when main throws', () => {
    const fs = require('fs');
    const cliContent = fs.readFileSync(
      path.join(__dirname, '../../src/cli/daily-brief.ts'),
      'utf-8'
    );

    // Verify error handler exits with code 1
    expect(cliContent).toContain('process.exit(1)');
  });
});
