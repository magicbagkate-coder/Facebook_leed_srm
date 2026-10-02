import { FacebookMonitor } from '#app/monitor/facebook-monitor.js';
import type {
  ClientMessageOptions,
  HasMessagesOptions,
  LatestMessagesOptions,
  SetTagsOptions,
  SitniksChat,
  SitniksMessage,
} from '#app/sitniks/sitniks.types.js';
import { SitniksClient } from '#app/sitniks/sitniks-client.js';

type FakeMessages = {
  clientDirect: boolean;
  comments: boolean;
  flow?: SitniksMessage[];
};

class FakeSitniksClient {
  readonly movedIds: string[] = [];
  readonly statusById: { [chatId: string]: string } = {};
  readonly tagCalls: SetTagsOptions[] = [];

  constructor(
    private readonly chats: SitniksChat[],
    private readonly messages: { [chatId: string]: FakeMessages },
  ) {}

  async listChats(): Promise<SitniksChat[]> {
    return this.chats;
  }

  async latestMessages(options: LatestMessagesOptions): Promise<SitniksMessage[]> {
    return this.messages[options.chatId].flow ?? [];
  }

  async hasClientMessage(options: ClientMessageOptions): Promise<boolean> {
    return this.messages[options.chatId].clientDirect;
  }

  async hasMessages(options: HasMessagesOptions): Promise<boolean> {
    return this.messages[options.chatId].comments;
  }

  async setChatTags(options: SetTagsOptions): Promise<void> {
    this.tagCalls.push(options);
  }

  async changeChatStatus(options: { chatId: string; status: string }): Promise<void> {
    this.movedIds.push(options.chatId);
    this.statusById[options.chatId] = options.status;
  }
}

function buildChat(options: { id: string; tags?: string[] }): SitniksChat {
  return {
    id: options.id,
    initialSource: 'facebook',
    ownerName: 'Page',
    userId: `client-${options.id}`,
    userName: `User ${options.id}`,
    status: 'Новий',
    tags: options.tags ?? [],
  };
}

function buildMonitor(fake: FakeSitniksClient): FacebookMonitor {
  return new FacebookMonitor(fake as unknown as SitniksClient);
}

describe('FacebookMonitor', () => {
  const chats = [
    buildChat({ id: 'only-comments', tags: ['Reels'] }),
    buildChat({ id: 'our-direct-only', tags: ['ФБ'] }),
    buildChat({ id: 'client-direct' }),
    buildChat({ id: 'empty' }),
  ];
  // "our-direct-only": we wrote in direct, the client did not answer -> clientDirect is false
  const messages = {
    'only-comments': { clientDirect: false, comments: true },
    'our-direct-only': { clientDirect: false, comments: true },
    'client-direct': { clientDirect: true, comments: true },
    empty: { clientDirect: false, comments: false },
  };
  const expectedMoved = ['only-comments', 'our-direct-only'];

  it('moves chats with comments where the client wrote nothing in direct', async () => {
    const fake = new FakeSitniksClient(chats, messages);
    const movedIds = await buildMonitor(fake).runOnce({ dryRun: false });
    expect(movedIds).toEqual(expectedMoved);
    expect(fake.movedIds).toEqual(expectedMoved);
  });

  it('adds the ФБ tag, keeps old tags and does not duplicate the tag', async () => {
    const fake = new FakeSitniksClient(chats, messages);
    await buildMonitor(fake).runOnce({ dryRun: false });
    expect(fake.tagCalls).toEqual([{ chatId: 'only-comments', tags: ['Reels', 'ФБ'] }]);
  });

  it('does not change any chat in dry-run mode', async () => {
    const fake = new FakeSitniksClient(chats, messages);
    const movedIds = await buildMonitor(fake).runOnce({ dryRun: true });
    expect(movedIds).toEqual(expectedMoved);
    expect(fake.movedIds).toEqual([]);
    expect(fake.tagCalls).toEqual([]);
  });

  it('moves a chat to "Вибір товару" when the client replied after the price button', async () => {
    const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();
    const flow: SitniksMessage[] = [
      { sentBy: 'page', createdAt: minutesAgo(90), text: 'Зараз наш менеджер' },
      { sentBy: 'client-replied', createdAt: minutesAgo(91), text: 'так 🥰' },
      { sentBy: 'page', createdAt: minutesAgo(92), messageType: 'image' },
      { sentBy: 'client-replied', createdAt: minutesAgo(93), text: 'дізнатись ціну' },
    ];
    const fake = new FakeSitniksClient([buildChat({ id: 'replied' })], {
      replied: { clientDirect: true, comments: true, flow },
    });
    const movedIds = await buildMonitor(fake).runOnce({ dryRun: false });
    expect(movedIds).toEqual(['replied']);
    expect(fake.statusById.replied).toBe('Вибір товару');
    expect(fake.tagCalls).toEqual([{ chatId: 'replied', tags: ['ФБ'] }]);
  });
});
