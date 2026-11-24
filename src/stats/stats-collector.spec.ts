import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { appConfig } from '#app/config/app-config.js';
import type { ListChatsOptions, SitniksChat, SitniksMessage } from '#app/sitniks/sitniks.types.js';
import { SitniksClient } from '#app/sitniks/sitniks-client.js';
import { StatsCollector } from '#app/stats/stats-collector.js';
import { kyivDay, StatsStore } from '#app/stats/stats-store.js';

function buildChat(options: { id: string; status: string; lastAt: string }): SitniksChat {
  return {
    id: options.id,
    initialSource: 'instagram',
    ownerName: 'Page',
    userId: `client-${options.id}`,
    userName: `User ${options.id}`,
    status: options.status,
    tags: [],
    lastMessageCreatedAt: options.lastAt,
  };
}

class FakeSitniksClient {
  messageReads = 0;

  constructor(
    private readonly chats: SitniksChat[],
    private readonly clientLastIds: string[],
  ) {}

  async listChats(options: ListChatsOptions): Promise<SitniksChat[]> {
    return this.chats.filter((chat) => chat.status === options.status);
  }

  async newestMessageOfAnyKind(chatId: string): Promise<SitniksMessage | undefined> {
    this.messageReads += 1;
    const sender = this.clientLastIds.includes(chatId) ? `client-${chatId}` : 'page';
    return { sentBy: sender, createdAt: new Date().toISOString() };
  }
}

describe('StatsCollector', () => {
  let folder: string;
  const originalFile = appConfig.statsFile;
  const chats = [
    buildChat({ id: 'n1', status: 'Новий', lastAt: '2026-11-24T10:00:00Z' }),
    buildChat({ id: 'n2', status: 'Новий', lastAt: '2026-11-24T10:01:00Z' }),
    buildChat({ id: 'p1', status: 'Вибір товару', lastAt: '2026-11-24T10:02:00Z' }),
    buildChat({ id: 'other', status: 'В роботі', lastAt: '2026-11-24T10:03:00Z' }),
  ];

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'stats-'));
    appConfig.statsFile = join(folder, 'stats.jsonl');
  });

  afterEach(async () => {
    appConfig.statsFile = originalFile;
    await rm(folder, { recursive: true, force: true });
  });

  it('counts all chats and those whose newest message is the client\'s, in both statuses', async () => {
    const fake = new FakeSitniksClient(chats, ['n1', 'p1']);
    const point = await new StatsCollector(fake as unknown as SitniksClient, new StatsStore()).collect();
    expect(point.newChats).toEqual({ total: 2, unanswered: 1 });
    expect(point.productChoice).toEqual({ total: 1, unanswered: 1 });
  });

  it('reads the last message again only when the chat has changed', async () => {
    const fake = new FakeSitniksClient(chats, ['n1']);
    const collector = new StatsCollector(fake as unknown as SitniksClient, new StatsStore());
    await collector.collect();
    await collector.collect();
    expect(fake.messageReads).toBe(3);
  });

  it('saves every measurement and returns the points of the requested Kyiv day', async () => {
    const fake = new FakeSitniksClient(chats, []);
    const store = new StatsStore();
    await new StatsCollector(fake as unknown as SitniksClient, store).collect();
    expect(await store.readDay(kyivDay(new Date()))).toHaveLength(1);
    expect(await store.readDay('2000-01-01')).toEqual([]);
  });
});
