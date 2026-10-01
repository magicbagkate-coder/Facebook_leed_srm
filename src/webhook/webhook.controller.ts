import { Body, Controller, HttpCode, Logger, NotFoundException, Param, Post } from '@nestjs/common';

import { appConfig } from '#app/config/app-config.js';

type WebhookAck = {
  ok: boolean;
};

const MAX_LOGGED_CHARS = 3_000;

/** Temporary receiver: logs the payload of Sitniks webhooks, changes nothing. */
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  @Post('sitniks/:token')
  @HttpCode(200)
  receive(@Param('token') token: string, @Body() body: unknown): WebhookAck {
    if (token !== appConfig.webhookToken) throw new NotFoundException();
    this.logger.log(`Webhook payload: ${JSON.stringify(body).slice(0, MAX_LOGGED_CHARS)}`);
    return { ok: true };
  }
}
