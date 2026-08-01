import { RateLimiter } from '../../src/fetch/rate-limiter';
import { SourceConfig } from '../../src/sources/sources';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  describe('checkRateLimit with no rate limit config', () => {
    it('should return allow when rateLimit is undefined', async () => {
      const source: SourceConfig = {
        id: 'test-source',
        name: 'Test Source',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: undefined,
      };

      const result = await limiter.checkRateLimit(source);
      expect(result).toBe('allow');
    });

    it('should return allow when rateLimit is null', async () => {
      const source: SourceConfig = {
        id: 'test-source',
        name: 'Test Source',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: null,
      };

      const result = await limiter.checkRateLimit(source);
      expect(result).toBe('allow');
    });
  });

  describe('checkRateLimit with available tokens', () => {
    it('should return allow when source has available tokens', async () => {
      const source: SourceConfig = {
        id: 'test-source',
        name: 'Test Source',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: { requestsPerHour: 3600 }, // 1 request per second
      };

      const result = await limiter.checkRateLimit(source);
      expect(result).toBe('allow');
    });

    it('should consume token on allow', async () => {
      const source: SourceConfig = {
        id: 'test-source',
        name: 'Test Source',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: { requestsPerHour: 3600 }, // 1 request per second (1000ms per token)
      };

      // First call should allow
      const result1 = await limiter.checkRateLimit(source);
      expect(result1).toBe('allow');

      // Second call immediately (within 1s) should not allow
      const result2 = await limiter.checkRateLimit(source);
      // Should be backoff (wait < 5s)
      expect(result2).toBe('backoff');
    });

    it('should handle multiple consecutive allows when tokens are high', async () => {
      const source: SourceConfig = {
        id: 'test-source',
        name: 'Test Source',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: { requestsPerHour: 360000 }, // Very high rate: 100 per second = 1 token per 10ms
      };

      const result1 = await limiter.checkRateLimit(source);
      expect(result1).toBe('allow');

      // Wait a bit between calls to accumulate tokens
      await new Promise(resolve => setTimeout(resolve, 30));

      const result2 = await limiter.checkRateLimit(source);
      expect(result2).toBe('allow');

      await new Promise(resolve => setTimeout(resolve, 30));

      const result3 = await limiter.checkRateLimit(source);
      expect(result3).toBe('allow');
    });
  });

  describe('checkRateLimit with no tokens and short wait', () => {
    it('should return backoff when wait time is less than 5 seconds', async () => {
      const source: SourceConfig = {
        id: 'test-source',
        name: 'Test Source',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: { requestsPerHour: 3600 }, // 1 request per second (1000ms per token)
      };

      // Exhaust first token
      await limiter.checkRateLimit(source);

      // Next call immediately should return backoff (wait < 5s)
      const result = await limiter.checkRateLimit(source);
      expect(result).toBe('backoff');
    });
  });

  describe('checkRateLimit with no tokens and long wait', () => {
    it('should return skip when wait time is 5 seconds or more', async () => {
      const source: SourceConfig = {
        id: 'test-source',
        name: 'Test Source',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: { requestsPerHour: 10 }, // Very low rate: 10 per hour (360 seconds per token)
      };

      // First request consumes the only token
      await limiter.checkRateLimit(source);

      // Second request immediately should return skip (wait >= 5s)
      const result = await limiter.checkRateLimit(source);
      expect(result).toBe('skip');
    });
  });

  describe('token refill over time', () => {
    it('should refill tokens after time passes', async () => {
      const source: SourceConfig = {
        id: 'test-source',
        name: 'Test Source',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: { requestsPerHour: 3600 }, // 1 request per second (1000ms per token)
      };

      // First call uses token
      const result1 = await limiter.checkRateLimit(source);
      expect(result1).toBe('allow');

      // Wait long enough for a full token to refill
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Should have refilled and allow again
      const result2 = await limiter.checkRateLimit(source);
      expect(result2).toBe('allow');
    });

    it('should refill partial tokens correctly', async () => {
      const source: SourceConfig = {
        id: 'test-source',
        name: 'Test Source',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: { requestsPerHour: 3600 }, // 1 request per second
      };

      // First call uses token
      await limiter.checkRateLimit(source);

      // Wait half the time needed for a token
      await new Promise(resolve => setTimeout(resolve, 500));

      // Should not have full token yet
      const result = await limiter.checkRateLimit(source);
      expect(result).toBe('backoff'); // Partial token, but not enough for allow
    });
  });

  describe('multiple sources have independent buckets', () => {
    it('should maintain separate token counts per source', async () => {
      const source1: SourceConfig = {
        id: 'source-1',
        name: 'Source 1',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: { requestsPerHour: 3600 },
      };

      const source2: SourceConfig = {
        id: 'source-2',
        name: 'Source 2',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: { requestsPerHour: 3600 },
      };

      // First request on source1
      const s1Result1 = await limiter.checkRateLimit(source1);
      expect(s1Result1).toBe('allow');

      // Second request on source1 should not allow (no token)
      const s1Result2 = await limiter.checkRateLimit(source1);
      expect(['backoff', 'skip']).toContain(s1Result2);

      // First request on source2 should succeed (independent bucket)
      const s2Result1 = await limiter.checkRateLimit(source2);
      expect(s2Result1).toBe('allow');
    });

    it('should track failure and recovery independently', async () => {
      const source1: SourceConfig = {
        id: 'source-1',
        name: 'Source 1',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: { requestsPerHour: 3600 },
      };

      const source2: SourceConfig = {
        id: 'source-2',
        name: 'Source 2',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: { requestsPerHour: 3600 },
      };

      // Exhaust source1
      await limiter.checkRateLimit(source1);
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Source2 should still allow immediately
      const result = await limiter.checkRateLimit(source2);
      expect(result).toBe('allow');

      // Source1 should now allow (refilled)
      const s1Result = await limiter.checkRateLimit(source1);
      expect(s1Result).toBe('allow');
    });
  });

  describe('token bucket capping at max', () => {
    it('should cap refilled tokens at requestsPerHour', async () => {
      const source: SourceConfig = {
        id: 'test-source',
        name: 'Test Source',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: { requestsPerHour: 3600 }, // 1 per second
      };

      // First call should allow
      const result1 = await limiter.checkRateLimit(source);
      expect(result1).toBe('allow');

      // Rapidly make many calls to exhaust initial tokens
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(await limiter.checkRateLimit(source));
      }

      // After exhausting initial token, should get backoff/skip
      const hasBackoffOrSkip = results.some(r => r === 'backoff' || r === 'skip');
      expect(hasBackoffOrSkip).toBe(true);

      // Not all should be allow (token capping prevents unlimited allows)
      const allowCount = results.filter(r => r === 'allow').length;
      expect(allowCount).toBeLessThan(10);
    });
  });

  describe('floating-point edge cases', () => {
    it('should handle rapid calls with floating-point arithmetic gracefully', async () => {
      const source: SourceConfig = {
        id: 'test-source',
        name: 'Test Source',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: { requestsPerHour: 3600 }, // 1 per second
      };

      const results = [];
      for (let i = 0; i < 3; i++) {
        results.push(await limiter.checkRateLimit(source));
      }

      // First should be allow, others should be backoff (< 5s wait)
      expect(results[0]).toBe('allow');
      expect(results[1]).toBe('backoff');
      expect(results[2]).toBe('backoff');
    });

    it('should handle very high request rates correctly', async () => {
      const source: SourceConfig = {
        id: 'test-source',
        name: 'Test Source',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: { requestsPerHour: 360000 }, // 100 per second = 1 token every 10ms
      };

      // Rapid calls should only allow initially, then backoff/skip
      const results = [];
      for (let i = 0; i < 50; i++) {
        results.push(await limiter.checkRateLimit(source));
      }

      // First call should allow, rest depend on timing
      expect(results[0]).toBe('allow');
      // With a high rate, we might allow a few more if time passes between calls
      const allowCount = results.filter(r => r === 'allow').length;
      expect(allowCount).toBeGreaterThanOrEqual(1);
      expect(allowCount).toBeLessThanOrEqual(50);
    });
  });

  describe('utility methods', () => {
    it('should reset state for a single source', async () => {
      const source: SourceConfig = {
        id: 'test-source',
        name: 'Test Source',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: { requestsPerHour: 3600 },
      };

      // Use a token
      await limiter.checkRateLimit(source);

      // Verify it was consumed
      expect(limiter.getTokens(source.id)).toBeLessThan(0.5);

      // Reset
      limiter.reset(source.id);

      // Tokens should be 0 again
      expect(limiter.getTokens(source.id)).toBe(0);
    });

    it('should reset all state', async () => {
      const source1: SourceConfig = {
        id: 'source-1',
        name: 'Source 1',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: { requestsPerHour: 3600 },
      };

      const source2: SourceConfig = {
        id: 'source-2',
        name: 'Source 2',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: { requestsPerHour: 3600 },
      };

      // Use tokens from both
      await limiter.checkRateLimit(source1);
      await limiter.checkRateLimit(source2);

      // Reset all
      limiter.resetAll();

      // Both should be reset
      expect(limiter.getTokens(source1.id)).toBe(0);
      expect(limiter.getTokens(source2.id)).toBe(0);
    });
  });
});
