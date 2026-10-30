import { Frame, FrameType, MetricId } from '../protocol/types';

const HEARTBEAT_EVERY = 100; // une trame sur 100 est un HEARTBEAT

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export class SimulatedDevice {
  private seq = 0;
  private temp: number; // centièmes de °C

  constructor(
    readonly deviceId: number,
    private readonly startedAt: number,
    private readonly rng: () => number = Math.random,
  ) {
    this.temp = 3500 + Math.floor(rng() * 2000); // 35 à 55 °C
  }

  nextFrame(now: number): Frame {
    this.seq += 1;
    const base = { deviceId: this.deviceId, seq: this.seq, uptimeMs: now - this.startedAt };

    if (this.seq % HEARTBEAT_EVERY === 0) {
      return { ...base, type: FrameType.HEARTBEAT, measurements: [] };
    }

    // marche aléatoire bornée : reste sous 65 °C, donc les anomalies ressortent
    this.temp = clamp(this.temp + Math.round((this.rng() - 0.5) * 40), 2000, 6500);
    return {
      ...base,
      type: FrameType.TELEMETRY,
      measurements: [
        { metricId: MetricId.TEMPERATURE, value: this.temp },
        { metricId: MetricId.VOLTAGE, value: 12000 + Math.round((this.rng() - 0.5) * 200) },
        { metricId: MetricId.CURRENT, value: 1500 + Math.round((this.rng() - 0.5) * 300) },
      ],
    };
  }
}