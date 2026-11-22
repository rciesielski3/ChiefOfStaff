import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  DEFAULT_TRENDS_OUT,
  resolveOutPath,
  runExportGitHubTrends,
} from '../../src/cli/export-github-trends';
import { FetchLike, GITHUB_TREND_TOPICS } from '../../src/business-logic/github-trends';

const NOW = new Date('2026-11-18T08:00:00Z');

function repo(name: string, stars: number) {
  return {
    name,
    html_url: `https://github.com/acme/${name}`,
    description: `${name} description`,
    created_at: '2026-11-01T10:00:00Z',
    stargazers_count: stars,
    owner: { login: 'acme' },
  };
}

function okFetch(items: unknown[] = [repo('widget', 120)]): jest.Mock {
  return jest.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ items }),
  }));
}

describe('resolveOutPath', () => {
  it('defaults to qa-news/public/trending.json', () => {
    expect(resolveOutPath([], {})).toBe(DEFAULT_TRENDS_OUT);
    expect(DEFAULT_TRENDS_OUT).toBe('qa-news/public/trending.json');
  });

  it('uses GITHUB_TRENDS_OUT when --out is absent', () => {
    expect(resolveOutPath([], { GITHUB_TRENDS_OUT: 'tmp/t.json' })).toBe('tmp/t.json');
  });

  it('prefers --out over GITHUB_TRENDS_OUT', () => {
    expect(resolveOutPath(['--out', 'a.json'], { GITHUB_TRENDS_OUT: 'b.json' })).toBe('a.json');
  });

  it('throws when --out has no value', () => {
    expect(() => resolveOutPath(['--out'], {})).toThrow('--out requires a path argument');
    expect(() => resolveOutPath(['--out', '--x'], {})).toThrow('--out requires a path argument');
  });
});

describe('runExportGitHubTrends', () => {
  let root: string;
  const log = jest.fn();

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'gh-trends-'));
    log.mockClear();
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const outFile = () => path.join(root, DEFAULT_TRENDS_OUT);

  it('writes { generatedAt, items } to the default path, creating directories', async () => {
    const fetchImpl = okFetch();
    const result = await runExportGitHubTrends({
      projectRoot: root,
      env: {},
      now: NOW,
      fetchImpl: fetchImpl as unknown as FetchLike,
      log,
    });

    expect(result).toEqual({ outPath: outFile(), count: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(GITHUB_TREND_TOPICS.length);
    const written = JSON.parse(fs.readFileSync(outFile(), 'utf8'));
    expect(written.generatedAt).toBe(NOW.toISOString());
    expect(written.items).toHaveLength(1);
    expect(written.items[0]).toMatchObject({
      title: 'acme/widget',
      url: 'https://github.com/acme/widget',
      summary: 'widget description',
      description: 'widget description',
      stars: 120,
      category: 'test-automation',
      publishedAt: '2026-11-01T10:00:00Z',
    });
    expect(fs.existsSync(`${outFile()}.tmp`)).toBe(false);
  });

  it('writes to the --out path relative to the project root', async () => {
    await runExportGitHubTrends({
      argv: ['--out', 'custom/trends.json'],
      projectRoot: root,
      env: {},
      now: NOW,
      fetchImpl: okFetch() as unknown as FetchLike,
      log,
    });
    expect(fs.existsSync(path.join(root, 'custom/trends.json'))).toBe(true);
  });

  it('sends the token as a header but never logs it', async () => {
    const fetchImpl = okFetch();
    await runExportGitHubTrends({
      projectRoot: root,
      env: { GITHUB_TOKEN: 'secret-token' },
      now: NOW,
      fetchImpl: fetchImpl as unknown as FetchLike,
      log,
    });
    const init = fetchImpl.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers.Authorization).toBe('Bearer secret-token');
    expect(log.mock.calls.flat().join('\n')).not.toContain('secret-token');
  });

  it('keeps the previous file unchanged when a topic search fails', async () => {
    fs.mkdirSync(path.dirname(outFile()), { recursive: true });
    const previous = '{"generatedAt":"2026-11-17T08:00:00.000Z","items":[]}\n';
    fs.writeFileSync(outFile(), previous);

    let call = 0;
    const fetchImpl = jest.fn(async () => {
      call += 1;
      if (call === 2) {
        return { ok: false, status: 403, statusText: 'rate limit', json: async () => ({}) };
      }
      return { ok: true, status: 200, statusText: 'OK', json: async () => ({ items: [] }) };
    });

    await expect(
      runExportGitHubTrends({
        projectRoot: root,
        env: {},
        now: NOW,
        fetchImpl: fetchImpl as unknown as FetchLike,
        log,
      }),
    ).rejects.toThrow('HTTP 403');

    expect(fs.readFileSync(outFile(), 'utf8')).toBe(previous);
    expect(fs.existsSync(`${outFile()}.tmp`)).toBe(false);
  });

  it('does not create the file when fetch rejects and no previous file exists', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('network down');
    });
    await expect(
      runExportGitHubTrends({
        projectRoot: root,
        env: {},
        now: NOW,
        fetchImpl: fetchImpl as unknown as FetchLike,
        log,
      }),
    ).rejects.toThrow('network down');
    expect(fs.existsSync(outFile())).toBe(false);
  });

  it('removes the temp file and keeps the previous file when the rename fails', async () => {
    // A directory at the target path makes rename fail after the temp file is written.
    fs.mkdirSync(outFile(), { recursive: true });
    await expect(
      runExportGitHubTrends({
        projectRoot: root,
        env: {},
        now: NOW,
        fetchImpl: okFetch() as unknown as FetchLike,
        log,
      }),
    ).rejects.toThrow();
    expect(fs.statSync(outFile()).isDirectory()).toBe(true);
    expect(fs.existsSync(`${outFile()}.tmp`)).toBe(false);
  });
});
