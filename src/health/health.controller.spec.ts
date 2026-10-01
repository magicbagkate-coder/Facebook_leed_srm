import { HealthController } from '#app/health/health.controller.js';
import { JobRunner } from '#app/monitor/job-runner.js';

describe('HealthController', () => {
  it('is ok with no jobs', () => {
    const healthController = new HealthController();
    expect(healthController.getStatus()).toEqual({ status: 'ok', jobs: [] });
  });

  it('reports a registered job that has not finished a pass yet', () => {
    const runner = new JobRunner({ name: 'TestJob', intervalMs: 60_000, run: async (): Promise<void> => undefined });
    const { jobs, status } = new HealthController().getStatus();
    expect(status).toBe('ok');
    expect(jobs[0]).toMatchObject({ name: 'TestJob', intervalSeconds: 60, passes: 0, isStale: false });
    expect(runner.report().lastSuccessAgoSeconds).toBeNull();
    JobRunner.all.length = 0;
  });
});
