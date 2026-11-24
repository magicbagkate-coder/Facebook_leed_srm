import { NotFoundException } from '@nestjs/common';

import { StatsController } from '#app/stats/stats.controller.js';
import type { StatsPoint } from '#app/stats/stats.types.js';
import type { StatsStore } from '#app/stats/stats-store.js';

const point: StatsPoint = {
  at: '2026-11-24T10:00:00.000Z',
  newChats: { total: 5, unanswered: 1 },
  productChoice: { total: 7, unanswered: 2 },
};

describe('StatsController', () => {
  const requestedDays: string[] = [];
  const store = {
    readDay: async (day: string): Promise<StatsPoint[]> => {
      requestedDays.push(day);
      return [point];
    },
  } as unknown as StatsStore;
  const controller = new StatsController(store);

  it('refuses a wrong token', async () => {
    expect(() => controller.page('wrong')).toThrow(NotFoundException);
    await expect(controller.points('wrong')).rejects.toThrow(NotFoundException);
  });

  it('serves the page and the points of the requested day', async () => {
    expect(controller.page('test-token')).toContain('chart.js');
    expect(await controller.points('test-token', '2026-11-24')).toEqual([point]);
    expect(requestedDays).toEqual(['2026-11-24']);
  });

  it('falls back to today when the day is not a valid date', async () => {
    await controller.points('test-token', 'abc');
    expect(requestedDays[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
