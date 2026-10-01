import { Controller, Get } from '@nestjs/common';

import { type JobReport,JobRunner } from '#app/monitor/job-runner.js';

type HealthStatus = {
  status: 'ok' | 'degraded';
  jobs: JobReport[];
};

/** "degraded" means that some job has not finished a successful pass for a long time. */
@Controller('health')
export class HealthController {
  @Get()
  getStatus(): HealthStatus {
    const jobs = JobRunner.all.map((runner) => runner.report());
    return { status: jobs.some((job) => job.isStale) ? 'degraded' : 'ok', jobs };
  }
}
