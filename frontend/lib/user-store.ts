import { compare, hash } from "bcryptjs";

import { prisma } from "@/lib/db";

export type AppUser = {
  id: string;
  email: string;
  passwordHash: string;
  role: "ADMIN" | "USER";
  createdAt: Date;
};

let adminBootstrapPromise: Promise<void> | null = null;

async function ensureAdminUser(): Promise<void> {
  if (adminBootstrapPromise) {
    return adminBootstrapPromise;
  }

  adminBootstrapPromise = (async () => {
    const defaultPassword = "Admin123456!";
    const email = (process.env.ADMIN_EMAIL ?? "admin@hr.local").toLowerCase();
    const password = process.env.ADMIN_PASSWORD ?? defaultPassword;

    if (process.env.NODE_ENV === "production") {
      if (!process.env.ADMIN_PASSWORD) {
        throw new Error("ADMIN_PASSWORD is required in production");
      }
      if (password === defaultPassword) {
        throw new Error("ADMIN_PASSWORD default value is not allowed in production");
      }
    }

    const passwordHash = await hash(password, 10);

    await prisma.user.upsert({
      where: { email },
      update: {
        role: "ADMIN",
        passwordHash
      },
      create: {
        email,
        passwordHash,
        role: "ADMIN"
      }
    });
  })();

  return adminBootstrapPromise;
}

export async function registerUser(input: {
  email: string;
  password: string;
  role?: "ADMIN" | "USER";
}): Promise<AppUser> {
  await ensureAdminUser();
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("USER_EXISTS");
  }
  const passwordHash = await hash(input.password, 10);

  const created = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: input.role ?? "USER"
    }
  });

  return {
    id: created.id,
    email: created.email,
    passwordHash: created.passwordHash,
    role: created.role,
    createdAt: created.createdAt
  };
}

export async function verifyUserPassword(
  user: AppUser,
  password: string
): Promise<boolean> {
  return compare(password, user.passwordHash);
}

export async function findUserByEmail(email: string): Promise<AppUser | null> {
  await ensureAdminUser();
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() }
  });
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    role: user.role,
    createdAt: user.createdAt
  };
}
