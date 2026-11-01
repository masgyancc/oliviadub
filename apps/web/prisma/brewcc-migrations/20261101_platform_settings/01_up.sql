-- BrewCC global platform settings (e.g. "Allow Users to Add Domains"). Purely additive: one new table.
-- A missing row means the default value (allowUserDomains = OFF).

-- CreateTable
CREATE TABLE `PlatformSetting` (
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NOT NULL,
    `updatedById` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
