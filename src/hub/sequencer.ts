const UINT32 = 2 ** 32;
const HALF = 2 ** 31;

export interface SequenceVerdict {
  accepted: boolean;   // false = doublon ou trame en retard, à écarter
  lost: number;        // trames manquantes détectées grâce à cette trame
  restarted?: boolean; // présent (true) seulement si l'appareil vient de redémarrer
}

interface Track {
  seq: number;
  uptimeMs: number;
}

export class Sequencer {
  private readonly tracks = new Map<number, Track>(); // deviceId -> dernier état accepté

  constructor(private readonly restartToleranceMs: number = 1000) {}

  check(deviceId: number, seq: number, uptimeMs?: number): SequenceVerdict {
    const track = this.tracks.get(deviceId);

    if (track === undefined) {
      // Première trame vue : rien à comparer, pas de perte
      this.tracks.set(deviceId, { seq, uptimeMs: uptimeMs ?? 0 });
      return { accepted: true, lost: 0 };
    }

    if (uptimeMs !== undefined && uptimeMs + this.restartToleranceMs < track.uptimeMs) {
      // L'uptime a reculé nettement : l'appareil a redémarré, on repart de zéro
      this.tracks.set(deviceId, { seq, uptimeMs });
      return { accepted: true, lost: 0, restarted: true };
    }

    // Distance circulaire sur 32 bits : 0 = doublon, < 2^31 = en avance, sinon en retard
    const ahead = (seq - track.seq) >>> 0;
    if (ahead === 0 || ahead >= HALF) return { accepted: false, lost: 0 };

    track.seq = seq;
    if (uptimeMs !== undefined) track.uptimeMs = uptimeMs;
    return { accepted: true, lost: ahead - 1 };
  }
}