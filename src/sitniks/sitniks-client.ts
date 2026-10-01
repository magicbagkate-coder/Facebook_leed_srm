import { Injectable } from '@nestjs/common';

import { appConfig } from '#app/config/app-config.js';
import { RATE_LIMIT_PAUSE_MS } from '#app/monitor/monitor.constants.js';
import type {
  ChangeStatusOptions,
  ChatListResponse,
  ChatMessagesResponse,
  ClientMessageOptions,
  HasMessagesOptions,
  LatestMessagesOptions,
  ListChatsOptions,
  SetTagsOptions,
  SitniksChat,
  SitniksMessage,
  SitniksRequest,
} from '#app/sitniks/sitniks.types.js';
import { SitniksError } from '#app/sitniks/sitniks-error.js';

// Chat endpoints allow 10 requests per 10 seconds; keep a safe gap between all requests
const REQUEST_GAP_MS = 1_500;
const PAGE_SIZE = 50;
const HTTP_TOO_MANY_REQUESTS = 429;

@Injectable()
export class SitniksClient {
  private nextSlotAt = 0;
  private blockedUntil = 0;

  async listChats(options: ListChatsOptions): Promise<SitniksChat[]> {
    const chats: SitniksChat[] = [];
    let isLastPage: boolean;
    do {
      const query = new URLSearchParams({
        status: options.status,
        initialSource: options.initialSource,
        skip: String(chats.length),
        limit: String(PAGE_SIZE),
      });
      if (options.startDate) query.set('startDate', options.startDate);
      const page = await this.getJson<ChatListResponse>({ method: 'GET', path: '/chats', query });
      chats.push(...page.data);
      isLastPage = page.data.length === 0 || chats.length >= page.count;
    } while (!isLastPage);
    return chats;
  }

  async hasMessages(options: HasMessagesOptions): Promise<boolean> {
    const query = new URLSearchParams({ limit: '1', isComment: String(options.isComment) });
    const path = `/chats/${options.chatId}/messages`;
    const page = await this.getJson<ChatMessagesResponse>({ method: 'GET', path, query });
    return page.data.length > 0;
  }

  /** Newest direct messages first (the API returns the newest message at index 0). */
  async latestMessages(options: LatestMessagesOptions): Promise<SitniksMessage[]> {
    const query = new URLSearchParams({ limit: String(options.limit) });
    const path = `/chats/${options.chatId}/messages`;
    const page = await this.getJson<ChatMessagesResponse>({ method: 'GET', path, query });
    return page.data;
  }

  /** True if the client wrote at least one direct message; messages from our side are ignored. */
  async hasClientMessage(options: ClientMessageOptions): Promise<boolean> {
    const path = `/chats/${options.chatId}/messages`;
    let skip = 0;
    let page: ChatMessagesResponse;
    do {
      const query = new URLSearchParams({ limit: String(PAGE_SIZE), skip: String(skip) });
      page = await this.getJson<ChatMessagesResponse>({ method: 'GET', path, query });
      if (page.data.some((message) => message.sentBy === options.userId)) return true;
      skip += page.data.length;
    } while (page.data.length === PAGE_SIZE);
    return false;
  }

  /** Replaces the whole tag list of the chat, so pass the existing tags too. */
  async setChatTags(options: SetTagsOptions): Promise<void> {
    await this.send({
      method: 'PUT',
      path: `/chats/${options.chatId}`,
      body: JSON.stringify({ tags: options.tags }),
    });
  }

  async changeChatStatus(options: ChangeStatusOptions): Promise<void> {
    await this.send({
      method: 'PATCH',
      path: `/chats/${options.chatId}/status`,
      body: JSON.stringify({ status: options.status }),
    });
  }

  private async getJson<T>(request: SitniksRequest): Promise<T> {
    const response = await this.send(request);
    return (await response.json()) as T;
  }

  private async send(request: SitniksRequest): Promise<Response> {
    this.assertNotBlocked();
    await this.waitTurn();
    const url = new URL(appConfig.sitniksBaseUrl + request.path);
    if (request.query) url.search = request.query.toString();
    const response = await fetch(url, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${appConfig.sitniksApiKey}`,
        'Content-Type': 'application/json',
      },
      body: request.body,
    });
    this.rememberRateLimit(response.status);
    if (!response.ok) {
      throw new SitniksError(`${request.method} ${request.path} failed with ${response.status}`, response.status);
    }
    return response;
  }

  /** After a 429 the API blocks the key for a minute, so we stop sending requests meanwhile. */
  private assertNotBlocked(): void {
    if (Date.now() >= this.blockedUntil) return;
    throw new SitniksError('Paused after rate limit', HTTP_TOO_MANY_REQUESTS);
  }

  private rememberRateLimit(httpStatus: number): void {
    if (httpStatus !== HTTP_TOO_MANY_REQUESTS) return;
    this.blockedUntil = Date.now() + RATE_LIMIT_PAUSE_MS;
  }

  private async waitTurn(): Promise<void> {
    const now = Date.now();
    const startAt = Math.max(now, this.nextSlotAt);
    this.nextSlotAt = startAt + REQUEST_GAP_MS;
    if (startAt === now) return;
    await new Promise<void>((resolve) => setTimeout(resolve, startAt - now));
  }
}
