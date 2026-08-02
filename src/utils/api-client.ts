/**
 * Generic HTTP client for API requests with retry logic and timeout handling
 */

interface RetryOptions {
  /** Maximum number of attempts (including the first try). Default: 3 */
  maxAttempts?: number;
  /** Base delay in ms before the first retry. Doubles on each subsequent retry. Default: 100 */
  baseDelayMs?: number;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wrap a promise with a timeout. If the promise doesn't resolve/reject within
 * the specified time, reject with a timeout error.
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string = `Operation timed out after ${timeoutMs}ms`
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ]);
}

/**
 * Run an async operation with retry + exponential backoff.
 *
 * Algorithm:
 * 1. Attempt the operation.
 * 2. On success, return the result immediately.
 * 3. On failure, if attempts remain, wait `baseDelayMs * 2^(attempt-1)` ms
 *    then retry.
 * 4. If all attempts are exhausted, throw the last error encountered.
 */
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxAttempts) {
        const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
        console.warn(
          `Attempt ${attempt}/${maxAttempts} failed, retrying in ${delayMs}ms...`,
          error
        );
        await sleep(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Generic HTTP client for making API requests
 */
export class APIClient {
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(timeoutMs: number = 30000, maxRetries: number = 3) {
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
  }

  /**
   * Make a GET request with retry and timeout handling
   */
  async get<T>(url: string, headers?: Record<string, string>): Promise<T> {
    return fetchWithRetry(
      () =>
        withTimeout(
          fetch(url, { headers }),
          this.timeoutMs,
          `GET request timed out after ${this.timeoutMs}ms: ${url}`
        ).then(async res => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText} for ${url}`);
          }
          return res.json() as Promise<T>;
        }),
      { maxAttempts: this.maxRetries, baseDelayMs: 100 }
    );
  }

  /**
   * Make a POST request with retry and timeout handling
   */
  async post<T>(
    url: string,
    body: Record<string, unknown>,
    headers?: Record<string, string>
  ): Promise<T> {
    return fetchWithRetry(
      () =>
        withTimeout(
          fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...headers
            },
            body: JSON.stringify(body)
          }),
          this.timeoutMs,
          `POST request timed out after ${this.timeoutMs}ms: ${url}`
        ).then(async res => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText} for ${url}`);
          }
          return res.json() as Promise<T>;
        }),
      { maxAttempts: this.maxRetries, baseDelayMs: 100 }
    );
  }
}
