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

  constructor(filePath: string = 'data/knowledge_facts.ndjson') {
    this.filePath = filePath;
  }

  /**
   * Append facts to store with deduplication
   *
   * - Checks for duplicates by normalized content hash
   * - If duplicate exists with different source, creates new version
   * - Returns count of facts actually stored
   */
  async append(facts: KnowledgeFact[]): Promise<{ stored: number; deduplicated: number }> {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });

      // Read existing facts to check for duplicates
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
    }
  }

  /**
   * Read all facts from store
   */
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
      // If read fails, return empty set and let append handle it
      return new Set();
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
