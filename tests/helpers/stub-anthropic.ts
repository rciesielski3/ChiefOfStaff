/**
 * Preload for CLI tests: `ts-node -r tests/helpers/stub-anthropic.ts src/cli/<cli>.ts`.
 *
 * Answers every Anthropic API request with a 401 authentication error, as the
 * real API does for an invalid key, without opening a network connection.
 * The CLI still runs the real SDK and SummaryGenerator, so tests keep checking
 * the graceful fallback on an API error, but they no longer depend on the
 * network (a blocked or slow network made the SDK retry and stall the suite).
 *
 * The SDK reads globalThis.fetch when a client is constructed, which happens
 * after this preload. Requests to any other host go to the real fetch.
 */
const ANTHROPIC_HOST = 'api.anthropic.com';

const realFetch = globalThis.fetch;

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

globalThis.fetch = async (input, init) => {
  if (new URL(requestUrl(input)).hostname !== ANTHROPIC_HOST) {
    return realFetch(input, init);
  }
  const body = {
    type: 'error',
    error: { type: 'authentication_error', message: 'invalid x-api-key (stubbed in tests)' },
  };
  return new Response(JSON.stringify(body), {
    status: 401,
    headers: { 'content-type': 'application/json', 'request-id': 'req_test_stub' },
  });
};
