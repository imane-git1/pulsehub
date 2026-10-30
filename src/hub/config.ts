export interface HubConfig {
  udpHost: string;
  udpPort: number;
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
  };
}