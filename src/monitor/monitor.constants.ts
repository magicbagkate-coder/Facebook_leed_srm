// Values come from Sitniks CRM data, so they stay in the CRM language
export const WATCHED_STATUS = 'Новий';
export const TARGET_STATUS = 'Фейсбук';
export const FACEBOOK_SOURCE = 'facebook';
export const FACEBOOK_TAG = 'ФБ';

// Instagram flow
export const INSTAGRAM_SOURCE = 'instagram';
export const NEW_BOT_STATUS = 'Новий БОТ';
export const PRODUCT_STATUS = 'Вибір товару';
export const NEW_BOT_TAG = 'НБ';
export const PRICE_BUTTON_TEXT = 'дізнатись ціну';
export const PRESS_HERE_TEXT = 'натисніть тут';
// Client must stay silent this long after our price reply before the chat moves to "Новий БОТ"
export const SILENCE_MS = 60_000;
export const START_FLOW_INTERVAL_MS = 60_000;
export const BOT_FLOW_INTERVAL_MS = 300_000;
export const BOT_OVERLAP_MS = 600_000;
export const BOT_FIRST_LOOKBACK_MS = 86_400_000;
export const NEWEST_MESSAGES = 50;

// Pause after a 429 response: the API blocks for 1 minute, add a margin
export const RATE_LIMIT_PAUSE_MS = 70_000;
