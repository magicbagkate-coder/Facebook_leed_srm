import { isBotWaiting, isClientLast, isRepliedAfterPrice, judgeWaiting, recentMessages } from '#app/monitor/instagram-rules.js';
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

  it('is false for an empty chat and when the client wrote free text last', () => {
    const freeText = buildMessage({ from: 'client', ageSeconds: 130, text: 'Добрий день, яка ціна?' });
    expect(check([])).toBe(false);
    expect(check([freeText])).toBe(false);
  });

  it('is true when the client pressed the price button and got no answer for a minute', () => {
    expect(check([priceClick])).toBe(true);
    const secondPress = buildMessage({ from: 'client', ageSeconds: 100, text: 'дізнатись ціну' });
    expect(check([secondPress, priceClick, pressHere])).toBe(true);
  });

  it('is false when the price button was pressed less than a minute ago', () => {
    const freshPress = buildMessage({ from: 'client', ageSeconds: 10, text: 'дізнатись ціну' });
    expect(check([freshPress, pressHere])).toBe(false);
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

describe('isRepliedAfterPrice', () => {
  const yes = buildMessage({ from: 'client', ageSeconds: 60, text: 'так 🥰' });
  const managerSoon = buildMessage({ from: 'page', ageSeconds: 50, text: 'Зараз наш менеджер' });
  const check = (messages: SitniksMessage[]): boolean =>
    isRepliedAfterPrice({ messages, userId: USER_ID, nowMs: NOW_MS });

  it('is true when the client replied after the price button and no manager answered', () => {
    expect(check([managerSoon, yes, photoOld, priceReply, priceClick])).toBe(true);
  });

  it('is false when a manager already answered', () => {
    const managerReply = buildMessage({ from: 'manager', ageSeconds: 30, text: 'Вітаю' });
    expect(check([managerReply, yes, photoOld, priceReply, priceClick])).toBe(false);
  });

  it('is false when the client only said thanks, refused or sent a like', () => {
    const thanks = buildMessage({ from: 'client', ageSeconds: 60, text: 'Дякую' });
    expect(check([thanks, photoOld, priceReply, priceClick])).toBe(false);
  });

  it('is false without a price button press (the client wrote on their own)', () => {
    expect(check([yes, photoOld])).toBe(false);
  });

  it('is false while the client has not replied yet', () => {
    expect(check([photoOld, priceReply, priceClick])).toBe(false);
  });
});

describe('only the last 24 hours count (a new bot prompt months later)', () => {
  const monthsAgo = 60 * 24 * 150;
  const oldPress = buildMessage({ from: 'client', ageSeconds: monthsAgo, text: 'дізнатись ціну' });
  const oldReply = buildMessage({ from: 'client', ageSeconds: monthsAgo - 60, text: 'побачити інші моделі' });
  const oldBot = buildMessage({ from: 'page', ageSeconds: monthsAgo - 120, text: 'Підкажіть, якого кольору?' });
  const newPrompt = buildMessage({ from: 'page', ageSeconds: 100, text: '⬇натисніть тут⬇' });
  const history = [newPrompt, oldBot, oldReply, oldPress];

  it('keeps only the messages of the last 24 hours', () => {
    expect(recentMessages(history, NOW_MS)).toEqual([newPrompt]);
    expect(recentMessages([photoOld, priceReply, priceClick], NOW_MS)).toHaveLength(3);
  });

  it('does not treat an old reply as a reply to the new bot prompt', () => {
    expect(isRepliedAfterPrice({ messages: history, userId: USER_ID, nowMs: NOW_MS })).toBe(false);
  });

  it('does not mark a chat as waiting for a manager because of an old reply', () => {
    expect(judgeWaiting({ messages: history, userId: USER_ID, nowMs: NOW_MS })).toBe('fine');
  });

  it('moves such a chat back to the bot after the silence', () => {
    expect(isBotWaiting({ messages: history, userId: USER_ID, nowMs: NOW_MS })).toBe(true);
  });
});

describe('isClientLast', () => {
  it('is true when the newest message is from the client', () => {
    const reaction = buildMessage({ from: 'client', ageSeconds: 5, text: 'Дальше' });
    expect(isClientLast({ messages: [reaction, photoOld], userId: USER_ID })).toBe(true);
  });

  it('is false when the client only pressed the price button, even twice', () => {
    const press = buildMessage({ from: 'client', ageSeconds: 5, text: 'дізнатись ціну' });
    expect(isClientLast({ messages: [press, press, pressHere], userId: USER_ID })).toBe(false);
  });

  it('is false when the client only sent a like', () => {
    const like = {
      ...buildMessage({ from: 'client', ageSeconds: 5 }),
      messageType: 'image',
      attachmentUrl: 'https://scontent.xx.fbcdn.net/v/t39.1997-6/39178562_1505_n.png',
    };
    expect(isClientLast({ messages: [like, photoOld], userId: USER_ID })).toBe(false);
  });

  it('is false when the client only said thanks or refused', () => {
    const thanks = buildMessage({ from: 'client', ageSeconds: 5, text: 'Ні,не потрібно' });
    expect(isClientLast({ messages: [thanks, photoOld], userId: USER_ID })).toBe(false);
  });

  it('is false when the newest message is ours or the chat is empty', () => {
    expect(isClientLast({ messages: [photoOld, priceClick], userId: USER_ID })).toBe(false);
    expect(isClientLast({ messages: [], userId: USER_ID })).toBe(false);
  });
});
