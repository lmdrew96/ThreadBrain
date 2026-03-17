import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// Derives a 32-byte key from SETTINGS_ENCRYPTION_KEY (any string)
let _key: Buffer | null = null;
function getKey(): Buffer {
  if (!_key) {
    const raw = process.env.SETTINGS_ENCRYPTION_KEY;
    if (!raw) throw new Error("SETTINGS_ENCRYPTION_KEY is not set");
    _key = scryptSync(raw, "threadbrain-settings-v1", 32);
  }
  return _key;
}

/** Encrypts plaintext using AES-256-GCM. Returns "iv:tag:ciphertext" (hex). */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

/** Decrypts a value produced by encrypt(). Returns the original plaintext. */
export function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, encryptedHex] = ciphertext.split(":");
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
