import { NextResponse } from "next/server";
import { validateToken } from "@/lib/github";
import { setSetting } from "@/lib/db";

export async function POST() {
  try {
    const user = await validateToken();
    await setSetting("github_pat_configured", "true");
    return NextResponse.json({ ok: true, login: user.login, avatarUrl: user.avatarUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Validation failed";
    const status = message.includes("Unauthorized") || message.includes("401") ? 401 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
