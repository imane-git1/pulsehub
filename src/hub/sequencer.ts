export interface SequenceVerdict {
  accepted: boolean; // false = doublon ou trame en retard, à écarter
  lost: number;      // trames manquantes détectées grâce à cette trame
}

export class Sequencer {
  private readonly lastSeq = new Map<number, number>(); // deviceId -> dernier seq accepté

  check(deviceId: number, seq: number): SequenceVerdict {
    const last = this.lastSeq.get(deviceId);

    if (last === undefined) {
      // Première trame vue pour cet appareil : on n'a rien à comparer, pas de perte
      this.lastSeq.set(deviceId, seq);
      return { accepted: true, lost: 0 };
    }

    if (seq <= last) return { accepted: false, lost: 0 }; // doublon ou retard

    this.lastSeq.set(deviceId, seq);
    return { accepted: true, lost: seq - last - 1 };
  }
}