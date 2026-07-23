import { exportMonthlyRecap, exportMonthlyRecapWithSummaries, MonthlyRecap, MonthlyRecapExport } from '../../src/business-logic/export-monthly-recap';
import { Article } from '../../src/business-logic/normalize-article';
import { SummaryGenerator } from '../../src/business-logic/summary-generator';

describe('exportMonthlyRecap', () => {
  /**
   * Test 1: Groups articles by month and curates to top N (25 default)
   *
   * Creates 50 articles across different months:
   * - 25 articles from June 2026 (2026-06-01 to 2026-06-25)
   * - 25 articles from July 2026 (2026-07-01 to 2026-07-25)
   *
   * Should produce:
   * - 2 months in result
   * - Each month has exactly 25 articles (default curateLimit)
   * - Articles within each month sorted by date (newest first)
   */
  it('should group articles by month and curate to top N by recency', () => {
    const articles: Article[] = [];

    // Create 25 articles from June 2026
    for (let i = 1; i <= 25; i++) {
      articles.push({
        id: `june-${i}`,
        title: `June Article ${i}`,
        summary: `Summary for June article ${i}`,
        url: `https://example.com/june/${i}`,
        source: 'Test Source',
        category: 'news',
        publishedAt: `2026-06-${String(i).padStart(2, '0')}T10:00:00Z`,
        tags: []
      });
    }

    // Create 25 articles from July 2026
    for (let i = 1; i <= 25; i++) {
      articles.push({
        id: `july-${i}`,
        title: `July Article ${i}`,
        summary: `Summary for July article ${i}`,
        url: `https://example.com/july/${i}`,
        source: 'Test Source',
        category: 'news',
        publishedAt: `2026-07-${String(i).padStart(2, '0')}T10:00:00Z`,
        tags: []
      });
    }

    const result = exportMonthlyRecap(articles);

    // Should have 2 months
    expect(result.months).toHaveLength(2);

    // July month (newest) should be first
    expect(result.months[0].monthOf).toBe('2026-07-01');
    expect(result.months[0].items).toHaveLength(25);

    // June month (older) should be second
    expect(result.months[1].monthOf).toBe('2026-06-01');
    expect(result.months[1].items).toHaveLength(25);

    // Verify articles within each month are sorted newest first
    const julyItems = result.months[0].items;
    expect(julyItems[0].id).toBe('july-25'); // Most recent
    expect(julyItems[24].id).toBe('july-1'); // Oldest in July
  });

  /**
   * Test 2: Each month has summary field (string)
   *
   * Creates 2 articles from different months
   * Each MonthlyRecap should have a summary field that is a string
   */
  it('should include summary field for each month', () => {
    const articles: Article[] = [
      {
        id: 'test-1',
        title: 'Article 1',
        summary: 'Summary 1',
        url: 'https://example.com/1',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-06-15T10:00:00Z',
        tags: []
      },
      {
        id: 'test-2',
        title: 'Article 2',
        summary: 'Summary 2',
        url: 'https://example.com/2',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-07-15T10:00:00Z',
        tags: []
      }
    ];

    const result = exportMonthlyRecap(articles);

    // Each month should have a summary field that is a string
    result.months.forEach(month => {
      expect(typeof month.summary).toBe('string');
      // Initially should be empty string (Task 6 will populate it)
      expect(month.summary).toBe('');
    });
  });

  /**
   * Test 3: Returns empty months array for empty articles
   *
   * Pass empty articles array
   * Should return { months: [] }
   */
  it('should return empty months array for empty articles', () => {
    const articles: Article[] = [];

    const result = exportMonthlyRecap(articles);

    expect(result.months).toHaveLength(0);
    expect(Array.isArray(result.months)).toBe(true);
  });

  /**
   * Test 4: Sorts months chronologically (newest first)
   *
   * Creates articles spanning multiple months
   * Months should be sorted with newest first
   */
  it('should sort months chronologically with newest first', () => {
    const articles: Article[] = [
      {
        id: 'test-1',
        title: 'Article 1',
        summary: 'Summary 1',
        url: 'https://example.com/1',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-05-15T10:00:00Z', // May (oldest)
        tags: []
      },
      {
        id: 'test-2',
        title: 'Article 2',
        summary: 'Summary 2',
        url: 'https://example.com/2',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-07-15T10:00:00Z', // July (newest)
        tags: []
      },
      {
        id: 'test-3',
        title: 'Article 3',
        summary: 'Summary 3',
        url: 'https://example.com/3',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-06-15T10:00:00Z', // June (middle)
        tags: []
      }
    ];

    const result = exportMonthlyRecap(articles);

    expect(result.months).toHaveLength(3);

    // Verify months are sorted newest first
    expect(result.months[0].monthOf).toBe('2026-07-01');
    expect(result.months[1].monthOf).toBe('2026-06-01');
    expect(result.months[2].monthOf).toBe('2026-05-01');
  });

  /**
   * Test 5: Curates to specified limit
   *
   * Creates 30 articles in a single month
   * With curateLimit = 20, should only return 20 articles per month
   */
  it('should curate to specified limit (20 articles per month)', () => {
    const articles: Article[] = [];

    // Create 30 articles from July 2026
    for (let i = 1; i <= 30; i++) {
      articles.push({
        id: `july-${i}`,
        title: `July Article ${i}`,
        summary: `Summary for July article ${i}`,
        url: `https://example.com/july/${i}`,
        source: 'Test Source',
        category: 'news',
        publishedAt: `2026-07-${String(i).padStart(2, '0')}T10:00:00Z`,
        tags: []
      });
    }

    // Export with custom limit of 20
    const result = exportMonthlyRecap(articles, 20);

    // Should have 1 month
    expect(result.months).toHaveLength(1);

    // Should only have 20 articles (the most recent ones)
    const month = result.months[0];
    expect(month.items).toHaveLength(20);

    // Should be the 20 most recent articles (july-30 to july-11)
    expect(month.items[0].id).toBe('july-30'); // Most recent
    expect(month.items[19].id).toBe('july-11'); // Oldest in curated set
  });
});

describe('exportMonthlyRecapWithSummaries', () => {
  /**
   * Test 1: Generates summaries when SummaryGenerator provided
   *
   * Creates 2 articles from different months
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
        publishedAt: '2026-06-15T10:00:00Z',
        tags: []
      },
      {
        id: 'test-2',
        title: 'Article 2',
        summary: 'Summary 2',
        url: 'https://example.com/2',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-07-15T10:00:00Z',
        tags: []
      }
    ];

    // Mock SummaryGenerator
    const mockSummaryGenerator = {
      generateSummary: jest.fn(async (items: Article[]) => {
        return `Generated summary for ${items.length} articles`;
      })
    } as unknown as SummaryGenerator;

    const result = await exportMonthlyRecapWithSummaries(articles, 25, mockSummaryGenerator);

    // Should have 2 months
    expect(result.months).toHaveLength(2);

    // Each month should have a populated summary
    result.months.forEach(month => {
      expect(typeof month.summary).toBe('string');
      expect(month.summary.length).toBeGreaterThan(0);
      expect(month.summary).toMatch(/Generated summary for/);
    });

    // Verify generateSummary was called for each month
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
        publishedAt: '2026-07-15T10:00:00Z',
        tags: []
      }
    ];

    // Mock SummaryGenerator to throw error
    const mockSummaryGenerator = {
      generateSummary: jest.fn(async () => {
        throw new Error('API error');
      })
    } as unknown as SummaryGenerator;

    const result = await exportMonthlyRecapWithSummaries(articles, 25, mockSummaryGenerator);

    // Should have 1 month
    expect(result.months).toHaveLength(1);

    // Month should have fallback summary
    const month = result.months[0];
    expect(typeof month.summary).toBe('string');
    expect(month.summary).toMatch(/Month of 2026-07-01: 1 articles/);
  });

  /**
   * Test 3: Empty articles returns empty months
   *
   * Creates empty articles array
   * Should return { months: [] }
   */
  it('should return empty months array for empty articles', async () => {
    const articles: Article[] = [];

    const mockSummaryGenerator = {
      generateSummary: jest.fn(async () => 'summary')
    } as unknown as SummaryGenerator;

    const result = await exportMonthlyRecapWithSummaries(articles, 25, mockSummaryGenerator);

    expect(result.months).toHaveLength(0);
  });
});
