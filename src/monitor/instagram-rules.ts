import { isButtonOrLike, isPressHerePrompt, isPriceButton, isThanksOrRefusal } from '#app/monitor/bot-texts.js';
import { NEWEST_MESSAGES, SILENCE_MS } from '#app/monitor/monitor.constants.js';
import type { SitniksMessage } from '#app/sitniks/sitniks.types.js';

type Sender = 'client' | 'manager' | 'page';

type BotWaitingOptions = {
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

/**
 * The newest messages are only from the page or bot. They start either a chat that consists
 * of bot messages only, or a flow where the client pressed the price button.
 */
function isBotFlow(options: LatestSenderOptions): boolean {
  const { messages, userId } = options;
  const starterIndex = messages.findIndex((message) => senderOf(message, userId) !== 'page');
  if (starterIndex === -1) return messages.length < NEWEST_MESSAGES;
  return senderOf(messages[starterIndex], userId) === 'client' && isPriceButton(messages[starterIndex].text);
}

/** Our bot wrote last: the "press here" prompt counts even after a dialog with a manager, other bot messages only inside a price flow. */
function isBotLast(options: LatestSenderOptions): boolean {
  const { messages, userId } = options;
  if (senderOf(messages[0], userId) !== 'page') return false;
  return isPressHerePrompt(messages[0].text) || isBotFlow(options);
}

/** The client pressed the price button and our bot has not answered yet. */
function isUnansweredPriceClick(options: LatestSenderOptions): boolean {
  const [latest] = options.messages;
  return senderOf(latest, options.userId) === 'client' && isPriceButton(latest.text);
}

/**
 * Rule 1: nothing has happened for SILENCE_MS and either our bot wrote last (and the client
 * did not react) or the client pressed the price button and got no answer.
 * Messages are ordered newest first.
 */
export function isBotWaiting(options: BotWaitingOptions): boolean {
  const { messages, userId, nowMs } = options;
  if (messages.length === 0) return false;
  if (nowMs - Date.parse(messages[0].createdAt) < SILENCE_MS) return false;
  return isBotLast({ messages, userId }) || isUnansweredPriceClick({ messages, userId });
}

/**
 * Rule 2: the newest message was written by the client and is a real reply: not the price
 * button, not a like and not just thanks or a refusal.
 */
export function isClientLast(options: LatestSenderOptions): boolean {
  const [latest] = options.messages;
  return (
    latest !== undefined &&
    senderOf(latest, options.userId) === 'client' &&
    !isButtonOrLike(latest) &&
    !isThanksOrRefusal(latest.text)
  );
}
