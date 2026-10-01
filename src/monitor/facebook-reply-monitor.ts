import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { appConfig } from '#app/config/app-config.js';
import { moveChatTo } from '#app/monitor/chat-mover.js';
import { isClientLast } from '#app/monitor/instagram-rules.js';
import { JobRunner } from '#app/monitor/job-runner.js';
import {
  BOT_FLOW_INTERVAL_MS,
  FACEBOOK_SOURCE,
  FACEBOOK_TAG,
  PRODUCT_STATUS,
  TARGET_STATUS,
} from '#app/monitor/monitor.constants.js';
import { reviewEach, scanStartIso } from '#app/monitor/pass.js';
import type { SitniksChat } from '#app/sitniks/sitniks.types.js';
import { SitniksClient } from '#app/sitniks/sitniks-client.js';

/**
 * Facebook chats in "Фейсбук": when the client writes in direct ("бажаю замовити",
 * "побачити інші моделі", anything), the chat moves to "Вибір товару".
 * Webhooks react at once; a scan every 5 minutes is the fallback.
 */
@Injectable()
export class FacebookReplyMonitor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FacebookReplyMonitor.name);
  private lastScanAt = 0;
  private readonly runner = new JobRunner({
    name: 'FacebookReplyScan',
    intervalMs: BOT_FLOW_INTERVAL_MS,
    run: (): Promise<unknown> => this.moveRepliedChats(),
  });

  constructor(private readonly sitniks: SitniksClient) {}

  onModuleInit(): void {
    this.runner.start();
  }

  onModuleDestroy(): void {
    this.runner.stop();
  }

  /** Looks at chats with recent activity: a client reply always changes the last message time. */
  async moveRepliedChats(): Promise<string[]> {
    const scanStartedAt = Date.now();
    const chats = await this.sitniks.listChats({
      status: TARGET_STATUS,
      initialSource: FACEBOOK_SOURCE,
      startDate: scanStartIso(this.lastScanAt),
    });
    const result = await reviewEach({
      chats,
      logger: this.logger,
      review: (chat) => this.reviewReplied(chat),
    });
    if (result.failedCount === 0) this.lastScanAt = scanStartedAt;
    return result.movedIds;
  }

  private async reviewReplied(chat: SitniksChat): Promise<boolean> {
    const messages = await this.sitniks.latestMessages({ chatId: chat.id, limit: 1 });
    if (!isClientLast({ messages, userId: chat.userId })) return false;
    await this.moveChat(chat);
    return true;
  }

  /** The webhook already says that the client wrote in direct, so no extra check is needed. */
  async reviewReply(chat: SitniksChat): Promise<void> {
    try {
      await this.moveChat(chat);
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }

  private async moveChat(chat: SitniksChat): Promise<void> {
    await moveChatTo({
      sitniks: this.sitniks,
      logger: this.logger,
      chat,
      status: PRODUCT_STATUS,
      tag: FACEBOOK_TAG,
      dryRun: appConfig.dryRun,
    });
  }
}
