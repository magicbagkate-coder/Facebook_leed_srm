import { Logger } from '@nestjs/common';

type JobOptions = {
  name: string;
  intervalMs: number;
  run: () => Promise<unknown>;
};

/** Runs one job on a timer; a pass never overlaps with the previous one and errors are only logged. */
export class JobRunner {
  private readonly logger: Logger;
  private timer: NodeJS.Timeout | undefined;
  private isRunning = false;

  constructor(private readonly options: JobOptions) {
    this.logger = new Logger(options.name);
  }

  start(): void {
    this.timer = setInterval(() => void this.tick(), this.options.intervalMs);
    void this.tick();
  }

  stop(): void {
    clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      await this.options.run();
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));
    } finally {
      this.isRunning = false;
    }
  }
}
