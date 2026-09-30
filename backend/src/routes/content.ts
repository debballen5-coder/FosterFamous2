import { Hono } from "hono";
import { ZodError } from "zod";
import { env } from "../env";
import type { AppEnv } from "../http";
import {
  ContentGenerationError,
  ContentGenerationService,
} from "../services/content-generation";
import {
  InstallationSecurityService,
  SecurityError,
} from "../services/installation-security";
import { ContentGenerationRequestSchema } from "../types";

const configuredMaxRequestBytes = Number(env.MAX_CONTENT_REQUEST_BYTES);
const DEFAULT_MAX_CONTENT_REQUEST_BYTES =
  Number.isSafeInteger(configuredMaxRequestBytes) && configuredMaxRequestBytes > 0
    ? configuredMaxRequestBytes
    : 65_536;

type Generator = Pick<ContentGenerationService, "generate">;

function contentError(c: { json: (value: unknown, status: 401 | 409 | 429 | 503) => Response; header: (name: string, value: string) => void }, error: SecurityError) {
  if (error.retryAfterSeconds) c.header("Retry-After", String(error.retryAfterSeconds));
  return c.json({ error: { message: error.message, code: error.code } }, error.status as 409 | 429 | 503);
}

export function createContentRouter(options: {
  security?: InstallationSecurityService;
  generator?: Generator;
  maxRequestBytes?: number;
} = {}) {
  const contentRouter = new Hono<AppEnv>();
  const security = options.security ?? new InstallationSecurityService();
  const generator = options.generator ?? new ContentGenerationService();
  const maxRequestBytes = options.maxRequestBytes ?? DEFAULT_MAX_CONTENT_REQUEST_BYTES;

  contentRouter.post("/generate", async (c) => {
    const contentLength = Number(c.req.header("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
      return c.json(
        { error: { message: "Request is too large to create safely.", code: "REQUEST_TOO_LARGE" } },
        413
      );
    }

    const installation = c.get("installation");
    if (!installation) {
      return c.json(
        { error: { message: "Foster Famous couldn't verify this device right now. Please try again.", code: "AUTHENTICATION_REQUIRED" } },
        401
      );
    }

    const idempotencyKey = c.req.header("idempotency-key");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { message: "Request body must be valid JSON.", code: "INVALID_JSON" } }, 400);
    }

    const validated = ContentGenerationRequestSchema.safeParse(body);
    if (!validated.success) {
      return c.json(
        {
          error: {
            message: "Request validation failed.",
            code: "VALIDATION_ERROR",
            details: validated.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          },
        },
        400
      );
    }

    let admission;
    try {
      admission = await security.reserveGeneration(installation, idempotencyKey, validated.data);
    } catch (error) {
      if (error instanceof SecurityError) return contentError(c, error);
      return c.json(
        { error: { message: "Foster Famous couldn't create that right now. Please try again.", code: "SECURITY_UNAVAILABLE" } },
        503
      );
    }

    if (admission.state === "completed") return c.json({ data: admission.response });
    if (admission.state === "in-progress") {
      return c.json(
        { error: { message: "Foster Famous is still creating that draft. Please try again shortly.", code: "GENERATION_IN_PROGRESS" } },
        409
      );
    }
    if (admission.state === "failed") {
      return c.json(
        { error: { message: "Foster Famous couldn't create that right now. Please try again with a new request.", code: "GENERATION_RETRY_LATER" } },
        409
      );
    }

    try {
      const result = await generator.generate(validated.data);
      await security.completeGeneration(admission.recordId, admission.usageId, result);
      return c.json({ data: result });
    } catch (error) {
      const errorCode = error instanceof ContentGenerationError ? error.code : "AI_UNAVAILABLE";
      await security.failGeneration(admission.recordId, admission.usageId, errorCode);
      if (error instanceof ContentGenerationError) {
        return c.json({ error: { message: error.message, code: error.code } }, error.status as 502 | 503 | 504);
      }
      if (error instanceof ZodError) {
        return c.json(
          { error: { message: "Generated content failed safety validation.", code: "AI_INVALID_RESPONSE" } },
          502
        );
      }
      console.error("Unexpected content generation error", error);
      return c.json(
        { error: { message: "Content generation is temporarily unavailable.", code: "AI_UNAVAILABLE" } },
        502
      );
    }
  });

  return contentRouter;
}

export const contentRouter = createContentRouter();
