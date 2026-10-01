import { PRESS_HERE_TEXT, PRICE_BUTTON_TEXT } from '#app/monitor/monitor.constants.js';

function containsText(text: string | undefined, part: string): boolean {
  return (text ?? '').toLowerCase().includes(part);
}

/** The client pressed the price button of our bot, it is not a live message. */
export function isPriceButton(text: string | undefined): boolean {
  return containsText(text, PRICE_BUTTON_TEXT);
}

/** Our bot asked the client to press a button. */
export function isPressHerePrompt(text: string | undefined): boolean {
  return containsText(text, PRESS_HERE_TEXT);
}
