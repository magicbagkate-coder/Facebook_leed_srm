import { Module } from '@nestjs/common';

import { HealthController } from '#app/health/health.controller.js';
import { FacebookMonitor } from '#app/monitor/facebook-monitor.js';
import { FacebookReplyMonitor } from '#app/monitor/facebook-reply-monitor.js';
import { InstagramMonitor } from '#app/monitor/instagram-monitor.js';
import { TelegramNotifier } from '#app/notify/telegram-notifier.js';
import { SitniksClient } from '#app/sitniks/sitniks-client.js';
import { StatsController } from '#app/stats/stats.controller.js';
import { StatsCollector } from '#app/stats/stats-collector.js';
import { StatsStore } from '#app/stats/stats-store.js';
import { WebhookController } from '#app/webhook/webhook.controller.js';

@Module({
  controllers: [HealthController, WebhookController, StatsController],
  providers: [
    SitniksClient,
    TelegramNotifier,
    StatsStore,
    StatsCollector,
    FacebookMonitor,
    FacebookReplyMonitor,
    InstagramMonitor,
  ],
})
export class AppModule {}
