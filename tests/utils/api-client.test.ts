import { APIClient } from '../../src/utils/api-client';

describe('APIClient', () => {
  let client: APIClient;

  beforeEach(() => {
    client = new APIClient(5000, 3);
    jest.clearAllMocks();
  });

  describe('GET requests', () => {
    it('should successfully fetch JSON data', async () => {
      const mockData = { id: 1, title: 'Test Article' };
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => mockData
        } as Response)
      );

      const result = await client.get('/test');

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith('/test', { headers: undefined });
    });

    it('should include custom headers in request', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({})
        } as Response)
      );

      const headers = { Authorization: 'Bearer token123' };
      await client.get('/test', headers);

      expect(global.fetch).toHaveBeenCalledWith('/test', { headers });
    });

    it('should throw error on HTTP 404', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        } as Response)
      );

      await expect(client.get('/test')).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should throw error on HTTP 500', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        } as Response)
      );

      await expect(client.get('/test')).rejects.toThrow('HTTP 500: Internal Server Error');
    });

    it('should retry on network error', async () => {
      let attemptCount = 0;
      global.fetch = jest.fn(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error('Network timeout'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true })
        } as Response);
      });

      const result = await client.get('/test');

      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should timeout if request exceeds timeout duration', async () => {
      const slowClient = new APIClient(100, 1); // 100ms timeout

      global.fetch = jest.fn(
        () => new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({})
          } as Response), 200)
        )
      );

      await expect(slowClient.get('/test')).rejects.toThrow('timed out');
    });

    it('should throw after exhausting retries', async () => {
      global.fetch = jest.fn(() =>
        Promise.reject(new Error('Persistent network error'))
      );

      const clientWith1Retry = new APIClient(5000, 1);
      await expect(clientWith1Retry.get('/test')).rejects.toThrow('Persistent network error');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle JSON parse errors', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => {
            throw new SyntaxError('Unexpected token < in JSON');
          }
        } as Response)
      );

      await expect(client.get('/test')).rejects.toThrow('Unexpected token');
    });
  });

  describe('POST requests', () => {
    it('should successfully post data and receive response', async () => {
      const requestBody = { name: 'John', age: 30 };
      const responseData = { id: 123, ...requestBody };

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => responseData
        } as Response)
      );

      const result = await client.post('/users', requestBody);

      expect(result).toEqual(responseData);
      expect(global.fetch).toHaveBeenCalledWith('/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
    });

    it('should include custom headers in POST request', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({})
        } as Response)
      );

      const headers = { 'X-Custom': 'value' };
      await client.post('/test', {}, headers);

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Custom': 'value'
          })
        })
      );
    });

    it('should throw error on HTTP 400', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'Bad Request'
        } as Response)
      );

      await expect(client.post('/test', {})).rejects.toThrow('HTTP 400: Bad Request');
    });

    it('should retry on network error during POST', async () => {
      let attemptCount = 0;
      global.fetch = jest.fn(() => {
        attemptCount++;
        if (attemptCount < 2) {
          return Promise.reject(new Error('Connection refused'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true })
        } as Response);
      });

      const result = await client.post('/test', { data: 'value' });

      expect(result).toEqual({ success: true });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should timeout on slow POST request', async () => {
      const slowClient = new APIClient(50, 1);

      global.fetch = jest.fn(
        () => new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({})
          } as Response), 100)
        )
      );

      await expect(slowClient.post('/test', {})).rejects.toThrow('timed out');
    });
  });

  describe('Exponential backoff', () => {
    it('should wait longer between each retry', async () => {
      const timings: number[] = [];
      let lastTime = Date.now();

      global.fetch = jest.fn(() => {
        const now = Date.now();
        if (timings.length > 0) {
          timings.push(now - lastTime);
        }
        lastTime = now;

        if (timings.length < 2) {
          return Promise.reject(new Error('Temporary error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({})
        } as Response);
      });

      const clientWithLongDelay = new APIClient(5000, 3);
      await clientWithLongDelay.get('/test');

      // Backoff should be roughly: 0ms (first attempt) + 100ms (retry 1) + 200ms (retry 2)
      // We're just checking that timings exist and are increasing
      expect(timings.length).toBeGreaterThan(0);
      if (timings.length > 1) {
        // Second delay should be longer than first (exponential backoff)
        expect(timings[1]).toBeGreaterThanOrEqual(timings[0]);
      }
    });
  });

  describe('Constructor options', () => {
    it('should use default timeout and retry settings', async () => {
      const defaultClient = new APIClient();

      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({})
        } as Response)
      );

      await defaultClient.get('/test');
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should use custom timeout setting', async () => {
      const customTimeoutClient = new APIClient(1000, 1);

      global.fetch = jest.fn(
        () => new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({})
          } as Response), 500)
        )
      );

      const result = await customTimeoutClient.get('/test');
      expect(result).toBeDefined();
    });

    it('should use custom max retries setting', async () => {
      let attemptCount = 0;
      global.fetch = jest.fn(() => {
        attemptCount++;
        return Promise.reject(new Error('Error'));
      });

      const customRetriesClient = new APIClient(5000, 2);

      await expect(customRetriesClient.get('/test')).rejects.toThrow();
      expect(attemptCount).toBe(2); // Initial attempt + 1 retry
    });
  });
});
