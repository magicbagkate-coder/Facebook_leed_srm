import { HealthController } from '#app/health/health.controller.js';

describe('HealthController', () => {
  it('returns ok status', () => {
    const healthController = new HealthController();
    expect(healthController.getStatus()).toEqual({ status: 'ok' });
  });
});
