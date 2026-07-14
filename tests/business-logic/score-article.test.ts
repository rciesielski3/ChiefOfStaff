import { scoreArticle, scoreArticles, DEFAULT_CONFIG } from '../../src/business-logic/score-article';
import { Article } from '../../src/business-logic/normalize-article';

describe('scoreArticle', () => {
  const mockArticle: Article = {
    id: 'test-1',
    title: 'Playwright Testing Framework Update',
    summary: 'New features for automated testing and CI/CD integration',
    url: 'https://example.com/playwright',
    source: 'Playwright Blog',
    category: 'release',
    publishedAt: new Date().toISOString(),
    tags: ['playwright', 'testing']
  };

  it('should start with base score', () => {
    const result = scoreArticle(mockArticle);

    // Base score should be 50 (or more with keyword matches)
    expect(result.score).toBeGreaterThanOrEqual(DEFAULT_CONFIG.weights.base);
  });

  it('should add weight for matching keywords in title', () => {
    const article = {
      ...mockArticle,
      title: 'Breaking: Security vulnerability in popular library'
    };

    const result = scoreArticle(article);

    // Should have matched 'security' keyword and 'breaking' keyword
    expect(result.score).toBeGreaterThan(DEFAULT_CONFIG.weights.base);
    expect(result.reason).toContain('security');
  });

  it('should add weight for matching source name', () => {
    const article = {
      ...mockArticle,
      source: 'OpenAI Blog'
    };

    const result = scoreArticle(article);

    // Should have matched OpenAI as a source
    expect(result.score).toBeGreaterThan(DEFAULT_CONFIG.weights.base);
    expect(result.reason).toContain('openai');
  });

  it('should classify priority based on score', () => {
    const criticalArticle = {
      ...mockArticle,
      title: 'Breaking security vulnerability: critical CVE exploit',
      source: 'OpenAI'
    };

    const result = scoreArticle(criticalArticle);

    // High score should map to CRITICAL priority
    expect(result.priority).toBe('CRITICAL');
  });

  it('should classify HIGH priority', () => {
    const highArticle = {
      ...mockArticle,
      title: 'TypeScript release with breaking changes'
    };

    const result = scoreArticle(highArticle);

    // Should be HIGH or above
    expect(['HIGH', 'CRITICAL']).toContain(result.priority);
  });

  it('should include reasons for scoring', () => {
    const article = {
      ...mockArticle,
      title: 'Playwright security migration guide'
    };

    const result = scoreArticle(article);

    // Should have tracked the keywords that contributed to score
    expect(result.reason.length).toBeGreaterThan(0);
    expect(result.reason).toContain('playwright');
  });

  it('should deduplicate reasons', () => {
    const article = mockArticle;
    const result = scoreArticle(article);

    // Should not have duplicate reasons
    const uniqueReasons = new Set(result.reason);
    expect(result.reason.length).toBe(uniqueReasons.size);
  });

  it('should apply freshness bonus for recent articles', () => {
    const now = new Date();
    const recentArticle = {
      ...mockArticle,
      publishedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
    };

    const oldArticle = {
      ...mockArticle,
      publishedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
    };

    const recentScore = scoreArticle(recentArticle);
    const oldScore = scoreArticle(oldArticle);

    // Recent article should have higher or equal score
    expect(recentScore.score).toBeGreaterThanOrEqual(oldScore.score);
  });

  it('should handle articles without keywords', () => {
    const article = {
      ...mockArticle,
      title: 'Random article about gardening'
    };

    const result = scoreArticle(article);

    // Should still have base score
    expect(result.score).toBeGreaterThanOrEqual(DEFAULT_CONFIG.weights.base);
  });

  it('should use custom config', () => {
    const customConfig = {
      weights: {
        base: 100,
        keywords: { 'custom-keyword': 50 },
        sources: {}
      },
      priority: {
        critical: 200,
        high: 150,
        medium: 100
      }
    };

    const article = {
      ...mockArticle,
      title: 'Article with custom-keyword'
    };

    const result = scoreArticle(article, customConfig);

    // Should use custom base score and weights
    expect(result.score).toBeGreaterThanOrEqual(customConfig.weights.base + 50);
  });

  it('should handle missing publish date gracefully', () => {
    const article = {
      ...mockArticle,
      publishedAt: 'invalid-date'
    };

    // Should not throw
    expect(() => scoreArticle(article)).not.toThrow();
  });
});

describe('scoreArticles', () => {
  const mockArticles: Article[] = [
    {
      id: 'test-1',
      title: 'Article A with playwright',
      summary: 'Some content',
      url: 'https://example.com/a',
      source: 'Blog A',
      category: 'article',
      publishedAt: new Date().toISOString(),
      tags: []
    },
    {
      id: 'test-2',
      title: 'Article B with typescript',
      summary: 'More content',
      url: 'https://example.com/b',
      source: 'Blog B',
      category: 'article',
      publishedAt: new Date().toISOString(),
      tags: []
    },
    {
      id: 'test-3',
      title: 'Article C with no keywords',
      summary: 'Other content',
      url: 'https://example.com/c',
      source: 'Blog C',
      category: 'article',
      publishedAt: new Date().toISOString(),
      tags: []
    }
  ];

  it('should score multiple articles', () => {
    const results = scoreArticles(mockArticles);

    expect(results.length).toBe(mockArticles.length);
    results.forEach(article => {
      expect(article.score).toBeDefined();
      expect(article.priority).toBeDefined();
      expect(article.reason).toBeDefined();
    });
  });

  it('should sort articles by score descending', () => {
    const results = scoreArticles(mockArticles);

    // Scores should be in descending order
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
    }
  });

  it('should preserve article data', () => {
    const results = scoreArticles(mockArticles);

    results.forEach((result, index) => {
      expect(result.id).toBe(mockArticles[index].id);
      expect(result.title).toBe(mockArticles[index].title);
      expect(result.url).toBe(mockArticles[index].url);
    });
  });

  it('should handle empty array', () => {
    const results = scoreArticles([]);

    expect(results).toEqual([]);
  });
});
