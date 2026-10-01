import { JobRunner } from '#app/monitor/job-runner.js';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('JobRunner', () => {
  it('keeps running after a failed pass', async () => {
    let calls = 0;
    const runner = new JobRunner({
      name: 'FailingJob',
      intervalMs: 20,
      run: async (): Promise<void> => {
        calls += 1;
        throw new Error('boom');
      },
    });
    runner.start();
    await wait(120);
    runner.stop();
    expect(calls).toBeGreaterThan(2);
  });

  it('never runs two passes at the same time', async () => {
    let active = 0;
    let maxActive = 0;
    const runner = new JobRunner({
      name: 'SlowJob',
      intervalMs: 10,
      run: async (): Promise<void> => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await wait(60);
        active -= 1;
      },
    });
    runner.start();
    await wait(200);
    runner.stop();
    expect(maxActive).toBe(1);
  });
});
