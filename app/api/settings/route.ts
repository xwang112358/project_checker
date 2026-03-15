import { NextRequest, NextResponse } from "next/server";
import { getSetting, setSetting } from "@/lib/db";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  const value = await getSetting(key);
  return NextResponse.json({ key, value });
}

export async function POST(req: NextRequest) {
  const { key, value } = await req.json();
  if (!key || value === undefined) {
    return NextResponse.json({ error: "key and value required" }, { status: 400 });
  }
  await setSetting(key, String(value));
  return NextResponse.json({ ok: true });
}
