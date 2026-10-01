import { isClientLast, isSilentAfterPrice } from '#app/monitor/instagram-rules.js';
import type { SitniksMessage } from '#app/sitniks/sitniks.types.js';

const USER_ID = 'client-1';
const NOW_MS = Date.parse('2026-10-01T12:00:00Z');

type MessageOptions = {
  from: 'client' | 'manager' | 'page';
  ageSeconds: number;
  text?: string;
};

function buildMessage(options: MessageOptions): SitniksMessage {
  return {
    sentBy: options.from === 'client' ? USER_ID : 'page-1',
    managerName: options.from === 'manager' ? 'Manager' : undefined,
    text: options.text,
    createdAt: new Date(NOW_MS - options.ageSeconds * 1000).toISOString(),
  };
}

const priceClick = buildMessage({ from: 'client', ageSeconds: 130, text: 'Дізнатись ціну' });
const priceReply = buildMessage({ from: 'page', ageSeconds: 125, text: 'Вітаю💛 Гарний вибір' });
const photoOld = buildMessage({ from: 'page', ageSeconds: 120 });
const photoFresh = buildMessage({ from: 'page', ageSeconds: 10 });

function check(messages: SitniksMessage[]): boolean {
  return isSilentAfterPrice({ messages, userId: USER_ID, nowMs: NOW_MS });
}

describe('isSilentAfterPrice', () => {
  it('is true when the client pressed the price button and stayed silent for a minute', () => {
    expect(check([photoOld, priceReply, priceClick])).toBe(true);
  });

  it('is false when our last message is less than a minute old', () => {
    expect(check([photoFresh, priceReply, priceClick])).toBe(false);
  });

  it('is false when there is no reply from us yet', () => {
    expect(check([priceClick])).toBe(false);
  });

  it('is false when the client wrote something after our reply', () => {
    const reaction = buildMessage({ from: 'client', ageSeconds: 5, text: 'Дальше' });
    expect(check([reaction, photoOld, priceReply, priceClick])).toBe(false);
  });

  it('is false for another button', () => {
    const otherButton = buildMessage({ from: 'client', ageSeconds: 130, text: 'Дальше' });
    expect(check([photoOld, priceReply, otherButton])).toBe(false);
  });

  it('is false when a manager answered', () => {
    const managerReply = buildMessage({ from: 'manager', ageSeconds: 100, text: 'Вітаю' });
    expect(check([managerReply, priceReply, priceClick])).toBe(false);
  });
});

describe('isClientLast', () => {
  it('is true when the newest message is from the client', () => {
    const reaction = buildMessage({ from: 'client', ageSeconds: 5, text: 'Дальше' });
    expect(isClientLast({ messages: [reaction, photoOld], userId: USER_ID })).toBe(true);
  });

  it('is false when the newest message is ours or the chat is empty', () => {
    expect(isClientLast({ messages: [photoOld, priceClick], userId: USER_ID })).toBe(false);
    expect(isClientLast({ messages: [], userId: USER_ID })).toBe(false);
  });
});
