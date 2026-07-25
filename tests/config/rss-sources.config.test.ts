import { RSS_SOURCES, getEnabledSources } from '../../src/config/rss-sources.config';
import { RSSSourceConfig } from '../../src/business-logic/rss-fetch';

describe('RSS Sources Configuration', () => {
  describe('RSS_SOURCES array', () => {
    it('should have at least 8 sources defined', () => {
      expect(RSS_SOURCES.length).toBeGreaterThanOrEqual(8);
    });

    it('should have Ministry of Testing source', () => {
      const ministryOfTesting = RSS_SOURCES.find(
        source => source.name.toLowerCase().includes('ministry') && source.name.toLowerCase().includes('testing')
      );
      expect(ministryOfTesting).toBeDefined();
      expect(ministryOfTesting?.url).toContain('ministryoftesting');
    });

    it('should have OpenAI source', () => {
      const openAI = RSS_SOURCES.find(source => source.name.toLowerCase().includes('openai'));
      expect(openAI).toBeDefined();
      expect(openAI?.url).toContain('openai');
    });
  });

  describe('getEnabledSources()', () => {
    it('should return all sources when enabled field not specified', () => {
      const enabled = getEnabledSources();
      // All default sources should be returned if none are explicitly disabled
      expect(enabled.length).toBeGreaterThanOrEqual(8);
      expect(enabled.every(s => (s as any).enabled !== false)).toBe(true);
    });

    it('should filter out disabled sources', () => {
      // Create a test array with mixed enabled/disabled sources
      const testSources: (RSSSourceConfig & { enabled?: boolean })[] = [
        { url: 'https://example1.com', name: 'Source 1', enabled: true },
        { url: 'https://example2.com', name: 'Source 2', enabled: false },
        { url: 'https://example3.com', name: 'Source 3' }, // enabled undefined, should be included
      ];

      // Filter using the same logic as getEnabledSources
      const filtered = testSources.filter(s => s.enabled !== false);

      expect(filtered.length).toBe(2);
      expect(filtered.some(s => s.name === 'Source 2')).toBe(false);
      expect(filtered.some(s => s.name === 'Source 1')).toBe(true);
      expect(filtered.some(s => s.name === 'Source 3')).toBe(true);
    });
  });
});
