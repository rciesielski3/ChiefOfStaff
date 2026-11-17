import * as http from 'http';
import { AddressInfo, Socket } from 'net';
import { fetchRSS } from '../../src/business-logic/rss-fetch';

/**
 * fetchRSS must not leave sockets open after it settles.
 *
 * rss-parser follows a redirect without reading or closing the 3xx response
 * (and rejects a non-2xx status the same way). With a keep-alive agent (the
 * Node 19+ default, so the Node 22 CI runner) that connection stays open and
 * keeps the daily-brief process alive after its work is done.
 *
 * Uses a real local HTTP server (no rss-parser mock). After fetchRSS settles,
 * no client socket to that server may still hold the event loop open. Idle
 * keep-alive sockets parked in the agent pool are unref'd by Node and do not
 * count; `process._getActiveHandles()` lists only ref'd handles.
 */

const FEED = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>t</title>
<item><title>a</title><link>http://example.com/a</link><pubDate>Mon, 16 Nov 2026 00:00:00 GMT</pubDate></item>
</channel></rss>`;

describe('fetchRSS socket cleanup', () => {
  let server: http.Server;
  let baseUrl: string;
  let port: number;
  const serverSockets = new Set<Socket>();
  let originalKeepAlive: boolean;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/redirect') {
        res.writeHead(301, { location: '/feed' });
        res.end('moved');
      } else if (req.url === '/forbidden') {
        res.writeHead(403, { 'content-type': 'text/html' });
        res.end('forbidden');
      } else {
        res.writeHead(200, { 'content-type': 'application/rss+xml' });
        res.end(FEED);
      }
    });
    // Like a CDN edge: keep idle connections open well past the test window.
    server.keepAliveTimeout = 60000;
    server.on('connection', (socket) => {
      serverSockets.add(socket);
      socket.on('close', () => serverSockets.delete(socket));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Node 19+ defaults the global agent to keep-alive; force it so the test
    // behaves the same on older local Node versions.
    originalKeepAlive = (http.globalAgent as any).keepAlive;
    (http.globalAgent as any).keepAlive = true;
  });

  afterAll(async () => {
    (http.globalAgent as any).keepAlive = originalKeepAlive;
    serverSockets.forEach((socket) => socket.destroy());
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  /** Client sockets to the test server that still keep the event loop alive. */
  function liveClientSockets(): Socket[] {
    return (process as any)
      ._getActiveHandles()
      .filter((h: unknown) => h instanceof Socket && h.remotePort === port && !h.destroyed);
  }

  async function expectNoLiveClientSockets(): Promise<void> {
    const deadline = Date.now() + 1000;
    while (liveClientSockets().length > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(liveClientSockets()).toHaveLength(0);
  }

  it('releases the redirect response connection after following a redirect', async () => {
    const articles = await fetchRSS(`${baseUrl}/redirect`, 'Redirecting feed');
    expect(articles).toHaveLength(1);
    await expectNoLiveClientSockets();
  });

  it('releases the connection of a non-2xx response', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(fetchRSS(`${baseUrl}/forbidden`, 'Forbidden feed')).rejects.toThrow(
      'Status code 403',
    );
    await expectNoLiveClientSockets();
    jest.restoreAllMocks();
  });

  it('releases the connection of a successful response', async () => {
    await fetchRSS(`${baseUrl}/feed`, 'Plain feed');
    await expectNoLiveClientSockets();
  });
});
