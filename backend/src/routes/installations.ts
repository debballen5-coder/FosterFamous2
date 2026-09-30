import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../http";
import {
  InstallationSecurityService,
  SecurityError,
} from "../services/installation-security";

const refreshSchema = z
  .object({ refreshCredential: z.string().trim().min(20).max(512) })
  .strict();

function sourceIp(headers: Headers): string {
  // The platform proxy may supply one of these values. It is only a supplemental
  // registration/refresh throttle until a future App Attest integration exists.
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return headers.get("cf-connecting-ip") ?? headers.get("x-real-ip") ?? forwarded ?? "unknown";
}

function errorResponse(c: { json: (value: unknown, status: 401 | 409 | 429 | 503) => Response; header: (name: string, value: string) => void }, error: SecurityError) {
  if (error.retryAfterSeconds) c.header("Retry-After", String(error.retryAfterSeconds));
  return c.json({ error: { message: error.message, code: error.code } }, error.status);
}

function tokensResponse(tokens: {
  accessToken: string;
  refreshCredential: string;
  accessExpiresAt: Date;
  accessExpiresInSeconds: number;
}) {
  return {
    accessToken: tokens.accessToken,
    refreshCredential: tokens.refreshCredential,
    accessExpiresAt: tokens.accessExpiresAt.toISOString(),
    accessExpiresInSeconds: tokens.accessExpiresInSeconds,
  };
}

export function createInstallationRouter(security = new InstallationSecurityService()) {
  const installationRouter = new Hono<AppEnv>();

  installationRouter.post("/register", async (c) => {
    try {
      const tokens = await security.register(sourceIp(c.req.raw.headers));
      return c.json({ data: tokensResponse(tokens) });
    } catch (error) {
      if (error instanceof SecurityError) return errorResponse(c, error);
      return c.json(
        { error: { message: "Foster Famous couldn't prepare this device right now. Please try again.", code: "SECURITY_UNAVAILABLE" } },
        503
      );
    }
  });

  installationRouter.post("/refresh", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        { error: { message: "Foster Famous couldn't verify this device right now. Please try again.", code: "AUTHENTICATION_REQUIRED" } },
        401
      );
    }

    const parsed = refreshSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { message: "Foster Famous couldn't verify this device right now. Please try again.", code: "AUTHENTICATION_REQUIRED" } },
        401
      );
    }

    try {
      const tokens = await security.refresh(parsed.data.refreshCredential, sourceIp(c.req.raw.headers));
      return c.json({ data: tokensResponse(tokens) });
    } catch (error) {
      if (error instanceof SecurityError) return errorResponse(c, error);
      return c.json(
        { error: { message: "Foster Famous couldn't verify this device right now. Please try again.", code: "SECURITY_UNAVAILABLE" } },
        503
      );
    }
  });

  return installationRouter;
}
