import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") return null;
  return session;
}

function csvEscape(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return new Response("Forbidden", { status: 403 });
  }

  const rows = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      message: {
        select: {
          id: true,
          sessionId: true
        }
      },
      user: {
        select: {
          id: true,
          email: true
        }
      }
    }
  });

  const header = [
    "date",
    "feedback_id",
    "message_id",
    "rating",
    "comment",
    "session_id",
    "user_id",
    "user_email"
  ];

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.createdAt.toISOString(),
        row.id,
        row.messageId,
        row.rating,
        row.comment ?? "",
        row.message.sessionId,
        row.userId,
        row.user.email
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  const csv = `\uFEFF${lines.join("\n")}`;
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="feedback-export.csv"`
    }
  });
}
