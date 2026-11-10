import { exportMonthlyRecapWithSummaries } from '../../src/business-logic/export-monthly-recap';
import { Article } from '../../src/business-logic/normalize-article';
import { primaryQANewsCategory } from '../../src/business-logic/categorize-article';

describe('exportMonthlyRecap — Deterministic Fallback Text Validation', () => {
  const testArticles: Article[] = [
    {
      id: 'a1',
      title: 'Test Article 1',
      summary: 'Summary 1',
      url: 'https://example.com/1',
      source: 'Test',
      category: 'test',
      publishedAt: '2026-07-21T10:00:00Z',
      tags: []
    },
    {
      id: 'a2',
      title: 'Test Article 2',
      summary: 'Summary 2',
      url: 'https://example.com/2',
      source: 'Test',
      category: 'test',
      publishedAt: '2026-07-21T11:00:00Z',
      tags: []
    }
  ];

  it('should use deterministic fallback text format: "{count} stories. Latest: ...; Top categories: ..."', async () => {
    const result = await exportMonthlyRecapWithSummaries(testArticles, 25, undefined);

    expect(result.months).toBeDefined();
    expect(result.months.length).toBeGreaterThan(0);

    const summary = result.months[0].summary;
    // Items are newest first, so the top titles start with Article 2
    const label = primaryQANewsCategory(testArticles[1]);
    expect(summary).toBe(`2 stories. Latest: Test Article 2; Test Article 1. Top categories: ${label} (2).`);
  });

  it('should use deterministic fallback text when SummaryGenerator is not provided', async () => {
    // Invoke without API key (no SummaryGenerator)
    const result = await exportMonthlyRecapWithSummaries(testArticles, 25, undefined);

    expect(result.months[0].summary).toMatch(/^2 stories\./);
    expect(result.months[0].summary).toContain('Latest');
    // Should not be empty
    expect(result.months[0].summary.length).toBeGreaterThan(0);
  });

  it('should produce valid JSON with fallback text in summary field', async () => {
    const result = await exportMonthlyRecapWithSummaries(testArticles, 25, undefined);

    // Verify JSON structure
    expect(result.months).toBeDefined();
    expect(Array.isArray(result.months)).toBe(true);
    expect(result.months[0].summary).toContain('Latest');

    // Verify all required fields present
    expect(result.months[0].items).toBeDefined();
    expect(Array.isArray(result.months[0].items)).toBe(true);
    expect(result.months[0].monthOf).toBeDefined();

    // Verify JSON can be stringified
    const jsonString = JSON.stringify(result);
    expect(jsonString).toBeDefined();
    expect(() => JSON.parse(jsonString)).not.toThrow();
  });
});
