import * as fs from 'fs/promises';
import * as path from 'path';
import { Insight } from './knowledge-types';

/**
 * M6.4 Insight Storage & Persistence
 *
 * NDJSON-based insight store with CRUD operations and queries.
 * - Persists insights to `/data/insights.ndjson` (one JSON object per line)
 * - Supports: add, findById, findByDomain, findByType, findHighConfidence, update, delete
 * - Timestamps: generated_at (immutable) + updated_at (on modifications)
 */
export class InsightStore {
  constructor(private filePath: string) {}

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
    return allInsights.filter(i => i.domain === domain);
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
   * Update insight fields and refresh updated_at timestamp
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
      updated_at: new Date().toISOString(),
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
   */
  private async writeAll(insights: Insight[]): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    const content = insights
      .map(insight => JSON.stringify(insight))
      .join('\n');

    await fs.writeFile(this.filePath, content + (insights.length > 0 ? '\n' : ''), 'utf-8');
  }
}
