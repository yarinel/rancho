import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import * as schema from "@/db/schema";
import { readMedia } from "@/server/storage";
import { clientKeyFromHeaders, rateLimit } from "@/server/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ip = clientKeyFromHeaders(req.headers);
  if (!rateLimit(`media:${ip}`, 300, 10 * 60 * 1000)) {
    return new NextResponse(null, { status: 429 });
  }
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) return new NextResponse(null, { status: 404 });

  const d = await db();
  const rows = await d.select().from(schema.media).where(eq(schema.media.id, id));
  const item = rows[0];
  if (!item) return new NextResponse(null, { status: 404 });

  const bytes = await readMedia(item.storageKey);
  if (!bytes) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": item.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
