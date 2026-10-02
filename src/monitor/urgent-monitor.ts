import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { appConfig } from '#app/config/app-config.js';
import { judgeWaiting, type WaitVerdict } from '#app/monitor/instagram-rules.js';
import { JobRunner } from '#app/monitor/job-runner.js';
import {
  FACEBOOK_SOURCE,
  INSTAGRAM_SOURCE,
  NEWEST_MESSAGES,
  PRODUCT_STATUS,
  URGENT_INTERVAL_MS,
  URGENT_LOOKBACK_MS,
  URGENT_MAX_CHECKS,
  URGENT_SCAN_DELAY_MS,
  URGENT_TAG,
  WATCHED_STATUS,
} from '#app/monitor/monitor.constants.js';
import { reviewEach } from '#app/monitor/pass.js';
import type { SitniksChat } from '#app/sitniks/sitniks.types.js';
import { SitniksClient } from '#app/sitniks/sitniks-client.js';

const WATCHED_STATUSES = [WATCHED_STATUS, PRODUCT_STATUS];
const SOURCES = [INSTAGRAM_SOURCE, FACEBOOK_SOURCE];

type Budget = {
  left: number;
};

/**
 * Leads that wait for a manager: the client wrote a real message, nobody answered for 30 minutes.
 * Such chats get the tag "СРОЧНО"; the status is not changed.
 */
@Injectable()
export class UrgentMonitor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UrgentMonitor.name);
  // chat id -> time of its last message when the verdict cannot change without a new message
  private readonly settled = new Map<string, string>();
  private readonly runner = new JobRunner({
    name: 'UrgentScan',
    intervalMs: URGENT_INTERVAL_MS,
    firstRunDelayMs: URGENT_SCAN_DELAY_MS,
    lane: 'low',
    run: (): Promise<unknown> => this.tagWaitingChats(),
  });

  constructor(private readonly sitniks: SitniksClient) {}

  onModuleInit(): void {
    this.logger.log(`Urgent monitor started, dryRun=${appConfig.urgentDryRun}`);
    this.runner.start();
  }

  onModuleDestroy(): void {
    this.runner.stop();
  }

  /** Returns ids of chats that were (or would be) tagged. */
  async tagWaitingChats(): Promise<string[]> {
    const chats = await this.collectChats();
    const budget: Budget = { left: URGENT_MAX_CHECKS };
    const result = await reviewEach({
      chats,
      logger: this.logger,
      review: (chat) => this.reviewChat({ chat, budget }),
    });
    return result.movedIds;
  }

  private async collectChats(): Promise<SitniksChat[]> {
    const startDate = new Date(Date.now() - URGENT_LOOKBACK_MS).toISOString();
    const byId = new Map<string, SitniksChat>();
    for (const status of WATCHED_STATUSES) {
      for (const initialSource of SOURCES) {
        const chats = await this.sitniks.listChats({ status, initialSource, startDate });
        chats.forEach((chat) => byId.set(chat.id, chat));
      }
    }
    return [...byId.values()];
  }

  private async reviewChat(options: { chat: SitniksChat; budget: Budget }): Promise<boolean> {
    const { chat, budget } = options;
    if (this.isSettled(chat) || budget.left <= 0) return false;
    budget.left -= 1;
    if ((await this.readVerdict(chat)) !== 'urgent') return false;
    await this.tagChat(chat);
    return true;
  }

  /** A final verdict is remembered, so the chat is read again only after a new message. */
  private async readVerdict(chat: SitniksChat): Promise<WaitVerdict> {
    const messages = await this.sitniks.latestMessages({ chatId: chat.id, limit: NEWEST_MESSAGES });
    const verdict = judgeWaiting({ messages, userId: chat.userId, nowMs: Date.now() });
    if (verdict !== 'young') this.settled.set(chat.id, chat.lastMessageCreatedAt ?? '');
    return verdict;
  }

  private isSettled(chat: SitniksChat): boolean {
    if (chat.tags.includes(URGENT_TAG)) return true;
    const key = chat.lastMessageCreatedAt;
    return key !== undefined && this.settled.get(chat.id) === key;
  }

  private async tagChat(chat: SitniksChat): Promise<void> {
    const label = `${chat.userName} (${chat.ownerName}, ${chat.status}, ${chat.id})`;
    if (appConfig.urgentDryRun) {
      this.logger.log(`[dry-run] would tag "${URGENT_TAG}": ${label}`);
      return;
    }
    await this.sitniks.setChatTags({ chatId: chat.id, tags: [...chat.tags, URGENT_TAG] });
    this.logger.log(`Tagged "${URGENT_TAG}": ${label}`);
  }
}
