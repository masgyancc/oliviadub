// BrewCC Telegram bot configuration. Secrets are only read from the environment, never logged.

export const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME?.replace(
  /^@/,
  "",
);

// Day boundaries for "today" / "yesterday" analytics
export const TELEGRAM_TIMEZONE =
  process.env.TELEGRAM_TIMEZONE || "Asia/Jakarta";

export const LINK_TOKEN_TTL_SECONDS = 5 * 60;
export const SESSION_TTL_SECONDS = 15 * 60;
export const LINKS_PAGE_SIZE = 5;

export const isTelegramConfigured = () =>
  Boolean(
    process.env.TELEGRAM_BOT_TOKEN &&
      process.env.TELEGRAM_WEBHOOK_SECRET &&
      TELEGRAM_BOT_USERNAME,
  );
