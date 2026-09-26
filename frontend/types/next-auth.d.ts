import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    sessionId?: string;
    persistent?: boolean;
    expiresAt?: string;
    user: DefaultSession["user"] & {
      role: "ADMIN" | "USER";
    };
  }

  interface User {
    role: "ADMIN" | "USER";
    sessionId?: string;
    persistent?: boolean;
    expiresAt?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "ADMIN" | "USER";
    sessionId?: string;
    persistent?: boolean;
    expiresAt?: string;
  }
}
