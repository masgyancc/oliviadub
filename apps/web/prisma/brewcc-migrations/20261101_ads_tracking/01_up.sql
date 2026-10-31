-- BrewCC Ads Tracking. Purely additive: one new table, no existing table touched.
-- Generated with `prisma migrate diff` against production on 2026-11-01.

-- CreateTable
CREATE TABLE `LinkTrackingPixel` (
    `id` VARCHAR(191) NOT NULL,
    `linkId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `platform` ENUM('meta', 'tiktok', 'google_ads') NOT NULL,
    `pixelId` VARCHAR(191) NOT NULL,
    `conversionLabel` VARCHAR(191) NOT NULL DEFAULT '',
    `name` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LinkTrackingPixel_projectId_idx`(`projectId`),
    UNIQUE INDEX `LinkTrackingPixel_linkId_platform_pixelId_conversionLabel_key`(`linkId`, `platform`, `pixelId`, `conversionLabel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
