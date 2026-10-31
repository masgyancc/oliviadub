-- Rollback of 01_up.sql. Only after the code without Ads Tracking is live again.
-- Removes all tracking tags; links, clicks and analytics are not affected.
DROP TABLE `LinkTrackingPixel`;
