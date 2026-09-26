import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  question: z.string().trim().min(2).max(300).optional(),
  answer: z.string().trim().min(2).max(4000).optional(),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  order: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional()
});

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return null;
  }
  return session;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const updated = await prisma.faqItem.update({
    where: { id },
    data: {
      ...(parsed.data.question !== undefined ? { question: parsed.data.question } : {}),
      ...(parsed.data.answer !== undefined ? { answer: parsed.data.answer } : {}),
      ...(parsed.data.category !== undefined ? { category: parsed.data.category || null } : {}),
      ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {})
    }
  });

  return NextResponse.json({
    item: {
      ...updated,
      updatedAt: updated.updatedAt.toISOString()
    }
  });
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.faqItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
