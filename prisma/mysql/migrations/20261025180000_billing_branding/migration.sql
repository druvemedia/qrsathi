-- AlterTable
ALTER TABLE `User` ADD COLUMN `quotaLock` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Payment` ADD COLUMN `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    ADD COLUMN `failureReason` VARCHAR(500) NOT NULL DEFAULT '',
    ADD COLUMN `interval` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `kind` VARCHAR(191) NOT NULL DEFAULT 'payment_link',
    ADD COLUMN `planName` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `refundedAmount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `subscriptionId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Session` ADD COLUMN `reauthAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `PricingPlan` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(500) NOT NULL DEFAULT '',
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `monthlyPrice` INTEGER NOT NULL DEFAULT 0,
    `annualPrice` INTEGER NOT NULL DEFAULT 0,
    `features` VARCHAR(4000) NOT NULL DEFAULT '[]',
    `limits` VARCHAR(4000) NOT NULL DEFAULT '{}',
    `featured` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProviderPlan` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `interval` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL,
    `mode` VARCHAR(191) NOT NULL,
    `providerPlanId` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProviderPlan_providerPlanId_key`(`providerPlanId`),
    INDEX `ProviderPlan_planId_interval_mode_active_idx`(`planId`, `interval`, `mode`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscription` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `planName` VARCHAR(191) NOT NULL DEFAULT '',
    `interval` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `provider` VARCHAR(191) NOT NULL DEFAULT 'razorpay',
    `mode` VARCHAR(191) NOT NULL DEFAULT 'test',
    `providerSubscriptionId` VARCHAR(191) NOT NULL,
    `providerPlanId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'created',
    `currentPeriodEnd` DATETIME(3) NULL,
    `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Subscription_providerSubscriptionId_key`(`providerSubscriptionId`),
    INDEX `Subscription_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookEvent` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'processed',
    `summary` VARCHAR(500) NOT NULL DEFAULT '',
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WebhookEvent_receivedAt_idx`(`receivedAt`),
    UNIQUE INDEX `WebhookEvent_provider_eventId_key`(`provider`, `eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BrandAsset` (
    `id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `storedName` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NOT NULL,
    `width` INTEGER NOT NULL DEFAULT 0,
    `height` INTEGER NOT NULL DEFAULT 0,
    `size` INTEGER NOT NULL,
    `createdBy` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BrandAsset_storedName_key`(`storedName`),
    INDEX `BrandAsset_kind_createdAt_idx`(`kind`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Payment_userId_createdAt_idx` ON `Payment`(`userId`, `createdAt`);

-- CreateIndex
CREATE INDEX `Payment_subscriptionId_idx` ON `Payment`(`subscriptionId`);

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProviderPlan` ADD CONSTRAINT `ProviderPlan_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `PricingPlan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscription` ADD CONSTRAINT `Subscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Case-sensitive provider identifiers (Razorpay ids are case-sensitive).
ALTER TABLE `Subscription` MODIFY `providerSubscriptionId` VARCHAR(191) NOT NULL COLLATE utf8mb4_bin;
ALTER TABLE `ProviderPlan` MODIFY `providerPlanId` VARCHAR(191) NOT NULL COLLATE utf8mb4_bin;
ALTER TABLE `WebhookEvent` MODIFY `eventId` VARCHAR(191) NOT NULL COLLATE utf8mb4_bin;
ALTER TABLE `BrandAsset` MODIFY `storedName` VARCHAR(191) NOT NULL COLLATE utf8mb4_bin;
