import { describe, expect, it } from 'vitest';
import { decodeFrame } from '../../src/protocol/decode';
import { encodeFrame } from '../../src/protocol/encode';
import { Frame, FrameType, MetricId } from '../../src/protocol/types';

const EXAMPLE = Buffer.from('504801020007000000010000' + '03e800f6', 'hex');

const telemetry: Frame = {
  type: FrameType.TELEMETRY, deviceId: 42, seq: 4_294_967_295, uptimeMs: 123456,
  measurements: [
    { metricId: MetricId.TEMPERATURE, value: -1250 },
    { metricId: MetricId.VOLTAGE, value: 12000 },
  ],
};

describe('decodeFrame', () => {
  it('décode le HEARTBEAT d\'exemple du sujet', () => {
    expect(decodeFrame(EXAMPLE)).toEqual({
      ok: true,
      frame: { type: FrameType.HEARTBEAT, deviceId: 7, seq: 1, uptimeMs: 1000, measurements: [] },
    });
  });

  it('fait un aller-retour encode/decode (valeurs négatives, seq max)', () => {
    expect(decodeFrame(encodeFrame(telemetry))).toEqual({ ok: true, frame: telemetry });
  });

  it('encode l\'exemple du sujet à l\'identique', () => {
    const hb: Frame = { type: FrameType.HEARTBEAT, deviceId: 7, seq: 1, uptimeMs: 1000, measurements: [] };
    expect(encodeFrame(hb).equals(EXAMPLE)).toBe(true);
  });

  const mutate = (fn: (b: Buffer) => Buffer) => decodeFrame(fn(Buffer.from(EXAMPLE)));

  it('rejette un checksum faux', () => {
    expect(mutate((b) => { b[15] = 0x00; return b; })).toEqual({ ok: false, error: 'bad_checksum' });
  });
  it('rejette un mauvais magic', () => {
    expect(mutate((b) => { b[0] = 0x00; return b; })).toEqual({ ok: false, error: 'bad_magic' });
  });
  it('rejette une mauvaise version', () => {
    expect(mutate((b) => { b[2] = 2; return b; })).toEqual({ ok: false, error: 'bad_version' });
  });
  it('rejette un type inconnu', () => {
    expect(mutate((b) => { b[3] = 9; return b; })).toEqual({ ok: false, error: 'bad_type' });
  });
  it('rejette une trame trop courte', () => {
    expect(decodeFrame(Buffer.alloc(5))).toEqual({ ok: false, error: 'too_short' });
  });
  it('rejette une trame trop longue', () => {
    expect(decodeFrame(Buffer.alloc(513))).toEqual({ ok: false, error: 'too_long' });
  });
    it('rejette une longueur incohérente avec count', () => {
    expect(mutate((b) => Buffer.concat([b, Buffer.from([0x00])]))).toEqual({
      ok: false,
      error: 'bad_length',
    });
  });
  it('rejette une trame tronquée sous la taille minimale', () => {
    expect(mutate((b) => b.subarray(0, 15))).toEqual({ ok: false, error: 'too_short' });
  });
  it('rejette deviceId = 0', () => {
    const f = encodeFrame({ ...telemetry, deviceId: 0 });
    expect(decodeFrame(f)).toEqual({ ok: false, error: 'bad_device_id' });
  });
});