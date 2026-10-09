-- Super-admin panel: lets an admin close abandoned sessions, records the
-- last login per user, and stores per-request traffic from http-server.
ALTER TYPE "SessionStatus" ADD VALUE 'CANCELLED';

ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

CREATE TABLE "ApiRequestLog" (
    "id" BIGSERIAL NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "ip" TEXT,
    "userId" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiRequestLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApiRequestLog_createdAt_idx" ON "ApiRequestLog"("createdAt");

CREATE INDEX "ApiRequestLog_userId_idx" ON "ApiRequestLog"("userId");
