import { appConfig } from '#app/config/app-config.js';
import { UrgentMonitor } from '#app/monitor/urgent-monitor.js';
import type {
  LatestMessagesOptions,
  SetTagsOptions,
  SitniksChat,
  SitniksMessage,
} from '#app/sitniks/sitniks.types.js';
import { SitniksClient } from '#app/sitniks/sitniks-client.js';

const USER_ID = 'client-1';

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function buildChat(id: string, tags: string[] = []): SitniksChat {
  return {
    id,
    initialSource: 'instagram',
    ownerName: 'page',
    userId: USER_ID,
    userName: `User ${id}`,
    status: 'Вибір товару',
    tags,
    lastMessageCreatedAt: minutesAgo(40),
  };
}

class FakeSitniksClient {
  readonly tagCalls: SetTagsOptions[] = [];
  readLimit = 0;
  messageReads = 0;

  constructor(
    private readonly chats: SitniksChat[],
    private readonly messagesById: { [chatId: string]: SitniksMessage[] },
  ) {}

  async listChats(): Promise<SitniksChat[]> {
    return this.chats;
  }

  async latestMessages(options: LatestMessagesOptions): Promise<SitniksMessage[]> {
    this.messageReads += 1;
    return this.messagesById[options.chatId] ?? [];
  }

  async setChatTags(options: SetTagsOptions): Promise<void> {
    this.tagCalls.push(options);
  }
}

const waiting: SitniksMessage[] = [{ sentBy: USER_ID, createdAt: minutesAgo(40), text: 'Хочу замовити, як оплатити?' }];
const young: SitniksMessage[] = [{ sentBy: USER_ID, createdAt: minutesAgo(5), text: 'Хочу замовити' }];
const answered: SitniksMessage[] = [
  { sentBy: 'page', managerName: 'Manager', createdAt: minutesAgo(10), text: 'Вітаю' },
  { sentBy: USER_ID, createdAt: minutesAgo(40), text: 'Хочу замовити' },
];

function buildMonitor(fake: FakeSitniksClient): UrgentMonitor {
  return new UrgentMonitor(fake as unknown as SitniksClient);
}

describe('UrgentMonitor', () => {
  afterEach(() => {
    appConfig.urgentDryRun = true;
  });

  it('tags only leads where the client waits for a manager for more than 30 minutes', async () => {
    appConfig.urgentDryRun = false;
    const fake = new FakeSitniksClient([buildChat('waiting', ['Reels']), buildChat('young'), buildChat('answered')], {
      waiting,
      young,
      answered,
    });
    const taggedIds = await buildMonitor(fake).tagWaitingChats();
    expect(taggedIds).toEqual(['waiting']);
    expect(fake.tagCalls).toEqual([{ chatId: 'waiting', tags: ['Reels', 'СРОЧНО'] }]);
  });

  it('does not tag again and does not re-read chats that are already settled', async () => {
    appConfig.urgentDryRun = false;
    const fake = new FakeSitniksClient([buildChat('waiting'), buildChat('answered'), buildChat('tagged', ['СРОЧНО'])], {
      waiting,
      answered,
    });
    const monitor = buildMonitor(fake);
    await monitor.tagWaitingChats();
    const readsAfterFirstPass = fake.messageReads;
    expect(readsAfterFirstPass).toBe(2);
    await monitor.tagWaitingChats();
    expect(fake.messageReads).toBe(readsAfterFirstPass);
  });

  it('reads at most 20 chats per pass', async () => {
    const chats = Array.from({ length: 30 }, (unusedSlot, index) => buildChat(`chat-${index}`));
    const fake = new FakeSitniksClient(chats, {});
    await buildMonitor(fake).tagWaitingChats();
    expect(fake.messageReads).toBe(20);
  });

  it('changes nothing in dry-run mode', async () => {
    const fake = new FakeSitniksClient([buildChat('waiting')], { waiting });
    const taggedIds = await buildMonitor(fake).tagWaitingChats();
    expect(taggedIds).toEqual(['waiting']);
    expect(fake.tagCalls).toEqual([]);
  });
});
