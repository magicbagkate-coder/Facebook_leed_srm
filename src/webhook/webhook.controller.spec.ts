import { NotFoundException } from '@nestjs/common';

import { WebhookController } from '#app/webhook/webhook.controller.js';

describe('WebhookController', () => {
  it('accepts a request with the right token', () => {
    const webhookController = new WebhookController();
    expect(webhookController.receive('test-token', { text: 'hello' })).toEqual({ ok: true });
  });

  it('rejects a request with a wrong token', () => {
    const webhookController = new WebhookController();
    expect(() => webhookController.receive('wrong', {})).toThrow(NotFoundException);
  });
});
