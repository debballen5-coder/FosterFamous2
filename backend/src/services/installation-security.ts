import { createHmac, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { currentEnv } from "../env";
import { getPrisma } from "../prisma";

const ACTIVE_INSTALLATION_STATUS = "ACTIVE";
const CONTENT_ENDPOINT = "content.generate";
const MAX_TOKEN_LENGTH = 512;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]{8,200}$/;

type Clock = () => Date;

export interface InstallationPrincipal {
  installationId: string;
  sessionId: string;
}

export interface InstallationTokens {
  accessToken: string;
  refreshCredential: string;
  accessExpiresAt: Date;
  accessExpiresInSeconds: number;
}

export interface InstallationSecurityConfig {
  tokenSecret?: string;
  accessTokenTtlSeconds: number;
  refreshCredentialTtlDays: number;
  aiRequestsPerTenMinutes: number;
  aiDailyQuota: number;
  aiMonthlyQuota: number;
  aiGlobalRequestsPerMinute: number;
  registrationRequestsPerHour: number;
  refreshRequestsPerHour: number;
  idempotencyRetentionHours: number;
  mediaUploadsPerTenMinutes: number;
  mediaGlobalUploadsPerMinute: number;
}

export type GenerationAdmission =
  | { state: "reserved"; recordId: string; usageId: string }
  | { state: "completed"; response: unknown }
  | { state: "in-progress" }
  | { state: "failed" };

export class SecurityError extends Error {
  constructor(
    public readonly code:
      | "SECURITY_NOT_CONFIGURED"
      | "AUTHENTICATION_REQUIRED"
      | "RATE_LIMITED"
      | "QUOTA_EXCEEDED"
      | "IDEMPOTENCY_KEY_REQUIRED"
      | "IDEMPOTENCY_KEY_REUSED"
      | "GENERATION_IN_PROGRESS"
      | "GENERATION_RETRY_LATER"
      | "SECURITY_UNAVAILABLE",
    public readonly status: 401 | 409 | 429 | 503,
    public readonly retryAfterSeconds?: number
  ) {
    super(
      status === 401
        ? "Foster Famous couldn't verify this device right now. Please try again."
        : "Foster Famous couldn't create that right now. Your foster information and draft are still safe. Please try again."
    );
    this.name = "SecurityError";
  }
}

function positiveInteger(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function securityConfigFromEnv(): InstallationSecurityConfig {
  // Resolve fresh local development settings when this module is hot-reloaded.
  const env = currentEnv();
  return {
    tokenSecret: env.INSTALLATION_TOKEN_SECRET,
    accessTokenTtlSeconds: positiveInteger(env.ACCESS_TOKEN_TTL_SECONDS, 900),
    refreshCredentialTtlDays: positiveInteger(env.REFRESH_CREDENTIAL_TTL_DAYS, 90),
    aiRequestsPerTenMinutes: positiveInteger(env.AI_REQUESTS_PER_10_MINUTES, 20),
    aiDailyQuota: positiveInteger(env.AI_DAILY_QUOTA, 100),
    aiMonthlyQuota: positiveInteger(env.AI_MONTHLY_QUOTA, 1000),
    aiGlobalRequestsPerMinute: positiveInteger(env.AI_GLOBAL_REQUESTS_PER_MINUTE, 120),
    registrationRequestsPerHour: positiveInteger(env.REGISTRATION_REQUESTS_PER_HOUR, 10),
    refreshRequestsPerHour: positiveInteger(env.REFRESH_REQUESTS_PER_HOUR, 60),
    idempotencyRetentionHours: positiveInteger(env.IDEMPOTENCY_RETENTION_HOURS, 24),
    mediaUploadsPerTenMinutes: positiveInteger(env.MEDIA_UPLOADS_PER_10_MINUTES, 10),
    mediaGlobalUploadsPerMinute: positiveInteger(env.MEDIA_GLOBAL_UPLOADS_PER_MINUTE, 60),
  };
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function startOfUtcMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function startOfWindow(value: Date, windowMilliseconds: number): Date {
  return new Date(Math.floor(value.getTime() / windowMilliseconds) * windowMilliseconds);
}

function secondsUntil(value: Date, now: Date): number {
  return Math.max(1, Math.ceil((value.getTime() - now.getTime()) / 1000));
}

/**
 * Server-only anonymous installation security. Raw access and refresh values are
 * cryptographically random and persisted only as HMAC digests.
 */
export class InstallationSecurityService {
  private readonly config: InstallationSecurityConfig;
  private readonly db: PrismaClient;
  private readonly now: Clock;

  constructor(options: {
    db?: PrismaClient;
    config?: InstallationSecurityConfig;
    now?: Clock;
  } = {}) {
    this.db = options.db ?? getPrisma();
    this.config = options.config ?? securityConfigFromEnv();
    this.now = options.now ?? (() => new Date());
  }

  private requireConfigured(): string {
    const secret = this.config.tokenSecret;
    if (!secret || secret.length < 32) {
      throw new SecurityError("SECURITY_NOT_CONFIGURED", 503);
    }
    return secret;
  }

  private fingerprint(value: string): string {
    return createHmac("sha256", this.requireConfigured()).update(value).digest("hex");
  }

  private createCredential(prefix: "ff_at" | "ff_rt"): string {
    return `${prefix}_${randomBytes(32).toString("base64url")}`;
  }

  private async consumeRateLimit(
    scope: string,
    key: string,
    limit: number,
    windowMilliseconds: number,
    now = this.now()
  ): Promise<void> {
    const windowStartedAt = startOfWindow(now, windowMilliseconds);
    const expiresAt = new Date(windowStartedAt.getTime() + windowMilliseconds);

    try {
      const bucket = await this.db.rateLimitBucket.upsert({
        where: {
          scope_key_windowStartedAt: { scope, key, windowStartedAt },
        },
        create: { scope, key, windowStartedAt, expiresAt, count: 1 },
        update: { count: { increment: 1 }, expiresAt },
      });

      if (bucket.count > limit) {
        throw new SecurityError("RATE_LIMITED", 429, secondsUntil(expiresAt, now));
      }
    } catch (error) {
      if (error instanceof SecurityError) throw error;
      throw new SecurityError("SECURITY_UNAVAILABLE", 503);
    }
  }

  private async issueSession(installationId: string, tokenVersion: number): Promise<InstallationTokens> {
    const now = this.now();
    const accessToken = this.createCredential("ff_at");
    const refreshCredential = this.createCredential("ff_rt");
    const accessExpiresAt = new Date(now.getTime() + this.config.accessTokenTtlSeconds * 1000);
    const refreshExpiresAt = new Date(now.getTime() + this.config.refreshCredentialTtlDays * 86_400_000);

    try {
      await this.db.installationSession.create({
        data: {
          installationId,
          accessTokenHash: this.fingerprint(accessToken),
          accessExpiresAt,
          refreshTokenHash: this.fingerprint(refreshCredential),
          refreshExpiresAt,
          tokenVersion,
        },
      });
    } catch {
      throw new SecurityError("SECURITY_UNAVAILABLE", 503);
    }

    return {
      accessToken,
      refreshCredential,
      accessExpiresAt,
      accessExpiresInSeconds: this.config.accessTokenTtlSeconds,
    };
  }

  /** Enrollment is intentionally rate-limited and cost-free; App Attest can bind it later. */
  async register(sourceIp: string): Promise<InstallationTokens> {
    this.requireConfigured();
    const now = this.now();
    const ipFingerprint = this.fingerprint(`ip:${sourceIp || "unknown"}`);
    await this.consumeRateLimit(
      "installation-registration-ip",
      ipFingerprint,
      this.config.registrationRequestsPerHour,
      60 * 60 * 1000,
      now
    );

    try {
      const installation = await this.db.installation.create({ data: {} });
      return await this.issueSession(installation.id, installation.tokenVersion);
    } catch (error) {
      if (error instanceof SecurityError) throw error;
      throw new SecurityError("SECURITY_UNAVAILABLE", 503);
    }
  }

  async refresh(refreshCredential: string, sourceIp: string): Promise<InstallationTokens> {
    this.requireConfigured();
    if (!refreshCredential || refreshCredential.length > MAX_TOKEN_LENGTH) {
      throw new SecurityError("AUTHENTICATION_REQUIRED", 401);
    }

    const now = this.now();
    const ipFingerprint = this.fingerprint(`ip:${sourceIp || "unknown"}`);
    await this.consumeRateLimit(
      "installation-refresh-ip",
      ipFingerprint,
      this.config.refreshRequestsPerHour,
      60 * 60 * 1000,
      now
    );

    let session;
    try {
      session = await this.db.installationSession.findUnique({
        where: { refreshTokenHash: this.fingerprint(refreshCredential) },
        include: { installation: true },
      });
    } catch {
      throw new SecurityError("SECURITY_UNAVAILABLE", 503);
    }

    if (
      !session ||
      session.revokedAt ||
      session.refreshExpiresAt <= now ||
      session.installation.status !== ACTIVE_INSTALLATION_STATUS ||
      session.installation.revokedAt ||
      session.tokenVersion !== session.installation.tokenVersion
    ) {
      throw new SecurityError("AUTHENTICATION_REQUIRED", 401);
    }

    await this.consumeRateLimit(
      "installation-refresh-installation",
      session.installationId,
      this.config.refreshRequestsPerHour,
      60 * 60 * 1000,
      now
    );

    const accessToken = this.createCredential("ff_at");
    const nextRefreshCredential = this.createCredential("ff_rt");
    const accessExpiresAt = new Date(now.getTime() + this.config.accessTokenTtlSeconds * 1000);
    const refreshExpiresAt = new Date(now.getTime() + this.config.refreshCredentialTtlDays * 86_400_000);

    try {
      await this.db.$transaction([
        this.db.installationSession.update({
          where: { id: session.id },
          data: {
            accessTokenHash: this.fingerprint(accessToken),
            accessExpiresAt,
            refreshTokenHash: this.fingerprint(nextRefreshCredential),
            refreshExpiresAt,
            lastRefreshedAt: now,
          },
        }),
        this.db.installation.update({
          where: { id: session.installationId },
          data: { lastSeenAt: now },
        }),
      ]);
    } catch {
      throw new SecurityError("SECURITY_UNAVAILABLE", 503);
    }

    return {
      accessToken,
      refreshCredential: nextRefreshCredential,
      accessExpiresAt,
      accessExpiresInSeconds: this.config.accessTokenTtlSeconds,
    };
  }

  async authenticate(authorizationHeader: string | undefined): Promise<InstallationPrincipal> {
    this.requireConfigured();
    const token = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token || token.length > MAX_TOKEN_LENGTH) {
      throw new SecurityError("AUTHENTICATION_REQUIRED", 401);
    }

    const now = this.now();
    let session;
    try {
      session = await this.db.installationSession.findUnique({
        where: { accessTokenHash: this.fingerprint(token) },
        include: { installation: true },
      });
    } catch {
      throw new SecurityError("SECURITY_UNAVAILABLE", 503);
    }

    if (
      !session ||
      session.revokedAt ||
      session.accessExpiresAt <= now ||
      session.installation.status !== ACTIVE_INSTALLATION_STATUS ||
      session.installation.revokedAt ||
      session.tokenVersion !== session.installation.tokenVersion
    ) {
      throw new SecurityError("AUTHENTICATION_REQUIRED", 401);
    }

    try {
      await this.db.installation.update({
        where: { id: session.installationId },
        data: { lastSeenAt: now },
      });
    } catch {
      throw new SecurityError("SECURITY_UNAVAILABLE", 503);
    }

    return { installationId: session.installationId, sessionId: session.id };
  }

  /** Lightweight pre-storage protection for authenticated media uploads. */
  async admitMediaUpload(principal: InstallationPrincipal): Promise<void> {
    this.requireConfigured();
    const now = this.now();
    await this.consumeRateLimit(
      "media-upload-global",
      "all",
      this.config.mediaGlobalUploadsPerMinute,
      60_000,
      now
    );
    await this.consumeRateLimit(
      "media-upload-installation",
      principal.installationId,
      this.config.mediaUploadsPerTenMinutes,
      10 * 60_000,
      now
    );
  }

  private validateIdempotencyKey(key: string | undefined): string {
    if (!key || !IDEMPOTENCY_KEY_PATTERN.test(key)) {
      throw new SecurityError("IDEMPOTENCY_KEY_REQUIRED", 409);
    }
    return key;
  }

  private async findIdempotencyRecord(installationId: string, key: string) {
    try {
      return await this.db.idempotencyRecord.findUnique({
        where: {
          installationId_endpoint_key: {
            installationId,
            endpoint: CONTENT_ENDPOINT,
            key,
          },
        },
      });
    } catch {
      throw new SecurityError("SECURITY_UNAVAILABLE", 503);
    }
  }

  private existingAdmission(
    record: Awaited<ReturnType<InstallationSecurityService["findIdempotencyRecord"]>>,
    fingerprint: string,
    now = this.now()
  ): GenerationAdmission | null {
    if (!record || record.expiresAt.getTime() <= now.getTime()) return null;
    if (record.requestFingerprint !== fingerprint) {
      throw new SecurityError("IDEMPOTENCY_KEY_REUSED", 409);
    }
    if (record.status === "COMPLETED" && record.responseJson) {
      try {
        return { state: "completed", response: JSON.parse(record.responseJson) };
      } catch {
        throw new SecurityError("SECURITY_UNAVAILABLE", 503);
      }
    }
    return record.status === "PENDING" ? { state: "in-progress" } : { state: "failed" };
  }

  async reserveGeneration(
    principal: InstallationPrincipal,
    idempotencyKey: string | undefined,
    request: unknown
  ): Promise<GenerationAdmission> {
    this.requireConfigured();
    const key = this.validateIdempotencyKey(idempotencyKey);
    const fingerprint = this.fingerprint(JSON.stringify(request));
    const now = this.now();
    const existing = this.existingAdmission(
      await this.findIdempotencyRecord(principal.installationId, key),
      fingerprint,
      now
    );
    // A failed provider call produced no draft to replay. Preserve the action's
    // request identity, but let the same exact action retry safely.
    if (existing && existing.state !== "failed") return existing;

    await this.consumeRateLimit(
      "content-generation-global",
      "all",
      this.config.aiGlobalRequestsPerMinute,
      60_000,
      now
    );
    await this.consumeRateLimit(
      "content-generation-installation",
      principal.installationId,
      this.config.aiRequestsPerTenMinutes,
      10 * 60_000,
      now
    );

    const expiresAt = new Date(now.getTime() + this.config.idempotencyRetentionHours * 60 * 60_000);

    try {
      const reserved = await this.db.$transaction(async (tx) => {
        await tx.idempotencyRecord.deleteMany({ where: { expiresAt: { lte: now } } });

        const racedRecord = await tx.idempotencyRecord.findUnique({
          where: {
            installationId_endpoint_key: {
              installationId: principal.installationId,
              endpoint: CONTENT_ENDPOINT,
              key,
            },
          },
        });
        const racedAdmission = this.existingAdmission(racedRecord, fingerprint, now);
        if (racedAdmission && racedAdmission.state !== "failed") return racedAdmission;

        const [dailyUsage, monthlyUsage] = await Promise.all([
          tx.aiUsage.aggregate({
            where: {
              installationId: principal.installationId,
              endpoint: CONTENT_ENDPOINT,
              status: { in: ["PENDING", "SUCCEEDED"] },
              createdAt: { gte: startOfUtcDay(now) },
            },
            _sum: { units: true },
          }),
          tx.aiUsage.aggregate({
            where: {
              installationId: principal.installationId,
              endpoint: CONTENT_ENDPOINT,
              status: { in: ["PENDING", "SUCCEEDED"] },
              createdAt: { gte: startOfUtcMonth(now) },
            },
            _sum: { units: true },
          }),
        ]);

        if ((dailyUsage._sum.units ?? 0) >= this.config.aiDailyQuota) {
          throw new SecurityError("QUOTA_EXCEEDED", 429, secondsUntil(new Date(startOfUtcDay(now).getTime() + 86_400_000), now));
        }
        if ((monthlyUsage._sum.units ?? 0) >= this.config.aiMonthlyQuota) {
          const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
          throw new SecurityError("QUOTA_EXCEEDED", 429, secondsUntil(nextMonth, now));
        }

        const usage = await tx.aiUsage.create({
          data: {
            installationId: principal.installationId,
            endpoint: CONTENT_ENDPOINT,
            status: "PENDING",
          },
        });
        const record = racedRecord?.status === "FAILED"
          ? await tx.idempotencyRecord.update({
              where: { id: racedRecord.id },
              data: {
                status: "PENDING",
                usageId: usage.id,
                responseJson: null,
                errorCode: null,
                completedAt: null,
                expiresAt,
              },
            })
          : await tx.idempotencyRecord.create({
              data: {
                installationId: principal.installationId,
                endpoint: CONTENT_ENDPOINT,
                key,
                requestFingerprint: fingerprint,
                status: "PENDING",
                usageId: usage.id,
                expiresAt,
              },
            });
        return { state: "reserved" as const, recordId: record.id, usageId: usage.id };
      });
      return reserved;
    } catch (error) {
      if (error instanceof SecurityError) throw error;
      const afterRace = this.existingAdmission(await this.findIdempotencyRecord(principal.installationId, key), fingerprint);
      if (afterRace) return afterRace;
      throw new SecurityError("SECURITY_UNAVAILABLE", 503);
    }
  }

  async completeGeneration(recordId: string, usageId: string, response: unknown): Promise<void> {
    const now = this.now();
    try {
      await this.db.$transaction([
        this.db.idempotencyRecord.update({
          where: { id: recordId },
          data: { status: "COMPLETED", responseJson: JSON.stringify(response), completedAt: now },
        }),
        this.db.aiUsage.update({
          where: { id: usageId },
          data: { status: "SUCCEEDED", providerModel: "gpt-5.2", completedAt: now },
        }),
      ]);
    } catch {
      throw new SecurityError("SECURITY_UNAVAILABLE", 503);
    }
  }

  async failGeneration(recordId: string, usageId: string, errorCode: string): Promise<void> {
    const now = this.now();
    try {
      await this.db.$transaction([
        this.db.idempotencyRecord.update({
          where: { id: recordId },
          data: { status: "FAILED", errorCode, completedAt: now },
        }),
        this.db.aiUsage.update({
          where: { id: usageId },
          data: { status: "FAILED", errorCode, completedAt: now },
        }),
      ]);
    } catch {
      // The original provider error remains safe to return; a later duplicate will not be admitted without a record.
    }
  }
}
