-- CreateTable
CREATE TABLE "Installation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "revokedAt" DATETIME,
    "tokenVersion" INTEGER NOT NULL DEFAULT 1,
    "plan" TEXT,
    "entitlement" TEXT
);

-- CreateTable
CREATE TABLE "InstallationSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installationId" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "accessExpiresAt" DATETIME NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "refreshExpiresAt" DATETIME NOT NULL,
    "tokenVersion" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRefreshedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "InstallationSession_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installationId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 1,
    "providerModel" TEXT,
    "errorCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "AiUsage_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installationId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "usageId" TEXT,
    "responseJson" TEXT,
    "errorCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "IdempotencyRecord_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "windowStartedAt" DATETIME NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MediaObject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "installationId" TEXT NOT NULL,
    "storageFileId" TEXT,
    "storageKey" TEXT,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "MediaObject_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "Installation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Installation_status_idx" ON "Installation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InstallationSession_accessTokenHash_key" ON "InstallationSession"("accessTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "InstallationSession_refreshTokenHash_key" ON "InstallationSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "InstallationSession_installationId_idx" ON "InstallationSession"("installationId");

-- CreateIndex
CREATE INDEX "InstallationSession_accessExpiresAt_idx" ON "InstallationSession"("accessExpiresAt");

-- CreateIndex
CREATE INDEX "InstallationSession_refreshExpiresAt_idx" ON "InstallationSession"("refreshExpiresAt");

-- CreateIndex
CREATE INDEX "AiUsage_installationId_createdAt_idx" ON "AiUsage"("installationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_endpoint_createdAt_idx" ON "AiUsage"("endpoint", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_status_createdAt_idx" ON "AiUsage"("status", "createdAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_installationId_endpoint_key_key" ON "IdempotencyRecord"("installationId", "endpoint", "key");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitBucket_scope_key_windowStartedAt_key" ON "RateLimitBucket"("scope", "key", "windowStartedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaObject_storageFileId_key" ON "MediaObject"("storageFileId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaObject_storageKey_key" ON "MediaObject"("storageKey");

-- CreateIndex
CREATE INDEX "MediaObject_installationId_idx" ON "MediaObject"("installationId");
