import * as fs from 'fs/promises';
import * as path from 'path';
import { Insight } from './insight';
import { AtomicFileWriter } from './atomic-file-writer';
import { JsonValidator } from './json-validator';

/**
 * M6.4 Insight Storage & Persistence
 *
 * NDJSON-based insight store with CRUD operations and queries.
 * - Persists insights to `/data/insights.ndjson` (one JSON object per line)
 * - Supports: add, findById, findByDomain, findByType, findHighConfidence, update, delete
 * - Timestamps: generated_at (immutable) + updated_at (on modifications)
 * - Durability: Uses AtomicFileWriter for safe, atomic writes with validation
 */
export class InsightStore {
  private writer: AtomicFileWriter;
  private validator: JsonValidator;

  constructor(private filePath: string) {
    this.writer = new AtomicFileWriter();
    this.validator = new JsonValidator();
  }

  /**
   * Add an insight to storage
   */
  async add(insight: Insight): Promise<void> {
    const allInsights = await this.readAll();
    allInsights.push(insight);
    await this.writeAll(allInsights);
  }

  /**
   * Retrieve a single insight by ID
   */
  async findById(id: string): Promise<Insight | null> {
    const allInsights = await this.readAll();
    const insight = allInsights.find(i => i.id === id);
    return insight || null;
  }

  /**
   * Query insights by domain
   */
  async findByDomain(domain: string): Promise<Insight[]> {
    const allInsights = await this.readAll();
    return allInsights.filter(i => i.domains.includes(domain));
  }

  /**
   * Query insights by type
   */
  async findByType(type: string): Promise<Insight[]> {
    const allInsights = await this.readAll();
    return allInsights.filter(i => i.type === type);
  }

  /**
   * Get high-confidence insights (threshold 0.80 by default)
   */
  async findHighConfidence(threshold: number = 0.80): Promise<Insight[]> {
    const allInsights = await this.readAll();
    return allInsights.filter(i => i.confidence >= threshold);
  }

  /**
   * Update insight fields and refresh updatedAt timestamp
   */
  async update(id: string, partial: Partial<Insight>): Promise<Insight | null> {
    const allInsights = await this.readAll();
    const index = allInsights.findIndex(i => i.id === id);

    if (index === -1) {
      return null;
    }

    const updated: Insight = {
      ...allInsights[index],
      ...partial,
      updatedAt: new Date(),
    };

    allInsights[index] = updated;
    await this.writeAll(allInsights);
    return updated;
  }

  /**
   * Delete an insight by ID
   */
  async delete(id: string): Promise<boolean> {
    const allInsights = await this.readAll();
    const index = allInsights.findIndex(i => i.id === id);

    if (index === -1) {
      return false;
    }

    allInsights.splice(index, 1);
    await this.writeAll(allInsights);
    return true;
  }

  /**
   * Get all insights from storage
   */
  async getAllInsights(): Promise<Insight[]> {
    return this.readAll();
  }

  /**
   * Read all insights from NDJSON file (private)
   */
  private async readAll(): Promise<Insight[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      if (!content.trim()) {
        return [];
      }

      const insights: Insight[] = [];
      const lines = content.split('\n');

      for (const line of lines) {
        if (line.trim()) {
          try {
            const insight = JSON.parse(line) as Insight;
            insights.push(insight);
          } catch (e) {
            // Skip malformed JSON lines
            console.warn(`Failed to parse insight line: ${line}`);
          }
        }
      }

      return insights;
    } catch (error) {
      // If file doesn't exist, return empty array
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Write all insights to NDJSON file (private)
   * Uses AtomicFileWriter for durability and atomicity
   */
  private async writeAll(insights: Insight[]): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    const content = insights
      .map(insight => JSON.stringify(insight))
      .join('\n');

    // Write atomically using AtomicFileWriter
    await this.writer.writeFile(this.filePath, content + (insights.length > 0 ? '\n' : ''));

    // Validate written file for integrity
    try {
      const readContent = await fs.readFile(this.filePath, 'utf-8');
      if (!readContent.trim() && insights.length > 0) {
        throw new Error('Validation failed: written file is empty but insights were provided');
      }

      // Verify each line can be parsed as JSON
      const lines = readContent.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            JSON.parse(line);
          } catch (e) {
            throw new Error(`Validation failed: invalid JSON in written file: ${line}`);
          }
        }
      }
    } catch (error) {
      throw new Error(`File validation after write failed: ${(error as Error).message}`);
    }
  }
}
