import { Body, Controller, HttpCode, NotFoundException, Param, Post } from '@nestjs/common';

import { appConfig } from '#app/config/app-config.js';
import { FacebookMonitor } from '#app/monitor/facebook-monitor.js';
import { FacebookReplyMonitor } from '#app/monitor/facebook-reply-monitor.js';
import { extractClientReply, extractNewComment } from '#app/webhook/webhook-event.js';

type WebhookAck = {
  ok: boolean;
};

/**
 * Receives Sitniks "message in chat" events:
 * a comment in a new Facebook chat and a client reply in "Фейсбук" are reviewed right away.
 */
@Controller('webhooks')
export class WebhookController {
  constructor(
    private readonly monitor: FacebookMonitor,
    private readonly replyMonitor: FacebookReplyMonitor,
  ) {}

  @Post('sitniks/:token')
  @HttpCode(200)
  receive(@Param('token') token: string, @Body() body: unknown): WebhookAck {
    if (token !== appConfig.webhookToken) throw new NotFoundException();
    const commentChat = extractNewComment(body);
    if (commentChat) void this.monitor.reviewChat(commentChat);
    const replyChat = extractClientReply(body);
    if (replyChat) void this.replyMonitor.reviewReply(replyChat);
    return { ok: true };
  }
}
