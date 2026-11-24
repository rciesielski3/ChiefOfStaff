import {
  scoreArticle,
  scoreArticles,
  DEFAULT_CONFIG,
  hasNegativeKeywords,
  isListicleTitle,
  LISTICLE_PENALTY,
} from '../../src/business-logic/score-article';
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
    tags: ['playwright', 'testing'],
  };

  it('should start with base score', () => {
    const result = scoreArticle(mockArticle);

    // Base score should be 50 (or more with keyword matches)
    expect(result.score).toBeGreaterThanOrEqual(DEFAULT_CONFIG.weights.base);
  });

  it('should add weight for matching keywords in title', () => {
    const article = {
      ...mockArticle,
      title: 'Breaking: Security vulnerability in popular library',
    };

    const result = scoreArticle(article);

    // Should have matched 'security' keyword and 'breaking' keyword
    expect(result.score).toBeGreaterThan(DEFAULT_CONFIG.weights.base);
    expect(result.reason).toContain('security');
  });

  it('should add weight for matching source name', () => {
    const article = {
      ...mockArticle,
      title: 'x',
      summary: 'y',
      publishedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
      source: 'Google Testing Blog',
    };

    const result = scoreArticle(article);

    expect(result.score).toBe(
      DEFAULT_CONFIG.weights.base + DEFAULT_CONFIG.weights.sources['Google Testing'],
    );
    expect(result.reason).toContain('Google Testing');
  });

  describe('source weight matching', () => {
    const cfg = (sources: Record<string, number>) => ({
      ...DEFAULT_CONFIG,
      weights: { base: 0, keywords: {}, sources },
    });
    const old = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString();
    const base = {
      ...mockArticle,
      title: 'x',
      summary: 'y',
      publishedAt: old,
    };

    it('applies a source weight configured with a capitalised key', () => {
      const result = scoreArticle(
        { ...base, source: 'Ministry of Testing' },
        cfg({
          'Ministry of Testing': 50,
        }),
      );
      expect(result.score).toBe(50);
      expect(result.reason).toContain('Ministry of Testing');
    });

    it('matches case-insensitively and ignores surrounding whitespace', () => {
      const result = scoreArticle({ ...base, source: '  CYPRESS ' }, cfg({ ' Cypress ': 40 }));
      expect(result.score).toBe(40);
    });

    it('still matches by substring (key "Google Testing" vs source "Google Testing Blog")', () => {
      const result = scoreArticle(
        { ...base, source: 'Google Testing Blog' },
        cfg({
          'Google Testing': 45,
        }),
      );
      expect(result.score).toBe(45);
    });

    it('does not apply an unrelated source weight', () => {
      const result = scoreArticle({ ...base, source: 'InfoQ' }, cfg({ Cypress: 40 }));
      expect(result.score).toBe(0);
    });

    it('ignores empty source keys', () => {
      const result = scoreArticle({ ...base, source: 'InfoQ' }, cfg({ '  ': 99 }));
      expect(result.score).toBe(0);
    });

    it('applies the default weight for real capitalised sources', () => {
      const result = scoreArticle({ ...base, source: 'Ministry of Testing' });
      expect(result.score).toBe(
        DEFAULT_CONFIG.weights.base + DEFAULT_CONFIG.weights.sources['Ministry of Testing'],
      );
    });
  });

  describe('default source weights are a modest prior', () => {
    const { keywords, sources } = DEFAULT_CONFIG.weights;
    const strongestKeyword = Math.max(...Object.values(keywords));
    const old = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString();
    const art = (title: string, source: string): Article => ({
      ...mockArticle,
      title,
      summary: '',
      source,
      publishedAt: old,
    });

    it('never outweighs a third of the strongest keyword weight', () => {
      for (const weight of Object.values(sources)) {
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(strongestKeyword / 3);
      }
    });

    it('keeps the high-volume source below the official QA sources', () => {
      expect(sources['Ministry of Testing']).toBeLessThan(sources['Google Testing']);
      expect(sources['Ministry of Testing']).toBeGreaterThan(0);
    });

    it('lets a strong keyword beat a weighted source with weaker relevance', () => {
      const relevant = scoreArticle(art('Test automation guide', 'InfoQ'));
      const weighted = scoreArticle(art('Some QA news', 'Ministry of Testing'));
      expect(relevant.score).toBeGreaterThan(weighted.score);
    });

    it('ranks QA sources only slightly above other sources at equal relevance', () => {
      const qa = scoreArticle(art('Testing news', 'Martin Fowler'));
      const other = scoreArticle(art('Testing news', 'InfoQ'));
      expect(qa.score).toBeGreaterThan(other.score);
      expect(qa.score - other.score).toBeLessThanOrEqual(strongestKeyword / 3);
    });

    it('keeps top-3 diverse when one source has many equally relevant articles', () => {
      const flood = Array.from({ length: 10 }, (_, i) =>
        art(`Testing deep dive ${i}`, 'Ministry of Testing'),
      );
      const others = [
        art('Testing in practice', 'Martin Fowler'),
        art('Testing in practice 2', 'Google Testing Blog'),
        art('Testing in practice 3', 'Cypress'),
      ];
      const top3 = scoreArticles([...flood, ...others])
        .slice(0, 3)
        .map((a) => a.source);
      expect(new Set(top3).size).toBeGreaterThan(1);
      expect(top3).not.toContain('Ministry of Testing');
    });
  });

  it('should classify priority based on score', () => {
    const criticalArticle = {
      ...mockArticle,
      title: 'Breaking security vulnerability: critical CVE exploit',
      source: 'OpenAI',
    };

    const result = scoreArticle(criticalArticle);

    // High score should map to CRITICAL priority
    expect(result.priority).toBe('CRITICAL');
  });

  it('should classify HIGH priority', () => {
    const highArticle = {
      ...mockArticle,
      title: 'TypeScript release with breaking changes',
    };

    const result = scoreArticle(highArticle);

    // Should be HIGH or above
    expect(['HIGH', 'CRITICAL']).toContain(result.priority);
  });

  it('should include reasons for scoring', () => {
    const article = {
      ...mockArticle,
      title: 'Playwright security migration guide',
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
      publishedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    };

    const oldArticle = {
      ...mockArticle,
      publishedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    };

    const recentScore = scoreArticle(recentArticle);
    const oldScore = scoreArticle(oldArticle);

    // Recent article should have higher or equal score
    expect(recentScore.score).toBeGreaterThanOrEqual(oldScore.score);
  });

  it('should handle articles without keywords', () => {
    const article = {
      ...mockArticle,
      title: 'Random article about gardening',
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
        sources: {},
      },
      priority: {
        critical: 200,
        high: 150,
        medium: 100,
      },
    };

    const article = {
      ...mockArticle,
      title: 'Article with custom-keyword',
    };

    const result = scoreArticle(article, customConfig);

    // Should use custom base score and weights
    expect(result.score).toBeGreaterThanOrEqual(customConfig.weights.base + 50);
  });

  it('should handle missing publish date gracefully', () => {
    const article = {
      ...mockArticle,
      publishedAt: 'invalid-date',
    };

    // Should not throw
    expect(() => scoreArticle(article)).not.toThrow();
  });
});

describe('hasNegativeKeywords', () => {
  it('should filter out pure ECC memory articles', () => {
    const article: Article = {
      id: 'test-ecc',
      title: 'ECC and DDR5 Memory Performance Comparison',
      summary: 'Exploring ECC memory vs DDR5 performance metrics...',
      url: 'https://example.com/ecc',
      source: 'Tech News',
      category: 'article',
      publishedAt: new Date().toISOString(),
      tags: [],
    };

    expect(hasNegativeKeywords(article)).toBe(true);
  });

  it('should filter out residential proxies articles', () => {
    const article: Article = {
      id: 'test-proxies',
      title: 'LG to Ban Residential Proxies from Smart TV Apps',
      summary: 'Smart TV manufacturers are cracking down on residential proxies...',
      url: 'https://example.com/proxies',
      source: 'Tech News',
      category: 'article',
      publishedAt: new Date().toISOString(),
      tags: [],
    };

    expect(hasNegativeKeywords(article)).toBe(true);
  });

  it('should filter out proxies articles even with non-QA "test" mention', () => {
    const article: Article = {
      id: 'test-proxies-with-test',
      title: 'LG to Ban Residential Proxies: test results show effectiveness',
      summary: 'Testing effects of residential proxy bans on networks...',
      url: 'https://example.com/proxies-test',
      source: 'Tech News',
      category: 'article',
      publishedAt: new Date().toISOString(),
      tags: [],
    };

    // Should be filtered because 'test' appears but without QA keywords like 'qa engineering'
    expect(hasNegativeKeywords(article)).toBe(true);
  });

  it('should allow GPU testing articles with QA keywords', () => {
    const article: Article = {
      id: 'test-gpu-qa',
      title: 'Testing GPU Performance with Playwright Stress Tests',
      summary: 'How to test GPU hardware using automated testing frameworks and QA methodology...',
      url: 'https://example.com/gpu-test',
      source: 'Tech Blog',
      category: 'article',
      publishedAt: new Date().toISOString(),
      tags: [],
    };

    // Should NOT be filtered because it has QA keyword 'playwright'
    expect(hasNegativeKeywords(article)).toBe(false);
  });

  it('should allow QA best practices articles', () => {
    const article: Article = {
      id: 'test-qa',
      title: 'QA Best Practices for Test Automation',
      summary: 'Test automation strategies for quality assurance teams...',
      url: 'https://example.com/qa',
      source: 'QA Blog',
      category: 'article',
      publishedAt: new Date().toISOString(),
      tags: [],
    };

    expect(hasNegativeKeywords(article)).toBe(false);
  });

  it('should filter out pure GPU articles without QA context', () => {
    const article: Article = {
      id: 'test-gpu-pure',
      title: 'GPU Performance Analysis and Benchmarking',
      summary: 'Comparing GPU performance across different hardware...',
      url: 'https://example.com/gpu-perf',
      source: 'Hardware News',
      category: 'article',
      publishedAt: new Date().toISOString(),
      tags: [],
    };

    expect(hasNegativeKeywords(article)).toBe(true);
  });

  it('should allow articles with Cypress testing framework', () => {
    const article: Article = {
      id: 'test-cypress',
      title: 'Cypress E2E Testing Guide',
      summary: 'Complete guide to end-to-end testing with Cypress...',
      url: 'https://example.com/cypress',
      source: 'Tech Blog',
      category: 'article',
      publishedAt: new Date().toISOString(),
      tags: [],
    };

    expect(hasNegativeKeywords(article)).toBe(false);
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
      tags: [],
    },
    {
      id: 'test-2',
      title: 'Article B with typescript',
      summary: 'More content',
      url: 'https://example.com/b',
      source: 'Blog B',
      category: 'article',
      publishedAt: new Date().toISOString(),
      tags: [],
    },
    {
      id: 'test-3',
      title: 'Article C with no keywords',
      summary: 'Other content',
      url: 'https://example.com/c',
      source: 'Blog C',
      category: 'article',
      publishedAt: new Date().toISOString(),
      tags: [],
    },
  ];

  it('should score multiple articles', () => {
    const results = scoreArticles(mockArticles);

    expect(results.length).toBe(mockArticles.length);
    results.forEach((article) => {
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

  it('should filter out articles with negative keywords', () => {
    const articlesWithNegative: Article[] = [
      {
        id: 'test-valid',
        title: 'Playwright Testing Framework Update',
        summary: 'New features for automated testing',
        url: 'https://example.com/valid',
        source: 'Blog',
        category: 'article',
        publishedAt: new Date().toISOString(),
        tags: [],
      },
      {
        id: 'test-ecc',
        title: 'ECC and DDR5 Memory Performance',
        summary: 'Comparing ECC memory with DDR5 performance...',
        url: 'https://example.com/ecc',
        source: 'Tech News',
        category: 'article',
        publishedAt: new Date().toISOString(),
        tags: [],
      },
      {
        id: 'test-proxies',
        title: 'LG to Ban Residential Proxies',
        summary: 'Smart TV ban on residential proxies...',
        url: 'https://example.com/proxies',
        source: 'Tech News',
        category: 'article',
        publishedAt: new Date().toISOString(),
        tags: [],
      },
    ];

    const results = scoreArticles(articlesWithNegative);

    // Should only have 1 article (the valid one)
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('test-valid');
  });
});

describe('engineering / AI scoring intent', () => {
  const old = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString();
  const art = (title: string, summary = 'x', source = 'Some Blog'): Article => ({
    id: 'e',
    title,
    summary,
    url: 'https://example.com/e',
    source,
    category: 'article',
    publishedAt: old,
    tags: [],
  });

  it('a bare post scores the base', () => {
    expect(scoreArticle(art('A walk through our week')).score).toBe(DEFAULT_CONFIG.weights.base);
  });

  it.each([
    'Reliability lessons from a multi-region outage',
    'Making failure diagnosis reliable',
    'Software engineering after code becomes cheap',
    'Observability for event-driven systems',
    'Rethinking our architecture after 10 years',
    'What an incident review taught us',
    'Refactoring a legacy payment module',
    'Improving developer experience at scale',
    'Evals for LLM applications',
    'Code review at scale',
    'TDD in practice',
  ])('engineering/AI post outscores a bare post: %s', (title) => {
    expect(scoreArticle(art(title)).score).toBeGreaterThan(DEFAULT_CONFIG.weights.base);
  });

  it('keywords do not fire on unrelated words', () => {
    // "retrieval" must not match evals/eval; "outdated" must not match tdd
    const r = scoreArticle(art('Retrieval of outdated documents', 'plain text'));
    expect(r.score).toBe(DEFAULT_CONFIG.weights.base);
  });

  it('a security CVE post no longer outranks a strong QA post by default', () => {
    const cve = scoreArticle(art('Security advisory: critical CVE in a popular library'));
    const qa = scoreArticle(art('Test automation strategy with Playwright'));
    expect(qa.score).toBeGreaterThan(cve.score);
    // A lone 'security' hit (plus 'critical cve' style noise) must not beat a mid QA keyword stack
    const midQa = scoreArticle(art('Unit testing tips'));
    const secOnly = scoreArticle(art('Security update'));
    expect(DEFAULT_CONFIG.weights.keywords.security).toBe(30);
    expect(midQa.score).toBeGreaterThanOrEqual(secOnly.score);
  });

  it('strong engineering post beats a bare CVE-free post and a lone security keyword', () => {
    const eng = scoreArticle(
      art('Observability and reliability architecture for incident response'),
    );
    const sec = scoreArticle(art('Security notes'));
    expect(eng.score).toBeGreaterThan(sec.score);
  });
});

describe('hasNegativeKeywords - AI/infra posts survive', () => {
  const mk = (title: string, summary = ''): Article => ({
    id: 'n',
    title,
    summary,
    url: 'https://example.com/n',
    source: 'Blog',
    category: 'article',
    publishedAt: new Date().toISOString(),
    tags: [],
  });

  it.each([
    ['The components of agent memory', ''],
    ['Inference engineering for software engineers', 'GPU and memory budgets'],
    ['Your .NET parallel loop can become serial in a one-CPU container', ''],
    ['Scaling LLM training across a GPU cluster', ''],
  ])('keeps %s', (title, summary) => {
    expect(hasNegativeKeywords(mk(title, summary))).toBe(false);
  });

  it.each([
    ['Nvidia GPU prices fall again', 'Graphics cards are cheaper this quarter'],
    ['Intel unveils a faster CPU', 'New processor benchmarks'],
    ['Best memory kits for your gaming PC', 'Faster RAM'],
    ['ECC and DDR5 Memory Performance Comparison', ''],
  ])('still drops hardware headline %s', (title, summary) => {
    expect(hasNegativeKeywords(mk(title, summary))).toBe(true);
  });
});

describe('listicle penalty', () => {
  const mk = (title: string, summary = 'x'): Article => ({
    id: 'l',
    title,
    summary,
    url: 'https://example.com/l',
    source: 'Some Blog',
    category: 'article',
    publishedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    tags: [],
  });

  it.each([
    '12 BEST AI Test Automation Tools for 2026 The Third Wave',
    '10 Best Test Management Tools',
    'Top 15 Testing Frameworks in 2026',
    'Best API testing tools for startups',
    '7 top CI/CD platforms compared',
  ])('detects listicle title: %s', (title) => {
    expect(isListicleTitle(title)).toBe(true);
    const r = scoreArticle(mk(title));
    expect(r.reason).toContain('listicle');
  });

  it.each([
    '5 lessons from running a flaky test suite',
    'Top-down vs bottom-up testing',
    'Best practices for code review',
    'The best things in open source are built together',
    'Tests as data: ensuring generated code does what we want',
    'We timed 50 end-to-end tests on Playwright, Selenium, Cypress',
  ])('does not flag legitimate title: %s', (title) => {
    expect(isListicleTitle(title)).toBe(false);
    expect(scoreArticle(mk(title)).reason).not.toContain('listicle');
  });

  it('subtracts the penalty only for listicles, title only', () => {
    const plain = scoreArticle(mk('Tools for 2026', 'x'));
    const list = scoreArticle(mk('10 Best Tools for 2026', 'x'));
    expect(list.score).toBe(plain.score - LISTICLE_PENALTY);
    // summary text alone never triggers it
    expect(scoreArticle(mk('Weekly notes', '10 best tools for 2026')).reason).not.toContain(
      'listicle',
    );
  });

  it('a listicle no longer outranks a normal strong QA post', () => {
    const list = scoreArticle(mk('12 BEST AI Test Automation Tools for 2026'));
    const normal = scoreArticle(mk('Test automation strategy and flaky agents'));
    expect(normal.score).toBeGreaterThan(list.score);
  });
});

describe('engineering source priors', () => {
  const mk = (source: string): Article => ({
    id: 's',
    title: 'x',
    summary: 'y',
    url: 'https://example.com/s',
    source,
    category: 'article',
    publishedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    tags: [],
  });

  it.each(['Pragmatic Engineer', 'Netflix TechBlog', 'Kent Beck'])('%s gets a small prior', (s) => {
    const bonus = scoreArticle(mk(s)).score - DEFAULT_CONFIG.weights.base;
    expect(bonus).toBeGreaterThanOrEqual(5);
    expect(bonus).toBeLessThanOrEqual(10);
  });

  it('priors do not collide with other configured source names', () => {
    const keys = ['pragmatic engineer', 'netflix', 'kent beck'];
    const others = [
      'Ministry of Testing',
      'Google Testing Blog',
      'InfoQ',
      'Martin Fowler',
      'Cypress',
      'Playwright',
      'OpenAI',
      'Cloudflare',
      'Test Guild',
      'GitHub Blog',
      'MCP Blog',
      'Simon Willison',
      'Checkly',
      'DevelopSense',
    ];
    for (const o of others) {
      for (const k of keys) expect(o.toLowerCase().includes(k)).toBe(false);
    }
  });
});
