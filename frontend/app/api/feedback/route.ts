import { NextResponse } from "next/server";
import { z } from "zod";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import { prisma } from "@/lib/db";
import { resolveRequestSession } from "@/lib/request-session";

const bodySchema = z.object({
  sessionId: z.string().min(8).optional(),
  messageId: z.string().min(8),
  rating: z.union([z.literal(1), z.literal(-1)]),
  comment: z.string().trim().max(600).optional().or(z.literal(""))
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const resolved = await resolveRequestSession(request, parsed.data.sessionId);
  if (!resolved) {
    return new Response("Unauthorized", { status: 401 });
  }

  const message = await prisma.message.findUnique({
    where: { id: parsed.data.messageId },
    select: { id: true, role: true, sessionId: true }
  });

  if (!message || message.role !== "assistant") {
    return NextResponse.json({ error: "Assistant message not found" }, { status: 404 });
  }

  if (message.sessionId !== resolved.sessionId) {
    return NextResponse.json({ error: "Message is outside active session" }, { status: 403 });
  }

  try {
    await prisma.feedback.create({
      data: {
        messageId: parsed.data.messageId,
        userId: resolved.userId,
        rating: parsed.data.rating,
        comment: parsed.data.comment || null
      }
    });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Feedback already exists" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
