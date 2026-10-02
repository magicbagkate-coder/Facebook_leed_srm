import { Logger } from '@nestjs/common';

import { laneStorage, type RequestLane } from '#app/sitniks/request-lane.js';

type JobOptions = {
  name: string;
  intervalMs: number;
  run: () => Promise<unknown>;
  // Heavy jobs start later, so that after a restart they do not block the urgent 30-second checks
  firstRunDelayMs?: number;
  // Heavy background scans use the "low" lane, so urgent jobs get the request queue first
  lane?: RequestLane;
};

export type JobReport = {
  name: string;
  intervalSeconds: number;
  passes: number;
  skippedPasses: number;
  lastSuccessAgoSeconds: number | null;
  lastDurationSeconds: number | null;
  lastError: string | null;
  isStale: boolean;
};

// A job is "stale" when it has not finished a successful pass for this many intervals
const STALE_AFTER_INTERVALS = 3;
const MS_IN_SECOND = 1000;

/**
 * Runs one job on a timer. A pass never overlaps with the previous one, errors are logged,
 * and skipped or slow passes are reported instead of staying silent.
 */
export class JobRunner {
  static readonly all: JobRunner[] = [];

  private readonly logger: Logger;
  private readonly createdAt = Date.now();
  private timer: NodeJS.Timeout | undefined;
  private firstRunTimer: NodeJS.Timeout | undefined;
  private isRunning = false;
  private passStartedAt = 0;
  private passes = 0;
  private skippedPasses = 0;
  private lastSuccessAt: number | undefined;
  private lastDurationMs: number | undefined;
  private lastError: string | undefined;

  constructor(private readonly options: JobOptions) {
    this.logger = new Logger(options.name);
    JobRunner.all.push(this);
  }

  start(): void {
    this.timer = setInterval(() => void this.tick(), this.options.intervalMs);
    this.firstRunTimer = setTimeout(() => void this.tick(), this.options.firstRunDelayMs ?? 0);
  }

  stop(): void {
    clearInterval(this.timer);
    clearTimeout(this.firstRunTimer);
  }

  report(): JobReport {
    const now = Date.now();
    const lastSuccess = this.lastSuccessAt ?? this.createdAt;
    return {
      name: this.options.name,
      intervalSeconds: this.options.intervalMs / MS_IN_SECOND,
      passes: this.passes,
      skippedPasses: this.skippedPasses,
      lastSuccessAgoSeconds: this.lastSuccessAt ? Math.round((now - this.lastSuccessAt) / MS_IN_SECOND) : null,
      lastDurationSeconds: this.lastDurationMs ? Math.round(this.lastDurationMs / MS_IN_SECOND) : null,
      lastError: this.lastError ?? null,
      isStale: now - lastSuccess > this.options.intervalMs * STALE_AFTER_INTERVALS,
    };
  }

  private async tick(): Promise<void> {
    if (this.isRunning) {
      this.skipPass();
      return;
    }
    this.isRunning = true;
    this.passStartedAt = Date.now();
    try {
      await laneStorage.run(this.options.lane ?? 'high', () => this.options.run());
      this.lastSuccessAt = Date.now();
      this.lastError = undefined;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.logger.error(this.lastError);
    } finally {
      this.finishPass();
    }
  }

  private skipPass(): void {
    this.skippedPasses += 1;
    const runningSeconds = Math.round((Date.now() - this.passStartedAt) / MS_IN_SECOND);
    this.logger.warn(`Previous pass is still running (${runningSeconds}s), skipping this one`);
  }

  private finishPass(): void {
    this.isRunning = false;
    this.passes += 1;
    this.lastDurationMs = Date.now() - this.passStartedAt;
    if (this.lastDurationMs <= this.options.intervalMs) return;
    this.logger.warn(`Pass took ${Math.round(this.lastDurationMs / MS_IN_SECOND)}s, longer than its interval`);
  }
}
