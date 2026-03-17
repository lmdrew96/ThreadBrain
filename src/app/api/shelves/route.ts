import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { shelves } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userShelves = await db
    .select()
    .from(shelves)
    .where(eq(shelves.userId, userId))
    .orderBy(asc(shelves.createdAt));

  return NextResponse.json(userShelves);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, emoji } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const [shelf] = await db
    .insert(shelves)
    .values({ userId, name: name.trim(), emoji: emoji ?? "📚" })
    .returning();

  return NextResponse.json(shelf, { status: 201 });
}
