-- BrewCC Saved Pixels. Purely additive: one new table and one new nullable column.
-- Existing tracking tags keep working unchanged (savedPixelId stays NULL for them).

-- CreateTable
CREATE TABLE `SavedTrackingPixel` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `platform` ENUM('meta', 'tiktok', 'google_ads') NOT NULL,
    `pixelId` VARCHAR(191) NOT NULL,
    `conversionLabel` VARCHAR(191) NOT NULL DEFAULT '',
    `name` VARCHAR(60) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SavedTrackingPixel_projectId_idx`(`projectId`),
    UNIQUE INDEX `SavedTrackingPixel_user_pixel_key`(`userId`, `projectId`, `platform`, `pixelId`, `conversionLabel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `LinkTrackingPixel` ADD COLUMN `savedPixelId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `LinkTrackingPixel_savedPixelId_idx` ON `LinkTrackingPixel`(`savedPixelId`);
