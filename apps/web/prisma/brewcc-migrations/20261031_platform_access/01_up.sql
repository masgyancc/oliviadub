-- BrewCC: platform role + approval status + admin audit log
-- Generated with `prisma migrate diff` against production on 2026-10-31.
-- Purely additive: no existing column, table or row is modified or removed.
-- Equivalent to `pnpm prisma:push` with the current schema (review the push output before accepting).

-- AlterTable
ALTER TABLE `User` ADD COLUMN `platformRole` ENUM('user', 'master_admin') NOT NULL DEFAULT 'user',
    ADD COLUMN `status` ENUM('pending', 'approved', 'rejected', 'suspended') NOT NULL DEFAULT 'pending',
    ADD COLUMN `statusReason` TEXT NULL,
    ADD COLUMN `statusUpdatedAt` DATETIME(3) NULL,
    ADD COLUMN `statusUpdatedById` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `AdminAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `targetUserId` VARCHAR(191) NULL,
    `targetDomain` VARCHAR(191) NULL,
    `fromValue` VARCHAR(191) NULL,
    `toValue` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminAuditLog_actorId_idx`(`actorId`),
    INDEX `AdminAuditLog_targetUserId_idx`(`targetUserId`),
    INDEX `AdminAuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `User_status_idx` ON `User`(`status`);
