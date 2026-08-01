/**
 * SourceCircuitBreaker implements a circuit breaker pattern to prevent
 * cascading failures when fetching from problematic sources.
 *
 * State Machine:
 * - CLOSED: Normal operation (allows requests)
 * - OPEN: After 3+ failures within 1 hour (blocks requests)
 * - Recovery: After 1 hour timeout, next check allows requests to retry
 */
export class SourceCircuitBreaker {
  /**
   * Consecutive failure count per source
   */
  private failureCount: Map<string, number>;

  /**
   * Timestamp of last failure per source (milliseconds)
   */
  private lastFailureTime: Map<string, number>;

  /**
   * Circuit open timeout in milliseconds (1 hour)
   */
  private readonly CIRCUIT_TIMEOUT_MS = 3600_000; // 1 hour

  /**
   * Failure threshold for opening circuit
   */
  private readonly FAILURE_THRESHOLD = 3;

  constructor() {
    this.failureCount = new Map();
    this.lastFailureTime = new Map();
  }

  /**
   * Check if a source can be fetched (circuit not open).
   * Returns false if circuit is open (3+ failures within 1 hour).
   */
  canFetch(sourceId: string): boolean {
    const failures = this.failureCount.get(sourceId) ?? 0;
    const lastFailure = this.lastFailureTime.get(sourceId) ?? 0;
    const now = Date.now();

    // Check if circuit is open: 3+ failures AND within timeout window
    if (failures >= this.FAILURE_THRESHOLD && now - lastFailure < this.CIRCUIT_TIMEOUT_MS) {
      console.warn(`[${sourceId}] Circuit open (${failures} consecutive failures)`);
      return false;
    }

    return true;
  }

  /**
   * Record a successful fetch (reset failure counter).
   */
  recordSuccess(sourceId: string): void {
    this.failureCount.set(sourceId, 0);
  }

  /**
   * Record a failed fetch (increment failure counter).
   */
  recordFailure(sourceId: string): void {
    const currentCount = this.failureCount.get(sourceId) ?? 0;
    this.failureCount.set(sourceId, currentCount + 1);
    this.lastFailureTime.set(sourceId, Date.now());
  }

  /**
   * Get current failure count for a source (testing/debugging utility)
   */
  public getFailureCount(sourceId: string): number {
    return this.failureCount.get(sourceId) ?? 0;
  }

  /**
   * Reset circuit breaker state for a source (testing/debugging utility)
   */
  public reset(sourceId: string): void {
    this.failureCount.delete(sourceId);
    this.lastFailureTime.delete(sourceId);
  }

  /**
   * Reset all state (testing/debugging utility)
   */
  public resetAll(): void {
    this.failureCount.clear();
    this.lastFailureTime.clear();
  }
}
