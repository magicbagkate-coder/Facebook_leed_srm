import { appConfig } from '#app/config/app-config.js';
import { FacebookReplyMonitor } from '#app/monitor/facebook-reply-monitor.js';
import type {
  ChangeStatusOptions,
  LatestMessagesOptions,
  ListChatsOptions,
  SetTagsOptions,
  SitniksChat,
  SitniksMessage,
} from '#app/sitniks/sitniks.types.js';
import { SitniksClient } from '#app/sitniks/sitniks-client.js';

const USER_ID = 'client-1';

class FakeSitniksClient {
  readonly statusCalls: ChangeStatusOptions[] = [];
  readonly tagCalls: SetTagsOptions[] = [];
  readonly listCalls: ListChatsOptions[] = [];

  constructor(
    private readonly chats: SitniksChat[],
    private readonly messages: SitniksMessage[],
  ) {}

  async listChats(options: ListChatsOptions): Promise<SitniksChat[]> {
    this.listCalls.push(options);
    return this.chats;
  }

  async latestMessages(options: LatestMessagesOptions): Promise<SitniksMessage[]> {
    return this.messages.slice(0, options.limit);
  }

  async setChatTags(options: SetTagsOptions): Promise<void> {
    this.tagCalls.push(options);
  }

  async changeChatStatus(options: ChangeStatusOptions): Promise<void> {
    this.statusCalls.push(options);
  }
}

const chat: SitniksChat = {
  id: 'chat-1',
  initialSource: 'facebook',
  ownerName: 'Page',
  userId: USER_ID,
  userName: 'Client',
  status: 'Фейсбук',
  tags: [],
};

const clientWrote: SitniksMessage[] = [{ sentBy: USER_ID, createdAt: new Date().toISOString(), text: 'бажаю замовити' }];
const weWrote: SitniksMessage[] = [{ sentBy: 'page-1', managerName: 'Manager', createdAt: new Date().toISOString() }];

function buildMonitor(fake: FakeSitniksClient): FacebookReplyMonitor {
  return new FacebookReplyMonitor(fake as unknown as SitniksClient);
}

describe('FacebookReplyMonitor', () => {
  beforeEach(() => {
    appConfig.dryRun = false;
  });

  afterEach(() => {
    appConfig.dryRun = true;
  });

  it('moves a chat to "Вибір товару" when the client wrote last', async () => {
    const fake = new FakeSitniksClient([chat], clientWrote);
    const movedIds = await buildMonitor(fake).moveRepliedChats();
    expect(movedIds).toEqual(['chat-1']);
    expect(fake.tagCalls).toEqual([{ chatId: 'chat-1', tags: ['ФБ'] }]);
    expect(fake.statusCalls).toEqual([{ chatId: 'chat-1', status: 'Вибір товару' }]);
    expect(fake.listCalls[0].status).toBe('Фейсбук');
    expect(fake.listCalls[0].startDate).toBeDefined();
  });

  it('leaves the chat when we wrote last', async () => {
    const fake = new FakeSitniksClient([chat], weWrote);
    const movedIds = await buildMonitor(fake).moveRepliedChats();
    expect(movedIds).toEqual([]);
    expect(fake.statusCalls).toEqual([]);
  });

  it('moves a chat reported by a webhook without extra reads', async () => {
    const fake = new FakeSitniksClient([], []);
    await buildMonitor(fake).reviewReply({ ...chat, tags: ['ФБ'] });
    expect(fake.tagCalls).toEqual([]);
    expect(fake.statusCalls).toEqual([{ chatId: 'chat-1', status: 'Вибір товару' }]);
  });
});
