import {
  isButtonOrLike,
  isManagerHandoff,
  isPressHerePrompt,
  isPriceButton,
  isThanksOrRefusal,
} from '#app/monitor/bot-texts.js';
import {
  DIALOG_WINDOW_MS,
  NEWEST_MESSAGES,
  SILENCE_MS,
} from '#app/monitor/monitor.constants.js';
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
  nowMs?: number;
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
  const { userId, nowMs } = options;
  const messages = recentMessages(options.messages, nowMs);
  if (messages.length === 0) return false;
  if (nowMs - Date.parse(messages[0].createdAt) < SILENCE_MS) return false;
  return isBotLast({ messages, userId }) || isUnansweredPriceClick({ messages, userId });
}

function isRealReply(message: SitniksMessage, userId: string): boolean {
  return senderOf(message, userId) === 'client' && !isButtonOrLike(message) && !isThanksOrRefusal(message.text);
}

/** Keeps only the messages of the last 24 hours, so an old dialog never affects a chat today. */
export function recentMessages(messages: SitniksMessage[], nowMs: number): SitniksMessage[] {
  return messages.filter((message) => nowMs - Date.parse(message.createdAt) <= DIALOG_WINDOW_MS);
}

/**
 * Rule 3 (chat in "Новий"): after the latest price button press the client wrote a real reply
 * (not thanks, not a refusal) and no manager has answered since. Messages are ordered newest first.
 */
export function isRepliedAfterPrice(options: LatestSenderOptions): boolean {
  const { userId } = options;
  const messages = recentMessages(options.messages, options.nowMs ?? Date.now());
  const pressIndex = messages.findIndex((message) => senderOf(message, userId) === 'client' && isPriceButton(message.text));
  if (pressIndex === -1) return false;
  const afterPress = messages.slice(0, pressIndex);
  if (afterPress.some((message) => senderOf(message, userId) === 'manager')) return false;
  return afterPress.some((message) => isRealReply(message, userId));
}

/**
 * Our bot handed the client over to a manager in the last 24 hours and no manager has answered since.
 * The client may have written after the handoff ("Чекаю"): the chat still waits for a manager.
 */
export function isBotHandoffPending(options: LatestSenderOptions): boolean {
  const { userId } = options;
  const messages = recentMessages(options.messages, options.nowMs ?? Date.now());
  const handoffIndex = messages.findIndex((message) => senderOf(message, userId) === 'page' && isManagerHandoff(message.text));
  if (handoffIndex === -1) return false;
  return !messages.slice(0, handoffIndex).some((message) => senderOf(message, userId) === 'manager');
}

/** A chat in "Новий" must go to "Вибір товару": a reply after the price button or a bot handoff to a manager. */
export function needsChoiceFromNew(options: LatestSenderOptions): boolean {
  return isRepliedAfterPrice(options) || isBotHandoffPending(options);
}

/**
 * The client wrote a real reply in the last 24 hours, even if a manager has already answered it.
 * A new press of the price button starts a new flow, so only the messages after the latest press count.
 */
export function hasRealClientReply(options: LatestSenderOptions): boolean {
  const { userId } = options;
  const messages = recentMessages(options.messages, options.nowMs ?? Date.now());
  const pressIndex = messages.findIndex((message) => senderOf(message, userId) === 'client' && isPriceButton(message.text));
  const flow = pressIndex === -1 ? messages : messages.slice(0, pressIndex);
  return flow.some((message) => isRealReply(message, userId));
}

/**
 * A chat in "Новий БОТ" or "Фейсбук" must go to "Вибір товару": the client wrote a real reply
 * (a manager may have answered it faster than our scan), or the cases above.
 */
export function needsChoiceFromBot(options: LatestSenderOptions): boolean {
  return isClientLast(options) || hasRealClientReply(options) || needsChoiceFromNew(options);
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
