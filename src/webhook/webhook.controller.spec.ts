import { NotFoundException } from '@nestjs/common';

import { FacebookMonitor } from '#app/monitor/facebook-monitor.js';
import type { SitniksChat } from '#app/sitniks/sitniks.types.js';
import { WebhookController } from '#app/webhook/webhook.controller.js';

class FakeMonitor {
  readonly reviewedIds: string[] = [];

  async reviewChat(chat: SitniksChat): Promise<void> {
    this.reviewedIds.push(chat.id);
  }
}

type EventOptions = {
  status?: string;
  source?: string;
  commentId?: string;
};

function buildEvent(options: EventOptions): unknown {
  return {
    chat: {
      id: 'chat-1',
      initialSource: options.source ?? 'facebook',
      ownerName: 'Page',
      status: options.status ?? 'Новий',
      tags: ['Reels'],
      userId: 'client-1',
      userName: 'Client',
    },
    message: { sentBy: 'client-1', text: 'Ціна', commentId: options.commentId },
  };
}

function buildController(fake: FakeMonitor): WebhookController {
  return new WebhookController(fake as unknown as FacebookMonitor);
}

describe('WebhookController', () => {
  it('reviews a comment in a new Facebook chat', () => {
    const fake = new FakeMonitor();
    const result = buildController(fake).receive('test-token', buildEvent({ commentId: 'c-1' }));
    expect(result).toEqual({ ok: true });
    expect(fake.reviewedIds).toEqual(['chat-1']);
  });

  it.each([
    { name: 'a direct message without commentId', body: buildEvent({}) },
    { name: 'a chat not in the new status', body: buildEvent({ commentId: 'c-1', status: 'Фейсбук' }) },
    { name: 'a chat from another source', body: buildEvent({ commentId: 'c-1', source: 'instagram' }) },
    { name: 'a body without chat and message', body: { test: 'ping' } },
    { name: 'an empty body', body: undefined },
  ])('ignores $name', ({ body }) => {
    const fake = new FakeMonitor();
    expect(buildController(fake).receive('test-token', body)).toEqual({ ok: true });
    expect(fake.reviewedIds).toEqual([]);
  });

  it('rejects a request with a wrong token', () => {
    const fake = new FakeMonitor();
    expect(() => buildController(fake).receive('wrong', {})).toThrow(NotFoundException);
  });
});
