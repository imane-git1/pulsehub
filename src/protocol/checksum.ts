/** XOR des octets de buf[0 .. end[ */
export function xorChecksum(buf: Uint8Array, end: number = buf.length): number {
  let x = 0;
  for (let i = 0; i < end; i++) x ^= buf[i]!;
  return x;
}