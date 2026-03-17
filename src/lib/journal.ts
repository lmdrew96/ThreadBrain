import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";

/** Returns the decrypted RJ config for a userId, or null if not configured. */
export async function getUserJournalConfig(
  userId: string
): Promise<{ rjUrl: string; rjApiKey: string } | null> {
  const [row] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  if (!row?.rjUrl || !row?.rjApiKey) return null;

  try {
    return { rjUrl: row.rjUrl, rjApiKey: decrypt(row.rjApiKey) };
  } catch {
    // Decryption failed (e.g. encryption key rotated) — treat as not configured
    return null;
  }
}
