-- BrewCC Telegram bot integration. Purely additive: two new tables, no existing table touched.
-- Generated with `prisma migrate diff` against production on 2026-11-01.

-- CreateTable
CREATE TABLE `TelegramAccount` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `telegramId` VARCHAR(191) NOT NULL,
    `telegramUsername` VARCHAR(191) NULL,
    `connectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastInteractionAt` DATETIME(3) NULL,

    UNIQUE INDEX `TelegramAccount_userId_key`(`userId`),
    UNIQUE INDEX `TelegramAccount_telegramId_key`(`telegramId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TelegramLinkToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TelegramLinkToken_tokenHash_key`(`tokenHash`),
    INDEX `TelegramLinkToken_userId_idx`(`userId`),
    INDEX `TelegramLinkToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
