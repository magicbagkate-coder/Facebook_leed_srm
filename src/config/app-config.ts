import 'dotenv/config';

type AppConfig = {
  port: number;
  sitniksApiKey: string;
  webhookToken: string;
  sitniksBaseUrl: string;
  dryRun: boolean;
  instagramDryRun: boolean;
  pollIntervalMs: number;
  requestTimeoutMs: number;
  rateLimitPauseMs: number;
};

const DEFAULT_PORT = 5000;
const POLL_INTERVAL_MS = 60_000;
const REQUEST_TIMEOUT_MS = 20_000;
// Sitniks blocks the key for a minute after HTTP 429; add a margin
const RATE_LIMIT_PAUSE_MS = 70_000;
const SITNIKS_BASE_URL = 'https://crm.sitniks.com/open-api';

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env variable: ${name}`);
  return value;
}

export const appConfig: AppConfig = {
  port: Number(process.env.PORT ?? DEFAULT_PORT),
  sitniksApiKey: readRequired('SITNIKS_API_KEY'),
  webhookToken: readRequired('WEBHOOK_TOKEN'),
  sitniksBaseUrl: SITNIKS_BASE_URL,
  // Safe by default: chats are changed only when DRY_RUN=false
  dryRun: process.env.DRY_RUN !== 'false',
  instagramDryRun: process.env.INSTAGRAM_DRY_RUN !== 'false',
  pollIntervalMs: POLL_INTERVAL_MS,
  requestTimeoutMs: REQUEST_TIMEOUT_MS,
  rateLimitPauseMs: RATE_LIMIT_PAUSE_MS,
};
