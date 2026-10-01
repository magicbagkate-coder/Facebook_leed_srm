import { isBotWaiting, isClientLast } from '#app/monitor/instagram-rules.js';
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
const pressHere = buildMessage({ from: 'page', ageSeconds: 100, text: '⬇натисніть тут⬇' });

function check(messages: SitniksMessage[]): boolean {
  return isBotWaiting({ messages, userId: USER_ID, nowMs: NOW_MS });
}

describe('isBotWaiting', () => {
  it('is true when the client pressed the price button and stayed silent for a minute', () => {
    expect(check([photoOld, priceReply, priceClick])).toBe(true);
  });

  it('is true when the chat has only bot messages and the client pressed nothing', () => {
    expect(check([pressHere])).toBe(true);
  });

  it('is false when our last message is less than a minute old', () => {
    expect(check([photoFresh, priceReply, priceClick])).toBe(false);
  });

  it('is false for an empty chat and when the client wrote last', () => {
    expect(check([])).toBe(false);
    expect(check([priceClick])).toBe(false);
  });

  it('is false when the client wrote something after our reply', () => {
    const reaction = buildMessage({ from: 'client', ageSeconds: 5, text: 'Дальше' });
    expect(check([reaction, photoOld, priceReply, priceClick])).toBe(false);
  });

  it('is false for a bot message that follows another button or a free text from the client', () => {
    const otherButton = buildMessage({ from: 'client', ageSeconds: 130, text: 'Дальше' });
    expect(check([photoOld, priceReply, otherButton])).toBe(false);
  });

  it('is true for the press-here prompt even after a dialog with a manager', () => {
    const managerReply = buildMessage({ from: 'manager', ageSeconds: 200, text: 'Вітаю' });
    expect(check([pressHere, managerReply])).toBe(true);
  });

  it('is false for another bot message after a dialog with a manager', () => {
    const managerReply = buildMessage({ from: 'manager', ageSeconds: 200, text: 'Вітаю' });
    const managerSoon = buildMessage({ from: 'page', ageSeconds: 100, text: 'Менеджер зараз підключиться' });
    expect(check([managerSoon, managerReply])).toBe(false);
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
