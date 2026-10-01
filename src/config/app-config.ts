import 'dotenv/config';

type AppConfig = {
  port: number;
  sitniksApiKey: string;
  sitniksBaseUrl: string;
  dryRun: boolean;
  pollIntervalMs: number;
};

const DEFAULT_PORT = 5000;
const POLL_INTERVAL_MS = 60_000;
const SITNIKS_BASE_URL = 'https://crm.sitniks.com/open-api';

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env variable: ${name}`);
  return value;
}

export const appConfig: AppConfig = {
  port: Number(process.env.PORT ?? DEFAULT_PORT),
  sitniksApiKey: readRequired('SITNIKS_API_KEY'),
  sitniksBaseUrl: SITNIKS_BASE_URL,
  // Safe by default: chats are changed only when DRY_RUN=false
  dryRun: process.env.DRY_RUN !== 'false',
  pollIntervalMs: POLL_INTERVAL_MS,
};
