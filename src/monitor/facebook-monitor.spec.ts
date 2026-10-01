import { FacebookMonitor } from '#app/monitor/facebook-monitor.js';
import type {
  ClientMessageOptions,
  HasMessagesOptions,
  SetTagsOptions,
  SitniksChat,
} from '#app/sitniks/sitniks.types.js';
import { SitniksClient } from '#app/sitniks/sitniks-client.js';

type FakeMessages = {
  clientDirect: boolean;
  comments: boolean;
};

class FakeSitniksClient {
  readonly movedIds: string[] = [];
  readonly tagCalls: SetTagsOptions[] = [];

  constructor(
    private readonly chats: SitniksChat[],
    private readonly messages: { [chatId: string]: FakeMessages },
  ) {}

  async listChats(): Promise<SitniksChat[]> {
    return this.chats;
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
});
