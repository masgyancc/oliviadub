-- BrewCC Telegram groups. Purely additive: two new tables, no existing table touched.

-- CreateTable
CREATE TABLE `TelegramGroup` (
    `id` VARCHAR(191) NOT NULL,
    `chatId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `ownerUserId` VARCHAR(191) NOT NULL,
    `connectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TelegramGroup_chatId_key`(`chatId`),
    INDEX `TelegramGroup_ownerUserId_idx`(`ownerUserId`),
    INDEX `TelegramGroup_projectId_idx`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TelegramGroupMember` (
    `id` VARCHAR(191) NOT NULL,
    `groupId` VARCHAR(191) NOT NULL,
    `telegramId` VARCHAR(191) NOT NULL,
    `telegramUsername` VARCHAR(191) NULL,
    `displayName` VARCHAR(191) NULL,
    `status` VARCHAR(16) NOT NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approvedAt` DATETIME(3) NULL,

    INDEX `TelegramGroupMember_groupId_idx`(`groupId`),
    UNIQUE INDEX `TelegramGroupMember_groupId_telegramId_key`(`groupId`, `telegramId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
