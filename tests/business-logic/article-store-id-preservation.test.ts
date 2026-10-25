import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { NdJsonArticleStore } from '../../src/business-logic/article-store';
import { Article, buildLegacyArticleId } from '../../src/business-logic/normalize-article';

describe('dedupAndMerge keeps stored IDs for re-seen articles', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'article-store-ids-'));
    file = join(dir, 'articles.ndjson');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('does not replace an existing legacy ID when the same article is fetched again', async () => {
    const url = 'https://www.infoq.com/news/a/';
    const legacyId = buildLegacyArticleId('InfoQ', url);
    const stored: Article = {
      id: legacyId, title: 'Same title', summary: 's', url, source: 'InfoQ',
      category: 'news', publishedAt: new Date().toISOString(), tags: []
    };
    await fs.writeFile(file, JSON.stringify(stored) + '\n');

    const refetched: Article = { ...stored, id: 'infoq-0123456789abcdef' };
    const store = new NdJsonArticleStore(file);
    await store.dedupAndMerge([refetched]);

    const after = await store.read();
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(legacyId);
  });

  it('gives genuinely new articles the new-format ID', async () => {
    const store = new NdJsonArticleStore(file);
    const fresh: Article = {
      id: 'infoq-0123456789abcdef', title: 'Brand new', summary: 's',
      url: 'https://www.infoq.com/news/new/', source: 'InfoQ',
      category: 'news', publishedAt: new Date().toISOString(), tags: []
    };
    await store.dedupAndMerge([fresh]);

    const after = await store.read();
    expect(after[0].id).toBe('infoq-0123456789abcdef');
  });
});
