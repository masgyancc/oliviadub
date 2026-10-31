-- BrewCC Bulk Destination Replacement (undo history). Purely additive: one new table.
-- Generated with `prisma migrate diff` against production on 2026-11-01.

-- CreateTable
CREATE TABLE `LinkUrlReplacement` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `linkId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `oldUrl` TEXT NOT NULL,
    `newUrl` TEXT NOT NULL,
    `revertedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LinkUrlReplacement_runId_idx`(`runId`),
    INDEX `LinkUrlReplacement_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
