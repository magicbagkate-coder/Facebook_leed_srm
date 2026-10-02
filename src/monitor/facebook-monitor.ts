import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { appConfig } from '#app/config/app-config.js';
import { moveChatTo } from '#app/monitor/chat-mover.js';
import { isRepliedAfterPrice } from '#app/monitor/instagram-rules.js';
import { JobRunner } from '#app/monitor/job-runner.js';
import {
  FACEBOOK_SOURCE,
  FACEBOOK_TAG,
  NEWEST_MESSAGES,
  PRODUCT_STATUS,
  TARGET_STATUS,
  WATCHED_STATUS,
} from '#app/monitor/monitor.constants.js';
import type { ChatVerdict, RunOptions } from '#app/monitor/monitor.types.js';
import { reviewEach } from '#app/monitor/pass.js';
import type { SitniksChat } from '#app/sitniks/sitniks.types.js';
import { SitniksClient } from '#app/sitniks/sitniks-client.js';

/**
 * New Facebook chats:
 * - a comment and no live direct message from the client -> "Фейсбук" + tag "ФБ";
 * - the client replied after the price button and no manager answered -> "Вибір товару" + tag "ФБ".
 */
@Injectable()
export class FacebookMonitor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FacebookMonitor.name);
  // chat id -> time of its last message when the verdict cannot change without a new message
  private readonly settled = new Map<string, string>();
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

  /** Skips chats already judged (until a new message arrives) or already being reviewed right now. */
  private async checkChat(options: { chat: SitniksChat; dryRun: boolean }): Promise<boolean> {
    const { chat } = options;
    if (this.isSettled(chat) || this.reviewing.has(chat.id)) return false;
    this.reviewing.add(chat.id);
    try {
      return await this.evaluateChat(options);
    } finally {
      this.reviewing.delete(chat.id);
    }
  }

  private async evaluateChat(options: { chat: SitniksChat; dryRun: boolean }): Promise<boolean> {
    const { chat, dryRun } = options;
    const verdict = await this.judgeChat(chat);
    if (verdict === 'has-direct') this.settled.set(chat.id, chat.lastMessageCreatedAt ?? '');
    const status = this.targetStatus(verdict);
    if (!status) return false;
    await moveChatTo({
      sitniks: this.sitniks,
      logger: this.logger,
      chat,
      status,
      tag: FACEBOOK_TAG,
      dryRun,
    });
    return true;
  }

  private targetStatus(verdict: ChatVerdict): string | undefined {
    if (verdict === 'move') return TARGET_STATUS;
    return verdict === 'replied' ? PRODUCT_STATUS : undefined;
  }

  private isSettled(chat: SitniksChat): boolean {
    const key = chat.lastMessageCreatedAt;
    return key !== undefined && this.settled.get(chat.id) === key;
  }

  /**
   * The client replied after the price button -> "replied". Otherwise a comment and no live
   * direct message from the client -> "move" (messages written only by our side do not count).
   */
  private async judgeChat(chat: SitniksChat): Promise<ChatVerdict> {
    const messages = await this.sitniks.latestMessages({ chatId: chat.id, limit: NEWEST_MESSAGES });
    if (isRepliedAfterPrice({ messages, userId: chat.userId })) return 'replied';
    const hasClientDirect = await this.sitniks.hasClientMessage({
      chatId: chat.id,
      userId: chat.userId,
    });
    if (hasClientDirect) return 'has-direct';
    const hasComments = await this.sitniks.hasMessages({ chatId: chat.id, isComment: true });
    return hasComments ? 'move' : 'no-comments';
  }
}
