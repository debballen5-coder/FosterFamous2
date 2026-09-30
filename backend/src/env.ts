import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

/**
 * Supplies only local development fallbacks without changing production
 * environment precedence. The signing key is deliberately development-only:
 * production must provide its own 32+ character server secret.
 */
function localDevelopmentEnv(): Record<string, string> {
  if (process.env.NODE_ENV === "production") return {};

  const defaults: Record<string, string> = {
    DATABASE_URL: "file:./dev.db",
    INSTALLATION_TOKEN_SECRET: "foster-famous-local-development-signing-key-2026",
  };

  try {
    const source = readFileSync(join(import.meta.dir, "../.env"), "utf8");
    return source.split(/\r?\n/).reduce<Record<string, string>>((values, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return values;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) return values;
      const key = match[1];
      const rawValue = match[2];
      if (!key || rawValue === undefined) return values;
      values[key] = rawValue.replace(/^(["'])(.*)\1$/, "$2");
      return values;
    }, defaults);
  } catch {
    return defaults;
  }
}

/**
 * Environment variable schema using Zod
 * This ensures all required environment variables are present and valid
 */
const envSchema = z.object({
  // Server configuration
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z.string().optional().default("development"),
  DATABASE_URL: z.string().min(1).optional().default("file:./dev.db"),

  // Server-only provider and anonymous-installation security configuration.
  OPENAI_API_KEY: z.string().optional().default(""),
  INSTALLATION_TOKEN_SECRET: z.string().min(32).optional(),
  ACCESS_TOKEN_TTL_SECONDS: z.string().optional().default("900"),
  REFRESH_CREDENTIAL_TTL_DAYS: z.string().optional().default("90"),

  // Financial and abuse safety controls. Values remain server-configurable.
  AI_REQUESTS_PER_10_MINUTES: z.string().optional().default("20"),
  AI_DAILY_QUOTA: z.string().optional().default("100"),
  AI_MONTHLY_QUOTA: z.string().optional().default("1000"),
  AI_GLOBAL_REQUESTS_PER_MINUTE: z.string().optional().default("120"),
  REGISTRATION_REQUESTS_PER_HOUR: z.string().optional().default("10"),
  REFRESH_REQUESTS_PER_HOUR: z.string().optional().default("60"),
  MAX_CONTENT_REQUEST_BYTES: z.string().optional().default("65536"),
  IDEMPOTENCY_RETENTION_HOURS: z.string().optional().default("24"),

  // Media safety limits. Values are server-configurable so release operations
  // can adjust capacity without changing app code.
  MEDIA_IMAGE_MAX_BYTES: z.string().optional().default(String(25 * 1024 * 1024)),
  MEDIA_VIDEO_MAX_BYTES: z.string().optional().default(String(150 * 1024 * 1024)),
  MEDIA_UPLOADS_PER_DAY: z.string().optional().default("100"),
  MEDIA_UPLOADS_PER_10_MINUTES: z.string().optional().default("10"),
  MEDIA_GLOBAL_UPLOADS_PER_MINUTE: z.string().optional().default("60"),
  MEDIA_RETAINED_STORAGE_BYTES: z.string().optional().default(String(2 * 1024 * 1024 * 1024)),
});

/**
 * Validate and parse environment variables
 */
function parseCurrentEnv() {
  return envSchema.parse({ ...localDevelopmentEnv(), ...process.env });
}

function validateEnv() {
  try {
    const parsed = parseCurrentEnv();
    console.log("✅ Environment variables validated successfully");
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment variable validation failed:");
      error.issues.forEach((err: any) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      console.error("\nPlease check your .env file and ensure all required variables are set.");
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Validated and typed environment variables
 */
export const env = validateEnv();

/** Re-read validated local development configuration after a hot reload. */
export function currentEnv(): z.infer<typeof envSchema> {
  return parseCurrentEnv();
}

/**
 * Type of the validated environment variables
 */
export type Env = z.infer<typeof envSchema>;

