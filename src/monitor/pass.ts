import type { Logger } from '@nestjs/common';

import { BOT_FIRST_LOOKBACK_MS, BOT_OVERLAP_MS } from '#app/monitor/monitor.constants.js';
import type { SitniksChat } from '#app/sitniks/sitniks.types.js';

type ReviewEachOptions = {
  chats: SitniksChat[];
  logger: Logger;
  review: (chat: SitniksChat) => Promise<boolean>;
};

export type PassResult = {
  movedIds: string[];
  failedCount: number;
};

/**
 * Reviews every chat of a pass. An error in one chat is logged and does not stop the others.
 * `review` returns true when the chat was (or would be) moved.
 */
export async function reviewEach(options: ReviewEachOptions): Promise<PassResult> {
  const movedIds: string[] = [];
  let failedCount = 0;
  for (const chat of options.chats) {
    try {
      if (await options.review(chat)) movedIds.push(chat.id);
    } catch (error) {
      failedCount += 1;
      const reason = error instanceof Error ? error.message : String(error);
      options.logger.error(`Chat ${chat.id} (${chat.userName}) failed: ${reason}`);
    }
  }
  return { movedIds, failedCount };
}

/**
 * Start of the activity window for a scan: the last fully successful scan minus an overlap,
 * but never further back than the first-scan lookback, so a failing chat cannot grow the window forever.
 */
export function scanStartIso(lastScanAt: number): string {
  const start = Math.max(lastScanAt - BOT_OVERLAP_MS, Date.now() - BOT_FIRST_LOOKBACK_MS);
  return new Date(start).toISOString();
}
