import 'dotenv/config';

type AppConfig = {
  port: number;
  sitniksApiKey: string;
};

const DEFAULT_PORT = 5000;

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env variable: ${name}`);
  return value;
}

export const appConfig: AppConfig = {
  port: Number(process.env.PORT ?? DEFAULT_PORT),
  sitniksApiKey: readRequired('SITNIKS_API_KEY'),
};
