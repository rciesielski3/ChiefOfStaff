import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { Article } from './normalize-article';

/**
 * Interface for article storage with deduplication and merging
 */
export interface ArticleStore {
  /**
   * Read all articles from storage
   */
  read(): Promise<Article[]>;

  /**
   * Write articles to storage
   */
  write(articles: Article[]): Promise<void>;

  /**
   * Read existing articles, deduplicate with new articles, retain last 30 days, and write back
   */
  dedupAndMerge(newArticles: Article[]): Promise<Article[]>;
}

/**
 * NDJSON-based article store with deduplication and file locking for concurrency
 *
 * - Reads/writes articles as newline-delimited JSON (one article per line)
 * - Deduplicates by source + title hash
 * - Retains articles from the last 30 days
 * - Uses file locking to prevent concurrent writes
 */
export class NdJsonArticleStore implements ArticleStore {
  private lockFilePath: string;
  private readonly LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  private readonly RETENTION_DAYS = 30;

  constructor(private filePath: string) {
    this.lockFilePath = `${filePath}.lock`;
  }

  /**
   * Read all articles from NDJSON file
   */
  async read(): Promise<Article[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      if (!content.trim()) {
        return [];
      }

      const articles: Article[] = [];
      const lines = content.split('\n');

      for (const line of lines) {
        if (line.trim()) {
          try {
            const article = JSON.parse(line) as Article;
            articles.push(article);
          } catch (e) {
            // Skip malformed JSON lines
            console.warn(`Failed to parse article line: ${line}`);
          }
        }
      }

      return articles;
    } catch (error) {
      // If file doesn't exist, return empty array
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Write articles to NDJSON file with file locking
   */
  async write(articles: Article[]): Promise<void> {
    await this.acquireLock();

    try {
      const content = articles
        .map(article => JSON.stringify(article))
        .join('\n');

      await fs.writeFile(this.filePath, content + (articles.length > 0 ? '\n' : ''), 'utf-8');
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Deduplicate new articles against existing ones, merge, retain last 30 days, and write
   */
  async dedupAndMerge(newArticles: Article[]): Promise<Article[]> {
    // Read existing articles
    const existing = await this.read();

    // Create dedup map from existing articles
    const dedupMap = new Map<string, Article>();

    for (const article of existing) {
      const key = this.generateDedupKey(article);
      dedupMap.set(key, article);
    }

    // Merge with new articles
    for (const article of newArticles) {
      const key = this.generateDedupKey(article);

      if (dedupMap.has(key)) {
        // Article already exists - could update last seen time or other fields
        // For now, just keep the existing one (most recent data is new)
        dedupMap.set(key, article);
      } else {
        // New article
        dedupMap.set(key, article);
      }
    }

    // Filter to keep only articles from last 30 days
    const now = new Date();
    const merged = Array.from(dedupMap.values()).filter(article => {
      const publishedAt = new Date(article.publishedAt);
      const ageMs = now.getTime() - publishedAt.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      return ageDays <= this.RETENTION_DAYS;
    });

    // Sort by published date (newest first)
    merged.sort((a, b) => {
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

    // Write back to file
    await this.write(merged);

    return merged;
  }

  /**
   * Generate deduplication key from article source and title
   */
  private generateDedupKey(article: Article): string {
    const titleHash = createHash('sha256').update(article.title).digest('hex').slice(0, 12);
    return `${article.source}::${titleHash}`;
  }

  /**
   * Acquire file lock with timeout
   */
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

  /**
   * Release file lock
   */
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
