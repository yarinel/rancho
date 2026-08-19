import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import {
  ALLOWED_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  storeMedia,
} from "@/server/storage";
import { clientKeyFromHeaders, rateLimit } from "@/server/rate-limit";

/** Public intake photo upload — rate-limited, image-only, size-capped. */
export async function POST(req: NextRequest) {
  const ip = clientKeyFromHeaders(req.headers);
  if (!rateLimit(`upload:${ip}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "יותר מדי העלאות, נסו שוב מעט מאוחר יותר" }, { status: 429 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const requestToken = String(form.get("requestToken") ?? "");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "חסר קובץ" }, { status: 400 });
  }
  if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
    return NextResponse.json({ error: "אפשר להעלות רק תמונות" }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "התמונה גדולה מדי (עד 8MB)" }, { status: 413 });
  }

  // uploads must belong to a still-open draft — no anonymous orphan files
  const d = await db();
  const rows = requestToken
    ? await d.query.serviceRequests.findMany({
        where: (t, { eq }) => eq(t.publicToken, requestToken),
        limit: 1,
      })
    : [];
  const request = rows[0];
  if (!request || request.status !== "NEW") {
    return NextResponse.json({ error: "בקשה לא תקפה להעלאה" }, { status: 403 });
  }
  const requestId = request.id;
  const existing = await d.query.media.findMany({
    where: (t, { eq }) => eq(t.requestId, requestId),
  });
  if (existing.length >= 10) {
    return NextResponse.json({ error: "הגעתם למקסימום תמונות לבקשה" }, { status: 429 });
  }

  const key = randomUUID();
  await storeMedia(key, Buffer.from(await file.arrayBuffer()));
  const [row] = await d
    .insert(schema.media)
    .values({
      requestId,
      kind: "INTAKE",
      storageKey: key,
      contentType: file.type,
      sizeBytes: file.size,
    })
    .returning();

  return NextResponse.json({ mediaId: row.id, url: `/api/media/${row.id}` });
}
