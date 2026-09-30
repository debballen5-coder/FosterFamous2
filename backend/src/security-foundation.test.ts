import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./index";
import {
  InstallationSecurityService,
  type InstallationSecurityConfig,
} from "./services/installation-security";
import type { ContentGenerationResponse } from "./types";

const databasePath = join(tmpdir(), `foster-famous-security-${randomUUID()}.db`);
const databaseUrl = `file:${databasePath}`;
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

const config: InstallationSecurityConfig = {
  tokenSecret: "test-only-installation-token-secret-that-is-long-enough",
  accessTokenTtlSeconds: 60,
  refreshCredentialTtlDays: 90,
  aiRequestsPerTenMinutes: 20,
  aiDailyQuota: 100,
  aiMonthlyQuota: 1_000,
  aiGlobalRequestsPerMinute: 120,
  registrationRequestsPerHour: 10,
  refreshRequestsPerHour: 60,
  idempotencyRetentionHours: 24,
  mediaUploadsPerTenMinutes: 10,
  mediaGlobalUploadsPerMinute: 60,
};

const validBody = {
  contentType: "Facebook Post",
  foster: {
    id: "foster-1",
    name: "Milo",
    species: "dog",
    sex: "Male",
    age: "",
    breed: "Mixed breed",
    weight: "",
    size: null,
    fosterStartDate: null,
    daysInFoster: null,
    personality: [],
    personalityNotes: "",
    goodWithDogs: "Unknown",
    goodWithCats: "Unknown",
    goodWithChildren: "Unknown",
    childrenNotes: "",
    houseTrained: "Unknown",
    crateTrained: "Unknown",
    energyLevel: null,
    special: {
      favoriteActivity: "",
      favoriteToy: "",
      favoriteTreat: "",
      funniestHabit: "",
      bestSkill: "",
      mostLovableQuality: "",
      makesYouLaugh: "",
      progressMade: "",
      idealHome: "",
    },
    currentStatus: "",
    latestProgress: null,
    rescueName: "",
    city: "",
    state: "",
    adoptionUrl: "",
    contactMethod: "",
    adoptionFee: "",
    adoptionStatus: "Available",
    considerations: [],
  },
  tone: "Warm",
  length: "Medium",
  source: { type: "story", description: "Milo carried his toy to bed.", mediaUrl: null },
};

const generatedResponse: ContentGenerationResponse = {
  result: {
    hook: "Meet Milo",
    caption: "Milo is waiting for a home.",
    callToAction: "Contact the shelter or rescue for current adoption details.",
    onScreenText: "Meet Milo",
    keywords: ["rescue dog"],
    hashtags: ["#rescue"],
    shortVersion: "Meet Milo.",
    notes: [],
    warnings: [],
    idea: null,
    whatToCapture: null,
    suggestedFormat: null,
    whyThisHelps: null,
    shotList: [],
    suggestedLength: null,
    audioDirection: null,
    stickerSuggestion: null,
  },
  generatedAt: "2026-09-16T00:00:00.000Z",
  model: "gpt-5.6",
};

async function register(app: ReturnType<typeof createApp>) {
  const response = await app.request("http://localhost/api/installations/register", { method: "POST" });
  expect(response.status).toBe(200);
  return (await response.json()) as {
    data: { accessToken: string; refreshCredential: string };
  };
}

function createTestApp(
  overrides: Partial<InstallationSecurityConfig> = {},
  generateOverride?: (request: typeof validBody) => Promise<ContentGenerationResponse>
) {
  let providerCalls = 0;
  const requests: typeof validBody[] = [];
  const security = new InstallationSecurityService({ db, config: { ...config, ...overrides } });
  const app = createApp({
    security,
    mediaDb: db,
    generator: {
      generate: async (request) => {
        providerCalls += 1;
        requests.push(request as typeof validBody);
        return generateOverride ? generateOverride(request as typeof validBody) : generatedResponse;
      },
    },
  });
  return { app, security, providerCalls: () => providerCalls, requests: () => requests };
}

async function generate(
  app: ReturnType<typeof createApp>,
  accessToken: string,
  idempotencyKey: string,
  body: unknown = validBody
) {
  return app.request("http://localhost/api/content/generate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
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
  rmSync(databasePath, { force: true });
  rmSync(`${databasePath}-journal`, { force: true });
  rmSync(`${databasePath}-shm`, { force: true });
  rmSync(`${databasePath}-wal`, { force: true });
});

describe("anonymous installation security", () => {
  test("first use registers an opaque credential and accepts its short-lived access token", async () => {
    const { app, providerCalls } = createTestApp();
    const enrolled = await register(app);

    expect(enrolled.data.accessToken).toStartWith("ff_at_");
    expect(enrolled.data.refreshCredential).toStartWith("ff_rt_");

    const response = await generate(app, enrolled.data.accessToken, "security-first-use-1");
    expect(response.status).toBe(200);
    expect(providerCalls()).toBe(1);

    const storedSession = await db.installationSession.findFirstOrThrow();
    expect(storedSession.accessTokenHash).not.toContain(enrolled.data.accessToken);
    expect(storedSession.refreshTokenHash).not.toContain(enrolled.data.refreshCredential);
  });

  test("missing and invalid access tokens never reach the provider", async () => {
    const { app, providerCalls } = createTestApp();

    const missing = await app.request("http://localhost/api/content/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "missing-token-1" },
      body: JSON.stringify(validBody),
    });
    const invalid = await generate(app, "ff_at_not_a_real_token", "invalid-token-1");

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(providerCalls()).toBe(0);
  });

  test("refresh rotates credentials and invalidates the previous access token", async () => {
    const { app, providerCalls } = createTestApp();
    const enrolled = await register(app);
    const refreshed = await app.request("http://localhost/api/installations/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshCredential: enrolled.data.refreshCredential }),
    });
    expect(refreshed.status).toBe(200);
    const refreshedBody = (await refreshed.json()) as { data: { accessToken: string; refreshCredential: string } };

    expect(refreshedBody.data.accessToken).not.toBe(enrolled.data.accessToken);
    expect(refreshedBody.data.refreshCredential).not.toBe(enrolled.data.refreshCredential);
    expect((await generate(app, enrolled.data.accessToken, "old-access-token-1")).status).toBe(401);
    expect((await generate(app, refreshedBody.data.accessToken, "new-access-token-1")).status).toBe(200);
    expect(providerCalls()).toBe(1);
  });

  test("revoked installations are rejected before the provider is called", async () => {
    const { app, security, providerCalls } = createTestApp();
    const enrolled = await register(app);
    const principal = await security.authenticate(`Bearer ${enrolled.data.accessToken}`);
    await db.installation.update({ where: { id: principal.installationId }, data: { status: "REVOKED", revokedAt: new Date() } });

    const response = await generate(app, enrolled.data.accessToken, "revoked-installation-1");
    expect(response.status).toBe(401);
    expect(providerCalls()).toBe(0);
  });

  test("rate and quota denials never call the provider", async () => {
    const rateLimited = createTestApp({ aiRequestsPerTenMinutes: 1, aiDailyQuota: 10 });
    const rateEnrollment = await register(rateLimited.app);
    expect((await generate(rateLimited.app, rateEnrollment.data.accessToken, "rate-limit-one-1")).status).toBe(200);
    expect((await generate(rateLimited.app, rateEnrollment.data.accessToken, "rate-limit-two-1")).status).toBe(429);
    expect(rateLimited.providerCalls()).toBe(1);

    await db.rateLimitBucket.deleteMany();
    const quotaLimited = createTestApp({ aiRequestsPerTenMinutes: 10, aiDailyQuota: 1 });
    const quotaEnrollment = await register(quotaLimited.app);
    expect((await generate(quotaLimited.app, quotaEnrollment.data.accessToken, "quota-limit-one-1")).status).toBe(200);
    expect((await generate(quotaLimited.app, quotaEnrollment.data.accessToken, "quota-limit-two-1")).status).toBe(429);
    expect(quotaLimited.providerCalls()).toBe(1);
  });

  test("one idempotency key creates at most one provider generation", async () => {
    const { app, providerCalls } = createTestApp();
    const enrolled = await register(app);

    const first = await generate(app, enrolled.data.accessToken, "same-generation-action-1");
    const second = await generate(app, enrolled.data.accessToken, "same-generation-action-1");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.clone().json());
    expect(providerCalls()).toBe(1);
  });

  test("an intentional new key creates a new provider generation", async () => {
    const { app, providerCalls } = createTestApp();
    const enrolled = await register(app);

    expect((await generate(app, enrolled.data.accessToken, "intentional-action-one-1")).status).toBe(200);
    expect((await generate(app, enrolled.data.accessToken, "intentional-action-two-1")).status).toBe(200);
    expect(providerCalls()).toBe(2);
  });

  test("Ralph and Charlie receive isolated provider requests and generated responses", async () => {
    const { app, providerCalls, requests } = createTestApp({}, async (request) => ({
      ...generatedResponse,
      result: {
        ...generatedResponse.result,
        hook: `Meet ${request.foster.name}`,
        caption: `${request.foster.name} has a distinct foster-home moment to share.`,
      },
    }));
    const enrolled = await register(app);
    const ralph = {
      ...validBody,
      foster: {
        ...validBody.foster,
        id: "ralph",
        name: "Ralph",
        species: "cat",
        age: "very young",
        personality: ["Cuddly", "Food motivated"],
      },
      source: { type: "story", description: "Ralph just finished a bottle and curled up in his blanket.", mediaUrl: null },
    };
    const charlie = {
      ...validBody,
      foster: {
        ...validBody.foster,
        id: "charlie",
        name: "Charlie",
        species: "dog",
        age: "2 years",
        personality: ["Curious", "Playful"],
      },
      source: { type: "story", description: "Charlie proudly learned a new puzzle toy today.", mediaUrl: null },
    };

    const ralphResponse = await generate(app, enrolled.data.accessToken, "ralph-generation-action-1", ralph);
    const charlieResponse = await generate(app, enrolled.data.accessToken, "charlie-generation-action-1", charlie);
    const ralphBody = (await ralphResponse.json()) as { data: ContentGenerationResponse };
    const charlieBody = (await charlieResponse.json()) as { data: ContentGenerationResponse };

    expect(ralphResponse.status).toBe(200);
    expect(charlieResponse.status).toBe(200);
    expect(providerCalls()).toBe(2);
    expect(requests().map((request) => request.foster.id)).toEqual(["ralph", "charlie"]);
    expect(requests()[1]?.source.description).toContain("puzzle toy");
    expect(charlieBody.data.result.caption).not.toBe(ralphBody.data.result.caption);
    expect(charlieBody.data.result.caption).toContain("Charlie");
    expect(charlieBody.data.result.caption).not.toContain("Ralph");
  });

  test("the same idempotency key with a different foster conflicts instead of replaying content", async () => {
    const { app, providerCalls } = createTestApp();
    const enrolled = await register(app);
    const charlie = {
      ...validBody,
      foster: { ...validBody.foster, id: "charlie", name: "Charlie", species: "dog" },
      source: { type: "story", description: "Charlie learned a puzzle toy.", mediaUrl: null },
    };

    expect((await generate(app, enrolled.data.accessToken, "cross-foster-collision-1", validBody)).status).toBe(200);
    const conflict = await generate(app, enrolled.data.accessToken, "cross-foster-collision-1", charlie);

    expect(conflict.status).toBe(409);
    expect((await conflict.json())).toMatchObject({ error: { code: "IDEMPOTENCY_KEY_REUSED" } });
    expect(providerCalls()).toBe(1);
  });

  test("a failed generation can retry its exact idempotency action", async () => {
    let attempts = 0;
    const { app, providerCalls } = createTestApp({}, async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary provider outage");
      return generatedResponse;
    });
    const enrolled = await register(app);
    const actionKey = "failed-generation-retry-1";

    expect((await generate(app, enrolled.data.accessToken, actionKey)).status).toBe(502);
    expect((await generate(app, enrolled.data.accessToken, actionKey)).status).toBe(200);
    expect(providerCalls()).toBe(2);

    const record = await db.idempotencyRecord.findFirstOrThrow({ where: { key: actionKey } });
    expect(record.status).toBe("COMPLETED");
  });

  test("an expired idempotency record is not replayed", async () => {
    const { app, providerCalls } = createTestApp();
    const enrolled = await register(app);

    expect((await generate(app, enrolled.data.accessToken, "expired-generation-action-1")).status).toBe(200);
    await db.idempotencyRecord.updateMany({ data: { expiresAt: new Date(Date.now() - 1_000) } });
    expect((await generate(app, enrolled.data.accessToken, "expired-generation-action-1")).status).toBe(200);
    expect(providerCalls()).toBe(2);
  });

  test("media now uses the same authentication layer", async () => {
    const { app } = createTestApp();
    const response = await app.request("http://localhost/api/media/upload", { method: "POST" });
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });
});
