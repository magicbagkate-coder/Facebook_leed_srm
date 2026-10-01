import { Module } from '@nestjs/common';

import { HealthController } from '#app/health/health.controller.js';
import { FacebookMonitor } from '#app/monitor/facebook-monitor.js';
import { SitniksClient } from '#app/sitniks/sitniks-client.js';
import { WebhookController } from '#app/webhook/webhook.controller.js';

@Module({
  controllers: [HealthController, WebhookController],
  providers: [SitniksClient, FacebookMonitor],
})
export class AppModule {}
