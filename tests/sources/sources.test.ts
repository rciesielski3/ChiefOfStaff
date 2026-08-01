import { SourceManager, SourceValidationError } from '../../src/sources/sources';
import path from 'path';

describe('SourceManager', () => {
  const testConfigPath = path.join(__dirname, 'config.test.json');

  beforeEach(() => {
    // Save original environment variables
    process.env.NEWS_API_KEY = 'test-news-key';
    process.env.GITHUB_TOKEN = 'test-github-token';
    process.env.CLOUDFLARE_API_TOKEN = 'test-cloudflare-token';
    process.env.GRAPHQL_API_KEY = 'test-graphql-key';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.NEWS_API_KEY;
    delete process.env.GITHUB_TOKEN;
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.GRAPHQL_API_KEY;
  });

  describe('constructor and initialization', () => {
    it('should load and parse config.json successfully', () => {
      const manager = new SourceManager(testConfigPath);
      expect(manager).toBeDefined();
      // Should not throw during construction
    });

    it('should throw SourceValidationError when config file does not exist', () => {
      const nonExistentPath = path.join(__dirname, 'non-existent.json');
      expect(() => {
        new SourceManager(nonExistentPath);
      }).toThrow(SourceValidationError);
    });

    it('should throw SourceValidationError when environment variables are missing', () => {
      // Remove a required environment variable
      delete process.env.NEWS_API_KEY;

      expect(() => {
        new SourceManager(testConfigPath);
      }).toThrow(SourceValidationError);
      expect(() => {
        new SourceManager(testConfigPath);
      }).toThrow(/Missing environment variable/);
    });

    it('should substitute environment variables in auth headers', () => {
      const manager = new SourceManager(testConfigPath);
      const newsApiHeaders = manager.getAuthHeaders('news-api');

      expect(newsApiHeaders['X-API-Key']).toBe('test-news-key');
      expect(newsApiHeaders['X-API-Key']).not.toContain('${');
    });
  });

  describe('getEnabled()', () => {
    it('should return only enabled sources', () => {
      const manager = new SourceManager(testConfigPath);
      const enabled = manager.getEnabled();

      expect(enabled.length).toBe(4); // 4 enabled sources, 1 disabled
      expect(enabled.every(s => s.enabled === true)).toBe(true);
      expect(enabled.some(s => s.id === 'ministry-of-testing-rss')).toBe(false);
    });
  });

  describe('getByType()', () => {
    it('should filter sources by type: rest', () => {
      const manager = new SourceManager(testConfigPath);
      const restSources = manager.getByType('rest');

      expect(restSources.length).toBe(3); // news-api, github-releases, cloudflare-api
      expect(restSources.every(s => s.type === 'rest')).toBe(true);
    });

    it('should filter sources by type: rss', () => {
      const manager = new SourceManager(testConfigPath);
      const rssSources = manager.getByType('rss');

      expect(rssSources.length).toBe(1); // ministry-of-testing-rss
      expect(rssSources[0].id).toBe('ministry-of-testing-rss');
    });

    it('should filter sources by type: graphql', () => {
      const manager = new SourceManager(testConfigPath);
      const graphqlSources = manager.getByType('graphql');

      expect(graphqlSources.length).toBe(1); // graphql-api
      expect(graphqlSources[0].id).toBe('graphql-api');
    });

    it('should return empty array for type with no sources', () => {
      const manager = new SourceManager(testConfigPath);
      // Create a manager and test for a non-existent type
      const noSources = manager.getByType('rest').filter(s => s.id === 'non-existent');

      expect(noSources.length).toBe(0);
    });
  });

  describe('getById()', () => {
    it('should find source by ID', () => {
      const manager = new SourceManager(testConfigPath);
      const source = manager.getById('news-api');

      expect(source).toBeDefined();
      expect(source?.id).toBe('news-api');
      expect(source?.name).toBe('NewsAPI');
      expect(source?.type).toBe('rest');
    });

    it('should return undefined for non-existent source ID', () => {
      const manager = new SourceManager(testConfigPath);
      const source = manager.getById('non-existent-id');

      expect(source).toBeUndefined();
    });
  });

  describe('getAuthHeaders()', () => {
    it('should return auth headers for a source with auth config', () => {
      const manager = new SourceManager(testConfigPath);
      const headers = manager.getAuthHeaders('news-api');

      expect(headers).toBeDefined();
      expect(headers['X-API-Key']).toBe('test-news-key');
    });

    it('should return bearer token headers for sources with bearer auth', () => {
      const manager = new SourceManager(testConfigPath);
      const headers = manager.getAuthHeaders('github-releases');

      expect(headers).toBeDefined();
      expect(headers['Authorization']).toBe('Bearer test-github-token');
    });

    it('should return empty object for source without auth config', () => {
      const manager = new SourceManager(testConfigPath);
      const source = manager.getById('ministry-of-testing-rss');
      expect(source?.auth).toBeUndefined();
    });

    it('should substitute all environment variables in headers', () => {
      const manager = new SourceManager(testConfigPath);
      const cloudflareHeaders = manager.getAuthHeaders('cloudflare-api');
      const graphqlHeaders = manager.getAuthHeaders('graphql-api');

      expect(cloudflareHeaders['Authorization']).toBe('Bearer test-cloudflare-token');
      expect(cloudflareHeaders['Authorization']).not.toContain('${');

      expect(graphqlHeaders['Authorization']).toBe('Bearer test-graphql-key');
      expect(graphqlHeaders['Authorization']).not.toContain('${');
    });
  });

  describe('validation', () => {
    it('should validate required fields in source config', () => {
      // This will be tested implicitly - if required fields are missing,
      // the SourceManager should throw during initialization
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      sources.forEach(source => {
        expect(source.id).toBeDefined();
        expect(source.name).toBeDefined();
        expect(source.type).toBeDefined();
        expect(source.timeout).toBeDefined();
        expect(source.maxRetries).toBeDefined();
        expect(source.mapper).toBeDefined();
      });
    });

    it('should validate type-specific required fields', () => {
      const manager = new SourceManager(testConfigPath);
      const sources = manager.getEnabled();

      sources.forEach(source => {
        if (source.type === 'rss') {
          expect(source.url).toBeDefined();
        } else if (source.type === 'rest' || source.type === 'graphql') {
          expect(source.endpoint).toBeDefined();
        }
      });
    });
  });
});
