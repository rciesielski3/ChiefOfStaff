// Keyword-based category labelling is covered in categorize-article tests.
// Here the label is the article's own category so the summary logic is tested in isolation.
jest.mock('../../src/business-logic/categorize-article', () => ({
  primaryQANewsCategory: (article: { category: string }) => article.category
}));

import {
  buildDeterministicSummary,
  EMPTY_PERIOD_SUMMARY
} from '../../src/business-logic/deterministic-summary';
import { exportWeeklyHighlightsWithSummaries } from '../../src/business-logic/export-weekly-highlights';
import { exportMonthlyRecapWithSummaries } from '../../src/business-logic/export-monthly-recap';
import { Article } from '../../src/business-logic/normalize-article';
import { SummaryGenerator } from '../../src/business-logic/summary-generator';

function makeArticle(i: number, title: string, category: string, publishedAt: string): Article {
  return {
    id: `a-${i}`,
    title,
    summary: '',
    url: `https://example.com/${i}`,
    source: 'Test Source',
    category,
    publishedAt,
    tags: []
  };
}

describe('buildDeterministicSummary', () => {
  it('returns a non-empty summary derived from count, top titles and top categories', () => {
    const items = [
      makeArticle(1, 'Alpha release', 'ai', '2026-10-06T10:00:00Z'),
      makeArticle(2, 'Beta tooling', 'tooling', '2026-10-05T10:00:00Z'),
      makeArticle(3, 'Gamma testing', 'test-automation', '2026-10-04T10:00:00Z'),
      makeArticle(4, 'Delta patterns', 'ai', '2026-10-03T10:00:00Z'),
      makeArticle(5, 'Epsilon ops', 'ai', '2026-10-02T10:00:00Z')
    ];

    const summary = buildDeterministicSummary(items);

    expect(summary).toBe(
      '5 stories. Top stories: Alpha release; Beta tooling; Gamma testing. Top categories: ai (3), test-automation (1), tooling (1).'
    );
  });

  it('uses the singular for a single story', () => {
    const summary = buildDeterministicSummary([makeArticle(1, 'Only one', 'ai', '2026-10-06T10:00:00Z')]);

    expect(summary.startsWith('1 story. ')).toBe(true);
    expect(summary).toContain('Top stories: Only one.');
  });

  it('returns the explicit empty-state for an empty period, not a fake summary', () => {
    expect(buildDeterministicSummary([])).toBe(EMPTY_PERIOD_SUMMARY);
    expect(EMPTY_PERIOD_SUMMARY).toBe('No stories in this period.');
  });
});

describe('digest summaries without an API key', () => {
  const items = [
    makeArticle(1, 'First story', 'ai', '2026-10-06T10:00:00Z'),
    makeArticle(2, 'Second story', 'engineering', '2026-10-05T10:00:00Z')
  ];

  it('weekly: no generator yields a non-empty deterministic summary for a period with items', async () => {
    const result = await exportWeeklyHighlightsWithSummaries(items);

    expect(result.weeks).toHaveLength(1);
    expect(result.weeks[0].summary).not.toBe('');
    expect(result.weeks[0].summary).toBe(buildDeterministicSummary(result.weeks[0].items));
    expect(result.weeks[0].summary).toMatch(/^2 stories\. Top stories: First story; Second story\./);
  });

  it('monthly: no generator yields a non-empty deterministic summary for a period with items', async () => {
    const result = await exportMonthlyRecapWithSummaries(items, 25);

    expect(result.months).toHaveLength(1);
    expect(result.months[0].summary).not.toBe('');
    expect(result.months[0].summary).toBe(buildDeterministicSummary(result.months[0].items));
  });

  it('keyed path: a generator result is used as-is and the deterministic text is not substituted', async () => {
    const generator = {
      generateSummary: jest.fn(async (weekItems: Article[]) => `AI says ${weekItems.length}`)
    } as unknown as SummaryGenerator;

    const result = await exportWeeklyHighlightsWithSummaries(items, generator);

    expect(generator.generateSummary).toHaveBeenCalledTimes(1);
    expect(result.weeks[0].summary).toBe('AI says 2');
  });
});
