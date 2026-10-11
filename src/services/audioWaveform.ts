/** Time-ordered amplitude envelope, not a spectrum or decorative animation. */
export function bucketPeaks(samples: ArrayLike<number>, count = 128): number[] {
  if (!samples.length) return [];
  const bins = Math.min(count, samples.length);
  return Array.from({ length: bins }, (_, bin) => {
    let peak = 0;
    for (let i = Math.floor(bin * samples.length / bins); i < Math.floor((bin + 1) * samples.length / bins); i++) {
      const value = Math.abs(samples[i]);
      if (Number.isFinite(value)) peak = Math.max(peak, Math.min(1, value));
    }
    return peak;
  });
}

export function audioBytes(base64: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const text = base64.replace(/\s/g, '').replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor(text.length * 6 / 8));
  let bits = 0, value = 0, offset = 0;
  for (const char of text) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) throw new Error('Invalid audio encoding');
    value = (value << 6) | digit; bits += 6;
    if (bits >= 8) { bits -= 8; bytes[offset++] = (value >> bits) & 255; }
  }
  return bytes;
}

/** Decode ordinary PCM/float WAVs on web AND Expo Go, without playing them. */
export function wavPeaks(bytes: Uint8Array, count = 128): number[] | null {
  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const label = (offset: number) => String.fromCharCode(...bytes.slice(offset, offset + 4));
    if (label(0) !== 'RIFF' || label(8) !== 'WAVE') return null;
    let format = 0, channels = 0, bits = 0, stride = 0, start = 0, size = 0;
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const length = view.getUint32(offset + 4, true), data = offset + 8;
      if (data + length > bytes.length) return null;
      if (label(offset) === 'fmt ' && length >= 16) {
        format = view.getUint16(data, true); channels = view.getUint16(data + 2, true);
        stride = view.getUint16(data + 12, true); bits = view.getUint16(data + 14, true);
      } else if (label(offset) === 'data') { start = data; size = length; }
      offset = data + length + (length % 2);
    }
    if (!channels || stride !== channels * bits / 8 || !size || ![8,16,24,32].includes(bits) || !(format === 1 || (format === 3 && bits === 32))) return null;
    const frames = Math.floor(size / stride), bins = Math.min(count, frames);
    return Array.from({length: bins}, (_, bin) => {
      let peak = 0;
      for (let frame = Math.floor(bin * frames / bins); frame < Math.floor((bin + 1) * frames / bins); frame++) {
        for (let channel = 0; channel < channels; channel++) {
          const offset = start + frame * stride + channel * bits / 8;
          const sample = format === 3 ? view.getFloat32(offset, true) : bits === 8 ? (view.getUint8(offset) - 128) / 128
            : bits === 16 ? view.getInt16(offset, true) / 32768
            : bits === 32 ? view.getInt32(offset, true) / 2147483648
            : (view.getUint8(offset) | view.getUint8(offset+1)<<8 | view.getInt8(offset+2)<<16) / 8388608;
          if (Number.isFinite(sample)) peak = Math.max(peak, Math.min(1, Math.abs(sample)));
        }
      }
      return peak;
    });
  } catch { return null; }
}

export async function decodeWaveform(base64: string): Promise<number[] | null> {
  const bytes = audioBytes(base64), wav = wavPeaks(bytes);
  if (wav) return wav;
  const Context = typeof window !== 'undefined' && ((window as any).AudioContext || (window as any).webkitAudioContext);
  if (!Context) return null;
  const context = new Context();
  try {
    const decoded = await context.decodeAudioData(bytes.buffer);
    const peaks = Array<number>(Math.min(128, decoded.length)).fill(0);
    for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
      bucketPeaks(decoded.getChannelData(channel), peaks.length).forEach((value, i) => { peaks[i] = Math.max(peaks[i], value); });
    }
    return peaks;
  } catch { return null; }
  finally { await context.close().catch(() => {}); }
}
