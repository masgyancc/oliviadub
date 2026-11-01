-- Rollback of 01_up.sql. Only after the code without platform settings is live again.
-- Removes the stored settings only; domains and links are not affected.
DROP TABLE `PlatformSetting`;
