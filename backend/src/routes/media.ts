import { Hono, type Context } from "hono";
import type { PrismaClient } from "@prisma/client";
import { env } from "../env";
import type { AppEnv } from "../http";
import { prisma } from "../prisma";
import { InstallationSecurityService, SecurityError } from "../services/installation-security";
import { UploadedMediaFileSchema, type UploadedMediaFile } from "../types";

const STORAGE_UPLOAD_URL = "https://storage.vibecodeapp.com/v1/files/upload";
const STORAGE_FILE_URL = "https://storage.vibecodeapp.com/v1/files";
const UPLOAD_ID_PATTERN = /^[A-Za-z0-9._~-]{8,200}$/;
const MAX_FILENAME_LENGTH = 500;
const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

type MediaKind = "image" | "video";
type SupportedMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/heic"
  | "image/heif"
  | "video/mp4"
  | "video/quicktime";

export interface StorageFile {
  id: string;
  url: string;
  originalFilename?: string;
  contentType?: string;
  sizeBytes?: number;
}

export interface MediaStorageClient {
  upload: (file: File) => Promise<StorageFile>;
  delete: (storageFileId: string) => Promise<void>;
}

export interface MediaSecurityConfig {
  imageMaxBytes: number;
  videoMaxBytes: number;
  uploadsPerDay: number;
  retainedStorageBytes: number;
}

function positiveInteger(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function mediaSecurityConfigFromEnv(): MediaSecurityConfig {
  return {
    imageMaxBytes: positiveInteger(env.MEDIA_IMAGE_MAX_BYTES, 25 * 1024 * 1024),
    videoMaxBytes: positiveInteger(env.MEDIA_VIDEO_MAX_BYTES, 150 * 1024 * 1024),
    uploadsPerDay: positiveInteger(env.MEDIA_UPLOADS_PER_DAY, 100),
    retainedStorageBytes: positiveInteger(env.MEDIA_RETAINED_STORAGE_BYTES, 2 * 1024 * 1024 * 1024),
  };
}

function isStorageFile(value: unknown): value is StorageFile {
  if (!value || typeof value !== "object") return false;
  const file = value as Record<string, unknown>;
  return typeof file.id === "string" && file.id.length > 0
    && typeof file.url === "string" && /^https:\/\//i.test(file.url);
}

export const vibecodeStorageClient: MediaStorageClient = {
  async upload(file) {
    const form = new FormData();
    form.append("file", file, file.name || "foster-media");

    let response: Response;
    try {
      response = await fetch(STORAGE_UPLOAD_URL, { method: "POST", body: form });
    } catch {
      throw new Error("STORAGE_UNAVAILABLE");
    }
    if (!response.ok) throw new Error("UPLOAD_FAILED");

    const payload = await response.json().catch(() => null) as { file?: unknown } | null;
    if (!isStorageFile(payload?.file)) throw new Error("INVALID_STORAGE_RESPONSE");
    return payload.file;
  },

  async delete(storageFileId) {
    let response: Response;
    try {
      response = await fetch(`${STORAGE_FILE_URL}/${encodeURIComponent(storageFileId)}`, { method: "DELETE" });
    } catch {
      throw new Error("STORAGE_UNAVAILABLE");
    }
    if (!response.ok) throw new Error("STORAGE_DELETE_FAILED");
  },
};

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

/**
 * Detect only the media formats the V1 picker supports. This is intentionally a
 * bounded magic-byte check, not a promise of complete malware scanning.
 */
function identifyMedia(bytes: Uint8Array): { mediaType: MediaKind; contentType: SupportedMediaType } | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mediaType: "image", contentType: "image/jpeg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mediaType: "image", contentType: "image/png" };
  }
  if (readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 4) === "WEBP") {
    return { mediaType: "image", contentType: "image/webp" };
  }
  if (readAscii(bytes, 4, 4) !== "ftyp") return null;

  const brand = readAscii(bytes, 8, 4).toLowerCase();
  if (brand === "qt  ") return { mediaType: "video", contentType: "video/quicktime" };
  if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
    return { mediaType: "image", contentType: brand.startsWith("hei") ? "image/heic" : "image/heif" };
  }
  // ISO Base Media File Format brands used by iPhone/Android MP4 exports.
  if (["isom", "iso2", "mp41", "mp42", "avc1", "dash", "m4v ", "3gp4"].includes(brand)) {
    return { mediaType: "video", contentType: "video/mp4" };
  }
  return null;
}

function sameDeclaredFamily(declared: string, identified: { mediaType: MediaKind; contentType: SupportedMediaType }): boolean {
  if (!declared) return true;
  const normalized = declared.toLowerCase().trim();
  if (normalized === identified.contentType) return true;
  return identified.contentType.startsWith("image/he")
    ? normalized === "image/heic" || normalized === "image/heif"
    : false;
}

function uploadResponse(record: {
  id: string;
  storageFileId: string | null;
  remoteUrl: string | null;
  originalName: string | null;
  mediaType: string | null;
  contentType: string | null;
  sizeBytes: number | null;
}): UploadedMediaFile | null {
  return UploadedMediaFileSchema.safeParse({
    mediaObjectId: record.id,
    storageFileId: record.storageFileId,
    url: record.remoteUrl,
    filename: record.originalName,
    mediaType: record.mediaType,
    contentType: record.contentType,
    sizeBytes: record.sizeBytes,
  }).data ?? null;
}

function mediaError(c: Context<AppEnv>, message: string, code: string, status: 400 | 401 | 404 | 409 | 413 | 429 | 502 | 503) {
  return c.json({ error: { message, code } }, status);
}

const errorMessage = {
  invalidUpload: "Choose a supported photo or video to upload.",
  tooLarge: "That file is too large to upload. Please choose a smaller photo or video.",
  quota: "You've reached this device's media upload limit. Please try again later.",
  unavailable: "Media storage is temporarily unavailable. Please try again.",
  uploadFailed: "The media file could not be uploaded. Please try again.",
  deleteFailed: "That cloud media item could not be removed yet. Please try again.",
} as const;

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function createMediaRouter(options: {
  security: InstallationSecurityService;
  db?: PrismaClient;
  storage?: MediaStorageClient;
  config?: MediaSecurityConfig;
}) {
  const db = options.db ?? prisma;
  const storage = options.storage ?? vibecodeStorageClient;
  const config = options.config ?? mediaSecurityConfigFromEnv();
  const mediaRouter = new Hono<AppEnv>();

  mediaRouter.post("/upload", async (c) => {
    const principal = c.get("installation");
    if (!principal) return mediaError(c, "Foster Famous couldn't verify this device right now. Please try again.", "AUTHENTICATION_REQUIRED", 401 as never);

    const declaredLength = Number(c.req.header("content-length"));
    if (Number.isSafeInteger(declaredLength) && declaredLength > config.videoMaxBytes + MULTIPART_OVERHEAD_BYTES) {
      return mediaError(c, errorMessage.tooLarge, "REQUEST_TOO_LARGE", 413);
    }

    const clientUploadId = c.req.header("idempotency-key");
    if (!clientUploadId || !UPLOAD_ID_PATTERN.test(clientUploadId)) {
      return mediaError(c, "Foster Famous couldn't safely identify that upload. Please try again.", "IDEMPOTENCY_KEY_REQUIRED", 409);
    }

    try {
      const existing = await db.mediaObject.findUnique({
        where: { installationId_clientUploadId: { installationId: principal.installationId, clientUploadId } },
      });
      if (existing?.status === "AVAILABLE") {
        const response = uploadResponse(existing);
        if (response) return c.json({ data: response });
      }
      if (existing?.status === "PENDING") {
        return mediaError(c, "That upload is still being processed. Please wait a moment.", "UPLOAD_IN_PROGRESS", 409);
      }

      // Admission comes before multipart parsing and every storage-provider call.
      await options.security.admitMediaUpload(principal);
    } catch (error) {
      if (error instanceof SecurityError) {
        if (error.retryAfterSeconds) c.header("Retry-After", String(error.retryAfterSeconds));
        return mediaError(c, error.message, error.code, error.status as 401 | 409 | 429 | 503);
      }
      return mediaError(c, errorMessage.unavailable, "SECURITY_UNAVAILABLE", 503);
    }

    const formData = await c.req.formData().catch(() => null);
    const file = formData?.get("file");
    if (!(file instanceof File)) return mediaError(c, "Choose a photo or video to upload.", "MISSING_FILE", 400);
    if (file.name.length > MAX_FILENAME_LENGTH) return mediaError(c, errorMessage.invalidUpload, "INVALID_UPLOAD", 400);

    // Bun's multipart File type exposes arrayBuffer but not the DOM slice type.
    // The request is already buffered by formData(), so inspect its leading bytes only.
    const header = new Uint8Array(await file.arrayBuffer()).subarray(0, 64);
    const identified = identifyMedia(header);
    if (!identified || !sameDeclaredFamily(file.type, identified)) {
      return mediaError(c, errorMessage.invalidUpload, "UNSUPPORTED_MEDIA", 400);
    }
    const maxBytes = identified.mediaType === "image" ? config.imageMaxBytes : config.videoMaxBytes;
    if (file.size > maxBytes) return mediaError(c, errorMessage.tooLarge, "FILE_TOO_LARGE", 413);

    const now = new Date();
    let record: { id: string };
    try {
      const [dailyUploads, activeStorage] = await Promise.all([
        db.mediaObject.count({
          where: {
            installationId: principal.installationId,
            createdAt: { gte: startOfUtcDay(now) },
            status: { in: ["PENDING", "AVAILABLE"] },
          },
        }),
        db.mediaObject.aggregate({
          where: { installationId: principal.installationId, status: "AVAILABLE", deletedAt: null },
          _sum: { sizeBytes: true },
        }),
      ]);
      if (dailyUploads >= config.uploadsPerDay || (activeStorage._sum.sizeBytes ?? 0) + file.size > config.retainedStorageBytes) {
        return mediaError(c, errorMessage.quota, "MEDIA_QUOTA_EXCEEDED", 429);
      }

      const existing = await db.mediaObject.findUnique({
        where: { installationId_clientUploadId: { installationId: principal.installationId, clientUploadId } },
      });
      record = existing
        ? await db.mediaObject.update({
            where: { id: existing.id },
            data: {
              status: "PENDING",
              storageFileId: null,
              remoteUrl: null,
              originalName: file.name || "foster-media",
              mediaType: identified.mediaType,
              contentType: identified.contentType,
              sizeBytes: file.size,
              availableAt: null,
              deletedAt: null,
            },
            select: { id: true },
          })
        : await db.mediaObject.create({
            data: {
              installationId: principal.installationId,
              clientUploadId,
              originalName: file.name || "foster-media",
              mediaType: identified.mediaType,
              contentType: identified.contentType,
              sizeBytes: file.size,
              status: "PENDING",
              visibility: "PUBLIC_CDN",
            },
            select: { id: true },
          });
    } catch {
      return mediaError(c, errorMessage.unavailable, "SECURITY_UNAVAILABLE", 503);
    }

    let uploaded: StorageFile;
    try {
      uploaded = await storage.upload(file);
    } catch (error) {
      await db.mediaObject.update({ where: { id: record.id }, data: { status: "FAILED" } }).catch(() => undefined);
      const code = error instanceof Error ? error.message : "UPLOAD_FAILED";
      return mediaError(c, code === "STORAGE_UNAVAILABLE" ? errorMessage.unavailable : errorMessage.uploadFailed, code, code === "STORAGE_UNAVAILABLE" ? 503 : 502);
    }

    try {
      const completed = await db.mediaObject.update({
        where: { id: record.id },
        data: {
          storageFileId: uploaded.id,
          remoteUrl: uploaded.url,
          originalName: uploaded.originalFilename || file.name || "foster-media",
          mediaType: identified.mediaType,
          contentType: identified.contentType,
          sizeBytes: file.size,
          status: "AVAILABLE",
          availableAt: now,
        },
      });
      const response = uploadResponse(completed);
      if (!response) throw new Error("INVALID_STORAGE_RESPONSE");
      return c.json({ data: response });
    } catch {
      // A provider object without an ownership record must not become an orphan.
      await storage.delete(uploaded.id).catch(() => undefined);
      await db.mediaObject.update({ where: { id: record.id }, data: { status: "FAILED" } }).catch(() => undefined);
      return mediaError(c, errorMessage.unavailable, "OWNERSHIP_RECORD_FAILED", 503);
    }
  });

  mediaRouter.delete("/:mediaObjectId", async (c) => {
    const principal = c.get("installation");
    if (!principal) return mediaError(c, "Foster Famous couldn't verify this device right now. Please try again.", "AUTHENTICATION_REQUIRED", 401 as never);

    const mediaObjectId = c.req.param("mediaObjectId");
    let record;
    try {
      record = await db.mediaObject.findFirst({ where: { id: mediaObjectId, installationId: principal.installationId } });
    } catch {
      return mediaError(c, errorMessage.unavailable, "SECURITY_UNAVAILABLE", 503);
    }
    // Do not reveal whether another installation owns a guessed ID.
    if (!record) return mediaError(c, "That media item could not be found.", "MEDIA_NOT_FOUND", 404);
    if (record.deletedAt) return c.json({ data: { deleted: true } });
    if (!record.storageFileId || record.status !== "AVAILABLE") {
      return mediaError(c, errorMessage.deleteFailed, "MEDIA_NOT_AVAILABLE", 409);
    }

    try {
      await storage.delete(record.storageFileId);
    } catch {
      return mediaError(c, errorMessage.deleteFailed, "STORAGE_DELETE_FAILED", 502);
    }

    try {
      await db.mediaObject.update({ where: { id: record.id }, data: { deletedAt: new Date(), status: "DELETED" } });
      return c.json({ data: { deleted: true } });
    } catch {
      // The provider already confirmed deletion, but it would be dishonest to say the
      // server record was updated. Preserve a retryable local record instead.
      return mediaError(c, errorMessage.deleteFailed, "OWNERSHIP_RECORD_FAILED", 503);
    }
  });

  return mediaRouter;
}
