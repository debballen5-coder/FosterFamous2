import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./index";
import type { MediaSecurityConfig, MediaStorageClient } from "./routes/media";
import { InstallationSecurityService, type InstallationSecurityConfig } from "./services/installation-security";

const databasePath = join(tmpdir(), `foster-famous-media-${randomUUID()}.db`);
const databaseUrl = `file:${databasePath}`;
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

const securityConfig: InstallationSecurityConfig = {
  tokenSecret: "test-only-installation-token-secret-that-is-long-enough",
  accessTokenTtlSeconds: 60,
  refreshCredentialTtlDays: 90,
  aiRequestsPerTenMinutes: 20,
  aiDailyQuota: 100,
  aiMonthlyQuota: 1_000,
  aiGlobalRequestsPerMinute: 120,
  registrationRequestsPerHour: 100,
  refreshRequestsPerHour: 100,
  idempotencyRetentionHours: 24,
  mediaUploadsPerTenMinutes: 10,
  mediaGlobalUploadsPerMinute: 100,
};

const mediaConfig: MediaSecurityConfig = {
  imageMaxBytes: 25 * 1024 * 1024,
  videoMaxBytes: 150 * 1024 * 1024,
  uploadsPerDay: 100,
  retainedStorageBytes: 2 * 1024 * 1024 * 1024,
};

class FakeStorage implements MediaStorageClient {
  uploads = 0;
  deleted: string[] = [];
  deleteFails = false;
  invalidResponse = false;

  async upload(file: File) {
    this.uploads += 1;
    return {
      id: `storage-${this.uploads}`,
      url: this.invalidResponse ? "not-a-valid-storage-url" : `https://storage.example.test/${this.uploads}`,
      originalFilename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    };
  }

  async delete(storageFileId: string) {
    if (this.deleteFails) throw new Error("delete failed");
    this.deleted.push(storageFileId);
  }
}

function createTestApp(overrides: Partial<InstallationSecurityConfig> = {}, config = mediaConfig) {
  const storage = new FakeStorage();
  const security = new InstallationSecurityService({ db, config: { ...securityConfig, ...overrides } });
  return {
    app: createApp({ security, mediaDb: db, mediaStorage: storage, mediaConfig: config }),
    storage,
    security,
  };
}

async function register(app: ReturnType<typeof createApp>) {
  const response = await app.request("http://localhost/api/installations/register", { method: "POST" });
  expect(response.status).toBe(200);
  return (await response.json()) as { data: { accessToken: string } };
}

function jpegBytes(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
}

function mp4Bytes(): Uint8Array {
  return new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0x00]);
}

function upload(app: ReturnType<typeof createApp>, token: string, key: string, bytes = jpegBytes(), type = "image/jpeg") {
  const form = new FormData();
  const filename = type.startsWith("video/") ? "milo.mp4" : "milo.jpg";
  form.append("file", new File([bytes], filename, { type }));
  return app.request("http://localhost/api/media/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": key },
    body: form,
  });
}

beforeAll(() => {
  const pushed = Bun.spawnSync(["bunx", "prisma", "db", "push", "--skip-generate"], {
    cwd: import.meta.dir + "/..",
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdout: "ignore",
    stderr: "pipe",
  });
  if (pushed.exitCode !== 0) throw new Error(new TextDecoder().decode(pushed.stderr));
});

beforeEach(async () => {
  await db.idempotencyRecord.deleteMany();
  await db.aiUsage.deleteMany();
  await db.installationSession.deleteMany();
  await db.mediaObject.deleteMany();
  await db.installation.deleteMany();
  await db.rateLimitBucket.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
  for (const suffix of ["", "-journal", "-shm", "-wal"]) rmSync(`${databasePath}${suffix}`, { force: true });
});

describe("Launch 1B media security", () => {
  test("rejects unauthenticated, invalid, and expired uploads before storage", async () => {
    const { app, storage } = createTestApp();
    expect((await app.request("http://localhost/api/media/upload", { method: "POST" })).status).toBe(401);
    expect((await upload(app, "ff_at_invalid", "invalid-token-1")).status).toBe(401);

    const enrolled = await register(app);
    const principal = await new InstallationSecurityService({ db, config: securityConfig })
      .authenticate(`Bearer ${enrolled.data.accessToken}`);
    await db.installationSession.updateMany({ where: { installationId: principal.installationId }, data: { accessExpiresAt: new Date(0) } });
    expect((await upload(app, enrolled.data.accessToken, "expired-token-1")).status).toBe(401);
    expect(storage.uploads).toBe(0);
  });

  test("creates an owned server record and returns the app media ID", async () => {
    const { app, storage, security } = createTestApp();
    const enrolled = await register(app);
    const response = await upload(app, enrolled.data.accessToken, "valid-upload-1");
    expect(response.status).toBe(200);
    const body = await response.json() as { data: { mediaObjectId: string; storageFileId: string; mediaType: string } };
    expect(body.data.storageFileId).toBe("storage-1");
    expect(body.data.mediaType).toBe("image");
    expect(storage.uploads).toBe(1);

    const principal = await security.authenticate(`Bearer ${enrolled.data.accessToken}`);
    const media = await db.mediaObject.findUniqueOrThrow({ where: { id: body.data.mediaObjectId } });
    expect(media.installationId).toBe(principal.installationId);
    expect(media.status).toBe("AVAILABLE");
    expect(media.storageFileId).toBe("storage-1");
  });

  test("records video and thumbnail uploads as separate owned media objects", async () => {
    const { app, storage, security } = createTestApp();
    const enrolled = await register(app);
    const video = await upload(app, enrolled.data.accessToken, "video-upload-primary-1", mp4Bytes(), "video/mp4");
    const thumbnail = await upload(app, enrolled.data.accessToken, "video-upload-thumbnail-1", jpegBytes(), "image/jpeg");

    expect(video.status).toBe(200);
    expect(thumbnail.status).toBe(200);
    expect(storage.uploads).toBe(2);

    const principal = await security.authenticate(`Bearer ${enrolled.data.accessToken}`);
    const objects = await db.mediaObject.findMany({
      where: { installationId: principal.installationId },
      orderBy: { clientUploadId: "asc" },
    });
    expect(objects).toHaveLength(2);
    expect(objects.map((object) => object.mediaType).sort()).toEqual(["image", "video"]);
    expect(objects.every((object) => object.status === "AVAILABLE")).toBe(true);
  });

  test("uses one cloud upload for a repeated idempotency key", async () => {
    const { app, storage } = createTestApp();
    const enrolled = await register(app);
    const first = await upload(app, enrolled.data.accessToken, "same-upload-action-1");
    const second = await upload(app, enrolled.data.accessToken, "same-upload-action-1");
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.clone().json());
    expect(storage.uploads).toBe(1);
  });

  test("rejects spoofed types, oversized media, quotas, and rate abuse before storage", async () => {
    const invalid = createTestApp();
    const invalidEnrollment = await register(invalid.app);
    expect((await upload(invalid.app, invalidEnrollment.data.accessToken, "spoofed-media-1", new Uint8Array([1, 2, 3]), "image/jpeg")).status).toBe(400);
    expect(invalid.storage.uploads).toBe(0);

    const tiny = createTestApp({}, { ...mediaConfig, imageMaxBytes: 4 });
    const tinyEnrollment = await register(tiny.app);
    expect((await upload(tiny.app, tinyEnrollment.data.accessToken, "oversized-media-1")).status).toBe(413);
    expect(tiny.storage.uploads).toBe(0);

    const quota = createTestApp({}, { ...mediaConfig, uploadsPerDay: 1 });
    const quotaEnrollment = await register(quota.app);
    expect((await upload(quota.app, quotaEnrollment.data.accessToken, "quota-media-one-1")).status).toBe(200);
    expect((await upload(quota.app, quotaEnrollment.data.accessToken, "quota-media-two-1")).status).toBe(429);
    expect(quota.storage.uploads).toBe(1);

    await db.rateLimitBucket.deleteMany();
    await db.mediaObject.deleteMany();
    const rate = createTestApp({ mediaUploadsPerTenMinutes: 1 });
    const rateEnrollment = await register(rate.app);
    expect((await upload(rate.app, rateEnrollment.data.accessToken, "rate-media-one-1")).status).toBe(200);
    expect((await upload(rate.app, rateEnrollment.data.accessToken, "rate-media-two-1")).status).toBe(429);
    expect(rate.storage.uploads).toBe(1);
  });

  test("attempts cloud cleanup when a completed upload cannot become a valid ownership response", async () => {
    const { app, storage } = createTestApp();
    storage.invalidResponse = true;
    const enrolled = await register(app);

    const response = await upload(app, enrolled.data.accessToken, "orphan-cleanup-upload-1");
    expect(response.status).toBe(503);
    expect(storage.deleted).toEqual(["storage-1"]);
    const record = await db.mediaObject.findFirstOrThrow({ where: { clientUploadId: "orphan-cleanup-upload-1" } });
    expect(record.status).toBe("FAILED");
  });

  test("enforces ownership for deletion and only marks a record deleted after cloud deletion", async () => {
    const { app, storage } = createTestApp();
    const owner = await register(app);
    const other = await register(app);
    const uploaded = await upload(app, owner.data.accessToken, "owner-media-delete-1");
    const { data } = await uploaded.json() as { data: { mediaObjectId: string } };

    const denied = await app.request(`http://localhost/api/media/${data.mediaObjectId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${other.data.accessToken}` },
    });
    expect(denied.status).toBe(404);
    expect(storage.deleted).toEqual([]);

    storage.deleteFails = true;
    const failed = await app.request(`http://localhost/api/media/${data.mediaObjectId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${owner.data.accessToken}` },
    });
    expect(failed.status).toBe(502);
    expect((await db.mediaObject.findUniqueOrThrow({ where: { id: data.mediaObjectId } })).deletedAt).toBeNull();

    storage.deleteFails = false;
    const deleted = await app.request(`http://localhost/api/media/${data.mediaObjectId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${owner.data.accessToken}` },
    });
    expect(deleted.status).toBe(200);
    expect(storage.deleted).toEqual(["storage-1"]);
    expect((await db.mediaObject.findUniqueOrThrow({ where: { id: data.mediaObjectId } })).deletedAt).not.toBeNull();
  });
});
