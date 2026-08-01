import { SourceConfig } from '../sources/sources';

/**
 * RateLimiter implements a token bucket algorithm to control request rates per source.
 * Each source has its own token bucket that refills at the configured rate.
 */
export class RateLimiter {
  /**
   * Tokens per source (token count)
   */
  private tokens: Map<string, number>;

  /**
   * Last refill timestamp per source (milliseconds)
   */
  private lastRefillTime: Map<string, number>;

  constructor() {
    this.tokens = new Map();
    this.lastRefillTime = new Map();
  }

  /**
   * Check if a source can make a request.
   * Returns:
   * - 'allow': Has token available, can fetch immediately
   * - 'backoff': No tokens but will have some soon (< 5s wait), decide to retry later
   * - 'skip': Out of tokens for significant time (≥ 5s wait), skip this run
   */
  async checkRateLimit(source: SourceConfig): Promise<'allow' | 'backoff' | 'skip'> {
    // If no rate limit config, allow immediately
    if (!source.rateLimit) {
      return 'allow';
    }

    const sourceId = source.id;
    const now = Date.now();
    const requestsPerHour = source.rateLimit.requestsPerHour;
    const maxTokens = requestsPerHour;

    // Calculate token refill rate
    const tokensPerSecond = requestsPerHour / 3600;
    const msPerToken = 1000 / tokensPerSecond;

    // Initialize or refill tokens
    let currentTokens = this.tokens.get(sourceId) ?? 0;
    // On first call, initialize lastRefill to past so we get initial tokens
    const lastRefill = this.lastRefillTime.get(sourceId) ?? (now - msPerToken);

    // Refill tokens based on time elapsed
    const timeSinceRefill = now - lastRefill;
    const tokensToAdd = timeSinceRefill / msPerToken;
    currentTokens = Math.min(maxTokens, currentTokens + tokensToAdd);

    // Update last refill time
    this.lastRefillTime.set(sourceId, now);

    // Check if we have tokens available
    if (currentTokens >= 1) {
      // Consume one token
      this.tokens.set(sourceId, currentTokens - 1);
      return 'allow';
    }

    // Calculate wait time until next token is available
    const waitMs = Math.ceil(msPerToken - currentTokens * msPerToken);

    // Store updated token count (without consuming)
    this.tokens.set(sourceId, currentTokens);

    // Return decision based on wait time
    return waitMs < 5000 ? 'backoff' : 'skip';
  }

  /**
   * Reset rate limiter state for a source (testing/debugging utility)
   */
  public reset(sourceId: string): void {
    this.tokens.delete(sourceId);
    this.lastRefillTime.delete(sourceId);
  }

  /**
   * Reset all state (testing/debugging utility)
   */
  public resetAll(): void {
    this.tokens.clear();
    this.lastRefillTime.clear();
  }

  /**
   * Get current token count for a source (testing/debugging utility)
   */
  public getTokens(sourceId: string): number {
    return this.tokens.get(sourceId) ?? 0;
  }
}
