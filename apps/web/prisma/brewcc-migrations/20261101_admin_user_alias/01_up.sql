-- BrewCC private admin aliases for users. Purely additive: one new table.

-- CreateTable
CREATE TABLE `AdminUserAlias` (
    `id` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `alias` VARCHAR(100) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdminUserAlias_adminId_userId_key`(`adminId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
