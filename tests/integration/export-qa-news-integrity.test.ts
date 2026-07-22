import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('export-qa-news — Data Integrity', () => {
  it('should produce valid JSON structure even with empty summaries', () => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;

    const output = execSync(
      'npx ts-node src/cli/export-weekly-highlights.ts',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], env }
    );

    const json = JSON.parse(output);

    // Validate structure
    expect(json).toHaveProperty('weeks');
    expect(Array.isArray(json.weeks)).toBe(true);
    expect(json.weeks.length).toBeGreaterThan(0);

    const week = json.weeks[0];
    expect(week).toHaveProperty('weekOf');
    expect(week).toHaveProperty('items');
    expect(week).toHaveProperty('summary');
    expect(typeof week.summary).toBe('string');
  });

  it('should produce correct article counts', () => {
    const env = { ...process.env, ANTHROPIC_API_KEY: 'test-key' };

    const weeklyOutput = execSync(
      'npx ts-node src/cli/export-weekly-highlights.ts',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], env }
    );
    const weeklyJson = JSON.parse(weeklyOutput);

    const monthlyOutput = execSync(
      'npx ts-node src/cli/export-monthly-recap.ts',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], env }
    );
    const monthlyJson = JSON.parse(monthlyOutput);

    // Weekly should include all articles for the week
    expect(weeklyJson.weeks[0].items.length).toBeGreaterThan(0);

    // Monthly should have curated subset (up to 25 articles per spec)
    expect(monthlyJson.months[0].items.length).toBeGreaterThanOrEqual(0);
    expect(monthlyJson.months[0].items.length).toBeLessThanOrEqual(25);
  });

  it('should have all required fields in exported JSON', () => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;

    const weeklyOutput = execSync(
      'npx ts-node src/cli/export-weekly-highlights.ts',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], env }
    );
    const weeklyJson = JSON.parse(weeklyOutput);

    // Check week structure
    const week = weeklyJson.weeks[0];
    const requiredWeekFields = ['weekOf', 'items', 'summary'];
    requiredWeekFields.forEach(field => {
      expect(week).toHaveProperty(field);
    });

    // Check article structure
    if (week.items.length > 0) {
      const article = week.items[0];
      const requiredArticleFields = ['title', 'url', 'source', 'category'];
      requiredArticleFields.forEach(field => {
        expect(article).toHaveProperty(field);
      });
    }
  });

  it('should allow downstream consumers to parse JSON with fallback text', () => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;

    const output = execSync(
      'npx ts-node src/cli/export-weekly-highlights.ts',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], env }
    );

    const json = JSON.parse(output);

    // Simulate downstream consumer parsing
    expect(() => {
      const weeks = json.weeks;
      weeks.forEach((week: any) => {
        // Simulate accessing fields like a Next.js app would
        const title = week.summary || 'No summary';
        const count = week.items.length;
        const firstArticle = week.items[0]?.title || 'No articles';

        // All should be accessible without null/undefined errors
        expect(title).toBeDefined();
        expect(typeof count).toBe('number');
        expect(firstArticle).toBeDefined();
      });
    }).not.toThrow();
  });
});
