import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rawPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const rawPageSize = Number.parseInt(searchParams.get("pageSize") ?? "15", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0
    ? Math.min(rawPageSize, 100)
    : 15;
  const skip = (page - 1) * pageSize;

  const where: Prisma.FeedbackWhereInput = { rating: -1 };

  const [total, rows] = await prisma.$transaction([
    prisma.feedback.count({ where }),
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        message: {
          select: {
            id: true,
            sessionId: true,
            content: true
          }
        },
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    })
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    page,
    pageSize,
    total,
    totalPages,
    items: rows.map((row) => ({
      id: row.id,
      messageId: row.messageId,
      comment: row.comment,
      createdAt: row.createdAt.toISOString(),
      userId: row.userId,
      userEmail: row.user.email,
      sessionId: row.message.sessionId,
      messageContent: row.message.content
    }))
  });
}
