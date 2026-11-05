-- Rollback of 01_up.sql. Only after the code without Telegram groups is live again.
-- Disconnects every group; personal Telegram connections are not affected.
DROP TABLE `TelegramGroupMember`;
DROP TABLE `TelegramGroup`;
