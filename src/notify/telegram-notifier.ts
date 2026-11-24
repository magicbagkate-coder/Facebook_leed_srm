import { Injectable, Logger } from '@nestjs/common';

import { appConfig } from '#app/config/app-config.js';

const TELEGRAM_API_URL = 'https://api.telegram.org';
const SEND_TIMEOUT_MS = 10_000;

/** Sends a short text to the owner in Telegram. It never throws: a failed notification must not stop the monitors. */
@Injectable()
export class TelegramNotifier {
  private readonly logger = new Logger(TelegramNotifier.name);

  isConfigured(): boolean {
    return Boolean(appConfig.telegramBotToken && appConfig.telegramChatId);
  }

  /** Returns true when Telegram accepted the message. */
  async send(text: string): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const response = await fetch(`${TELEGRAM_API_URL}/bot${appConfig.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: appConfig.telegramChatId, text }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      if (!response.ok) this.logger.warn(`Telegram answered with HTTP ${response.status}`);
      return response.ok;
    } catch (error) {
      this.logger.warn(`Telegram message was not sent: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}
