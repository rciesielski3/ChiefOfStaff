import { exportWeeklyHighlights, exportWeeklyHighlightsWithSummaries, WeeklyHighlight, WeeklyHighlightsExport } from '../../src/business-logic/export-weekly-highlights';
import { Article } from '../../src/business-logic/normalize-article';
import { SummaryGenerator } from '../../src/business-logic/summary-generator';

describe('exportWeeklyHighlights', () => {
  /**
   * Test 1: Groups articles by week and includes ALL articles
   *
   * Creates 3 articles:
   * - Article 1: 2026-07-13 (Monday) - Week A
   * - Article 2: 2026-07-15 (Wednesday) - Week A
   * - Article 3: 2026-07-20 (Monday) - Week B
   *
   * Should produce:
   * - Week B (2026-07-20): 1 article
   * - Week A (2026-07-13): 2 articles
   * - Weeks sorted newest first
   */
  it('should group articles by week and include ALL articles from each week', () => {
    const articles: Article[] = [
      {
        id: 'test-1',
        title: 'Article 1',
        summary: 'Summary 1',
        url: 'https://example.com/1',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-07-13T10:00:00Z', // Monday of week 1
        tags: []
      },
      {
        id: 'test-2',
        title: 'Article 2',
        summary: 'Summary 2',
        url: 'https://example.com/2',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-07-15T14:00:00Z', // Wednesday of week 1
        tags: []
      },
      {
        id: 'test-3',
        title: 'Article 3',
        summary: 'Summary 3',
        url: 'https://example.com/3',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-07-20T09:00:00Z', // Monday of week 2
        tags: []
      }
    ];

    const result = exportWeeklyHighlights(articles);

    // Should have 2 weeks
    expect(result.weeks).toHaveLength(2);

    // First week should be newest (2026-07-20)
    expect(result.weeks[0].weekOf).toBe('2026-07-20');
    expect(result.weeks[0].items).toHaveLength(1);
    expect(result.weeks[0].items[0].id).toBe('test-3');

    // Second week should be older (2026-07-13)
    expect(result.weeks[1].weekOf).toBe('2026-07-13');
    expect(result.weeks[1].items).toHaveLength(2);
    expect(result.weeks[1].items.map(a => a.id)).toContain('test-1');
    expect(result.weeks[1].items.map(a => a.id)).toContain('test-2');
  });

  /**
   * Test 2: Each week has a summary field (string)
   *
   * Creates 2 articles from different weeks
   * Each WeeklyHighlight should have a summary field that is a string
   */
  it('should include summary field for each week', () => {
    const articles: Article[] = [
      {
        id: 'test-1',
        title: 'Article 1',
        summary: 'Summary 1',
        url: 'https://example.com/1',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-07-13T10:00:00Z',
        tags: []
      },
      {
        id: 'test-2',
        title: 'Article 2',
        summary: 'Summary 2',
        url: 'https://example.com/2',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-07-20T10:00:00Z',
        tags: []
      }
    ];

    const result = exportWeeklyHighlights(articles);

    // Each week should have a summary field that is a string
    result.weeks.forEach(week => {
      expect(typeof week.summary).toBe('string');
      // Initially should be empty string (Task 6 will populate it)
      expect(week.summary).toBe('');
    });
  });

  /**
   * Test 3: Returns empty weeks array for empty articles
   *
   * Pass empty articles array
   * Should return { weeks: [] }
   */
  it('should return empty weeks array for empty articles', () => {
    const articles: Article[] = [];

    const result = exportWeeklyHighlights(articles);

    expect(result.weeks).toHaveLength(0);
    expect(Array.isArray(result.weeks)).toBe(true);
  });

  /**
   * Test 4: Sorts weeks chronologically (newest first)
   *
   * Creates articles spanning multiple weeks
   * Weeks should be sorted with newest first
   */
  it('should sort weeks chronologically with newest first', () => {
    const articles: Article[] = [
      {
        id: 'test-1',
        title: 'Article 1',
        summary: 'Summary 1',
        url: 'https://example.com/1',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-07-06T10:00:00Z', // Week of 2026-07-06 (oldest)
        tags: []
      },
      {
        id: 'test-2',
        title: 'Article 2',
        summary: 'Summary 2',
        url: 'https://example.com/2',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-07-20T10:00:00Z', // Week of 2026-07-20 (newest)
        tags: []
      },
      {
        id: 'test-3',
        title: 'Article 3',
        summary: 'Summary 3',
        url: 'https://example.com/3',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-07-13T10:00:00Z', // Week of 2026-07-13 (middle)
        tags: []
      }
    ];

    const result = exportWeeklyHighlights(articles);

    expect(result.weeks).toHaveLength(3);

    // Verify weeks are sorted newest first
    expect(result.weeks[0].weekOf).toBe('2026-07-20');
    expect(result.weeks[1].weekOf).toBe('2026-07-13');
    expect(result.weeks[2].weekOf).toBe('2026-07-06');
  });

  /**
   * Bonus: Articles within each week should be sorted by date (newest first)
   */
  it('should sort articles within each week by date (newest first)', () => {
    const articles: Article[] = [
      {
        id: 'test-1',
        title: 'Article 1',
        summary: 'Summary 1',
        url: 'https://example.com/1',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-07-13T08:00:00Z', // Monday, early
        tags: []
      },
      {
        id: 'test-2',
        title: 'Article 2',
        summary: 'Summary 2',
        url: 'https://example.com/2',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-07-15T20:00:00Z', // Wednesday, late
        tags: []
      },
      {
        id: 'test-3',
        title: 'Article 3',
        summary: 'Summary 3',
        url: 'https://example.com/3',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-07-14T12:00:00Z', // Tuesday, midday
        tags: []
      }
    ];

    const result = exportWeeklyHighlights(articles);

    expect(result.weeks).toHaveLength(1);
    const week = result.weeks[0];
    expect(week.items).toHaveLength(3);

    // Articles should be sorted newest first
    expect(week.items[0].id).toBe('test-2'); // 2026-07-15
    expect(week.items[1].id).toBe('test-3'); // 2026-07-14
    expect(week.items[2].id).toBe('test-1'); // 2026-07-13
  });
});

describe('exportWeeklyHighlightsWithSummaries', () => {
  /**
   * Test 1: Generates summaries when SummaryGenerator provided
   *
   * Creates 2 articles from different weeks
   * Mocks SummaryGenerator.generateSummary()
   * Verifies summary field is populated with generated text
   */
  it('should generate summaries when SummaryGenerator provided', async () => {
    const articles: Article[] = [
      {
        id: 'test-1',
        title: 'Article 1',
        summary: 'Summary 1',
        url: 'https://example.com/1',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-07-13T10:00:00Z',
        tags: []
      },
      {
        id: 'test-2',
        title: 'Article 2',
        summary: 'Summary 2',
        url: 'https://example.com/2',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-07-20T10:00:00Z',
        tags: []
      }
    ];

    // Mock SummaryGenerator
    const mockSummaryGenerator = {
      generateSummary: jest.fn(async (items: Article[]) => {
        return `Generated summary for ${items.length} articles`;
      })
    } as unknown as SummaryGenerator;

    const result = await exportWeeklyHighlightsWithSummaries(articles, mockSummaryGenerator);

    // Should have 2 weeks
    expect(result.weeks).toHaveLength(2);

    // Each week should have a populated summary
    result.weeks.forEach(week => {
      expect(typeof week.summary).toBe('string');
      expect(week.summary.length).toBeGreaterThan(0);
      expect(week.summary).toMatch(/Generated summary for/);
    });

    // Verify generateSummary was called for each week
    expect(mockSummaryGenerator.generateSummary).toHaveBeenCalledTimes(2);
  });

  /**
   * Test 2: Uses fallback summary on error
   *
   * Creates 1 article
   * Mocks SummaryGenerator.generateSummary() to throw error
   * Verifies fallback summary text is used
   */
  it('should use fallback summary when generation fails', async () => {
    const articles: Article[] = [
      {
        id: 'test-1',
        title: 'Article 1',
        summary: 'Summary 1',
        url: 'https://example.com/1',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-07-13T10:00:00Z',
        tags: []
      }
    ];

    // Mock SummaryGenerator to throw error
    const mockSummaryGenerator = {
      generateSummary: jest.fn(async () => {
        throw new Error('API error');
      })
    } as unknown as SummaryGenerator;

    const result = await exportWeeklyHighlightsWithSummaries(articles, mockSummaryGenerator);

    // Should have 1 week
    expect(result.weeks).toHaveLength(1);

    // Week should have fallback summary
    const week = result.weeks[0];
    expect(typeof week.summary).toBe('string');
    expect(week.summary).toMatch(/Week of 2026-07-13: 1 articles/);
  });

  /**
   * Test 3: Empty articles returns empty weeks
   *
   * Creates empty articles array
   * Should return { weeks: [] }
   */
  it('should return empty weeks array for empty articles', async () => {
    const articles: Article[] = [];

    const mockSummaryGenerator = {
      generateSummary: jest.fn(async () => 'summary')
    } as unknown as SummaryGenerator;

    const result = await exportWeeklyHighlightsWithSummaries(articles, mockSummaryGenerator);

    expect(result.weeks).toHaveLength(0);
  });
});
