import { PRICE_BUTTON_TEXT, SILENCE_MS } from '#app/monitor/monitor.constants.js';
import type { SitniksMessage } from '#app/sitniks/sitniks.types.js';

type Sender = 'client' | 'manager' | 'page';

type PriceFlowOptions = {
  messages: SitniksMessage[];
  userId: string;
  nowMs: number;
};

type LatestSenderOptions = {
  messages: SitniksMessage[];
  userId: string;
};

/** The client has the id of the chat user, a manager has a name, everything else is our page or bot. */
function senderOf(message: SitniksMessage, userId: string): Sender {
  if (message.sentBy === userId) return 'client';
  return message.managerName ? 'manager' : 'page';
}

function isPriceButton(text: string | undefined): boolean {
  return (text ?? '').toLowerCase().includes(PRICE_BUTTON_TEXT);
}

/**
 * Rule 1: the client pressed "дізнатись ціну", got our price reply (messages from the page
 * or bot only) and has been silent for SILENCE_MS since our last message.
 * Messages are ordered newest first.
 */
export function isSilentAfterPrice(options: PriceFlowOptions): boolean {
  const { messages, userId, nowMs } = options;
  const triggerIndex = messages.findIndex((message) => senderOf(message, userId) !== 'page');
  if (triggerIndex < 1) return false;
  const trigger = messages[triggerIndex];
  if (senderOf(trigger, userId) !== 'client' || !isPriceButton(trigger.text)) return false;
  return nowMs - Date.parse(messages[0].createdAt) >= SILENCE_MS;
}

/** Rule 2: the newest message in the chat was written by the client (text or a button press). */
export function isClientLast(options: LatestSenderOptions): boolean {
  const [latest] = options.messages;
  return latest !== undefined && senderOf(latest, options.userId) === 'client';
}
