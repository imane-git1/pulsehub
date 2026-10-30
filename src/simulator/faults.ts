import { encodeFrame } from '../protocol/encode';
import { Frame, MetricId } from '../protocol/types';

export interface FaultOptions {
  badChecksumRate: number; // probabilité par trame (0 à 1)
  duplicateRate: number;
  reorderRate: number;
  anomalyRate: number;
}

export class FaultInjector {
  private readonly held = new Map<number, Buffer>(); // trame retenue par appareil

  constructor(
    private readonly opts: FaultOptions,
    private readonly rng: () => number = Math.random,
  ) {}

  /** Transforme une trame en 0, 1 ou 2 datagrammes à envoyer. */
  process(frame: Frame): Buffer[] {
    let buf = encodeFrame(this.maybeAnomaly(frame));

    if (this.rng() < this.opts.badChecksumRate) {
      buf = Buffer.from(buf);
      buf[buf.length - 1]! ^= 0xff; // casse le checksum
    }

    const out: Buffer[] = [];
    const held = this.held.get(frame.deviceId);
    if (held) {
      out.push(buf, held); // la trame retenue arrive après la suivante : désordre
      this.held.delete(frame.deviceId);
    } else if (this.rng() < this.opts.reorderRate) {
      this.held.set(frame.deviceId, buf);
    } else {
      out.push(buf);
    }

    if (out.length > 0 && this.rng() < this.opts.duplicateRate) out.push(out[0]!);
    return out;
  }

  private maybeAnomaly(frame: Frame): Frame {
    if (this.rng() >= this.opts.anomalyRate) return frame;
    return {
      ...frame,
      measurements: frame.measurements.map((m) =>
        m.metricId === MetricId.TEMPERATURE ? { ...m, value: 9000 + Math.floor(this.rng() * 3000) } : m,
      ),
    };
  }
}