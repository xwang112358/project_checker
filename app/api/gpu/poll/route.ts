import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { NodeSSH } from "node-ssh";
import type { GpuServerConfig, GpuServersFile, GpuMetric, GpuServerResult } from "@/lib/gpu-types";

const CONFIG_PATH = path.join(process.cwd(), "gpu-servers.json");

const NVIDIA_CMD =
  "nvidia-smi --query-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits";

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

function parseNvidiaSmi(stdout: string): GpuMetric[] {
  return stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(",").map((s) => s.trim());
      return {
        index: parseInt(parts[0], 10),
        name: parts[1],
        utilizationPct: parseInt(parts[2], 10),
        memoryUsedMb: parseInt(parts[3], 10),
        memoryTotalMb: parseInt(parts[4], 10),
        temperatureC: parseInt(parts[5], 10),
      };
    });
}

async function pollServer(
  config: GpuServerConfig,
  privateKey: string,
  passphrase: string | undefined,
  timeoutMs: number
): Promise<GpuServerResult> {
  const ssh = new NodeSSH();
  const polledAt = new Date().toISOString();

  try {
    await ssh.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      privateKey,
      passphrase: passphrase || undefined,
      readyTimeout: timeoutMs,
    });

    const result = await ssh.execCommand(NVIDIA_CMD);
    ssh.dispose();

    if (result.stderr && result.stderr.includes("command not found")) {
      return {
        id: config.id,
        label: config.label,
        host: config.host,
        online: true,
        gpus: [],
        polledAt,
        error: "nvidia-smi not found — is CUDA installed?",
      };
    }

    if (result.code !== 0 && result.stderr) {
      return {
        id: config.id,
        label: config.label,
        host: config.host,
        online: true,
        gpus: [],
        polledAt,
        error: `nvidia-smi error: ${result.stderr.trim()}`,
      };
    }

    const gpus = parseNvidiaSmi(result.stdout);
    return {
      id: config.id,
      label: config.label,
      host: config.host,
      online: true,
      gpus,
      polledAt,
    };
  } catch (err: unknown) {
    try { ssh.dispose(); } catch { /* ignore */ }

    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout =
      msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("timed out");
    const isAuth =
      msg.toLowerCase().includes("authentication") || msg.toLowerCase().includes("auth");

    let errorMsg = `SSH error: ${msg}`;
    if (isTimeout) errorMsg = "Connection timed out";
    else if (isAuth) errorMsg = "Authentication failed — check SSH key";

    return {
      id: config.id,
      label: config.label,
      host: config.host,
      online: false,
      gpus: [],
      polledAt,
      error: errorMsg,
    };
  }
}

export async function GET() {
  const polledAt = new Date().toISOString();
  const data = await readConfig();

  if (data.servers.length === 0) {
    return NextResponse.json({ servers: [], polledAt });
  }

  // Read SSH private key
  const keyPath =
    process.env.SSH_PRIVATE_KEY_PATH ?? path.join(os.homedir(), ".ssh", "id_rsa");

  let privateKey: string;
  try {
    privateKey = await fs.readFile(keyPath, "utf-8");
  } catch {
    return NextResponse.json(
      { error: `SSH key not found at: ${keyPath}. Set SSH_PRIVATE_KEY_PATH in .env.local` },
      { status: 500 }
    );
  }

  const passphrase = process.env.SSH_PASSPHRASE || undefined;
  const timeoutMs = parseInt(process.env.SSH_CONNECT_TIMEOUT_MS ?? "8000", 10);

  const settled = await Promise.allSettled(
    data.servers.map((server) => pollServer(server, privateKey, passphrase, timeoutMs))
  );

  const servers: GpuServerResult[] = settled.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    // Promise.allSettled should not reject since pollServer catches internally,
    // but handle it defensively
    return {
      id: data.servers[i].id,
      label: data.servers[i].label,
      host: data.servers[i].host,
      online: false,
      gpus: [],
      polledAt,
      error: "Unexpected error polling server",
    };
  });

  return NextResponse.json({ servers, polledAt });
}
