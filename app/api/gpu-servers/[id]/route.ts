import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { GpuServersFile } from "@/lib/gpu-types";

const CONFIG_PATH = path.join(process.cwd(), "gpu-servers.json");

async function readConfig(): Promise<GpuServersFile> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as GpuServersFile;
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { servers: [] };
    }
    throw err;
  }
}

async function writeConfig(data: GpuServersFile): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const data = await readConfig();
  const idx = data.servers.findIndex((s) => s.id === params.id);

  if (idx === -1) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }

  data.servers.splice(idx, 1);
  await writeConfig(data);

  return NextResponse.json({ ok: true });
}
