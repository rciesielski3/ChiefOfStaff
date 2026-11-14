import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const REPO_ROOT = path.resolve(__dirname, '../..');

/** ts-node binary, usable from any cwd (npx would not find it outside the repo). */
export const TS_NODE_BIN = path.join(REPO_ROOT, 'node_modules/.bin/ts-node');

/** Preload for `ts-node -r` that replaces RSS fetching with fixture articles. */
export const RSS_STUB = path.join(REPO_ROOT, 'tests/helpers/stub-rss-fetch.ts');

/**
 * Create a temp project root holding a copy of the given data/ files.
 * CLIs pointed at it (CHIEF_OF_STAFF_ROOT, or cwd for cwd-relative CLIs) read and
 * write there, so a test run never touches the real data/ or qa-news/ files.
 */
export function createTempProjectRoot(dataFiles: string[] = ['canonical_articles.ndjson']): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cos-test-'));
  fs.mkdirSync(path.join(root, 'data'));
  for (const file of dataFiles) {
    fs.copyFileSync(path.join(REPO_ROOT, 'data', file), path.join(root, 'data', file));
  }
  return root;
}

/**
 * Give the current describe block its own temp project root and point
 * CHIEF_OF_STAFF_ROOT at it. Returns a getter for the root path (valid inside tests).
 *
 * Jest gives each test file its own copy of process.env, and a child process
 * started without an `env` option inherits the real parent env instead. Pass
 * `env: process.env` (or a spread of it) to every execSync/execFileSync call.
 */
export function useTempProjectRoot(dataFiles?: string[]): () => string {
  let root = '';
  let previous: string | undefined;

  beforeAll(() => {
    previous = process.env.CHIEF_OF_STAFF_ROOT;
    root = createTempProjectRoot(dataFiles);
    process.env.CHIEF_OF_STAFF_ROOT = root;
  });

  afterAll(() => {
    if (previous === undefined) {
      delete process.env.CHIEF_OF_STAFF_ROOT;
    } else {
      process.env.CHIEF_OF_STAFF_ROOT = previous;
    }
    fs.rmSync(root, { recursive: true, force: true });
  });

  return () => root;
}
