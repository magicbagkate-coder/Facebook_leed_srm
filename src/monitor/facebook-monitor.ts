import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { appConfig } from '#app/config/app-config.js';
import {
  FACEBOOK_SOURCE,
  RATE_LIMIT_PAUSE_MS,
  TARGET_STATUS,
  WATCHED_STATUS,
} from '#app/monitor/monitor.constants.js';
import type { ChatVerdict, RunOptions } from '#app/monitor/monitor.types.js';
import type { SitniksChat } from '#app/sitniks/sitniks.types.js';
import { SitniksClient } from '#app/sitniks/sitniks-client.js';
import { SitniksError } from '#app/sitniks/sitniks-error.js';

const HTTP_TOO_MANY_REQUESTS = 429;

/**
 * Moves new Facebook chats that have comments but no direct messages
 * from the "Новий" status to the "Фейсбук" status.
 */
@Injectable()
export class FacebookMonitor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FacebookMonitor.name);
  private readonly chatsWithDirect = new Set<string>();
  private timer: NodeJS.Timeout | undefined;
  private isRunning = false;
  private pausedUntil = 0;

  constructor(private readonly sitniks: SitniksClient) {}

  onModuleInit(): void {
    this.logger.log(`Monitor started, dryRun=${appConfig.dryRun}`);
    this.timer = setInterval(() => void this.tick(), appConfig.pollIntervalMs);
    void this.tick();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  /** One scheduled pass: never overlaps with the previous one and pauses after HTTP 429. */
  async tick(): Promise<void> {
    if (this.isBusy()) return;
    this.isRunning = true;
    try {
      await this.runOnce({ dryRun: appConfig.dryRun });
    } catch (error) {
      this.registerFailure(error);
    } finally {
      this.isRunning = false;
    }
  }

  /** Checks all new Facebook chats and returns ids of chats that were (or would be) moved. */
  async runOnce(options: RunOptions): Promise<string[]> {
    const chats = await this.sitniks.listChats({
      status: WATCHED_STATUS,
      initialSource: FACEBOOK_SOURCE,
    });
    const movedIds: string[] = [];
    for (const chat of chats) {
      const isMoved = await this.checkChat({ chat, dryRun: options.dryRun });
      if (isMoved) movedIds.push(chat.id);
    }
    return movedIds;
  }

  private async checkChat(options: { chat: SitniksChat; dryRun: boolean }): Promise<boolean> {
    const { chat } = options;
    if (this.chatsWithDirect.has(chat.id)) return false;
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
      this.logger.log(`[dry-run] would move ${label} to "${TARGET_STATUS}"`);
      return;
    }
    await this.sitniks.changeChatStatus({ chatId: chat.id, status: TARGET_STATUS });
    this.logger.log(`Moved ${label} to "${TARGET_STATUS}"`);
  }

  private isBusy(): boolean {
    return this.isRunning || Date.now() < this.pausedUntil;
  }

  private registerFailure(error: unknown): void {
    this.logger.error(error instanceof Error ? error.message : String(error));
    if (!(error instanceof SitniksError)) return;
    if (error.httpStatus !== HTTP_TOO_MANY_REQUESTS) return;
    this.pausedUntil = Date.now() + RATE_LIMIT_PAUSE_MS;
    this.logger.warn('Rate limited by Sitniks, pausing for 70 seconds');
  }
}
