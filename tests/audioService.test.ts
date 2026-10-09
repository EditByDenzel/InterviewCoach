const mockSound = {
  unloadAsync: jest.fn(async()=>{}), setIsMutedAsync:jest.fn(async()=>{}),
  setOnPlaybackStatusUpdate:jest.fn(),
};
const mockRecording = {
  prepareToRecordAsync:jest.fn(async()=>{}),startAsync:jest.fn(async()=>{}),pauseAsync:jest.fn(async()=>{}),
  stopAndUnloadAsync:jest.fn(async()=>{}),getURI:jest.fn(()=>'file:///answer.m4a'),
};
jest.mock('react-native',()=>({Platform:{OS:'ios'}}));
jest.mock('expo-file-system',()=>({cacheDirectory:'file:///cache/',EncodingType:{Base64:'base64'},writeAsStringAsync:jest.fn(async()=>{}),readAsStringAsync:jest.fn(async()=>'audio')}));
jest.mock('expo-av',()=>({Audio:{
  setAudioModeAsync:jest.fn(async()=>{}),requestPermissionsAsync:jest.fn(async()=>({status:'granted'})),
  Sound:{createAsync:jest.fn(async()=>({sound:mockSound}))},
  Recording:jest.fn(()=>mockRecording),RecordingOptionsPresets:{HIGH_QUALITY:{}},
}}));
import { Audio } from 'expo-av';
import { playBase64Audio,stopPlayback,setPlaybackMuted,startRecording,pauseRecording,resumeRecording,stopRecording } from '../src/services/audioService';

describe('Interview audio controls',()=>{
  beforeEach(()=>{jest.useFakeTimers();jest.clearAllMocks();});
  afterEach(async()=>{await stopPlayback();await stopRecording();jest.useRealTimers();});
  const startPlayback=async()=>{
    const playback=playBase64Audio('audio','wav');
    // Flush async device/file preparation until the playback listener is installed.
    for(let i=0;i<15;i++)await Promise.resolve();
    return {playback};
  };
  it('cancels active playback and clears its safety timer when leaving a session',async()=>{
    const {playback}=await startPlayback();expect(jest.getTimerCount()).toBe(1);
    await stopPlayback();await playback;
    expect(mockSound.unloadAsync).toHaveBeenCalledTimes(1);expect(jest.getTimerCount()).toBe(0);
  });
  it('applies mute to active playback and subsequent questions',async()=>{
    const {playback}=await startPlayback();await setPlaybackMuted(true);
    expect(mockSound.setIsMutedAsync).toHaveBeenCalledWith(true);await stopPlayback();await playback;
    const next=await startPlayback();expect(Audio.Sound.createAsync).toHaveBeenLastCalledWith(expect.anything(),expect.objectContaining({isMuted:true}));
    await stopPlayback();await next.playback;await setPlaybackMuted(false);
  });
  it('pauses and resumes the same recording before submitting',async()=>{
    await startRecording();await pauseRecording();await resumeRecording();
    expect(mockRecording.pauseAsync).toHaveBeenCalledTimes(1);expect(mockRecording.startAsync).toHaveBeenCalledTimes(2);
    expect(await stopRecording()).toBe('file:///answer.m4a');expect(await stopRecording()).toBeNull();
  });
  it('reports actual playback position and duration to the waveform',async()=>{
    const progress=jest.fn();
    const playback=playBase64Audio('audio','wav',progress);
    for(let i=0;i<15;i++)await Promise.resolve();
    const listener=mockSound.setOnPlaybackStatusUpdate.mock.calls.find(call=>typeof call[0]==='function')?.[0];
    listener({isLoaded:true,positionMillis:750,durationMillis:3000,didJustFinish:false});
    expect(progress).toHaveBeenCalledWith(750,3000);
    listener({isLoaded:false});
    expect(progress).toHaveBeenCalledTimes(1);
    await stopPlayback();await playback;
    expect(mockSound.setOnPlaybackStatusUpdate).toHaveBeenLastCalledWith(null);
  });
  it('releases playback on a device playback error',async()=>{
    const {playback}=await startPlayback();
    const rejected=expect(playback).rejects.toThrow('Invalid audio');
    const listener=mockSound.setOnPlaybackStatusUpdate.mock.calls.find(call=>typeof call[0]==='function')?.[0];
    listener({isLoaded:false,error:'Invalid audio'});await rejected;
    expect(jest.getTimerCount()).toBe(0);
  });
});
