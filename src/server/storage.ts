import { mkdirSync } from "node:fs";
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * MediaStorage adapter. Local disk for dev (unguessable UUID keys under
 * .data/uploads, served via /api/media/[id]); Supabase Storage private bucket
 * with signed URLs replaces this in production (same interface).
 */

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? ".data/uploads";

export async function storeMedia(
  key: string,
  bytes: Buffer,
): Promise<void> {
  mkdirSync(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, key), bytes);
}

export async function readMedia(key: string): Promise<Buffer | null> {
  // keys are server-generated UUIDs — refuse anything path-like
  if (!/^[a-f0-9-]+$/.test(key)) return null;
  try {
    return await readFile(path.join(UPLOAD_DIR, key));
  } catch {
    return null;
  }
}

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);
