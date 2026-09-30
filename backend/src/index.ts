import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
import { Hono, type Context, type Next } from "hono";
import type { PrismaClient } from "@prisma/client";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./env";
import type { AppEnv } from "./http";
import { createContentRouter } from "./routes/content";
import { createInstallationRouter } from "./routes/installations";
import { createMediaRouter, type MediaSecurityConfig, type MediaStorageClient } from "./routes/media";
import { sampleRouter } from "./routes/sample";
import { ContentGenerationService } from "./services/content-generation";
import {
  InstallationSecurityService,
  SecurityError,
} from "./services/installation-security";

// CORS middleware - validates origin against allowlist
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecodeapp\.com$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.dev$/,
  /^https:\/\/vibecode\.dev$/,
];

type Generator = Pick<ContentGenerationService, "generate">;

export function createApp(options: {
  security?: InstallationSecurityService;
  generator?: Generator;
  mediaStorage?: MediaStorageClient;
  mediaConfig?: MediaSecurityConfig;
  mediaDb?: PrismaClient;
} = {}) {
  const security = options.security ?? new InstallationSecurityService();
  const app = new Hono<AppEnv>();

  app.use(
    "*",
    cors({
      origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
    })
  );

  // Logging does not log request authorization headers or credential bodies.
  app.use("*", logger());

  // Launch 1A and 1B use the same authenticated anonymous-installation context.
  const requireInstallation = async (c: Context<AppEnv>, next: Next) => {
    try {
      c.set("installation", await security.authenticate(c.req.header("authorization")));
      await next();
    } catch (error) {
      const securityError = error instanceof SecurityError
        ? error
        : new SecurityError("SECURITY_UNAVAILABLE", 503);
      if (securityError.retryAfterSeconds) {
        c.header("Retry-After", String(securityError.retryAfterSeconds));
      }
      return c.json(
        { error: { message: securityError.message, code: securityError.code } },
        securityError.status as 401 | 503
      );
    }
  };
  app.use("/api/content/*", requireInstallation);
  // This runs before multipart parsing or any call to the storage provider.
  app.use("/api/media/*", requireInstallation);

  // Health check endpoint
  app.get("/health", (c) => c.json({ status: "ok" }));

  // Routes
  app.route("/api/sample", sampleRouter);
  app.route("/api/installations", createInstallationRouter(security));
  app.route("/api/content", createContentRouter({ security, generator: options.generator }));
  app.route("/api/media", createMediaRouter({ security, db: options.mediaDb, storage: options.mediaStorage, config: options.mediaConfig }));

  return app;
}

const app = createApp();
const port = Number(env.PORT);

export default {
  port,
  fetch: app.fetch,
};
