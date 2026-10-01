import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { appConfig } from '#app/config/app-config.js';
import { JobRunner } from '#app/monitor/job-runner.js';
import {
  FACEBOOK_SOURCE,
  FACEBOOK_TAG,
  TARGET_STATUS,
  WATCHED_STATUS,
} from '#app/monitor/monitor.constants.js';
import type { ChatVerdict, RunOptions } from '#app/monitor/monitor.types.js';
import { reviewEach } from '#app/monitor/pass.js';
import type { SitniksChat } from '#app/sitniks/sitniks.types.js';
import { SitniksClient } from '#app/sitniks/sitniks-client.js';

/**
 * Moves new Facebook chats that have comments but no direct messages
 * from the "Новий" status to the "Фейсбук" status.
 */
@Injectable()
export class FacebookMonitor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FacebookMonitor.name);
  private readonly chatsWithDirect = new Set<string>();
  private readonly reviewing = new Set<string>();
  private readonly runner = new JobRunner({
    name: 'FacebookScan',
    intervalMs: appConfig.pollIntervalMs,
    run: (): Promise<unknown> => this.runOnce({ dryRun: appConfig.dryRun }),
  });

  constructor(private readonly sitniks: SitniksClient) {}

  onModuleInit(): void {
    this.logger.log(`Monitor started, dryRun=${appConfig.dryRun}`);
    this.runner.start();
  }

  onModuleDestroy(): void {
    this.runner.stop();
  }

  /** Checks all new Facebook chats and returns ids of chats that were (or would be) moved. */
  async runOnce(options: RunOptions): Promise<string[]> {
    const chats = await this.sitniks.listChats({
      status: WATCHED_STATUS,
      initialSource: FACEBOOK_SOURCE,
    });
    const result = await reviewEach({
      chats,
      logger: this.logger,
      review: (chat) => this.checkChat({ chat, dryRun: options.dryRun }),
    });
    return result.movedIds;
  }

  /** Reviews one chat reported by a webhook; errors are logged and never thrown. */
  async reviewChat(chat: SitniksChat): Promise<void> {
    try {
      await this.checkChat({ chat, dryRun: appConfig.dryRun });
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    }
  }

  /** Skips chats already known to have client messages or already being reviewed right now. */
  private async checkChat(options: { chat: SitniksChat; dryRun: boolean }): Promise<boolean> {
    const { chat } = options;
    if (this.chatsWithDirect.has(chat.id) || this.reviewing.has(chat.id)) return false;
    this.reviewing.add(chat.id);
    try {
      return await this.evaluateChat(options);
    } finally {
      this.reviewing.delete(chat.id);
    }
  }

  private async evaluateChat(options: { chat: SitniksChat; dryRun: boolean }): Promise<boolean> {
    const { chat } = options;
    const verdict = await this.judgeChat(chat);
    if (verdict === 'has-direct') this.chatsWithDirect.add(chat.id);
    if (verdict !== 'move') return false;
    await this.moveChat(options);
    return true;
  }

  /** Direct messages written only by our side count as "no direct messages". */
  private async judgeChat(chat: SitniksChat): Promise<ChatVerdict> {
    const hasClientDirect = await this.sitniks.hasClientMessage({
      chatId: chat.id,
      userId: chat.userId,
    });
    if (hasClientDirect) return 'has-direct';
    const hasComments = await this.sitniks.hasMessages({ chatId: chat.id, isComment: true });
    return hasComments ? 'move' : 'no-comments';
  }

  private async moveChat(options: { chat: SitniksChat; dryRun: boolean }): Promise<void> {
    const { chat, dryRun } = options;
    const label = `${chat.userName} (${chat.ownerName}, ${chat.id})`;
    if (dryRun) {
      this.logger.log(`[dry-run] would tag "${FACEBOOK_TAG}" and move ${label} to "${TARGET_STATUS}"`);
      return;
    }
    // Tag first: if the status change fails, the chat stays in "Новий" and is retried
    if (!chat.tags.includes(FACEBOOK_TAG)) {
      await this.sitniks.setChatTags({ chatId: chat.id, tags: [...chat.tags, FACEBOOK_TAG] });
    }
    await this.sitniks.changeChatStatus({ chatId: chat.id, status: TARGET_STATUS });
    this.logger.log(`Moved ${label} to "${TARGET_STATUS}"`);
  }
}
