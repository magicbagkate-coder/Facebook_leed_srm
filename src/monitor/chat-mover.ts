import type { Logger } from '@nestjs/common';

import { ATTENTION_TAG, PRODUCT_STATUS } from '#app/monitor/monitor.constants.js';
import type { SitniksChat } from '#app/sitniks/sitniks.types.js';
import type { SitniksClient } from '#app/sitniks/sitniks-client.js';

type MoveOptions = {
  sitniks: SitniksClient;
  logger: Logger;
  chat: SitniksChat;
  status: string;
  tags: string[];
  dryRun: boolean;
};

type TagsOptions = {
  sourceTag: string;
  status: string;
};

/** Tags of a move: the tag of the source plus "Внимание" for every move to "Вибір товару". */
export function tagsForMove(options: TagsOptions): string[] {
  return options.status === PRODUCT_STATUS ? [options.sourceTag, ATTENTION_TAG] : [options.sourceTag];
}

/** Adds the missing tags, then changes the chat status. In dry-run mode only logs. */
export async function moveChatTo(options: MoveOptions): Promise<void> {
  const { sitniks, logger, chat, status, tags, dryRun } = options;
  const label = `${chat.userName} (${chat.ownerName}, ${chat.id})`;
  if (dryRun) {
    logger.log(`[dry-run] would move ${label} to "${status}" with tags ${tags.join(', ')}`);
    return;
  }
  const missing = tags.filter((tag) => !chat.tags.includes(tag));
  if (missing.length > 0) {
    await sitniks.setChatTags({ chatId: chat.id, tags: [...chat.tags, ...missing] });
  }
  await sitniks.changeChatStatus({ chatId: chat.id, status });
  logger.log(`Moved ${label} to "${status}"`);
}
