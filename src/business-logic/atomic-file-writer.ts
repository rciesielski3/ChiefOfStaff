import * as fs from 'fs/promises';
import * as path from 'path';
import { randomBytes } from 'crypto';

/**
 * Safe file I/O wrapper that prevents corruption via atomic writes
 *
 * - Writes to temporary file, then atomically renames to final location
 * - Reads files with JSON validation
 * - Cleans up temp files on error
 * - Handles concurrent operations safely
 */
export class AtomicFileWriter {
  /**
   * Write content to file atomically
   *
   * Process:
   * 1. Generate unique temp file path
   * 2. Write content to temp file
   * 3. Atomically rename temp file to final location
   * 4. Clean up temp file on error
   *
   * @param filePath - Target file path
   * @param content - Content to write
   * @throws If write or rename fails
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Generate unique temp file path using random bytes
    const tempFileName = `${path.basename(filePath)}.${randomBytes(8).toString('hex')}.tmp`;
    const tempPath = path.join(dir, tempFileName);

    try {
      // Write to temp file
      await fs.writeFile(tempPath, content, 'utf-8');

      // Atomic rename: move temp file to final location
      // On most filesystems, this is atomic and cannot result in partial writes
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors (temp file might not exist)
      }
      throw error;
    }
  }

  /**
   * Read and parse JSON file with integrity check
   *
   * @param filePath - File path to read
   * @returns Parsed JSON object
   * @throws If file doesn't exist or JSON is invalid
   */
  async readFile(filePath: string): Promise<Record<string, unknown>> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Validate and parse JSON
      try {
        return JSON.parse(content) as Record<string, unknown>;
      } catch (parseError) {
        throw new Error(`Invalid JSON in file ${filePath}: ${(parseError as Error).message}`);
      }
    } catch (error) {
      // Re-throw file read errors (including ENOENT)
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw error;
      }
      // Re-throw parse errors or other file read errors
      throw error;
    }
  }
}
