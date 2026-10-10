const mockSound = {
  unloadAsync: jest.fn(async()=>{}), setIsMutedAsync:jest.fn(async()=>{}),
  setOnPlaybackStatusUpdate:jest.fn(),playAsync:jest.fn(async()=>{}),
};
const mockRecording = {
  prepareToRecordAsync:jest.fn(async()=>{}),startAsync:jest.fn(async()=>{}),pauseAsync:jest.fn(async()=>{}),
  stopAndUnloadAsync:jest.fn(async()=>{}),getURI:jest.fn(()=>'file:///answer.m4a'),
  setOnRecordingStatusUpdate:jest.fn(),setProgressUpdateInterval:jest.fn(),
};
jest.mock('react-native',()=>({Platform:{OS:'ios'}}));
jest.mock('expo-file-system',()=>({cacheDirectory:'file:///cache/',EncodingType:{Base64:'base64'},writeAsStringAsync:jest.fn(async()=>{}),deleteAsync:jest.fn(async()=>{}),getInfoAsync:jest.fn(async()=>({exists:true,isDirectory:false})),readAsStringAsync:jest.fn(async()=>'audio')}));
jest.mock('expo-av',()=>({Audio:{
  setAudioModeAsync:jest.fn(async()=>{}),requestPermissionsAsync:jest.fn(async()=>({status:'granted'})),
  Sound:{createAsync:jest.fn(async()=>({sound:mockSound}))},
  Recording:jest.fn(()=>mockRecording),RecordingOptionsPresets:{HIGH_QUALITY:{}},
}}));
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { playBase64Audio,stopPlayback,setPlaybackMuted,startRecording,pauseRecording,resumeRecording,stopRecording,subscribeAudioLevel,releaseTemporaryRecording } from '../src/services/audioService';

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
  it('completes even a short clip once and removes its temporary file',async()=>{
    const {playback}=await startPlayback();
    const listener=mockSound.setOnPlaybackStatusUpdate.mock.calls.find(call=>typeof call[0]==='function')?.[0];
    listener({isLoaded:true,positionMillis:40,durationMillis:40,didJustFinish:true});
    listener({isLoaded:true,positionMillis:40,durationMillis:40,didJustFinish:true});
    await stopPlayback();await playback;
    expect(mockSound.unloadAsync).toHaveBeenCalledTimes(1);
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith(expect.stringMatching(/tts_output_\d+\.wav$/),{idempotent:true});
    expect(jest.getTimerCount()).toBe(0);
  });
  it('reports a playback timeout rather than advancing as if speech finished',async()=>{
    const {playback}=await startPlayback();
    const rejected=expect(playback).rejects.toThrow('Audio playback timed out');
    jest.advanceTimersByTime(120_000);await rejected;
    expect(mockSound.unloadAsync).toHaveBeenCalledTimes(1);
  });
  it('does not start a sound created after the session was stopped',async()=>{
    let resolveCreation:(value:any)=>void=()=>{};
    (Audio.Sound.createAsync as jest.Mock).mockImplementationOnce(()=>new Promise(resolve=>{resolveCreation=resolve;}));
    const playback=playBase64Audio('audio');
    for(let i=0;i<15;i++)await Promise.resolve();
    await stopPlayback();resolveCreation({sound:mockSound});await playback;
    expect(mockSound.playAsync).not.toHaveBeenCalled();
    expect(mockSound.unloadAsync).toHaveBeenCalledTimes(1);
  });
  it('plays only the latest request when two questions start together',async()=>{
    const first=playBase64Audio('first');const second=playBase64Audio('second');
    for(let i=0;i<15;i++)await Promise.resolve();
    await first;expect(Audio.Sound.createAsync).toHaveBeenCalledTimes(1);
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(expect.anything(),'second',expect.anything());
    await stopPlayback();await second;
  });
  const recordingListener=()=>mockRecording.setOnRecordingStatusUpdate.mock.calls.find(call=>typeof call[0]==='function')?.[0];
  it('enables native metering and reports levels even in manual recording',async()=>{
    const level=jest.fn();const unsubscribe=subscribeAudioLevel(level);
    await startRecording();
    expect(mockRecording.prepareToRecordAsync).toHaveBeenCalledWith(expect.objectContaining({isMeteringEnabled:true}));
    expect(mockRecording.setProgressUpdateInterval).toHaveBeenCalledWith(80);
    recordingListener()({isRecording:true,metering:-20});
    expect(level).toHaveBeenLastCalledWith(.75);unsubscribe();
  });
  it('accepts a short spoken answer and triggers silence only once',async()=>{
    const silence=jest.fn();const idle=jest.fn();await startRecording(silence,idle);
    const listener=recordingListener();
    listener({isRecording:true,metering:-20});
    jest.advanceTimersByTime(2400);listener({isRecording:true,metering:-100});
    jest.advanceTimersByTime(10_000);listener({isRecording:true,metering:-100});
    expect(silence).toHaveBeenCalledTimes(1);expect(idle).not.toHaveBeenCalled();
  });
  it('excludes paused time from answer silence and idle detection',async()=>{
    const silence=jest.fn();const idle=jest.fn();await startRecording(silence,idle);
    const listener=recordingListener();listener({isRecording:true,metering:-20});
    jest.advanceTimersByTime(1000);await pauseRecording();
    jest.advanceTimersByTime(30_000);listener({isRecording:true,metering:-100});
    expect(silence).not.toHaveBeenCalled();await resumeRecording();
    listener({isRecording:true,metering:-100});expect(silence).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1400);listener({isRecording:true,metering:-100});
    expect(silence).toHaveBeenCalledTimes(1);expect(idle).not.toHaveBeenCalled();
  });
  it('rearms speech detection after an idle pause without immediately timing out again',async()=>{
    const silence=jest.fn();const idle=jest.fn();await startRecording(silence,idle);
    const listener=recordingListener();
    jest.advanceTimersByTime(7100);listener({isRecording:true,metering:-100});
    expect(idle).toHaveBeenCalledTimes(1);await pauseRecording();
    jest.advanceTimersByTime(20_000);await resumeRecording();
    listener({isRecording:true,metering:-100});expect(idle).toHaveBeenCalledTimes(1);
    listener({isRecording:true,metering:-20});
    jest.advanceTimersByTime(2400);listener({isRecording:true,metering:-100});
    expect(silence).toHaveBeenCalledTimes(1);
  });
  it('cancels preparation before opening a recording after leaving',async()=>{
    let resolvePreparation:()=>void=()=>{};
    mockRecording.prepareToRecordAsync.mockImplementationOnce(()=>new Promise<void>(resolve=>{resolvePreparation=resolve;}));
    const starting=startRecording();for(let i=0;i<10;i++)await Promise.resolve();
    const stopping=stopRecording();resolvePreparation();await starting;await stopping;
    expect(mockRecording.startAsync).not.toHaveBeenCalled();
    expect(mockRecording.stopAndUnloadAsync).toHaveBeenCalledTimes(1);
    expect(await stopRecording()).toBeNull();
  });
  it('releases partially prepared recordings after a startup error',async()=>{
    mockRecording.startAsync.mockRejectedValueOnce(new Error('Microphone lost'));
    await expect(startRecording()).rejects.toThrow('Microphone lost');
    expect(mockRecording.stopAndUnloadAsync).toHaveBeenCalledTimes(1);
    expect(await stopRecording()).toBeNull();
  });
  it('ignores queued meter samples from an earlier recording',async()=>{
    const silence=jest.fn();await startRecording(silence);
    const staleListener=recordingListener();await stopRecording();
    mockRecording.setOnRecordingStatusUpdate.mockClear();await startRecording(silence);
    staleListener({isRecording:true,metering:-20});
    jest.advanceTimersByTime(2400);recordingListener()({isRecording:true,metering:-100});
    expect(silence).not.toHaveBeenCalled();
  });
  it('releases only temporary native capture files after they are durably saved',async()=>{
    await releaseTemporaryRecording('file:///cache/Audio/recording.m4a');
    expect(FileSystem.deleteAsync).toHaveBeenCalledWith('file:///cache/Audio/recording.m4a',{idempotent:true});
  });
  it('never removes a cache subdirectory even when its URI lacks a trailing slash',async()=>{
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValueOnce({exists:true,isDirectory:true});
    await releaseTemporaryRecording('file:///cache/Audio');
    expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });
  it.each([
    'file:///documents/coachie-audio-v1/reply.m4a','file:///cache/../documents/reply.m4a',
    'file:///cache/%2E%2E/documents/reply.m4a','file:///cache/','data:audio/wav;base64,YQ==',
    'file:///cache-other/reply.m4a',
  ])('never releases permanent audio or paths outside the cache (%s)',async uri=>{
    await releaseTemporaryRecording(uri);expect(FileSystem.deleteAsync).not.toHaveBeenCalled();
  });
});
