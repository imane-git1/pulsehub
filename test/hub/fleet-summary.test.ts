import { describe, expect, it } from 'vitest';
import { FleetSummary, SummaryOptions } from '../../src/hub/fleet-summary';
import { SequenceVerdict } from '../../src/hub/sequencer';
import { Frame, FrameType, MetricId } from '../../src/protocol/types';

const OPTS: SummaryOptions = {
  hotThresholdCentiC: 7000,
  hotHoldMs: 5000,
  silentAfterMs: 2000,
  offlineAfterMs: 10000,
  rateWindowSeconds: 2,
};
const OK: SequenceVerdict = { accepted: true, lost: 0 };

function telemetry(deviceId: number, temp: number, seq = 1): Frame {
  return {
    type: FrameType.TELEMETRY, deviceId, seq, uptimeMs: 1000,
    measurements: [
      { metricId: MetricId.TEMPERATURE, value: temp },
      { metricId: MetricId.VOLTAGE, value: 12000 },
      { metricId: MetricId.CURRENT, value: 1500 },
    ],
  };
}

function heartbeat(deviceId: number, seq = 1): Frame {
  return { type: FrameType.HEARTBEAT, deviceId, seq, uptimeMs: 5000, measurements: [] };
}

describe('FleetSummary', () => {
  it('est entièrement à zéro au démarrage', () => {
    const snap = new FleetSummary(OPTS).snapshot(1000);
    expect(snap.reception).toEqual({
      accepted: 0, discarded: 0, lost: 0, invalid: 0, invalidByCause: {}, lossRate: 0, framesPerSecond: 0,
      restarts: 0,
    });
    expect(snap.devices).toEqual({ total: 0, ok: 0, hot: 0, silent: 0, offline: 0 });
    expect(snap.list).toEqual([]);
  });

  it('cumule trames acceptées, écartées et perdues selon les verdicts', () => {
    const s = new FleetSummary(OPTS);
    s.recordFrame(telemetry(1, 4000, 1), OK, 1000);
    s.recordFrame(telemetry(1, 4000, 4), { accepted: true, lost: 2 }, 1050);
    s.recordFrame(telemetry(1, 4000, 2), { accepted: false, lost: 0 }, 1100);
    const r = s.snapshot(1200).reception;
    expect(r.accepted).toBe(2);
    expect(r.lost).toBe(2);
    expect(r.discarded).toBe(1);
  });

  it('calcule le taux de perte', () => {
    const s = new FleetSummary(OPTS);
    s.recordFrame(telemetry(1, 4000, 1), OK, 1000);
    s.recordFrame(telemetry(1, 4000, 2), OK, 1050);
    s.recordFrame(telemetry(1, 4000, 4), { accepted: true, lost: 1 }, 1100);
    expect(s.snapshot(1200).reception.lossRate).toBe(0.25); // 1 perdue sur 4 attendues
  });

  it('compte les trames invalides par cause', () => {
    const s = new FleetSummary(OPTS);
    s.recordInvalid('bad_checksum');
    s.recordInvalid('bad_checksum');
    s.recordInvalid('bad_magic');
    const r = s.snapshot(1000).reception;
    expect(r.invalid).toBe(3);
    expect(r.invalidByCause).toEqual({ bad_checksum: 2, bad_magic: 1 });
  });

  it('passe un appareil de ok à silencieux puis hors-ligne', () => {
    const s = new FleetSummary(OPTS);
    s.recordFrame(telemetry(1, 4000), OK, 10_000);
    expect(s.snapshot(11_999).list[0]!.status).toBe('ok');
    expect(s.snapshot(12_000).list[0]!.status).toBe('silent');
    expect(s.snapshot(20_000).list[0]!.status).toBe('offline');
  });

  it('marque chaud un appareil au-dessus du seuil, et le reste après un retour à la normale', () => {
    const s = new FleetSummary(OPTS);
    s.recordFrame(telemetry(1, 7500), OK, 1000);
    s.recordFrame(telemetry(1, 4000, 2), OK, 1500);
    const d = s.snapshot(1700).list[0]!;
    expect(d.status).toBe('hot');
    expect(d.temperatureC).toBe(40);
  });

  it('redevient ok une fois le délai de maintien écoulé', () => {
    const s = new FleetSummary(OPTS);
    s.recordFrame(telemetry(1, 7500), OK, 1000);
    s.recordFrame(telemetry(1, 4000, 2), OK, 6900);
    expect(s.snapshot(7000).list[0]!.status).toBe('ok'); // 6000 ms depuis le pic, maintien de 5000
  });

  it('compte les appareils par statut', () => {
    const s = new FleetSummary(OPTS);
    s.recordFrame(telemetry(1, 4000), OK, 5_000);   // vu il y a 15 s : hors-ligne
    s.recordFrame(telemetry(2, 4000), OK, 17_500);  // vu il y a 2,5 s : silencieux
    s.recordFrame(telemetry(3, 8000), OK, 19_900);  // chaud
    s.recordFrame(telemetry(4, 4000), OK, 19_900);  // ok
    expect(s.snapshot(20_000).devices).toEqual({ total: 4, ok: 1, hot: 1, silent: 1, offline: 1 });
  });

  it('un HEARTBEAT prouve que l\'appareil est vivant sans effacer ses mesures', () => {
    const s = new FleetSummary(OPTS);
    s.recordFrame(telemetry(1, 4000), OK, 1000);
    s.recordFrame(heartbeat(1, 2), OK, 2500);
    const d = s.snapshot(3400).list[0]!;
    expect(d.status).toBe('ok');
    expect(d.lastSeenAgoMs).toBe(900);
    expect(d.temperatureC).toBe(40);
    expect(d.uptimeMs).toBe(5000);
  });

  it('une trame écartée ne rafraîchit pas la date de dernière réception', () => {
    const s = new FleetSummary(OPTS);
    s.recordFrame(telemetry(1, 4000), OK, 1000);
    s.recordFrame(telemetry(1, 4000, 1), { accepted: false, lost: 0 }, 3000);
    expect(s.snapshot(3500).list[0]!.status).toBe('silent');
  });

  it('calcule le débit sur les secondes complètes de la fenêtre', () => {
    const s = new FleetSummary(OPTS);
    for (let i = 0; i < 20; i++) s.recordFrame(telemetry(1, 4000, i + 1), OK, 1500);
    for (let i = 0; i < 20; i++) s.recordFrame(telemetry(1, 4000, i + 21), OK, 2500);
    expect(s.snapshot(3500).reception.framesPerSecond).toBe(20); // 40 trames sur 2 s
  });

    it('compte les redémarrages signalés par le séquenceur', () => {
    const s = new FleetSummary(OPTS);
    s.recordFrame(telemetry(1, 4000, 1), OK, 1000);
    s.recordFrame(telemetry(1, 4000, 1), { accepted: true, lost: 0, restarted: true }, 2000);
    expect(s.snapshot(2100).reception.restarts).toBe(1);
  });
});