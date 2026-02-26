import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readingSessions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [session] = await db
    .select()
    .from(readingSessions)
    .where(
      and(eq(readingSessions.id, id), eq(readingSessions.userId, userId))
    );

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const updates = await req.json();

  // Only allow specific fields to be updated
  const allowedFields: Record<string, unknown> = {};
  if ("currentChunkIdx" in updates)
    allowedFields.currentChunkIdx = updates.currentChunkIdx;
  if ("status" in updates) allowedFields.status = updates.status;
  if ("completedAt" in updates)
    allowedFields.completedAt = updates.completedAt
      ? new Date(updates.completedAt)
      : null;

  const [session] = await db
    .update(readingSessions)
    .set(allowedFields)
    .where(
      and(eq(readingSessions.id, id), eq(readingSessions.userId, userId))
    )
    .returning();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}
