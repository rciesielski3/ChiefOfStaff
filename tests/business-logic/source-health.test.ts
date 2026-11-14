import {
  computeSourceHealth,
  formatSourceHealthReport,
  SourceHealthArticle,
} from '../../src/business-logic/source-health';

const NOW = new Date('2026-11-14T12:00:00.000Z');

function article(source: string, publishedAt: string | undefined): SourceHealthArticle {
  return { source, publishedAt };
}

describe('computeSourceHealth', () => {
  it('counts articles inside the window, inclusive of both boundaries', () => {
    const articles = [
      article('A', '2026-11-07T12:00:00.000Z'), // exactly now - 7d: included
      article('A', '2026-11-14T12:00:00.000Z'), // exactly now: included
      article('A', '2026-11-07T11:59:59.999Z'), // just before window: excluded
      article('A', '2026-11-14T12:00:00.001Z'), // just after now: excluded
    ];

    const report = computeSourceHealth(['A'], articles, NOW);

    expect(report.sources).toEqual([
      { source: 'A', count: 2, lastPublishedAt: '2026-11-14T12:00:00.001Z' },
    ]);
  });

  it('respects a custom windowDays and reports window dates', () => {
    const articles = [
      article('A', '2026-11-12T00:00:00.000Z'),
      article('A', '2026-11-10T00:00:00.000Z'),
    ];

    const report = computeSourceHealth(['A'], articles, NOW, 3);

    expect(report.sources[0].count).toBe(1);
    expect(report.windowDays).toBe(3);
    expect(report.windowStart).toBe('2026-11-11T12:00:00.000Z');
    expect(report.windowEnd).toBe('2026-11-14T12:00:00.000Z');
  });

  it('defaults windowDays to 7', () => {
    const report = computeSourceHealth(['A'], [], NOW);
    expect(report.windowDays).toBe(7);
    expect(report.windowStart).toBe('2026-11-07T12:00:00.000Z');
  });

  it('includes every enabled source, even with zero articles', () => {
    const report = computeSourceHealth(['A', 'B'], [article('A', '2026-11-13T00:00:00Z')], NOW);

    expect(report.sources).toEqual([
      { source: 'A', count: 1, lastPublishedAt: '2026-11-13T00:00:00.000Z' },
      { source: 'B', count: 0, lastPublishedAt: null },
    ]);
  });

  it('ignores articles with missing or invalid publishedAt', () => {
    const articles = [
      article('A', undefined),
      article('A', ''),
      article('A', 'not-a-date'),
      article('A', '2026-11-13T00:00:00Z'),
    ];

    const report = computeSourceHealth(['A'], articles, NOW);

    expect(report.sources[0].count).toBe(1);
    expect(report.sources[0].lastPublishedAt).toBe('2026-11-13T00:00:00.000Z');
  });

  it('tracks the latest publishedAt per source across all time', () => {
    const articles = [
      article('Old', '2026-09-01T00:00:00Z'),
      article('Old', '2026-10-01T00:00:00Z'),
      article('Old', '2026-08-01T00:00:00Z'),
    ];

    const report = computeSourceHealth(['Old'], articles, NOW);

    expect(report.sources[0]).toEqual({
      source: 'Old',
      count: 0,
      lastPublishedAt: '2026-10-01T00:00:00.000Z',
    });
  });

  it('ignores sources that are not in the enabled list', () => {
    const report = computeSourceHealth(
      ['A'],
      [article('Removed Feed', '2026-11-13T00:00:00Z')],
      NOW
    );

    expect(report.sources.map((s) => s.source)).toEqual(['A']);
    expect(report.total).toBe(0);
  });

  it('sorts by count desc, then by name', () => {
    const articles = [
      article('B', '2026-11-13T00:00:00Z'),
      article('C', '2026-11-13T00:00:00Z'),
      article('C', '2026-11-12T00:00:00Z'),
      article('A', '2026-11-13T00:00:00Z'),
    ];

    const report = computeSourceHealth(['A', 'B', 'C', 'D'], articles, NOW);

    expect(report.sources.map((s) => s.source)).toEqual(['C', 'A', 'B', 'D']);
    expect(report.total).toBe(4);
  });
});

describe('formatSourceHealthReport', () => {
  it('produces a plain-text report with header, sorted rows, flags and total', () => {
    const report = computeSourceHealth(
      ['Busy', 'Quiet', 'Dead'],
      [
        article('Busy', '2026-11-13T00:00:00Z'),
        article('Busy', '2026-11-12T00:00:00Z'),
        article('Quiet', '2026-11-10T00:00:00Z'),
        article('Dead', '2026-10-01T09:30:00Z'),
      ],
      NOW
    );

    const text = formatSourceHealthReport(report);

    expect(text).toBe(
      [
        'Source health: 2026-11-07 to 2026-11-14 (7 days)',
        '',
        '2 Busy',
        '1 Quiet',
        '⚠️ 0 Dead (last article: 2026-10-01)',
        '',
        'Total: 3 articles from 3 sources (1 with zero)',
      ].join('\n')
    );
  });

  it('shows "never" for a zero source with no articles at all', () => {
    const report = computeSourceHealth(['Ghost'], [], NOW);

    expect(formatSourceHealthReport(report)).toContain('⚠️ 0 Ghost (last article: never)');
  });
});
