import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { appConfig } from '#app/config/app-config.js';
import { laneStorage } from '#app/sitniks/request-lane.js';
import { SitniksClient } from '#app/sitniks/sitniks-client.js';
import { SitniksError } from '#app/sitniks/sitniks-error.js';

type FakeCrm = {
  server: Server;
  baseUrl: string;
};

function startFakeCrm(respond: (res: import('node:http').ServerResponse, url: string) => void): Promise<FakeCrm> {
  return new Promise((resolve) => {
    const server = createServer((incoming, res) => {
      incoming.resume();
      respond(res, incoming.url ?? '');
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

function stopFakeCrm(crm: FakeCrm): Promise<void> {
  return new Promise((resolve) => {
    crm.server.closeAllConnections();
    crm.server.close(() => resolve());
  });
}

describe('SitniksClient against a fake CRM', () => {
  const originalBaseUrl = appConfig.sitniksBaseUrl;
  const originalTimeout = appConfig.requestTimeoutMs;
  const originalPause = appConfig.rateLimitPauseMs;
  const originalGap = appConfig.requestGapMs;

  afterEach(() => {
    appConfig.sitniksBaseUrl = originalBaseUrl;
    appConfig.requestTimeoutMs = originalTimeout;
    appConfig.rateLimitPauseMs = originalPause;
    appConfig.requestGapMs = originalGap;
  });

  it('gives up when the CRM hangs instead of waiting forever', async () => {
    const crm = await startFakeCrm(() => undefined);
    appConfig.sitniksBaseUrl = crm.baseUrl;
    appConfig.requestTimeoutMs = 150;
    await expect(new SitniksClient().hasMessages({ chatId: 'c1', isComment: true })).rejects.toThrow(
      /timed out/,
    );
    await stopFakeCrm(crm);
  });

  it('waits out an HTTP 429 and repeats the request once', async () => {
    let hits = 0;
    const crm = await startFakeCrm((res) => {
      hits += 1;
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = hits === 1 ? 429 : 200;
      res.end(JSON.stringify({ 'data': [{ sentBy: 'client-1', createdAt: '2026-10-01T10:00:00Z' }] }));
    });
    appConfig.sitniksBaseUrl = crm.baseUrl;
    appConfig.rateLimitPauseMs = 50;
    const messages = await new SitniksClient().latestMessages({ chatId: 'c1', limit: 1 });
    expect(messages).toHaveLength(1);
    expect(hits).toBe(2);
    await stopFakeCrm(crm);
  });

  it('fails after a second HTTP 429 instead of looping', async () => {
    let hits = 0;
    const crm = await startFakeCrm((res) => {
      hits += 1;
      res.statusCode = 429;
      res.end('{}');
    });
    appConfig.sitniksBaseUrl = crm.baseUrl;
    appConfig.rateLimitPauseMs = 50;
    await expect(new SitniksClient().hasMessages({ chatId: 'c1', isComment: true })).rejects.toBeInstanceOf(
      SitniksError,
    );
    expect(hits).toBe(2);
    await stopFakeCrm(crm);
  });

  it('serves urgent requests before queued background requests', async () => {
    const order: string[] = [];
    const crm = await startFakeCrm((res, url) => {
      order.push(url);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 'data': [] }));
    });
    appConfig.sitniksBaseUrl = crm.baseUrl;
    appConfig.requestGapMs = 80;
    const client = new SitniksClient();
    const read = (chatId: string): Promise<unknown> => client.latestMessages({ chatId, limit: 1 });
    const first = read('first');
    const background = laneStorage.run('low', () => read('background'));
    const urgent = laneStorage.run('high', () => read('urgent'));
    await Promise.all([first, background, urgent]);
    expect(order.map((path) => path.split('/')[2])).toEqual(['first', 'urgent', 'background']);
    await stopFakeCrm(crm);
  });

  it('reads messages newest first and detects a live client message', async () => {
    const crm = await startFakeCrm((res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          'data': [
            { sentBy: 'client-1', text: 'дізнатись ціну', createdAt: '2026-10-01T10:00:00Z' },
            { sentBy: 'page-1', createdAt: '2026-10-01T09:59:00Z' },
          ],
        }),
      );
    });
    appConfig.sitniksBaseUrl = crm.baseUrl;
    const client = new SitniksClient();
    expect(await client.hasClientMessage({ chatId: 'c1', userId: 'client-1' })).toBe(false);
    expect(await client.latestMessages({ chatId: 'c1', limit: 2 })).toHaveLength(2);
    await stopFakeCrm(crm);
  });
});
