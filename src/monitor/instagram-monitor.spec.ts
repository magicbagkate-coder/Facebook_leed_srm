import { appConfig } from '#app/config/app-config.js';
import { InstagramMonitor } from '#app/monitor/instagram-monitor.js';
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
  initialSource: 'instagram',
  ownerName: 'magicbagukraine',
  userId: USER_ID,
  userName: 'Client',
  status: 'Новий',
  tags: ['Reels'],
};

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

const silentFlow: SitniksMessage[] = [
  { sentBy: 'page', createdAt: minutesAgo(3), messageType: 'image' },
  { sentBy: 'page', createdAt: minutesAgo(3), text: 'Вітаю💛' },
  { sentBy: USER_ID, createdAt: minutesAgo(4), text: 'дізнатись ціну' },
];

const clientReply: SitniksMessage[] = [{ sentBy: USER_ID, createdAt: minutesAgo(1), text: 'Дальше' }];

function buildMonitor(fake: FakeSitniksClient): InstagramMonitor {
  return new InstagramMonitor(fake as unknown as SitniksClient);
}

describe('InstagramMonitor', () => {
  afterEach(() => {
    appConfig.instagramDryRun = true;
  });

  it('moves a silent chat to "Новий БОТ" and adds the НБ tag', async () => {
    appConfig.instagramDryRun = false;
    const fake = new FakeSitniksClient([chat], silentFlow);
    const movedIds = await buildMonitor(fake).moveSilentChats();
    expect(movedIds).toEqual(['chat-1']);
    expect(fake.tagCalls).toEqual([{ chatId: 'chat-1', tags: ['Reels', 'НБ'] }]);
    expect(fake.statusCalls).toEqual([{ chatId: 'chat-1', status: 'Новий БОТ' }]);
  });

  it('moves a chat with a client reply from "Новий БОТ" to "Вибір товару"', async () => {
    appConfig.instagramDryRun = false;
    const fake = new FakeSitniksClient([chat], clientReply);
    const movedIds = await buildMonitor(fake).moveRepliedChats();
    expect(movedIds).toEqual(['chat-1']);
    expect(fake.tagCalls).toEqual([{ chatId: 'chat-1', tags: ['Reels', 'НБ'] }]);
    expect(fake.statusCalls).toEqual([{ chatId: 'chat-1', status: 'Вибір товару' }]);
    expect(fake.listCalls[0].startDate).toBeDefined();
  });

  it('does not add the НБ tag twice when moving to "Вибір товару"', async () => {
    appConfig.instagramDryRun = false;
    const taggedChat = { ...chat, tags: ['НБ'] };
    const fake = new FakeSitniksClient([taggedChat], clientReply);
    await buildMonitor(fake).moveRepliedChats();
    expect(fake.tagCalls).toEqual([]);
    expect(fake.statusCalls).toEqual([{ chatId: 'chat-1', status: 'Вибір товару' }]);
  });

  it('changes nothing in dry-run mode', async () => {
    const fake = new FakeSitniksClient([chat], silentFlow);
    const movedIds = await buildMonitor(fake).moveSilentChats();
    expect(movedIds).toEqual(['chat-1']);
    expect(fake.statusCalls).toEqual([]);
    expect(fake.tagCalls).toEqual([]);
  });
});
