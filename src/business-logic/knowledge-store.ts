/**
 * M6.1 Knowledge Fact Storage
 *
 * Persists extracted facts to NDJSON with deduplication and versioning.
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import * as lockfile from 'proper-lockfile';
import { KnowledgeFact } from './knowledge-types';

/**
 * Service for storing and retrieving knowledge facts from NDJSON
 */
export class FactStore {
  private filePath: string;
  private readonly LOCK_TIMEOUT_MS = 30000; // 30 second lock timeout
  private lockRelease: (() => Promise<void>) | null = null;

  constructor(filePath: string = 'data/knowledge_facts.ndjson') {
    this.filePath = filePath;
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

  /**
   * Acquire file lock using proper-lockfile with timeout
   */
  private async acquireLock(): Promise<void> {
    try {
      // Ensure directory exists before locking
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      // Ensure file exists or can be created
      try {
        await fs.access(this.filePath);
      } catch {
        // File doesn't exist, create an empty file so lockfile can lock it
        await fs.writeFile(this.filePath, '', 'utf-8');
      }

      this.lockRelease = await lockfile.lock(this.filePath, {
        stale: this.LOCK_TIMEOUT_MS,
        retries: {
          minTimeout: 10,
          maxTimeout: 100,
          retries: Math.floor(this.LOCK_TIMEOUT_MS / 50),
        },
      });
    } catch (error) {
      throw new Error(`Failed to acquire lock on ${this.filePath}: ${error}`);
    }
  }

  /**
   * Release file lock
   */
  private async releaseLock(): Promise<void> {
    if (this.lockRelease) {
      try {
        await this.lockRelease();
        this.lockRelease = null;
      } catch (error) {
        console.warn(`Failed to release lock: ${error}`);
      }
    }
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
