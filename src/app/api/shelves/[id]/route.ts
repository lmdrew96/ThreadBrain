import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shelves } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { name, emoji } = await req.json();

  const updates: Record<string, string> = {};
  if (name?.trim()) updates.name = name.trim();
  if (emoji) updates.emoji = emoji;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const [shelf] = await db
    .update(shelves)
    .set(updates)
    .where(and(eq(shelves.id, id), eq(shelves.userId, userId)))
    .returning();

  if (!shelf) {
    return NextResponse.json({ error: "Shelf not found" }, { status: 404 });
  }

  return NextResponse.json(shelf);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [deleted] = await db
    .delete(shelves)
    .where(and(eq(shelves.id, id), eq(shelves.userId, userId)))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: "Shelf not found" }, { status: 404 });
  }

  // Documents with this shelfId are automatically set to NULL via onDelete: set null
  return NextResponse.json({ ok: true });
}
