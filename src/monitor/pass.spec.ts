import { Logger } from '@nestjs/common';

import { reviewEach } from '#app/monitor/pass.js';
import type { SitniksChat } from '#app/sitniks/sitniks.types.js';

function buildChat(id: string): SitniksChat {
  return { id, initialSource: 'facebook', ownerName: 'Page', userId: 'u', userName: id, status: 'Новий', tags: [] };
}

describe('reviewEach', () => {
  it('keeps reviewing the other chats after one chat fails', async () => {
    const chats = [buildChat('a'), buildChat('broken'), buildChat('c')];
    const result = await reviewEach({
      chats,
      logger: new Logger('Test'),
      review: async (chat): Promise<boolean> => {
        if (chat.id === 'broken') throw new Error('404');
        return true;
      },
    });
    expect(result.movedIds).toEqual(['a', 'c']);
    expect(result.failedCount).toBe(1);
  });
});
