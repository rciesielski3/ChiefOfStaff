import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { AtomicFileWriter } from '../../src/business-logic/atomic-file-writer';

describe('AtomicFileWriter', () => {
  const testDir = '/tmp/atomic-file-writer-tests';
  let testFile: string;
  let writer: AtomicFileWriter;

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    testFile = path.join(testDir, `test-${Date.now()}.json`);
    writer = new AtomicFileWriter();
  });

  afterEach(async () => {
    // Clean up test files and temp files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('writeFile()', () => {
    it('should write file atomically without corruption', async () => {
      const testData = { key: 'value', nested: { count: 42 } };
      const content = JSON.stringify(testData);

      await writer.writeFile(testFile, content);

      // Verify file exists and has correct content
      const readContent = await fs.readFile(testFile, 'utf-8');
      const parsed = JSON.parse(readContent);

      expect(parsed).toEqual(testData);
    });

    it('should not leave temp files on success', async () => {
      const testData = { message: 'test data' };
      const content = JSON.stringify(testData);

      await writer.writeFile(testFile, content);

      // List all files in test directory
      const files = await fs.readdir(testDir);

      // Should only have the main file, no temp files
      expect(files.length).toBe(1);
      expect(files[0]).toBe(path.basename(testFile));
    });

    it('should clean up temp files on error', async () => {
      const testFile2 = path.join(testDir, `test-error-${Date.now()}.json`);
      // Make directory read-only to simulate write error
      const readOnlyDir = path.join(testDir, 'readonly');
      await fs.mkdir(readOnlyDir, { recursive: true });
      fsSync.chmodSync(readOnlyDir, 0o444);

      const readOnlyFile = path.join(readOnlyDir, 'test.json');

      try {
        // This should fail due to permission denied
        await writer.writeFile(readOnlyFile, JSON.stringify({ test: 'data' }));
        fail('Should have thrown an error');
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined();
      } finally {
        // Restore permissions for cleanup
        fsSync.chmodSync(readOnlyDir, 0o755);
      }

      // List files in test directory - should not have any temp files
      const files = await fs.readdir(testDir);
      const tempFiles = files.filter(f => f.endsWith('.tmp'));
      expect(tempFiles.length).toBe(0);
    });
  });

  describe('readFile()', () => {
    it('should read files with integrity check', async () => {
      const testData = { status: 'ok', data: [1, 2, 3] };
      const content = JSON.stringify(testData);

      await writer.writeFile(testFile, content);
      const read = await writer.readFile(testFile);

      expect(read).toEqual(testData);
    });

    it('should throw on corrupted JSON', async () => {
      // Write corrupted JSON directly to file
      await fs.writeFile(testFile, '{ invalid json', 'utf-8');

      try {
        await writer.readFile(testFile);
        fail('Should have thrown on corrupted JSON');
      } catch (error) {
        expect(error).toBeDefined();
        // Verify it's a JSON parse error
        expect((error as Error).message).toContain('JSON');
      }
    });

    it('should handle non-existent files gracefully', async () => {
      const nonExistentFile = path.join(testDir, 'does-not-exist.json');

      try {
        await writer.readFile(nonExistentFile);
        fail('Should have thrown on non-existent file');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as NodeJS.ErrnoException).code).toBe('ENOENT');
      }
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent writes safely', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => {
        const data = { id: i, timestamp: Date.now() };
        return writer.writeFile(testFile, JSON.stringify(data));
      });

      await Promise.all(promises);

      // File should still be valid JSON
      const content = await fs.readFile(testFile, 'utf-8');
      const parsed = JSON.parse(content);

      // Should have at least one valid entry
      expect(parsed).toBeDefined();
      expect(typeof parsed).toBe('object');
    });
  });
});
