/**
 * Source health: per-feed article yield over a recent window.
 *
 * Pure functions only (no I/O). Used by src/cli/source-health.ts to build a
 * weekly report so dead feeds can be spotted and disabled in the config.
 *
 * Articles from sources that are not in the enabled list are ignored.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SourceHealthArticle {
  source: string;
  publishedAt?: string;
}

export interface SourceHealthEntry {
  source: string;
  /** Articles published within [windowStart, windowEnd] */
  count: number;
  /** Latest valid publishedAt seen for this source (all time), or null if none */
  lastPublishedAt: string | null;
}

export interface SourceHealthReport {
  windowStart: string;
  windowEnd: string;
  windowDays: number;
  /** Sorted by count desc, then by source name */
  sources: SourceHealthEntry[];
  total: number;
}

function parseTime(value: string | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

export function computeSourceHealth(
  enabledSources: string[],
  articles: SourceHealthArticle[],
  now: Date,
  windowDays: number = 7
): SourceHealthReport {
  const end = now.getTime();
  const start = end - windowDays * DAY_MS;

  const counts = new Map<string, number>();
  const lastSeen = new Map<string, number>();
  for (const name of enabledSources) counts.set(name, 0);

  for (const { source, publishedAt } of articles) {
    if (!counts.has(source)) continue;
    const time = parseTime(publishedAt);
    if (time === null) continue;

    if (time >= start && time <= end) counts.set(source, counts.get(source)! + 1);
    if (time > (lastSeen.get(source) ?? -Infinity)) lastSeen.set(source, time);
  }

  const sources: SourceHealthEntry[] = Array.from(counts, ([source, count]) => {
    const last = lastSeen.get(source);
    return {
      source,
      count,
      lastPublishedAt: last === undefined ? null : new Date(last).toISOString(),
    };
  }).sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));

  return {
    windowStart: new Date(start).toISOString(),
    windowEnd: new Date(end).toISOString(),
    windowDays,
    sources,
    total: sources.reduce((sum, s) => sum + s.count, 0),
  };
}

function day(iso: string): string {
  return iso.slice(0, 10);
}

/** Concise plain-text report suitable for a Telegram message. */
export function formatSourceHealthReport(report: SourceHealthReport): string {
  const zeroCount = report.sources.filter((s) => s.count === 0).length;

  const rows = report.sources.map((s) =>
    s.count > 0
      ? `${s.count} ${s.source}`
      : `⚠️ 0 ${s.source} (last article: ${s.lastPublishedAt ? day(s.lastPublishedAt) : 'never'})`
  );

  return [
    `Source health: ${day(report.windowStart)} to ${day(report.windowEnd)} (${report.windowDays} days)`,
    '',
    ...rows,
    '',
    `Total: ${report.total} articles from ${report.sources.length} sources (${zeroCount} with zero)`,
  ].join('\n');
}
