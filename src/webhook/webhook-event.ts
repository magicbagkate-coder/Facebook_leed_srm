import { FACEBOOK_SOURCE, WATCHED_STATUS } from '#app/monitor/monitor.constants.js';
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

/** Returns the chat if the webhook reports a comment in a new Facebook chat, otherwise undefined. */
export function extractNewComment(body: unknown): SitniksChat | undefined {
  const chat = readPart(body, 'chat');
  const message = readPart(body, 'message');
  if (!chat || !message) return undefined;
  if (!isNewFacebookComment(chat, message)) return undefined;
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
