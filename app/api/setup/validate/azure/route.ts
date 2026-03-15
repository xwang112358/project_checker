import { NextResponse } from "next/server";
import { validateAzureCredentials } from "@/lib/azure-openai";
import { setSetting } from "@/lib/db";

export async function POST() {
  try {
    const result = await validateAzureCredentials();
    await setSetting("azure_openai_configured", "true");
    return NextResponse.json({ ok: true, model: result.model });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Validation failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
