/**
 * Source health: per-feed article yield over a recent window.
 *
 * Pure functions only (no I/O). Used by src/cli/source-health.ts to build a
 * weekly report so dead feeds can be spotted and disabled in the config.
 *
 * Articles from sources that are not in the enabled list are ignored.
 *
 * The store only keeps RETENTION_DAYS of articles, so a quiet feed can have no
 * stored articles at all. The CLI live-fetches those feeds and passes the
 * outcome in as FeedCheck data, so a quiet feed can be told from a broken one.
 */

import { RETENTION_DAYS } from './article-store';

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

/** Outcome of a live fetch of one feed. */
export type FeedCheck = { ok: true; items: number; newest?: string } | { ok: false; error: string };

const MAX_ERROR_LENGTH = 80;

function parseTime(value: string | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

export function computeSourceHealth(
  enabledSources: string[],
  articles: SourceHealthArticle[],
  now: Date,
  windowDays: number = 7,
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

/** Summarize fetched feed items into a successful FeedCheck. */
export function summarizeFeedItems(items: { pubDate: string }[]): FeedCheck {
  let newest: number | null = null;
  for (const { pubDate } of items) {
    const time = parseTime(pubDate);
    if (time !== null && (newest === null || time > newest)) newest = time;
  }
  return newest === null
    ? { ok: true, items: items.length }
    : { ok: true, items: items.length, newest: new Date(newest).toISOString() };
}

function day(iso: string): string {
  return iso.slice(0, 10);
}

function shortError(error: string): string {
  const oneLine = error.replace(/\s+/g, ' ').trim();
  return oneLine.length > MAX_ERROR_LENGTH ? oneLine.slice(0, MAX_ERROR_LENGTH - 1) + '…' : oneLine;
}

function zeroRow(entry: SourceHealthEntry, check: FeedCheck | undefined): string {
  const name = entry.source;
  if (check && !check.ok) return `❌ 0 ${name} (fetch failed: ${shortError(check.error)})`;
  if (check && check.newest) return `⚠️ 0 ${name} (feed OK, newest item ${day(check.newest)})`;
  if (check) return `⚠️ 0 ${name} (feed OK but empty, ${check.items} items)`;
  if (entry.lastPublishedAt) return `⚠️ 0 ${name} (last article: ${day(entry.lastPublishedAt)})`;
  return `⚠️ 0 ${name} (no articles in last ${RETENTION_DAYS} days, store retention)`;
}

/**
 * Concise plain-text report suitable for a Telegram message.
 *
 * `feedChecks` holds live-fetch outcomes for zero-count sources (keyed by
 * source name). Sources without an entry fall back to what the store knows.
 */
export function formatSourceHealthReport(
  report: SourceHealthReport,
  feedChecks: Map<string, FeedCheck> = new Map(),
): string {
  const zero = report.sources.filter((s) => s.count === 0);
  const failed = zero.filter((s) => feedChecks.get(s.source)?.ok === false).length;

  const rows = report.sources.map((s) =>
    s.count > 0 ? `${s.count} ${s.source}` : zeroRow(s, feedChecks.get(s.source)),
  );

  const summary =
    failed > 0 ? `${zero.length} with zero, ${failed} fetch failed` : `${zero.length} with zero`;

  return [
    `Source health: ${day(report.windowStart)} to ${day(report.windowEnd)} (${report.windowDays} days)`,
    '',
    ...rows,
    '',
    `Total: ${report.total} articles from ${report.sources.length} sources (${summary})`,
  ].join('\n');
}
