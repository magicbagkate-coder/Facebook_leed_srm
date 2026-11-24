import { appConfig } from '#app/config/app-config.js';
import { TelegramNotifier } from '#app/notify/telegram-notifier.js';

type FetchCall = { url: string; body: string };

describe('TelegramNotifier', () => {
  const originalFetch = globalThis.fetch;
  const calls: FetchCall[] = [];

  function mockFetch(status: number): void {
    globalThis.fetch = (async (url: string, init: { body: string }): Promise<Response> => {
      calls.push({ url, body: init.body });
      return new Response('{}', { status });
    }) as unknown as typeof fetch;
  }

  beforeEach(() => {
    calls.length = 0;
    appConfig.telegramBotToken = 'token-1';
    appConfig.telegramChatId = '42';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    appConfig.telegramBotToken = undefined;
    appConfig.telegramChatId = undefined;
  });

  it('sends the text to the configured chat', async () => {
    mockFetch(200);
    expect(await new TelegramNotifier().send('Привіт')).toBe(true);
    expect(calls[0].url).toBe('https://api.telegram.org/bottoken-1/sendMessage');
    expect(JSON.parse(calls[0].body)).toEqual({ chat_id: '42', text: 'Привіт' });
  });

  it('does nothing when the token or the chat id is missing', async () => {
    mockFetch(200);
    appConfig.telegramChatId = undefined;
    expect(await new TelegramNotifier().send('text')).toBe(false);
    expect(calls).toEqual([]);
  });

  it('returns false and does not throw when Telegram refuses or the network fails', async () => {
    mockFetch(401);
    expect(await new TelegramNotifier().send('text')).toBe(false);
    globalThis.fetch = (async (): Promise<Response> => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    expect(await new TelegramNotifier().send('text')).toBe(false);
  });
});
