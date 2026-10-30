-- BrewCC rollback of 01_up.sql. Only run AFTER the previous app version is live again
-- (the new code reads these columns). This discards approval history and the admin audit log.
-- Normally NOT needed: the old code ignores the new columns, so a code-only rollback is enough.

DROP INDEX `User_status_idx` ON `User`;

ALTER TABLE `User`
    DROP COLUMN `platformRole`,
    DROP COLUMN `status`,
    DROP COLUMN `statusReason`,
    DROP COLUMN `statusUpdatedAt`,
    DROP COLUMN `statusUpdatedById`;

DROP TABLE `AdminAuditLog`;
