import { Controller, Get, Header, NotFoundException, Param, Query } from '@nestjs/common';

import { appConfig } from '#app/config/app-config.js';
import type { StatsPoint } from '#app/stats/stats.types.js';
import { STATS_PAGE_HTML } from '#app/stats/stats-page.js';
import { kyivDay, StatsStore } from '#app/stats/stats-store.js';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A private page with the chart of the day. The token in the address is the same secret as for the webhook. */
@Controller('stats')
export class StatsController {
  constructor(private readonly store: StatsStore) {}

  @Get(':token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  page(@Param('token') token: string): string {
    this.checkToken(token);
    return STATS_PAGE_HTML;
  }

  @Get(':token/points')
  async points(@Param('token') token: string, @Query('day') day?: string): Promise<StatsPoint[]> {
    this.checkToken(token);
    const wanted = day && DAY_PATTERN.test(day) ? day : kyivDay(new Date());
    return this.store.readDay(wanted);
  }

  private checkToken(token: string): void {
    if (token !== appConfig.webhookToken) throw new NotFoundException();
  }
}
