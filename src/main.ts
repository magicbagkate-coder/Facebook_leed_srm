import { NestFactory } from '@nestjs/core';

import { AppModule } from '#app/app.module.js';
import { appConfig } from '#app/config/app-config.js';

async function startServer(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  await app.listen(appConfig.port);
}

void startServer();
