import type { SummaryOptions } from './fleet-summary';

export interface HubConfig {
  udpHost: string;
  udpPort: number;
  httpHost: string;
  httpPort: number;
  snapshotIntervalMs: number;
  summary: SummaryOptions;
}

function envNumber(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Variable ${name} invalide : "${raw}"`);
  return n;
}

export function loadHubConfig(env: NodeJS.ProcessEnv = process.env): HubConfig {
  return {
    udpHost: env.UDP_HOST ?? '0.0.0.0',
    udpPort: envNumber(env, 'UDP_PORT', 9000),
    httpHost: env.HTTP_HOST ?? '127.0.0.1',
    httpPort: envNumber(env, 'HTTP_PORT', 3000),
    snapshotIntervalMs: envNumber(env, 'SNAPSHOT_INTERVAL_MS', 1000),
    summary: {
      hotThresholdCentiC: Math.round(envNumber(env, 'HOT_THRESHOLD_C', 70) * 100),
      hotHoldMs: envNumber(env, 'HOT_HOLD_MS', 5000),
      silentAfterMs: envNumber(env, 'SILENT_AFTER_MS', 2000),
      offlineAfterMs: envNumber(env, 'OFFLINE_AFTER_MS', 10000),
      rateWindowSeconds: envNumber(env, 'RATE_WINDOW_S', 5),
    },
  };
}