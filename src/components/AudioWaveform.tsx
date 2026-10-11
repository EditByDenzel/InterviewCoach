import React, { useEffect, useRef, useState } from 'react';
import { Waveform } from './CoachieDesign';
import { loadAudioAsset } from '../store/audioAssetStore';
import { readAudioAsBase64 } from '../services/audioService';
import { decodeWaveform } from '../services/audioWaveform';

let decoding: Promise<unknown> = Promise.resolve();
export function AudioWaveform({ assetId, base64, uri, refreshKey, ...visual }: {
  assetId?: string; base64?: string; uri?: string; refreshKey?: boolean;
  candidate?: boolean; active?: boolean; progress?: number;
}) {
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const measured = useRef<string>();
  const key = assetId || uri || base64;
  useEffect(() => {
    let alive = true;
    if (key === measured.current) return;
    setPeaks(null);
    if (!key) return;
    // One decoder at a time: opening saved history must not create dozens of
    // audio contexts. Decode is silent and never starts microphone/playback.
    const task = decoding.then(async () => {
      if (!alive) return;
      const audio = assetId ? await loadAudioAsset(assetId) : uri ? await readAudioAsBase64(uri) : base64 ? { base64 } : null;
      const stored = audio && 'waveform' in audio ? audio.waveform : null;
      const valid = Array.isArray(stored) && stored.length > 0 && stored.length <= 128 && stored.every(value=>Number.isFinite(value)&&value>=0&&value<=1);
      const values = audio && (valid ? stored as number[] : await decodeWaveform(audio.base64));
      if (alive && values) { measured.current = key; setPeaks(values); }
    }).catch(() => {}); // Unsupported/damaged audio stays an honest flat line.
    decoding = task;
    return () => { alive = false; };
  }, [assetId, uri, base64, refreshKey]);
  return <Waveform {...visual} peaks={peaks}/>;
}
