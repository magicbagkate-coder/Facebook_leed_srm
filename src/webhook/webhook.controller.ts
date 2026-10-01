import { Body, Controller, HttpCode, NotFoundException, Param, Post } from '@nestjs/common';

import { appConfig } from '#app/config/app-config.js';
import { FacebookMonitor } from '#app/monitor/facebook-monitor.js';
import { extractNewComment } from '#app/webhook/webhook-event.js';

type WebhookAck = {
  ok: boolean;
};

/** Receives Sitniks "message in chat" events and reviews new Facebook comments right away. */
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly monitor: FacebookMonitor) {}

  @Post('sitniks/:token')
  @HttpCode(200)
  receive(@Param('token') token: string, @Body() body: unknown): WebhookAck {
    if (token !== appConfig.webhookToken) throw new NotFoundException();
    const chat = extractNewComment(body);
    if (chat) void this.monitor.reviewChat(chat);
    return { ok: true };
  }
}
