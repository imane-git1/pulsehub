import type { DecodeError } from '../protocol/decode';
import { Frame, MetricId } from '../protocol/types';
import type { SequenceVerdict } from './sequencer';

export type DeviceStatus = 'ok' | 'hot' | 'silent' | 'offline';

export interface SummaryOptions {
  hotThresholdCentiC: number; // température à partir de laquelle un appareil est « chaud » (centièmes de °C)
  hotHoldMs: number;          // durée pendant laquelle un appareil reste « chaud » après un pic
  silentAfterMs: number;      // sans trame depuis ce délai : « silencieux »
  offlineAfterMs: number;     // sans trame depuis ce délai : « hors-ligne »
  rateWindowSeconds: number;  // fenêtre de calcul du débit
}

export interface DeviceSnapshot {
  deviceId: number;
  status: DeviceStatus;
  lastSeenAgoMs: number;
  uptimeMs: number;
  temperatureC: number | null;
  voltageV: number | null;
  currentA: number | null;
  framesAccepted: number;
  framesLost: number;
}

export interface FleetCounts {
  total: number;
  ok: number;
  hot: number;
  silent: number;
  offline: number;
}

export interface FleetSnapshot {
  generatedAt: number;
  reception: {
    accepted: number;
    discarded: number;
    lost: number;
    invalid: number;
    invalidByCause: Record<string, number>;
    lossRate: number; // pertes / (acceptées + pertes), entre 0 et 1
    framesPerSecond: number;
  };
  devices: FleetCounts;
  list: DeviceSnapshot[];
}

interface DeviceState {
  lastSeenMs: number;
  uptimeMs: number;
  temperature: number | null; // centièmes de °C
  voltage: number | null;     // mV
  current: number | null;     // mA
  lastHotMs: number | null;
  accepted: number;
  lost: number;
}

export class FleetSummary {
  private accepted = 0;
  private discarded = 0;
  private lost = 0;
  private invalid = 0;
  private readonly invalidByCause = new Map<string, number>();
  private readonly devices = new Map<number, DeviceState>();
  private readonly buckets = new Map<number, number>(); // seconde -> trames acceptées

  constructor(private readonly opts: SummaryOptions) {}

  recordInvalid(cause: DecodeError): void {
    this.invalid++;
    this.invalidByCause.set(cause, (this.invalidByCause.get(cause) ?? 0) + 1);
  }

  recordFrame(frame: Frame, verdict: SequenceVerdict, now: number): void {
    if (!verdict.accepted) {
      this.discarded++;
      return;
    }
    this.accepted++;
    this.lost += verdict.lost;
    this.countInRate(now);

    const device = this.devices.get(frame.deviceId) ?? this.createDevice(frame.deviceId, now);
    device.lastSeenMs = now;
    device.uptimeMs = frame.uptimeMs;
    device.accepted++;
    device.lost += verdict.lost;

    for (const m of frame.measurements) {
      if (m.metricId === MetricId.TEMPERATURE) {
        device.temperature = m.value;
        if (m.value >= this.opts.hotThresholdCentiC) device.lastHotMs = now;
      } else if (m.metricId === MetricId.VOLTAGE) {
        device.voltage = m.value;
      } else if (m.metricId === MetricId.CURRENT) {
        device.current = m.value;
      }
    }
  }

  snapshot(now: number): FleetSnapshot {
    const list = [...this.devices.entries()]
      .sort(([a], [b]) => a - b)
      .map(([id, d]) => this.toSnapshot(id, d, now));

    const counts: FleetCounts = { total: list.length, ok: 0, hot: 0, silent: 0, offline: 0 };
    for (const d of list) counts[d.status]++;

    const expected = this.accepted + this.lost;
    return {
      generatedAt: now,
      reception: {
        accepted: this.accepted,
        discarded: this.discarded,
        lost: this.lost,
        invalid: this.invalid,
        invalidByCause: Object.fromEntries(this.invalidByCause),
        lossRate: expected === 0 ? 0 : this.lost / expected,
        framesPerSecond: this.rate(now),
      },
      devices: counts,
      list,
    };
  }

  private createDevice(id: number, now: number): DeviceState {
    const state: DeviceState = {
      lastSeenMs: now, uptimeMs: 0, temperature: null, voltage: null, current: null,
      lastHotMs: null, accepted: 0, lost: 0,
    };
    this.devices.set(id, state);
    return state;
  }

  private statusOf(d: DeviceState, now: number): DeviceStatus {
    const age = now - d.lastSeenMs;
    if (age >= this.opts.offlineAfterMs) return 'offline';
    if (age >= this.opts.silentAfterMs) return 'silent';
    if (d.lastHotMs !== null && now - d.lastHotMs < this.opts.hotHoldMs) return 'hot';
    return 'ok';
  }

  private toSnapshot(id: number, d: DeviceState, now: number): DeviceSnapshot {
    return {
      deviceId: id,
      status: this.statusOf(d, now),
      lastSeenAgoMs: now - d.lastSeenMs,
      uptimeMs: d.uptimeMs,
      temperatureC: d.temperature === null ? null : d.temperature / 100,
      voltageV: d.voltage === null ? null : d.voltage / 1000,
      currentA: d.current === null ? null : d.current / 1000,
      framesAccepted: d.accepted,
      framesLost: d.lost,
    };
  }

  // Débit : on compte les trames par seconde dans des « seaux », on garde les derniers seulement
  private countInRate(now: number): void {
    const second = Math.floor(now / 1000);
    this.buckets.set(second, (this.buckets.get(second) ?? 0) + 1);
    for (const key of this.buckets.keys()) {
      if (key < second - this.opts.rateWindowSeconds - 1) this.buckets.delete(key);
    }
  }

  private rate(now: number): number {
    const current = Math.floor(now / 1000);
    let sum = 0;
    // on ne lit que les secondes complètes (la seconde en cours est incomplète)
    for (let s = current - this.opts.rateWindowSeconds; s < current; s++) {
      sum += this.buckets.get(s) ?? 0;
    }
    return sum / this.opts.rateWindowSeconds;
  }
}