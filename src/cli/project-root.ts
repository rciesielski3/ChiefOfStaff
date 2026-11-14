import * as path from 'path';

/**
 * Directory that holds data/ and qa-news/ for the CLIs.
 *
 * Defaults to the repository root. CHIEF_OF_STAFF_ROOT overrides it so tests can
 * run a CLI against a temp copy of the data instead of the real files.
 */
export function resolveProjectRoot(): string {
  return process.env.CHIEF_OF_STAFF_ROOT || path.resolve(__dirname, '../..');
}
