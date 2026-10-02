import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { appConfig } from '#app/config/app-config.js';
import { moveChatTo } from '#app/monitor/chat-mover.js';
import { isBotWaiting, isClientLast, isRepliedAfterPrice } from '#app/monitor/instagram-rules.js';
import { JobRunner } from '#app/monitor/job-runner.js';
import {
  BOT_FLOW_INTERVAL_MS,
  BOT_SCAN_DELAY_MS,
  INSTAGRAM_SOURCE,
  NEW_BOT_STATUS,
  NEW_BOT_TAG,
  NEWEST_MESSAGES,
  PRODUCT_STATUS,
  START_FLOW_INTERVAL_MS,
  WATCHED_STATUS,
} from '#app/monitor/monitor.constants.js';
import { reviewEach, scanStartIso } from '#app/monitor/pass.js';
import type { SitniksChat } from '#app/sitniks/sitniks.types.js';
import { SitniksClient } from '#app/sitniks/sitniks-client.js';

/**
 * Instagram rules:
 * 1. "Новий": our bot wrote last (price reply or "press here") and the client stayed silent -> "Новий БОТ" + tag "НБ".
 * 1b. "Новий": after the price button the client wrote a real reply and no manager answered -> "Вибір товару" + tag "НБ".
 * 2. "Новий БОТ": the client wrote or pressed something -> "Вибір товару" (tag "НБ" is added if missing).
 */
@Injectable()
export class InstagramMonitor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InstagramMonitor.name);
  private lastBotScanAt = 0;
  private readonly runners: JobRunner[] = [
    new JobRunner({
      name: 'InstagramStartFlow',
      intervalMs: START_FLOW_INTERVAL_MS,
      run: (): Promise<unknown> => this.moveSilentChats(),
    }),
    new JobRunner({
      name: 'InstagramBotFlow',
      intervalMs: BOT_FLOW_INTERVAL_MS,
      firstRunDelayMs: BOT_SCAN_DELAY_MS,
      lane: 'low',
      run: (): Promise<unknown> => this.moveRepliedChats(),
    }),
  ];

  constructor(private readonly sitniks: SitniksClient) {}

  onModuleInit(): void {
    this.logger.log(`Instagram monitor started, dryRun=${appConfig.instagramDryRun}`);
    this.runners.forEach((runner) => runner.start());
  }

  onModuleDestroy(): void {
    this.runners.forEach((runner) => runner.stop());
  }

  /** Rule 1. Returns ids of chats that were (or would be) moved. */
  async moveSilentChats(): Promise<string[]> {
    const chats = await this.sitniks.listChats({
      status: WATCHED_STATUS,
      initialSource: INSTAGRAM_SOURCE,
    });
    const result = await reviewEach({
      chats,
      logger: this.logger,
      review: (chat) => this.reviewSilent(chat),
    });
    return result.movedIds;
  }

  /**
   * Rule 2. Looks only at chats with recent activity: a client reply always changes the last message time.
   * The activity window moves forward only after a pass without errors, so a failed chat is retried.
   */
  async moveRepliedChats(): Promise<string[]> {
    const scanStartedAt = Date.now();
    const chats = await this.sitniks.listChats({
      status: NEW_BOT_STATUS,
      initialSource: INSTAGRAM_SOURCE,
      startDate: scanStartIso(this.lastBotScanAt),
    });
    const result = await reviewEach({
      chats,
      logger: this.logger,
      review: (chat) => this.reviewReplied(chat),
    });
    if (result.failedCount === 0) this.lastBotScanAt = scanStartedAt;
    return result.movedIds;
  }

  private async reviewSilent(chat: SitniksChat): Promise<boolean> {
    const messages = await this.sitniks.latestMessages({ chatId: chat.id, limit: NEWEST_MESSAGES });
    if (isRepliedAfterPrice({ messages, userId: chat.userId })) {
      await this.moveChat({ chat, status: PRODUCT_STATUS });
      return true;
    }
    if (!isBotWaiting({ messages, userId: chat.userId, nowMs: Date.now() })) return false;
    await this.moveChat({ chat, status: NEW_BOT_STATUS });
    return true;
  }

  private async reviewReplied(chat: SitniksChat): Promise<boolean> {
    const messages = await this.sitniks.latestMessages({ chatId: chat.id, limit: 1 });
    if (!isClientLast({ messages, userId: chat.userId })) return false;
    await this.moveChat({ chat, status: PRODUCT_STATUS });
    return true;
  }

  private async moveChat(options: { chat: SitniksChat; status: string }): Promise<void> {
    await moveChatTo({
      sitniks: this.sitniks,
      logger: this.logger,
      chat: options.chat,
      status: options.status,
      tag: NEW_BOT_TAG,
      dryRun: appConfig.instagramDryRun,
    });
  }
}
