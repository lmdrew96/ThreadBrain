import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";

export const RESEARCH_JOURNAL_URL = "https://research.adhdesigns.dev";

/** Returns the decrypted RJ config for a userId, or null if not configured. */
export async function getUserJournalConfig(
  userId: string
): Promise<{ rjUrl: string; rjApiKey: string } | null> {
  const [row] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  if (!row?.rjApiKey) return null;

  try {
    return { rjUrl: RESEARCH_JOURNAL_URL, rjApiKey: decrypt(row.rjApiKey) };
  } catch {
    return null;
  }
}
