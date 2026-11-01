-- Rollback of 01_up.sql. Only after the code without admin aliases is live again.
-- Removes the private aliases only; users are not affected.
DROP TABLE `AdminUserAlias`;
