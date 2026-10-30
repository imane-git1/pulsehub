import { xorChecksum } from './checksum';
import {
  CHECKSUM_SIZE, Frame, FrameType, HEADER_SIZE, MAGIC_0, MAGIC_1,
  MAX_FRAME_SIZE, MEASURE_SIZE, VERSION,
} from './types';

export type DecodeError =
  | 'too_short' | 'too_long' | 'bad_magic' | 'bad_version' | 'bad_type'
  | 'bad_length' | 'bad_checksum' | 'bad_device_id' | 'bad_count';

export type DecodeResult =
  | { ok: true; frame: Frame }
  | { ok: false; error: DecodeError };

const fail = (error: DecodeError): DecodeResult => ({ ok: false, error });

export function decodeFrame(buf: Buffer): DecodeResult {
  if (buf.length > MAX_FRAME_SIZE) return fail('too_long');
  if (buf.length < HEADER_SIZE + CHECKSUM_SIZE) return fail('too_short');
  if (buf.readUInt8(0) !== MAGIC_0 || buf.readUInt8(1) !== MAGIC_1) return fail('bad_magic');
  if (buf.readUInt8(2) !== VERSION) return fail('bad_version');

  const type = buf.readUInt8(3);
  if (type !== FrameType.TELEMETRY && type !== FrameType.HEARTBEAT) return fail('bad_type');

  const count = buf.readUInt8(14);
  if (buf.length !== HEADER_SIZE + MEASURE_SIZE * count + CHECKSUM_SIZE) return fail('bad_length');

  const last = buf.length - 1;
  if (xorChecksum(buf, last) !== buf.readUInt8(last)) return fail('bad_checksum');

  const deviceId = buf.readUInt16BE(4);
  if (deviceId === 0) return fail('bad_device_id');
  if (type === FrameType.HEARTBEAT && count !== 0) return fail('bad_count');

  const measurements = [];
  for (let i = 0; i < count; i++) {
    const o = HEADER_SIZE + i * MEASURE_SIZE;
    measurements.push({ metricId: buf.readUInt8(o), value: buf.readInt16BE(o + 1) });
  }

  return {
    ok: true,
    frame: {
      type: type as FrameType,
      deviceId,
      seq: buf.readUInt32BE(6),
      uptimeMs: buf.readUInt32BE(10),
      measurements,
    },
  };
}