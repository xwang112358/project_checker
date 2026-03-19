export interface GpuServerConfig {
  id: string;
  label: string;
  host: string;
  port: number;
  username: string;
  sortOrder: number;
}

export interface GpuServersFile {
  servers: GpuServerConfig[];
}

export interface GpuMetric {
  index: number;
  name: string;
  utilizationPct: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  temperatureC: number;
}

export interface GpuServerResult {
  id: string;
  label: string;
  host: string;
  online: boolean;
  error?: string;
  gpus: GpuMetric[];
  polledAt: string;
}

export interface GpuPollResponse {
  servers: GpuServerResult[];
  polledAt: string;
}
