// React Native does not guarantee a global atob(), so decode the picker's
// base64 output ourselves. Padding is irrelevant to the byte count and is
// stripped before decoding.
const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let offset = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = BASE64_ALPHABET.indexOf(clean[i]);
    const b = BASE64_ALPHABET.indexOf(clean[i + 1]);
    const c = BASE64_ALPHABET.indexOf(clean[i + 2]);
    const d = BASE64_ALPHABET.indexOf(clean[i + 3]);
    if (a < 0 || b < 0) break;
    bytes[offset++] = (a << 2) | (b >> 4);
    if (c >= 0) bytes[offset++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) bytes[offset++] = ((c & 3) << 6) | d;
  }
  return bytes.subarray(0, offset);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
