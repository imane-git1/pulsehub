import { xorChecksum } from './checksum';
import { Frame, HEADER_SIZE, MAGIC_0, MAGIC_1, MEASURE_SIZE, VERSION } from './types';

export function encodeFrame(frame: Frame): Buffer {
  const count = frame.measurements.length;
  const buf = Buffer.alloc(HEADER_SIZE + MEASURE_SIZE * count + 1);
  buf.writeUInt8(MAGIC_0, 0);
  buf.writeUInt8(MAGIC_1, 1);
  buf.writeUInt8(VERSION, 2);
  buf.writeUInt8(frame.type, 3);
  buf.writeUInt16BE(frame.deviceId, 4);
  buf.writeUInt32BE(frame.seq, 6);
  buf.writeUInt32BE(frame.uptimeMs, 10);
  buf.writeUInt8(count, 14);
  frame.measurements.forEach((m, i) => {
    const o = HEADER_SIZE + i * MEASURE_SIZE;
    buf.writeUInt8(m.metricId, o);
    buf.writeInt16BE(m.value, o + 1);
  });
  buf.writeUInt8(xorChecksum(buf, buf.length - 1), buf.length - 1);
  return buf;
}