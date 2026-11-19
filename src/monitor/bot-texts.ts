import { PRESS_HERE_TEXT, PRICE_BUTTON_TEXT } from '#app/monitor/monitor.constants.js';

function containsText(text: string | undefined, part: string): boolean {
  return (text ?? '').toLowerCase().includes(part);
}

/** The client pressed the price button of our bot, it is not a live message. */
export function isPriceButton(text: string | undefined): boolean {
  return containsText(text, PRICE_BUTTON_TEXT);
}

// Our bot hands the client over to a manager: "менеджер зараз підбере інші моделі",
// "наш менеджер відправить вам більше фото", "зараз допоможемо оформити замовлення"
const HANDOFF_PATTERNS = [/менеджер.{0,25}(зараз|відправить|підбере|підключ)/, /зараз.{0,25}менеджер/, /допоможемо.{0,40}оформ/];

/** A message of our bot that hands the client over to a manager (it answers a button press of the client). */
export function isManagerHandoff(text: string | undefined): boolean {
  const value = (text ?? '').toLowerCase();
  return HANDOFF_PATTERNS.some((pattern) => pattern.test(value));
}

const COURTESY_PHRASES = [
  'не потрібно',
  'не треба',
  'не цікав',
  'не нужно',
  'не надо',
  'не интерес',
  'не хочу',
  'не буду',
  'дякую',
  'дякуємо',
  'спасибі',
  'спасибо',
  'благодарю',
];
// Short words must match as a whole word: "ні" is also a part of many other words
const COURTESY_WORDS = /(^|[^\p{L}])(ні|нет|дорого|дорогувато|зайве|пізніше|подумаю|подумаємо)([^\p{L}]|$)/u;
// A refusal that also shows interest ("дякую, так", "цікаво") is a live answer
const INTEREST_PATTERN = /(^|[^\p{L}])(так|да|беру|замовити)([^\p{L}]|$)|(?<!не )(цікаво|хочу)/u;
const MAX_COURTESY_LENGTH = 30;

type MessageContent = {
  text?: string;
  messageType?: string;
  attachmentUrl?: string;
};

// Facebook serves its built-in stickers (the "like" thumb) from this CDN path; real photos use another one
const FACEBOOK_STICKER_PATH = '/t39.1997-6/';

/** The "like" sticker: an image without text that comes from the Facebook sticker CDN path. */
export function isLikeSticker(content: MessageContent): boolean {
  return (
    content.messageType === 'image' &&
    (content.text ?? '') === '' &&
    (content.attachmentUrl ?? '').includes(FACEBOOK_STICKER_PATH)
  );
}

/** A button press of our bot or a like: it is not a live message from the client. */
export function isButtonOrLike(content: MessageContent): boolean {
  return isPriceButton(content.text) || isLikeSticker(content);
}

function hasRefusalWords(value: string): boolean {
  return COURTESY_WORDS.test(value) || COURTESY_PHRASES.some((phrase) => value.includes(phrase));
}

/** A short thanks or refusal without a question: the manager decides what to do with such a chat. */
export function isThanksOrRefusal(text: string | undefined): boolean {
  const value = (text ?? '').toLowerCase();
  if (value.length > MAX_COURTESY_LENGTH || value.includes('?') || INTEREST_PATTERN.test(value)) return false;
  return hasRefusalWords(value);
}

/** Our bot asked the client to press a button. */
export function isPressHerePrompt(text: string | undefined): boolean {
  return containsText(text, PRESS_HERE_TEXT);
}
