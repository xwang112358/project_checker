import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import type { GpuServerConfig, GpuServersFile } from "@/lib/gpu-types";

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

export async function GET() {
  const data = await readConfig();
  return NextResponse.json(data.servers);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { label, host, port, username } = body as {
    label?: string;
    host?: string;
    port?: number;
    username?: string;
  };

  if (!label || !host || !username) {
    return NextResponse.json({ error: "label, host, and username are required" }, { status: 400 });
  }

  const data = await readConfig();

  if (data.servers.some((s) => s.host === host)) {
    return NextResponse.json({ error: "A server with this host already exists" }, { status: 409 });
  }

  const newServer: GpuServerConfig = {
    id: crypto.randomUUID(),
    label: label.trim(),
    host: host.trim(),
    port: port ?? 22,
    username: username.trim(),
    sortOrder: data.servers.length,
  };

  data.servers.push(newServer);
  await writeConfig(data);

  return NextResponse.json(newServer, { status: 201 });
}
