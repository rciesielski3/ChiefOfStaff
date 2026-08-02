import { mapPapersWithCodeArticles } from '../../../src/transform/mappers/papers-with-code';
import { RawArticle } from '../../../src/business-logic/rss-fetch';

describe('Papers with Code Mapper', () => {
  const sourceId = 'test-papers-source';

  describe('mapPapersWithCodeArticles', () => {
    it('should transform valid API response with single paper', async () => {
      const response = {
        results: [
          {
            id: '1',
            title: 'Deep Learning Advances',
            url: 'https://papers.example.com/paper1',
            published: '2026-07-30T10:00:00Z',
            abstract: 'A comprehensive study of deep learning architectures.'
          }
        ]
      };

      const articles = await mapPapersWithCodeArticles(response, sourceId);

      expect(articles).toHaveLength(1);
      expect(articles[0]).toMatchObject({
        title: 'Deep Learning Advances',
        link: 'https://papers.example.com/paper1',
        pubDate: '2026-07-30T10:00:00Z',
        content: 'A comprehensive study of deep learning architectures.',
        source: 'Papers with Code'
      });
    });

    it('should transform valid API response with multiple papers', async () => {
      const response = {
        results: [
          {
            id: '1',
            title: 'Paper 1',
            url: 'https://papers.example.com/paper1',
            published: '2026-07-30T10:00:00Z',
            abstract: 'Abstract 1'
          },
          {
            id: '2',
            title: 'Paper 2',
            url: 'https://papers.example.com/paper2',
            published: '2026-07-29T10:00:00Z',
            abstract: 'Abstract 2'
          },
          {
            id: '3',
            title: 'Paper 3',
            url: 'https://papers.example.com/paper3',
            published: '2026-07-28T10:00:00Z',
            abstract: 'Abstract 3'
          }
        ]
      };

      const articles = await mapPapersWithCodeArticles(response, sourceId);

      expect(articles).toHaveLength(3);
      expect(articles.map(a => a.title)).toEqual(['Paper 1', 'Paper 2', 'Paper 3']);
    });

    it('should use default abstract when missing', async () => {
      const response = {
        results: [
          {
            id: '1',
            title: 'Paper without abstract',
            url: 'https://papers.example.com/paper1',
            published: '2026-07-30T10:00:00Z'
          }
        ]
      };

      const articles = await mapPapersWithCodeArticles(response, sourceId);

      expect(articles[0].content).toBe('No abstract available');
    });

    it('should truncate content longer than 300 characters', async () => {
      const longAbstract =
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.';

      const response = {
        results: [
          {
            id: '1',
            title: 'Long Abstract Paper',
            url: 'https://papers.example.com/paper1',
            published: '2026-07-30T10:00:00Z',
            abstract: longAbstract
          }
        ]
      };

      const articles = await mapPapersWithCodeArticles(response, sourceId);

      expect(articles[0].content.length).toBeLessThanOrEqual(303); // 300 + "..."
      expect(articles[0].content).toMatch(/\.\.\.$/);
      expect(articles[0].content.length).toBeGreaterThan(300); // Should include "..."
    });

    it('should use "Untitled" when title is missing', async () => {
      const response = {
        results: [
          {
            id: '1',
            url: 'https://papers.example.com/paper1',
            published: '2026-07-30T10:00:00Z',
            abstract: 'Abstract'
          }
        ]
      };

      const articles = await mapPapersWithCodeArticles(response, sourceId);

      expect(articles[0].title).toBe('Untitled');
    });

    it('should construct arxiv URL when url is missing but arxiv_id is available', async () => {
      const response = {
        results: [
          {
            id: '1',
            title: 'ArXiv Paper',
            published: '2026-07-30T10:00:00Z',
            abstract: 'Abstract',
            arxiv_id: '2207.12345'
          }
        ]
      };

      const articles = await mapPapersWithCodeArticles(response, sourceId);

      expect(articles[0].link).toBe('https://arxiv.org/abs/2207.12345');
    });

    it('should prefer url over arxiv_id when both present', async () => {
      const response = {
        results: [
          {
            id: '1',
            title: 'Paper',
            url: 'https://papers.example.com/paper1',
            published: '2026-07-30T10:00:00Z',
            abstract: 'Abstract',
            arxiv_id: '2207.12345'
          }
        ]
      };

      const articles = await mapPapersWithCodeArticles(response, sourceId);

      expect(articles[0].link).toBe('https://papers.example.com/paper1');
    });

    it('should throw error when response is not an object', async () => {
      await expect(mapPapersWithCodeArticles('not an object', sourceId)).rejects.toThrow(
        /expected object, got string/
      );

      await expect(mapPapersWithCodeArticles(null, sourceId)).rejects.toThrow(
        /Invalid Papers API response/
      );

      await expect(mapPapersWithCodeArticles(undefined, sourceId)).rejects.toThrow(
        /Invalid Papers API response/
      );

      await expect(mapPapersWithCodeArticles(123, sourceId)).rejects.toThrow(
        /expected object, got number/
      );
    });

    it('should throw error when results array is missing', async () => {
      const response = { data: [] };

      await expect(mapPapersWithCodeArticles(response, sourceId)).rejects.toThrow(
        /missing or invalid results array/
      );
    });

    it('should throw error when results is not an array', async () => {
      const response = { results: 'not an array' };

      await expect(mapPapersWithCodeArticles(response, sourceId)).rejects.toThrow(
        /missing or invalid results array/
      );
    });

    it('should handle empty results array', async () => {
      const response = { results: [] };

      const articles = await mapPapersWithCodeArticles(response, sourceId);

      expect(articles).toEqual([]);
    });

    it('should skip malformed papers and continue with valid ones', async () => {
      const response = {
        results: [
          {
            id: '1',
            title: 'Valid Paper',
            url: 'https://papers.example.com/paper1',
            published: '2026-07-30T10:00:00Z',
            abstract: 'Abstract'
          },
          null, // Malformed
          {
            id: '3',
            title: 'Another Valid Paper',
            url: 'https://papers.example.com/paper3',
            published: '2026-07-28T10:00:00Z',
            abstract: 'Abstract 3'
          }
        ]
      };

      const articles = await mapPapersWithCodeArticles(response, sourceId);

      expect(articles).toHaveLength(2);
      expect(articles[0].title).toBe('Valid Paper');
      expect(articles[1].title).toBe('Another Valid Paper');
    });

    it('should gracefully handle papers with missing fields using defaults', async () => {
      const response = {
        results: [
          {
            id: '1',
            title: 'Valid Paper',
            url: 'https://papers.example.com/paper1',
            published: '2026-07-30T10:00:00Z',
            abstract: 'Abstract'
          },
          {
            id: '2'
            // Missing title, url, published - should use defaults
          },
          {
            id: '3',
            title: 'Another Valid',
            url: 'https://papers.example.com/paper3',
            published: '2026-07-28T10:00:00Z',
            abstract: 'Abstract 3'
          }
        ]
      };

      const articles = await mapPapersWithCodeArticles(response, sourceId);

      expect(articles).toHaveLength(3);
      expect(articles[0].title).toBe('Valid Paper');
      expect(articles[1].title).toBe('Untitled'); // Default title
      expect(articles[1].link).toBe(''); // Empty URL
      expect(articles[1].content).toBe('No abstract available'); // Default abstract
      expect(articles[2].title).toBe('Another Valid');
    });

    it('should always set source to "Papers with Code"', async () => {
      const response = {
        results: [
          {
            id: '1',
            title: 'Paper 1',
            url: 'https://papers.example.com/paper1',
            published: '2026-07-30T10:00:00Z',
            abstract: 'Abstract 1'
          },
          {
            id: '2',
            title: 'Paper 2',
            url: 'https://papers.example.com/paper2',
            published: '2026-07-29T10:00:00Z',
            abstract: 'Abstract 2'
          }
        ]
      };

      const articles = await mapPapersWithCodeArticles(response, sourceId);

      expect(articles.every(a => a.source === 'Papers with Code')).toBe(true);
    });

    it('should preserve pubDate as ISO 8601 format', async () => {
      const isoDate = '2026-07-30T15:45:30Z';
      const response = {
        results: [
          {
            id: '1',
            title: 'Paper',
            url: 'https://papers.example.com/paper1',
            published: isoDate,
            abstract: 'Abstract'
          }
        ]
      };

      const articles = await mapPapersWithCodeArticles(response, sourceId);

      expect(articles[0].pubDate).toBe(isoDate);
    });

    it('should handle papers with whitespace in fields', async () => {
      const response = {
        results: [
          {
            id: '1',
            title: '  Paper with spaces  ',
            url: '  https://papers.example.com/paper1  ',
            published: '  2026-07-30T10:00:00Z  ',
            abstract: '  Abstract with leading/trailing spaces  '
          }
        ]
      };

      const articles = await mapPapersWithCodeArticles(response, sourceId);

      expect(articles[0].title).toBe('Paper with spaces');
      expect(articles[0].link).toBe('https://papers.example.com/paper1');
      expect(articles[0].pubDate).toBe('2026-07-30T10:00:00Z');
      expect(articles[0].content).toBe('Abstract with leading/trailing spaces');
    });

    it('should populate all RawArticle fields correctly', async () => {
      const response = {
        results: [
          {
            id: '1',
            title: 'Complete Paper',
            url: 'https://papers.example.com/paper1',
            published: '2026-07-30T10:00:00Z',
            abstract: 'This is the abstract.'
          }
        ]
      };

      const articles = await mapPapersWithCodeArticles(response, sourceId);

      const article = articles[0];
      expect(article).toHaveProperty('link');
      expect(article).toHaveProperty('title');
      expect(article).toHaveProperty('pubDate');
      expect(article).toHaveProperty('content');
      expect(article).toHaveProperty('source');

      expect(article.link).toBeTruthy();
      expect(article.title).toBeTruthy();
      expect(article.pubDate).toBeTruthy();
      expect(article.content).toBeTruthy();
      expect(article.source).toBeTruthy();
    });

    it('should handle response with extra unknown fields', async () => {
      const response = {
        results: [
          {
            id: '1',
            title: 'Paper',
            url: 'https://papers.example.com/paper1',
            published: '2026-07-30T10:00:00Z',
            abstract: 'Abstract',
            extra_field: 'should be ignored',
            another_field: 123
          }
        ],
        metadata: { total: 1 }
      };

      const articles = await mapPapersWithCodeArticles(response, sourceId);

      expect(articles).toHaveLength(1);
      expect(articles[0]).toMatchObject({
        title: 'Paper',
        link: 'https://papers.example.com/paper1',
        source: 'Papers with Code'
      });
    });

    it('should handle empty strings as missing fields', async () => {
      const response = {
        results: [
          {
            id: '1',
            title: '',
            url: '',
            published: '2026-07-30T10:00:00Z',
            abstract: ''
          }
        ]
      };

      const articles = await mapPapersWithCodeArticles(response, sourceId);

      expect(articles[0].title).toBe('Untitled');
      expect(articles[0].link).toBe('');
      expect(articles[0].content).toBe('No abstract available');
    });
  });
});
