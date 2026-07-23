import { exportWeeklyHighlightsWithSummaries } from '../../src/business-logic/export-weekly-highlights';
import { Article } from '../../src/business-logic/normalize-article';

describe('exportWeeklyHighlights — Fallback Text Validation', () => {
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

  it('should use fallback text format: "Week of {weekOf}: {count} articles"', async () => {
    const result = await exportWeeklyHighlightsWithSummaries(testArticles, undefined);

    expect(result.weeks).toBeDefined();
    expect(result.weeks.length).toBeGreaterThan(0);

    const summary = result.weeks[0].summary;
    // Fallback format should match pattern: "Week of YYYY-MM-DD: N articles"
    expect(summary).toMatch(/^Week of \d{4}-\d{2}-\d{2}: \d+ articles$/);
  });

  it('should use fallback text when SummaryGenerator is not provided', async () => {
    // Invoke without API key (no SummaryGenerator)
    const result = await exportWeeklyHighlightsWithSummaries(testArticles, undefined);

    expect(result.weeks[0].summary).toMatch(/^Week of/);
    expect(result.weeks[0].summary).toContain('articles');
    // Should not be empty
    expect(result.weeks[0].summary.length).toBeGreaterThan(0);
  });

  it('should produce valid JSON with fallback text in summary field', async () => {
    const result = await exportWeeklyHighlightsWithSummaries(testArticles, undefined);

    // Verify JSON structure
    expect(result.weeks).toBeDefined();
    expect(Array.isArray(result.weeks)).toBe(true);
    expect(result.weeks[0].summary).toContain('Week of');

    // Verify all required fields present
    expect(result.weeks[0].items).toBeDefined();
    expect(Array.isArray(result.weeks[0].items)).toBe(true);
    expect(result.weeks[0].weekOf).toBeDefined();

    // Verify JSON can be stringified
    const jsonString = JSON.stringify(result);
    expect(jsonString).toBeDefined();
    expect(() => JSON.parse(jsonString)).not.toThrow();
  });
});
