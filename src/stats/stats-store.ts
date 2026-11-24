import { Injectable } from '@nestjs/common';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { appConfig } from '#app/config/app-config.js';
import type { StatsPoint } from '#app/stats/stats.types.js';

const KYIV_TIME_ZONE = 'Europe/Kyiv';

/** The calendar day of a moment in Kyiv, as YYYY-MM-DD. */
export function kyivDay(moment: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: KYIV_TIME_ZONE }).format(moment);
}

/** Keeps every measurement as one JSON line in a file (the project has no database). */
@Injectable()
export class StatsStore {
  async append(point: StatsPoint): Promise<void> {
    await mkdir(dirname(appConfig.statsFile), { recursive: true });
    await appendFile(appConfig.statsFile, `${JSON.stringify(point)}\n`, 'utf8');
  }

  /** Measurements of one Kyiv day, oldest first. */
  async readDay(day: string): Promise<StatsPoint[]> {
    const points = await this.readAll();
    return points.filter((point) => kyivDay(new Date(point.at)) === day);
  }

  private async readAll(): Promise<StatsPoint[]> {
    try {
      const text = await readFile(appConfig.statsFile, 'utf8');
      return text
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line) as StatsPoint);
    } catch {
      return [];
    }
  }
}
