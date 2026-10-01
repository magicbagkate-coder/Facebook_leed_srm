import type { Logger } from '@nestjs/common';

import type { SitniksChat } from '#app/sitniks/sitniks.types.js';
import type { SitniksClient } from '#app/sitniks/sitniks-client.js';

type MoveOptions = {
  sitniks: SitniksClient;
  logger: Logger;
  chat: SitniksChat;
  status: string;
  tag: string;
  dryRun: boolean;
};

/** Adds the tag if it is missing, then changes the chat status. In dry-run mode only logs. */
export async function moveChatTo(options: MoveOptions): Promise<void> {
  const { sitniks, logger, chat, status, tag, dryRun } = options;
  const label = `${chat.userName} (${chat.ownerName}, ${chat.id})`;
  if (dryRun) {
    logger.log(`[dry-run] would move ${label} to "${status}" with tag "${tag}"`);
    return;
  }
  if (!chat.tags.includes(tag)) {
    await sitniks.setChatTags({ chatId: chat.id, tags: [...chat.tags, tag] });
  }
  await sitniks.changeChatStatus({ chatId: chat.id, status });
  logger.log(`Moved ${label} to "${status}"`);
}
