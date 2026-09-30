-- Add ownership, idempotency, and lifecycle metadata for Launch 1B media objects.
-- This migration intentionally leaves all existing media records untouched.
ALTER TABLE "MediaObject" ADD COLUMN "remoteUrl" TEXT;
ALTER TABLE "MediaObject" ADD COLUMN "originalName" TEXT;
ALTER TABLE "MediaObject" ADD COLUMN "mediaType" TEXT;
ALTER TABLE "MediaObject" ADD COLUMN "clientUploadId" TEXT;
ALTER TABLE "MediaObject" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "MediaObject" ADD COLUMN "availableAt" DATETIME;

CREATE UNIQUE INDEX "MediaObject_installationId_clientUploadId_key"
  ON "MediaObject"("installationId", "clientUploadId");
CREATE INDEX "MediaObject_installationId_status_deletedAt_idx"
  ON "MediaObject"("installationId", "status", "deletedAt");
CREATE INDEX "MediaObject_installationId_createdAt_idx"
  ON "MediaObject"("installationId", "createdAt");
