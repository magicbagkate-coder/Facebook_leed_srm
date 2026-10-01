import { isThanksOrRefusal } from '#app/monitor/bot-texts.js';
import { FACEBOOK_SOURCE, TARGET_STATUS, WATCHED_STATUS } from '#app/monitor/monitor.constants.js';
import type { SitniksChat } from '#app/sitniks/sitniks.types.js';

type UnknownRecord = { [key: string]: unknown };

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : undefined;
}

function readPart(body: unknown, key: string): UnknownRecord | undefined {
  const root = asRecord(body);
  return root ? asRecord(root[key]) : undefined;
}

function readText(source: UnknownRecord, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value : '';
}

function readTags(source: UnknownRecord): string[] {
  const value = source.tags;
  return Array.isArray(value) ? value.filter((tag) => typeof tag === 'string') : [];
}

function isNewFacebookComment(chat: UnknownRecord, message: UnknownRecord): boolean {
  return (
    readText(message, 'commentId') !== '' &&
    readText(chat, 'status') === WATCHED_STATUS &&
    readText(chat, 'initialSource') === FACEBOOK_SOURCE
  );
}

function isClientDirect(chat: UnknownRecord, message: UnknownRecord): boolean {
  return (
    readText(chat, 'userId') !== '' &&
    readText(message, 'commentId') === '' &&
    readText(message, 'sentBy') === readText(chat, 'userId')
  );
}

function isFacebookClientReply(chat: UnknownRecord, message: UnknownRecord): boolean {
  return (
    isClientDirect(chat, message) &&
    readText(chat, 'status') === TARGET_STATUS &&
    readText(chat, 'initialSource') === FACEBOOK_SOURCE &&
    !isThanksOrRefusal(readText(message, 'text'))
  );
}

function buildChat(chat: UnknownRecord): SitniksChat {
  return {
    id: readText(chat, 'id'),
    initialSource: readText(chat, 'initialSource'),
    ownerName: readText(chat, 'ownerName'),
    userId: readText(chat, 'userId'),
    userName: readText(chat, 'userName'),
    status: readText(chat, 'status'),
    tags: readTags(chat),
  };
}

/** Returns the chat if the webhook reports a comment in a new Facebook chat, otherwise undefined. */
export function extractNewComment(body: unknown): SitniksChat | undefined {
  const chat = readPart(body, 'chat');
  const message = readPart(body, 'message');
  if (!chat || !message) return undefined;
  return isNewFacebookComment(chat, message) ? buildChat(chat) : undefined;
}

/** Returns the chat if the client wrote in direct in a Facebook chat that is in "Фейсбук". */
export function extractClientReply(body: unknown): SitniksChat | undefined {
  const chat = readPart(body, 'chat');
  const message = readPart(body, 'message');
  if (!chat || !message) return undefined;
  return isFacebookClientReply(chat, message) ? buildChat(chat) : undefined;
}
