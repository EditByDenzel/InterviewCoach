import { audioBytes, bucketPeaks, wavPeaks, decodeWaveform } from '../src/services/audioWaveform';

function wav(samples: number[], channels = 1, float = false) {
  const bits = float ? 32 : 16, data = samples.length * bits / 8;
  const buffer = Buffer.alloc(44 + data);
  buffer.write('RIFF',0); buffer.writeUInt32LE(36+data,4); buffer.write('WAVEfmt ',8);
  buffer.writeUInt32LE(16,16); buffer.writeUInt16LE(float?3:1,20); buffer.writeUInt16LE(channels,22);
  buffer.writeUInt32LE(24000,24); buffer.writeUInt32LE(24000*channels*bits/8,28);
  buffer.writeUInt16LE(channels*bits/8,32); buffer.writeUInt16LE(bits,34);
  buffer.write('data',36); buffer.writeUInt32LE(data,40);
  samples.forEach((value,index)=>float?buffer.writeFloatLE(value,44+index*4):buffer.writeInt16LE(Math.round(value*32767),44+index*2));
  return buffer;
}

test('the actual quiet, loud and silent intervals retain their time order',()=>{
  expect(wavPeaks(wav([0,0,.25,-.25,.9,-.9,0,0]),4)).toEqual([0,expect.closeTo(.25,3),expect.closeTo(.9,3),0]);
});
test('silent WAVs stay silent rather than acquiring decorative speech',async()=>{
  expect(await decodeWaveform(wav(Array(256).fill(0)).toString('base64'))).toEqual(Array(128).fill(0));
});
test('stereo preserves speech in either channel without phase cancellation',()=>{
  expect(wavPeaks(wav([0,.7,.8,-.8],2),2)).toEqual([expect.closeTo(.7,3),expect.closeTo(.8,3)]);
});
test('float WAV and base64 decode correctly',()=>{
  expect(wavPeaks(audioBytes(wav([0,.2,-.6,1],1,true).toString('base64')),4)).toEqual([0,expect.closeTo(.2,5),expect.closeTo(.6,5),1]);
});
test('truncated and unsupported bytes cannot invent a waveform',()=>{
  const bytes=wav([.5,.5]);
  expect(wavPeaks(bytes.subarray(0,45))).toBeNull();
  expect(wavPeaks(Buffer.from('not audio'))).toBeNull();
});
test('bucketing covers the tail and treats nonfinite samples as silence',()=>{
  expect(bucketPeaks([0,NaN,.1,0,1],2)).toEqual([0,1]);
  expect(bucketPeaks([])).toEqual([]);
});
test('compressed browser decoding combines channels and releases its audio context',async()=>{
  const close=jest.fn(async()=>{});
  const decode=jest.fn(async()=>({length:4,numberOfChannels:2,getChannelData:(channel:number)=>Float32Array.from(channel?[0,.8,0,.6]:[.2,0,.4,0])}));
  const previous=(globalThis as any).window;
  (globalThis as any).window={AudioContext:class{decodeAudioData=decode;close=close;}};
  try {
    expect(await decodeWaveform(Buffer.from('compressed audio').toString('base64'))).toEqual([expect.closeTo(.2,5),expect.closeTo(.8,5),expect.closeTo(.4,5),expect.closeTo(.6,5)]);
    expect(close).toHaveBeenCalledTimes(1);
  } finally {(globalThis as any).window=previous;}
});
test('decoder failure releases its context and returns no fabricated waveform',async()=>{
  const close=jest.fn(async()=>{}),previous=(globalThis as any).window;
  (globalThis as any).window={AudioContext:class{decodeAudioData=async()=>{throw new Error('unsupported codec');};close=close;}};
  try {expect(await decodeWaveform('bm90IGF1ZGlv')).toBeNull();expect(close).toHaveBeenCalledTimes(1);}
  finally {(globalThis as any).window=previous;}
});
