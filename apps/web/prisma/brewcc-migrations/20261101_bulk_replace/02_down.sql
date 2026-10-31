-- Rollback of 01_up.sql. Only after the code without Bulk Destination Replacement is live again.
-- Removes undo history only; links keep their current URLs.
DROP TABLE `LinkUrlReplacement`;
