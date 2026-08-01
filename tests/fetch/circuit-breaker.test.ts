import { SourceCircuitBreaker } from '../../src/fetch/circuit-breaker';

describe('SourceCircuitBreaker', () => {
  let breaker: SourceCircuitBreaker;

  beforeEach(() => {
    breaker = new SourceCircuitBreaker();
    // Mock console.warn to verify logging
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('canFetch returns true initially', () => {
    it('should allow fetch when no prior failures exist', () => {
      const result = breaker.canFetch('test-source');
      expect(result).toBe(true);
    });

    it('should allow fetch for multiple sources initially', () => {
      expect(breaker.canFetch('source-1')).toBe(true);
      expect(breaker.canFetch('source-2')).toBe(true);
      expect(breaker.canFetch('source-3')).toBe(true);
    });
  });

  describe('recordFailure increments counter', () => {
    it('should increment failure count', () => {
      const sourceId = 'test-source';

      expect(breaker.getFailureCount(sourceId)).toBe(0);

      breaker.recordFailure(sourceId);
      expect(breaker.getFailureCount(sourceId)).toBe(1);

      breaker.recordFailure(sourceId);
      expect(breaker.getFailureCount(sourceId)).toBe(2);

      breaker.recordFailure(sourceId);
      expect(breaker.getFailureCount(sourceId)).toBe(3);
    });

    it('should increment independently per source', () => {
      breaker.recordFailure('source-1');
      breaker.recordFailure('source-1');

      breaker.recordFailure('source-2');

      expect(breaker.getFailureCount('source-1')).toBe(2);
      expect(breaker.getFailureCount('source-2')).toBe(1);
    });
  });

  describe('recordSuccess resets counter', () => {
    it('should reset failure count to 0', () => {
      const sourceId = 'test-source';

      breaker.recordFailure(sourceId);
      breaker.recordFailure(sourceId);
      expect(breaker.getFailureCount(sourceId)).toBe(2);

      breaker.recordSuccess(sourceId);
      expect(breaker.getFailureCount(sourceId)).toBe(0);
    });

    it('should reset only the specified source', () => {
      breaker.recordFailure('source-1');
      breaker.recordFailure('source-1');
      breaker.recordFailure('source-2');
      breaker.recordFailure('source-2');

      breaker.recordSuccess('source-1');

      expect(breaker.getFailureCount('source-1')).toBe(0);
      expect(breaker.getFailureCount('source-2')).toBe(2);
    });

    it('should allow successful calls even without prior failures', () => {
      const sourceId = 'test-source';
      breaker.recordSuccess(sourceId);
      expect(breaker.getFailureCount(sourceId)).toBe(0);
      expect(breaker.canFetch(sourceId)).toBe(true);
    });
  });

  describe('canFetch returns false after 3 failures (within 1 hour)', () => {
    it('should return false when circuit opens after 3 failures', () => {
      const sourceId = 'test-source';

      // Record 3 failures
      breaker.recordFailure(sourceId);
      breaker.recordFailure(sourceId);
      breaker.recordFailure(sourceId);

      // Circuit should now be open
      const result = breaker.canFetch(sourceId);
      expect(result).toBe(false);
    });

    it('should return true before reaching failure threshold', () => {
      const sourceId = 'test-source';

      breaker.recordFailure(sourceId);
      expect(breaker.canFetch(sourceId)).toBe(true);

      breaker.recordFailure(sourceId);
      expect(breaker.canFetch(sourceId)).toBe(true);

      // Third failure should open circuit
      breaker.recordFailure(sourceId);
      expect(breaker.canFetch(sourceId)).toBe(false);
    });

    it('should log warning when circuit opens', () => {
      const sourceId = 'test-source';

      breaker.recordFailure(sourceId);
      breaker.recordFailure(sourceId);
      breaker.recordFailure(sourceId);

      breaker.canFetch(sourceId);

      expect(console.warn).toHaveBeenCalledWith(
        `[${sourceId}] Circuit open (3 consecutive failures)`
      );
    });

    it('should maintain independent circuit state per source', () => {
      const source1 = 'source-1';
      const source2 = 'source-2';

      // Open circuit for source-1
      breaker.recordFailure(source1);
      breaker.recordFailure(source1);
      breaker.recordFailure(source1);

      // source-2 should still allow
      expect(breaker.canFetch(source1)).toBe(false);
      expect(breaker.canFetch(source2)).toBe(true);
    });
  });

  describe('canFetch returns true after circuit timeout (1 hour)', () => {
    it('should allow fetch after 1 hour timeout', async () => {
      const sourceId = 'test-source';

      // Open circuit
      breaker.recordFailure(sourceId);
      breaker.recordFailure(sourceId);
      breaker.recordFailure(sourceId);
      expect(breaker.canFetch(sourceId)).toBe(false);

      // Mock Date.now() to simulate 1 hour passing
      const originalNow = Date.now;
      const baseTime = Date.now();
      Date.now = jest.fn(() => baseTime + 3600_001); // 1 hour + 1ms

      try {
        const result = breaker.canFetch(sourceId);
        expect(result).toBe(true);
      } finally {
        Date.now = originalNow;
      }
    });

    it('should still block if called before timeout expires', async () => {
      const sourceId = 'test-source';

      // Open circuit
      breaker.recordFailure(sourceId);
      breaker.recordFailure(sourceId);
      breaker.recordFailure(sourceId);

      // Mock Date.now() to simulate 30 minutes passing (less than 1 hour)
      const originalNow = Date.now;
      const baseTime = Date.now();
      Date.now = jest.fn(() => baseTime + 1800_000); // 30 minutes

      try {
        const result = breaker.canFetch(sourceId);
        expect(result).toBe(false);
      } finally {
        Date.now = originalNow;
      }
    });

    it('should allow recovery after timeout without explicit reset', async () => {
      const sourceId = 'test-source';

      // Open circuit
      breaker.recordFailure(sourceId);
      breaker.recordFailure(sourceId);
      breaker.recordFailure(sourceId);
      expect(breaker.canFetch(sourceId)).toBe(false);

      // Simulate time passing
      const originalNow = Date.now;
      const baseTime = Date.now();
      Date.now = jest.fn(() => baseTime + 3600_001);

      try {
        // Should be allowed even with 3 failures still in counter
        expect(breaker.canFetch(sourceId)).toBe(true);

        // After recovery, success resets the counter
        breaker.recordSuccess(sourceId);
        expect(breaker.getFailureCount(sourceId)).toBe(0);
      } finally {
        Date.now = originalNow;
      }
    });
  });

  describe('multiple sources have independent state', () => {
    it('should maintain separate failure counts', () => {
      const source1 = 'source-1';
      const source2 = 'source-2';

      breaker.recordFailure(source1);
      breaker.recordFailure(source1);

      breaker.recordFailure(source2);
      breaker.recordFailure(source2);
      breaker.recordFailure(source2);
      breaker.recordFailure(source2); // Extra failure

      expect(breaker.getFailureCount(source1)).toBe(2);
      expect(breaker.getFailureCount(source2)).toBe(4);
    });

    it('should maintain separate circuit states', () => {
      const source1 = 'source-1';
      const source2 = 'source-2';

      // Open circuit for source-1 only
      breaker.recordFailure(source1);
      breaker.recordFailure(source1);
      breaker.recordFailure(source1);

      expect(breaker.canFetch(source1)).toBe(false);
      expect(breaker.canFetch(source2)).toBe(true);
    });

    it('should recover sources independently', () => {
      const source1 = 'source-1';
      const source2 = 'source-2';

      // Open both circuits
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure(source1);
        breaker.recordFailure(source2);
      }

      expect(breaker.canFetch(source1)).toBe(false);
      expect(breaker.canFetch(source2)).toBe(false);

      // Recover only source1
      breaker.recordSuccess(source1);

      expect(breaker.canFetch(source1)).toBe(true);
      expect(breaker.canFetch(source2)).toBe(false);
    });
  });

  describe('circuit state persists across calls', () => {
    it('should maintain state through multiple canFetch calls', () => {
      const sourceId = 'test-source';

      breaker.recordFailure(sourceId);
      breaker.recordFailure(sourceId);
      breaker.recordFailure(sourceId);

      // Multiple checks should return same result
      expect(breaker.canFetch(sourceId)).toBe(false);
      expect(breaker.canFetch(sourceId)).toBe(false);
      expect(breaker.canFetch(sourceId)).toBe(false);
    });

    it('should persist across intermixed source operations', () => {
      const source1 = 'source-1';
      const source2 = 'source-2';

      breaker.recordFailure(source1);
      expect(breaker.canFetch(source2)).toBe(true);

      breaker.recordFailure(source1);
      expect(breaker.canFetch(source1)).toBe(true);

      breaker.recordFailure(source1);
      expect(breaker.canFetch(source2)).toBe(true);

      // Now source1 should be open
      expect(breaker.canFetch(source1)).toBe(false);
    });
  });

  describe('logging on circuit open', () => {
    it('should log warning when circuit opens', () => {
      const sourceId = 'test-source';

      breaker.recordFailure(sourceId);
      breaker.recordFailure(sourceId);
      breaker.recordFailure(sourceId);

      expect(console.warn).not.toHaveBeenCalled();

      breaker.canFetch(sourceId);

      expect(console.warn).toHaveBeenCalledWith(
        '[test-source] Circuit open (3 consecutive failures)'
      );
    });

    it('should log on every canFetch call while circuit is open', () => {
      const sourceId = 'test-source';

      // Open circuit
      breaker.recordFailure(sourceId);
      breaker.recordFailure(sourceId);
      breaker.recordFailure(sourceId);

      // Multiple checks should all log
      breaker.canFetch(sourceId);
      breaker.canFetch(sourceId);

      expect(console.warn).toHaveBeenCalledTimes(2);
      expect(console.warn).toHaveBeenCalledWith(
        '[test-source] Circuit open (3 consecutive failures)'
      );
    });

    it('should not log when circuit is closed', () => {
      const sourceId = 'test-source';

      breaker.recordFailure(sourceId);
      breaker.canFetch(sourceId);
      breaker.canFetch(sourceId);

      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should show correct failure count in log message', () => {
      const sourceId = 'test-source';

      // Add extra failures
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure(sourceId);
      }

      breaker.canFetch(sourceId);

      expect(console.warn).toHaveBeenCalledWith(
        '[test-source] Circuit open (5 consecutive failures)'
      );
    });
  });

  describe('utility methods', () => {
    it('should reset state for a single source', () => {
      const sourceId = 'test-source';

      // Set up failures
      breaker.recordFailure(sourceId);
      breaker.recordFailure(sourceId);
      breaker.recordFailure(sourceId);

      expect(breaker.getFailureCount(sourceId)).toBe(3);
      expect(breaker.canFetch(sourceId)).toBe(false);

      // Reset
      breaker.reset(sourceId);

      // Should be reset
      expect(breaker.getFailureCount(sourceId)).toBe(0);
      expect(breaker.canFetch(sourceId)).toBe(true);
    });

    it('should reset only specified source', () => {
      const source1 = 'source-1';
      const source2 = 'source-2';

      breaker.recordFailure(source1);
      breaker.recordFailure(source1);
      breaker.recordFailure(source1);

      breaker.recordFailure(source2);
      breaker.recordFailure(source2);

      breaker.reset(source1);

      expect(breaker.getFailureCount(source1)).toBe(0);
      expect(breaker.getFailureCount(source2)).toBe(2);
    });

    it('should reset all state', () => {
      const source1 = 'source-1';
      const source2 = 'source-2';

      breaker.recordFailure(source1);
      breaker.recordFailure(source1);
      breaker.recordFailure(source1);

      breaker.recordFailure(source2);
      breaker.recordFailure(source2);

      breaker.resetAll();

      expect(breaker.getFailureCount(source1)).toBe(0);
      expect(breaker.getFailureCount(source2)).toBe(0);
      expect(breaker.canFetch(source1)).toBe(true);
      expect(breaker.canFetch(source2)).toBe(true);
    });
  });
});
