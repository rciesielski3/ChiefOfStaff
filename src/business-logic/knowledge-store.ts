/**
 * M6.1 Knowledge Fact Storage
 *
 * Persists extracted facts to NDJSON with deduplication and versioning.
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { KnowledgeFact } from './knowledge-types';

/**
 * Service for storing and retrieving knowledge facts from NDJSON
 */
export class FactStore {
  private filePath: string;
  private lockFilePath: string;
  private readonly LOCK_TIMEOUT_MS = 30000; // 30 second lock timeout

  constructor(filePath: string = 'data/knowledge_facts.ndjson') {
    this.filePath = filePath;
    this.lockFilePath = `${filePath}.lock`;
  }

  async append(facts: KnowledgeFact[]): Promise<{ stored: number; deduplicated: number }> {
    // Acquire lock to prevent concurrent writes
    await this.acquireLock();

    try {
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      // Read existing facts to check for duplicates (under lock)
      const existingHashes = await this.readHashes();

      let stored = 0;
      let deduplicated = 0;
      const newLines: string[] = [];

      for (const fact of facts) {
        const hash = this.hashContent(fact.content);

        if (existingHashes.has(hash)) {
          deduplicated++;
          continue;
        }

        newLines.push(JSON.stringify(fact));
        stored++;
        existingHashes.add(hash);
      }

      // Append to file
      if (newLines.length > 0) {
        const content = newLines.join('\n') + '\n';
        await fs.appendFile(this.filePath, content, 'utf-8');
      }

      return { stored, deduplicated };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to append facts to store: ${msg}`);
    } finally {
      // Always release lock
      await this.releaseLock();
    }
  }

  async readAll(): Promise<KnowledgeFact[]> {
    try {
      if (!fsSync.existsSync(this.filePath)) {
        return [];
      }

      const content = await fs.readFile(this.filePath, 'utf-8');
      if (!content.trim()) {
        return [];
      }

      const facts: KnowledgeFact[] = [];
      for (const line of content.split('\n')) {
        if (line.trim()) {
          try {
            facts.push(JSON.parse(line));
          } catch (e) {
            console.error(`Failed to parse fact line: ${line.substring(0, 50)}...`);
          }
        }
      }

      return facts;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read facts from store: ${msg}`);
    }
  }

  /**
   * Get facts by article ID
   */
  async getByArticleId(articleId: string): Promise<KnowledgeFact[]> {
    const allFacts = await this.readAll();
    return allFacts.filter(f => f.article_id === articleId);
  }

  /**
   * Get facts by type
   */
  async getByType(type: string): Promise<KnowledgeFact[]> {
    const allFacts = await this.readAll();
    return allFacts.filter(f => f.type === type);
  }

  /**
   * Get facts by minimum confidence
   */
  async getByMinConfidence(minConfidence: number): Promise<KnowledgeFact[]> {
    const allFacts = await this.readAll();
    return allFacts.filter(f => f.confidence >= minConfidence);
  }

  /**
   * Get facts count
   */
  async count(): Promise<number> {
    const allFacts = await this.readAll();
    return allFacts.length;
  }

  /**
   * Get extraction statistics
   */
  async getStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    avgConfidence: number;
    byStatus: Record<string, number>;
  }> {
    const facts = await this.readAll();

    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalConfidence = 0;

    for (const fact of facts) {
      byType[fact.type] = (byType[fact.type] || 0) + 1;
      byStatus[fact.status] = (byStatus[fact.status] || 0) + 1;
      totalConfidence += fact.confidence;
    }

    return {
      total: facts.length,
      byType,
      avgConfidence: facts.length > 0 ? totalConfidence / facts.length : 0,
      byStatus,
    };
  }

  /**
   * Clear all facts (for testing)
   */
  async clear(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
    } catch (error) {
      // File might not exist, that's ok
    }
  }

  /**
   * Read all content hashes from store
   */
  private async readHashes(): Promise<Set<string>> {
    try {
      if (!fsSync.existsSync(this.filePath)) {
        return new Set();
      }

      const content = await fs.readFile(this.filePath, 'utf-8');
      if (!content.trim()) {
        return new Set();
      }

      const hashes = new Set<string>();
      for (const line of content.split('\n')) {
        if (line.trim()) {
          try {
            const fact = JSON.parse(line) as KnowledgeFact;
            const hash = this.hashContent(fact.content);
            hashes.add(hash);
          } catch (e) {
            // Skip malformed lines
          }
        }
      }

      return hashes;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist yet, return empty set
        return new Set();
      }
      // For any other error (permissions, etc), throw to prevent silent deduplication loss
      throw error;
    }
  }

  /**
   * Generate normalized content hash for deduplication
   */
  private hashContent(content: string): string {
    const normalized = content
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
    return createHash('md5').update(normalized).digest('hex');
  }

  private async acquireLock(): Promise<void> {
    const startTime = Date.now();

    while (true) {
      try {
        // Try to create lock file exclusively
        const fd = fsSync.openSync(this.lockFilePath, fsSync.constants.O_CREAT | fsSync.constants.O_EXCL | fsSync.constants.O_WRONLY);
        fsSync.closeSync(fd);
        return; // Lock acquired
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw error;
        }

        // Check if lock file is stale (older than LOCK_TIMEOUT_MS)
        try {
          const stats = await fs.stat(this.lockFilePath);
          const lockAge = Date.now() - stats.mtimeMs;

          if (lockAge > this.LOCK_TIMEOUT_MS) {
            // Lock is stale, remove it and retry
            await fs.unlink(this.lockFilePath);
            continue;
          }
        } catch {
          // If we can't stat the lock file, just continue waiting
        }

        // Lock file exists and is not stale, wait a bit and retry
        if (Date.now() - startTime > this.LOCK_TIMEOUT_MS) {
          throw new Error(`Failed to acquire lock on ${this.filePath} after ${this.LOCK_TIMEOUT_MS}ms`);
        }

        await this.sleep(10); // Wait 10ms before retrying
      }
    }
  }

  private async releaseLock(): Promise<void> {
    try {
      await fs.unlink(this.lockFilePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`Failed to release lock: ${error}`);
      }
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance for global access
 */
let globalStore: FactStore | null = null;

export function getFactStore(filePath?: string): FactStore {
  if (!globalStore) {
    globalStore = new FactStore(filePath);
  }
  return globalStore;
}

export function resetFactStore(): void {
  globalStore = null;
}
