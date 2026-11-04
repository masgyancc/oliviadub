-- Rollback of 01_up.sql. Only after the code without Saved Pixels is live again.
-- Removes every user's pixel library. Tracking tags already on links keep firing.
DROP INDEX `LinkTrackingPixel_savedPixelId_idx` ON `LinkTrackingPixel`;
ALTER TABLE `LinkTrackingPixel` DROP COLUMN `savedPixelId`;
DROP TABLE `SavedTrackingPixel`;
