import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export async function GET() {
  const items: Array<{
    id: string;
    question: string;
    answer: string;
    category: string | null;
    order: number;
    isActive: boolean;
    updatedAt: Date;
  }> = await prisma.faqItem.findMany({
    where: { isActive: true },
    orderBy: [{ order: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      question: true,
      answer: true,
      category: true,
      order: true,
      isActive: true,
      updatedAt: true
    }
  });

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      updatedAt: item.updatedAt.toISOString()
    }))
  });
}
