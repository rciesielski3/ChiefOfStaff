import { SourceManager } from '../../src/sources/sources';
import path from 'path';

describe('SourceManager - Initial Config (15 RSS Sources)', () => {
  const testConfigPath = path.join(__dirname, 'config.initial.test.json');

  describe('Loading and initialization', () => {
    it('should load the initial config with 15 sources', () => {
      const manager = new SourceManager(testConfigPath);
      expect(manager).toBeDefined();
    });

    it('should load all 15 sources without errors', () => {
      // Should not throw during construction
      expect(() => {
        new SourceManager(testConfigPath);
      }).not.toThrow();
    });
  });

  describe('Source count and structure', () => {
    it('should return 15 enabled sources', () => {
      const manager = new SourceManager(testConfigPath);
      const enabled = manager.getEnabled();

      expect(enabled.length).toBe(15);
      expect(enabled.every(s => s.enabled === true)).toBe(true);
    });

    it('should return all 15 sources via getByType(rss)', () => {
      const manager = new SourceManager(testConfigPath);
      const rssSources = manager.getByType('rss');

      expect(rssSources.length).toBe(15);
      expect(rssSources.every(s => s.type === 'rss')).toBe(true);
    });

    it('should have no non-RSS sources in the initial config', () => {
      const manager = new SourceManager(testConfigPath);
      const restSources = manager.getByType('rest');
      const graphqlSources = manager.getByType('graphql');

      expect(restSources.length).toBe(0);
      expect(graphqlSources.length).toBe(0);
    });
  });

  describe('Existing 8 sources', () => {
    const existingSourceIds = [
      'ministry-of-testing',
      'google-testing-blog',
      'infoq',
      'martin-fowler',
      'cypress',
      'playwright',
      'openai',
      'cloudflare',
    ];

    it('should contain all 8 existing sources', () => {
      const manager = new SourceManager(testConfigPath);

      existingSourceIds.forEach(id => {
        const source = manager.getById(id);
        expect(source).toBeDefined();
        expect(source?.id).toBe(id);
      });
    });

    it('should have ministry-of-testing source with correct properties', () => {
      const manager = new SourceManager(testConfigPath);
      const source = manager.getById('ministry-of-testing');

      expect(source?.name).toBe('Ministry of Testing');
      expect(source?.type).toBe('rss');
      expect(source?.category).toBe('testing');
      expect(source?.url).toBe('https://www.ministryoftesting.com/contents/rss');
      expect(source?.mapper).toBe('rss');
      expect(source?.auth).toBeNull();
      expect(source?.timeout).toBe(30000);
      expect(source?.maxRetries).toBe(3);
    });

    it('should have google-testing-blog source with correct properties', () => {
      const manager = new SourceManager(testConfigPath);
      const source = manager.getById('google-testing-blog');

      expect(source?.name).toBe('Google Testing Blog');
      expect(source?.type).toBe('rss');
      expect(source?.category).toBe('testing');
      expect(source?.url).toBe('https://testing.googleblog.com/feeds/posts/default');
    });

    it('should have playwright source with GitHub releases URL', () => {
      const manager = new SourceManager(testConfigPath);
      const source = manager.getById('playwright');

      expect(source?.url).toBe('https://github.com/microsoft/playwright/releases.atom');
    });
  });

  describe('New 7 sources', () => {
    const newSourceIds = [
      'browserstack',
      'selenium-releases',
      'testproject',
      'smartbear',
      'postman',
      'hacker-news-security',
      'cncf-blog',
    ];

    it('should contain all 7 new sources', () => {
      const manager = new SourceManager(testConfigPath);

      newSourceIds.forEach(id => {
        const source = manager.getById(id);
        expect(source).toBeDefined();
        expect(source?.id).toBe(id);
      });
    });

    it('should have browserstack source with correct properties', () => {
      const manager = new SourceManager(testConfigPath);
      const source = manager.getById('browserstack');

      expect(source?.name).toBe('BrowserStack');
      expect(source?.type).toBe('rss');
      expect(source?.category).toBe('testing');
      expect(source?.url).toBe('https://www.browserstack.com/blog/feed');
      expect(source?.mapper).toBe('rss');
    });

    it('should have selenium-releases source with correct properties', () => {
      const manager = new SourceManager(testConfigPath);
      const source = manager.getById('selenium-releases');

      expect(source?.name).toBe('Selenium Releases');
      expect(source?.category).toBe('tools');
      expect(source?.url).toBe('https://github.com/SeleniumHQ/selenium/releases.atom');
    });

    it('should have postman source for API testing', () => {
      const manager = new SourceManager(testConfigPath);
      const source = manager.getById('postman');

      expect(source?.name).toBe('Postman');
      expect(source?.category).toBe('tools');
      expect(source?.url).toBe('https://www.getpostman.com/feed.xml');
    });

    it('should have cncf-blog source for DevOps/Cloud', () => {
      const manager = new SourceManager(testConfigPath);
      const source = manager.getById('cncf-blog');

      expect(source?.name).toBe('Cloud Native Computing Foundation');
      expect(source?.category).toBe('devops');
      expect(source?.url).toBe('https://www.cncf.io/feed/blog/');
    });
  });

  describe('Filters and metadata', () => {
    it('should have filters on all sources', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      sources.forEach(source => {
        expect(source.filters).toBeDefined();
        expect(source.filters?.includeKeywords).toBeDefined();
        expect(Array.isArray(source.filters?.includeKeywords)).toBe(true);
        expect(source.filters?.excludeKeywords).toBeDefined();
        expect(Array.isArray(source.filters?.excludeKeywords)).toBe(true);
        expect(source.filters?.daysBack).toBe(30);
      });
    });

    it('should have metadata on all sources', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      sources.forEach(source => {
        expect(source.metadata).toBeDefined();
        expect(source.metadata?.frequency).toBeDefined();
        expect(['daily', 'weekly', '2-3x/week']).toContain(source.metadata?.frequency);
        expect(source.metadata?.quality_rating).toBeDefined();
        expect([4, 5]).toContain(source.metadata?.quality_rating);
        expect(source.metadata?.priority).toBeDefined();
        expect(['HIGH', 'MEDIUM', 'LOW']).toContain(source.metadata?.priority);
      });
    });

    it('should have quality rating of 5 for high-priority core testing sources', () => {
      const manager = new SourceManager(testConfigPath);
      const highQualityIds = [
        'ministry-of-testing',
        'google-testing-blog',
        'infoq',
        'martin-fowler',
        'cypress',
        'playwright',
        'selenium-releases',
      ];

      highQualityIds.forEach(id => {
        const source = manager.getById(id);
        expect(source?.metadata?.quality_rating).toBe(5);
      });
    });

    it('should include relevant keywords for testing sources', () => {
      const manager = new SourceManager(testConfigPath);
      const source = manager.getById('browserstack');

      const keywords = (source?.filters?.includeKeywords as string[]) || [];
      expect(keywords.length).toBeGreaterThan(0);
      expect(keywords.some((k: string) => k.toLowerCase().includes('test'))).toBe(true);
      expect(keywords.some((k: string) => k.toLowerCase().includes('automation'))).toBe(true);
    });
  });

  describe('Category distribution', () => {
    it('should have sources in multiple categories', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      const categories = new Set(sources.map(s => s.category));
      expect(categories.size).toBeGreaterThan(3);
    });

    it('should have testing category sources', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      const testingCategorySources = sources.filter(s => s.category === 'testing');
      expect(testingCategorySources.length).toBeGreaterThan(0);
      expect(testingCategorySources.some(s => s.id === 'ministry-of-testing')).toBe(true);
      expect(testingCategorySources.some(s => s.id === 'browserstack')).toBe(true);
    });

    it('should have tools category sources', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      const toolsCategorySources = sources.filter(s => s.category === 'tools');
      expect(toolsCategorySources.length).toBeGreaterThan(0);
      expect(toolsCategorySources.some(s => s.id === 'cypress')).toBe(true);
      expect(toolsCategorySources.some(s => s.id === 'postman')).toBe(true);
    });

    it('should have qa category sources', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      const qaCategorySources = sources.filter(s => s.category === 'qa');
      expect(qaCategorySources.length).toBeGreaterThan(0);
    });

    it('should have ai category sources', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      const aiCategorySources = sources.filter(s => s.category === 'ai');
      expect(aiCategorySources.length).toBeGreaterThan(0);
      expect(aiCategorySources.some(s => s.id === 'openai')).toBe(true);
    });

    it('should have devops category sources', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      const devopsCategorySources = sources.filter(s => s.category === 'devops');
      expect(devopsCategorySources.length).toBeGreaterThan(0);
      expect(devopsCategorySources.some(s => s.id === 'cloudflare')).toBe(true);
    });
  });

  describe('Required field validation', () => {
    it('should have all required fields on every source', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      sources.forEach(source => {
        expect(source.id).toBeDefined();
        expect(source.name).toBeDefined();
        expect(source.type).toBeDefined();
        expect(source.enabled).toBeDefined();
        expect(source.url).toBeDefined();
        expect(source.timeout).toBeDefined();
        expect(source.maxRetries).toBeDefined();
        expect(source.mapper).toBeDefined();
      });
    });

    it('should have auth set to null on all RSS sources', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      sources.forEach(source => {
        expect(source.auth).toBeNull();
      });
    });

    it('should have valid timeout values', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      sources.forEach(source => {
        expect(source.timeout).toBe(30000);
        expect(typeof source.timeout).toBe('number');
      });
    });

    it('should have maxRetries set to 3', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      sources.forEach(source => {
        expect(source.maxRetries).toBe(3);
      });
    });

    it('should have mapper set to "rss" on all sources', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      sources.forEach(source => {
        expect(source.mapper).toBe('rss');
      });
    });
  });

  describe('URL format validation', () => {
    it('should have valid HTTP/HTTPS URLs for all sources', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      sources.forEach(source => {
        expect(source.url).toBeDefined();
        expect(source.url).toMatch(/^https?:\/\//);
      });
    });

    it('should have unique URLs for all sources', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      const urls = sources.map(s => s.url);
      const uniqueUrls = new Set(urls);

      expect(uniqueUrls.size).toBe(urls.length);
    });
  });

  describe('Priority distribution', () => {
    it('should have HIGH priority sources', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      const highPriority = sources.filter(s => s.metadata?.priority === 'HIGH');
      expect(highPriority.length).toBeGreaterThan(0);
    });

    it('should have MEDIUM priority sources', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      const mediumPriority = sources.filter(s => s.metadata?.priority === 'MEDIUM');
      expect(mediumPriority.length).toBeGreaterThan(0);
    });

    it('should have LOW priority sources', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      const lowPriority = sources.filter(s => s.metadata?.priority === 'LOW');
      expect(lowPriority.length).toBeGreaterThan(0);
    });
  });

  describe('Source IDs format', () => {
    it('should have kebab-case IDs for all sources', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      const kebabCaseRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;

      sources.forEach(source => {
        expect(source.id).toMatch(kebabCaseRegex);
      });
    });

    it('should have unique IDs for all sources', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      const ids = sources.map(s => s.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
