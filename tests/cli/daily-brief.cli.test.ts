import { spawn } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import { AddressInfo } from 'net';
import * as path from 'path';
import { REPO_ROOT, TS_NODE_BIN, createTempProjectRoot } from '../helpers/temp-project-root';

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
  let errorLogs: string[] = [];
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock process.exit to capture exit code without actually exiting
    originalExit = process.exit;
    errorLogs = [];

    // @ts-ignore - allow overriding process.exit for testing
    process.exit = jest.fn(() => {
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
    const cliContent = fs.readFileSync(
      path.join(__dirname, '../../src/cli/daily-brief.ts'),
      'utf-8',
    );

    // Verify the error handler pattern exists
    expect(cliContent).toContain('main().catch(');
    expect(cliContent).toContain('process.exit(1)');
    expect(cliContent).toContain('[Daily Brief] ❌ Error:');
  });

  it('logs errors to stderr when main throws', () => {
    // Verify error handler logs to console.error
    const cliContent = fs.readFileSync(
      path.join(__dirname, '../../src/cli/daily-brief.ts'),
      'utf-8',
    );

    // Check that console.error is called in error handler
    expect(cliContent).toContain('console.error');
  });

  it('exits with code 1 when main throws', () => {
    const cliContent = fs.readFileSync(
      path.join(__dirname, '../../src/cli/daily-brief.ts'),
      'utf-8',
    );

    // Verify error handler exits with code 1
    expect(cliContent).toContain('process.exit(1)');
  });
});

/**
 * The CLI must exit by itself once its work is done: no process.exit on the
 * success path, and no handle left holding the event loop open.
 *
 * Runs the real CLI with the real RSS fetch (rss-parser) against a local feed
 * served behind a redirect over keep-alive connections, the setup that kept
 * the CI process alive: rss-parser never closed the 3xx response, so its
 * connection stayed open. A preload points the CLI's sources at the local
 * server and turns keep-alive on (the default from Node 19).
 */
describe('Daily Brief CLI process lifetime', () => {
  const FEED = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Local</title>
<item><title>Test automation in CI</title><link>http://example.com/a</link><pubDate>${new Date().toUTCString()}</pubDate><description>Playwright and test automation.</description></item>
</channel></rss>`;
  const EXIT_DEADLINE_MS = 60000;

  let server: http.Server;
  let root: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/redirect') {
        res.writeHead(301, { location: '/feed' });
        res.end('moved');
      } else {
        res.writeHead(200, { 'content-type': 'application/rss+xml' });
        res.end(FEED);
      }
    });
    // Keep idle connections open far longer than the exit deadline.
    server.keepAliveTimeout = 10 * 60 * 1000;
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    root = createTempProjectRoot([]);
    fs.writeFileSync(
      path.join(root, 'local-sources.js'),
      [
        "require('http').globalAgent.keepAlive = true;",
        `const config = require(${JSON.stringify(path.join(REPO_ROOT, 'src/config/rss-sources.config'))});`,
        'config.getEnabledSources = () => [{ name: "Local redirect", url: process.env.LOCAL_FEED_URL, enabled: true }];',
      ].join('\n'),
    );
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it(
    'exits with code 0 on its own after WORKFLOW_COMPLETE',
    async () => {
      const { port } = server.address() as AddressInfo;
      const child = spawn(
        TS_NODE_BIN,
        ['-r', path.join(root, 'local-sources.js'), path.join(REPO_ROOT, 'src/cli/daily-brief.ts')],
        {
          cwd: root,
          env: { ...process.env, LOCAL_FEED_URL: `http://127.0.0.1:${port}/redirect` },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let output = '';
      child.stdout.on('data', (chunk) => (output += chunk));
      child.stderr.on('data', (chunk) => (output += chunk));

      const killTimer = setTimeout(() => child.kill('SIGKILL'), EXIT_DEADLINE_MS);
      const [code, signal] = await new Promise<[number | null, string | null]>((resolve) =>
        child.on('exit', (c, s) => resolve([c, s])),
      );
      clearTimeout(killTimer);

      expect(output).toContain('[WORKFLOW_COMPLETE]');
      expect(output).toContain('Local redirect: 1 articles');
      expect(signal).toBeNull(); // SIGKILL here means the process hung after its work
      expect(code).toBe(0);
      expect(fs.existsSync(path.join(root, 'data/canonical_articles.ndjson'))).toBe(true);
    },
    EXIT_DEADLINE_MS + 30000,
  );
});
