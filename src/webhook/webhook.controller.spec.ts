import { NotFoundException } from '@nestjs/common';

import { FacebookMonitor } from '#app/monitor/facebook-monitor.js';
import { FacebookReplyMonitor } from '#app/monitor/facebook-reply-monitor.js';
import type { SitniksChat } from '#app/sitniks/sitniks.types.js';
import { WebhookController } from '#app/webhook/webhook.controller.js';

class FakeMonitor {
  readonly reviewedIds: string[] = [];

  async reviewChat(chat: SitniksChat): Promise<void> {
    this.reviewedIds.push(chat.id);
  }
}

class FakeReplyMonitor {
  readonly repliedIds: string[] = [];

  async reviewReply(chat: SitniksChat): Promise<void> {
    this.repliedIds.push(chat.id);
  }
}

type EventOptions = {
  status?: string;
  source?: string;
  commentId?: string;
  from?: 'client' | 'page';
  text?: string;
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
    message: {
      sentBy: options.from === 'page' ? 'page-1' : 'client-1',
      text: options.text ?? 'Ціна',
      commentId: options.commentId,
    },
  };
}

type Setup = {
  controller: WebhookController;
  monitor: FakeMonitor;
  replyMonitor: FakeReplyMonitor;
};

function buildSetup(): Setup {
  const monitor = new FakeMonitor();
  const replyMonitor = new FakeReplyMonitor();
  const controller = new WebhookController(
    monitor as unknown as FacebookMonitor,
    replyMonitor as unknown as FacebookReplyMonitor,
  );
  return { controller, monitor, replyMonitor };
}

describe('WebhookController', () => {
  it('reviews a comment in a new Facebook chat', () => {
    const { controller, monitor, replyMonitor } = buildSetup();
    expect(controller.receive('test-token', buildEvent({ commentId: 'c-1' }))).toEqual({ ok: true });
    expect(monitor.reviewedIds).toEqual(['chat-1']);
    expect(replyMonitor.repliedIds).toEqual([]);
  });

  it('reviews a client direct message in a Facebook chat that is in "Фейсбук"', () => {
    const { controller, monitor, replyMonitor } = buildSetup();
    controller.receive('test-token', buildEvent({ status: 'Фейсбук' }));
    expect(replyMonitor.repliedIds).toEqual(['chat-1']);
    expect(monitor.reviewedIds).toEqual([]);
  });

  it.each([
    { name: 'a direct message in a new chat', body: buildEvent({}) },
    { name: 'a comment in a chat that is not new', body: buildEvent({ commentId: 'c-1', status: 'Фейсбук' }) },
    { name: 'a comment in a chat from another source', body: buildEvent({ commentId: 'c-1', source: 'instagram' }) },
    { name: 'our own message in "Фейсбук"', body: buildEvent({ status: 'Фейсбук', from: 'page' }) },
    { name: 'a client message in "Фейсбук" of another source', body: buildEvent({ status: 'Фейсбук', source: 'instagram' }) },
    { name: 'a short thanks in "Фейсбук"', body: buildEvent({ status: 'Фейсбук', text: 'Дякую!' }) },
    { name: 'a body without chat and message', body: { test: 'ping' } },
    { name: 'an empty body', body: undefined },
  ])('ignores $name', ({ body }) => {
    const { controller, monitor, replyMonitor } = buildSetup();
    expect(controller.receive('test-token', body)).toEqual({ ok: true });
    expect(monitor.reviewedIds).toEqual([]);
    expect(replyMonitor.repliedIds).toEqual([]);
  });

  it('rejects a request with a wrong token', () => {
    const { controller } = buildSetup();
    expect(() => controller.receive('wrong', {})).toThrow(NotFoundException);
  });
});
