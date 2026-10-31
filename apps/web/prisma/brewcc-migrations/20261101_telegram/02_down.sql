-- Rollback of 01_up.sql. Only after the code without the Telegram bot is live again.
-- Removes all Telegram links between BrewCC and Telegram accounts (no links, users or analytics are affected).
DROP TABLE `TelegramLinkToken`;
DROP TABLE `TelegramAccount`;
