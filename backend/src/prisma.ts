import { PrismaClient } from "@prisma/client";
import { currentEnv } from "./env";

const prismaModuleInstance = Symbol("prisma-module-instance");

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaDatabaseUrl?: string;
  prismaModuleInstance?: symbol;
};

/** Returns the current Prisma client, refreshing it when local dev configuration changes. */
export function getPrisma(): PrismaClient {
  const databaseUrl = currentEnv().DATABASE_URL;
  const existing = globalForPrisma.prisma;
  const canReuseExisting = process.env.NODE_ENV === "production"
    || (
      globalForPrisma.prismaDatabaseUrl === databaseUrl
      && globalForPrisma.prismaModuleInstance === prismaModuleInstance
    );
  if (existing && canReuseExisting) return existing;

  if (existing) void existing.$disconnect();

  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  globalForPrisma.prisma = client;
  globalForPrisma.prismaDatabaseUrl = databaseUrl;
  globalForPrisma.prismaModuleInstance = prismaModuleInstance;
  return client;
}

export const prisma = getPrisma();
