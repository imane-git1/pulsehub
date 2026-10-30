export const MAGIC_0 = 0x50; // 'P'
export const MAGIC_1 = 0x48; // 'H'
export const VERSION = 1;
export const HEADER_SIZE = 15;
export const MEASURE_SIZE = 3;
export const CHECKSUM_SIZE = 1;
export const MAX_FRAME_SIZE = 512;

export const FrameType = { TELEMETRY: 0x01, HEARTBEAT: 0x02 } as const;
export type FrameType = (typeof FrameType)[keyof typeof FrameType];

export const MetricId = { TEMPERATURE: 1, VOLTAGE: 2, CURRENT: 3 } as const;

export interface Measurement {
  metricId: number;
  value: number; // int16, valeur brute (centièmes de °C, mV, mA)
}

export interface Frame {
  type: FrameType;
  deviceId: number;
  seq: number;
  uptimeMs: number;
  measurements: Measurement[];
}