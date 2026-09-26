import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function applyDatabaseUrlFallback(): void {
  const directUrl = process.env.DATABASE_URL?.trim();
  if (directUrl) {
    return;
  }

  const asyncUrl = process.env.DATABASE_URL_ASYNC?.trim();
  if (asyncUrl) {
    process.env.DATABASE_URL = asyncUrl.replace(
      /^postgresql\+asyncpg:\/\//,
      "postgresql://"
    );
  }
}

applyDatabaseUrlFallback();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
