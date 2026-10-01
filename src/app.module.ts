import { Module } from '@nestjs/common';

import { HealthController } from '#app/health/health.controller.js';
import { FacebookMonitor } from '#app/monitor/facebook-monitor.js';
import { SitniksClient } from '#app/sitniks/sitniks-client.js';

@Module({
  controllers: [HealthController],
  providers: [SitniksClient, FacebookMonitor],
})
export class AppModule {}
