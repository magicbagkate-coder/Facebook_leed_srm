import { PRESS_HERE_TEXT, PRICE_BUTTON_TEXT } from '#app/monitor/monitor.constants.js';

function containsText(text: string | undefined, part: string): boolean {
  return (text ?? '').toLowerCase().includes(part);
}

/** The client pressed the price button of our bot, it is not a live message. */
export function isPriceButton(text: string | undefined): boolean {
  return containsText(text, PRICE_BUTTON_TEXT);
}

const COURTESY_PHRASES = [
  'не потрібно',
  'не треба',
  'не цікавить',
  'не нужно',
  'не надо',
  'не интересует',
  'дякую',
  'дякуємо',
  'спасибі',
  'спасибо',
  'благодарю',
];
const MAX_COURTESY_LENGTH = 30;

/** A short thanks or refusal without a question: the manager decides what to do with such a chat. */
export function isThanksOrRefusal(text: string | undefined): boolean {
  const value = (text ?? '').toLowerCase();
  if (value.length > MAX_COURTESY_LENGTH || value.includes('?')) return false;
  return COURTESY_PHRASES.some((phrase) => value.includes(phrase));
}

/** Our bot asked the client to press a button. */
export function isPressHerePrompt(text: string | undefined): boolean {
  return containsText(text, PRESS_HERE_TEXT);
}
