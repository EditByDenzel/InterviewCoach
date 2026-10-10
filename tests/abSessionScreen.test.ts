import React from 'react';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { ABSession, Scenario, contextForRun } from '../src/domain/abSession';

const mockAssets = new Map<string, { base64: string; mimeType: string }>();
let mockSaved: ABSession | null = null;
const mockJournal: ABSession[] = [];
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const mockSave = jest.fn(async (session: ABSession) => { mockSaved = clone(session); mockJournal.push(clone(session)); });
const mockLoad = jest.fn(async () => mockSaved);
const mockDecide = jest.fn();
const mockTranslate = jest.fn();
const mockCompare = jest.fn();
const mockTTS = jest.fn();
const mockTranscribe = jest.fn();
const mockPlayback = jest.fn();
const mockStopPlayback = jest.fn(async () => {});
const mockStartRecording = jest.fn(async (_silence: () => void, _idle: () => void) => {});
const mockStopRecording = jest.fn(async () => 'file:///cache/reply.m4a');
const mockPauseRecording = jest.fn(async () => {});
const mockResumeRecording = jest.fn(async () => {});
const mockPermission = jest.fn(async () => true);
const mockReleaseTemporary = jest.fn(async (_uri: string) => {});
let mockAppStateListener: ((state: string) => void) | null = null;
const mockRemoveAppStateListener = jest.fn();

jest.mock('react-native', () => {
  const React = require('react');
  const ScrollView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ scrollToEnd: jest.fn() }));
    return React.createElement('ScrollView', props, props.children);
  });
  return { View: 'View', Text: 'Text', TextInput: 'TextInput', ScrollView,
    KeyboardAvoidingView: 'KeyboardAvoidingView', ActivityIndicator: 'ActivityIndicator',
    StyleSheet: { create: (value: any) => value }, Platform: { OS: 'ios' }, Share: { share: jest.fn() },
    AppState: { addEventListener: (_event: string, listener: (state: string) => void) => {
      mockAppStateListener = listener; return { remove: mockRemoveAppStateListener };
    } } };
});
jest.mock('../src/components/CoachieDesign', () => {
  const React = require('react');
  const component = (name: string) => (props: any) => React.createElement(name, props, props.children);
  return { DesignFrame: component('DesignFrame'), GlassButton: component('Action'), Waveform: component('Waveform'),
    DESIGN: { font: 'Inter', medium: 'Inter', semibold: 'Inter' } };
});
jest.mock('../src/components/Motion', () => {
  const React = require('react');
  const component = (name: string) => (props: any) => React.createElement(name, props, props.children);
  return { FadeIn: component('FadeIn'), MotionPressable: component('MotionAction'),
    LiveDots: component('LiveDots'), BreathingHalo: component('Halo'), useMotion: () => ({ reduced: true }) };
});
jest.mock('../src/store/settingsStore', () => ({ loadSettings: async () => ({ geminiApiKey: 'fixture-key', geminiVoice: 'Kore', ttsProvider: 'gemini' }) }));
jest.mock('../src/store/abSessionStore', () => ({ saveABSession: (...args: any[]) => (mockSave as any)(...args), loadABSession: (...args: any[]) => (mockLoad as any)(...args), deleteABSession: jest.fn(async () => {}) }));
jest.mock('../src/store/audioAssetStore', () => ({
  saveAudioAsset: jest.fn(async (id: string, asset: any) => { mockAssets.set(id, clone(asset)); return id; }),
  loadAudioAsset: jest.fn(async (id: string) => mockAssets.get(id) ?? null),
  deleteAudioAssets: jest.fn(async (ids: string[]) => { ids.forEach(id => mockAssets.delete(id)); }),
}));
jest.mock('../src/services/abConversationService', () => ({
  decideNextTurn: (...args: any[]) => mockDecide(...args), translateToEnglish: (...args: any[]) => mockTranslate(...args), compareRuns: (...args: any[]) => mockCompare(...args),
}));
jest.mock('../src/services/geminiService', () => ({ generateGeminiTTS: (...args: any[]) => mockTTS(...args), transcribeAudio: (...args: any[]) => mockTranscribe(...args) }));
jest.mock('../src/services/audioService', () => ({
  playBase64Audio: (...args: any[]) => mockPlayback(...args), stopPlayback: (...args: any[]) => (mockStopPlayback as any)(...args),
  startRecording: (...args: any[]) => (mockStartRecording as any)(...args), stopRecording: (...args: any[]) => (mockStopRecording as any)(...args),
  pauseRecording: (...args: any[]) => (mockPauseRecording as any)(...args), resumeRecording: (...args: any[]) => (mockResumeRecording as any)(...args),
  requestMicrophonePermission: (...args: any[]) => (mockPermission as any)(...args),
  readAudioAsBase64: async () => ({ base64: 'cmVwbHk=', mimeType: 'audio/m4a' }), subscribeAudioLevel: () => () => {},
  releaseTemporaryRecording: (...args: any[]) => (mockReleaseTemporary as any)(...args),
}));

import ABSessionScreen from '../src/screens/ABSessionScreen';
import { saveAudioAsset, deleteAudioAssets } from '../src/store/audioAssetStore';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
const flush = async () => { for (let i = 0; i < 90; i++) await Promise.resolve(); };
const scenario: Scenario = { id: 'travel', title: 'Travel planning', objective: 'Plan a useful trip', role: 'Traveller',
  facts: ['A weekend trip'], constraints: [], language: 'English', minMinutes: 0, maxMinutes: 5 };

describe('Real A/B screen integration with controlled device and provider boundaries', () => {
  let renderer: ReactTestRenderer | null = null;
  let navigation: any;
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks(); mockAssets.clear(); mockJournal.length = 0; mockSaved = null;
    mockAppStateListener = null;
    mockSave.mockImplementation(async s => { mockSaved = clone(s); mockJournal.push(clone(s)); });
    mockLoad.mockImplementation(async () => mockSaved);
    mockDecide.mockImplementation(async (_key: string, s: ABSession) => ({
      sourceText: s.scenario.language === 'Thai' ? 'ช่วยวางแผนเที่ยวหน่อย' : 'Could you help plan my trip?',
      englishText: 'Could you help plan my trip?', reuseTurnId: '', goalResolved: false, scenarioOnly: true,
    }));
    mockTranslate.mockImplementation(async (_key: string, source: string, lang: string) => lang === 'Thai' ? 'The translated model reply.' : source);
    mockCompare.mockResolvedValue({ recommendation: 'tie', summary: 'Both gave useful answers.', outcomes: { A: 'Pass', B: 'Pass' }, findings: [], limitations: [] });
    mockTTS.mockResolvedValue('c3BlZWNo'); mockTranscribe.mockResolvedValue('A practical model reply.');
    mockPlayback.mockResolvedValue(undefined); mockStopPlayback.mockResolvedValue(undefined);
    mockPermission.mockResolvedValue(true); mockStopRecording.mockResolvedValue('file:///cache/reply.m4a');
    mockReleaseTemporary.mockImplementation(async () => {});
    (saveAudioAsset as jest.Mock).mockImplementation(async (id: string, asset: any) => { mockAssets.set(id, clone(asset)); return id; });
    navigation = { addListener: jest.fn(() => () => {}), popToTop: jest.fn() };
  });
  afterEach(async () => {
    await act(async () => { renderer?.unmount(); await flush(); }); renderer = null;
    jest.useRealTimers();
  });
  const mount = async (language = 'English', savedId?: string) => {
    await act(async () => {
      renderer = TestRenderer.create(React.createElement(ABSessionScreen, { navigation, route: { params: { scenario: { ...scenario, language }, ...(savedId ? { id: savedId } : {}) } } } as any));
      await flush();
    });
  };
  const control = (label: string) => renderer!.root.findAll(node =>
    (String(node.type) === 'Action' || String(node.type) === 'MotionAction') && (node.props.label === label || node.props.accessibilityLabel === label))[0];
  const press = async (label: string) => {
    const node = control(label); expect(node).toBeDefined();
    await act(async () => { node.props.onPress(); await flush(); });
  };
  const visibleText = () => renderer!.root.findAll(node => String(node.type) === 'Text').map(node => node.children.filter(child => typeof child === 'string').join('')).join('\n');
  const startWithoutAutoListen = async () => {
    const speech = deferred<string>(); mockTTS.mockReturnValueOnce(speech.promise);
    await press('Start Model A');
    await press('Automatic microphone capture after Coachie speaks');
    await act(async () => { speech.resolve('c3BlZWNo'); await flush(); });
    expect(mockStartRecording).not.toHaveBeenCalled();
  };

  it('waits for explicit Start A and appends/delivers its opener exactly once', async () => {
    await mount();
    expect(mockDecide).not.toHaveBeenCalled(); expect(mockTTS).not.toHaveBeenCalled(); expect(mockPermission).not.toHaveBeenCalled();
    await press('Start Model A');
    expect(mockDecide).toHaveBeenCalledTimes(1); expect(mockTTS).toHaveBeenCalledTimes(1);
    expect(mockSaved!.turns).toHaveLength(1); expect(mockSaved!.turns[0]).toMatchObject({ run: 'A', speaker: 'tasker', delivered: true });
  });

  it('retries an undelivered question after TTS failure without generating a second question', async () => {
    mockTTS.mockRejectedValueOnce(new Error('TTS unavailable'));
    await mount(); await press('Start Model A');
    expect(mockSaved!.turns).toHaveLength(1); expect(mockSaved!.turns[0].delivered).toBe(false);
    expect(visibleText()).toContain('TTS unavailable');
    await press('Retry failed action');
    expect(mockDecide).toHaveBeenCalledTimes(1); expect(mockTTS).toHaveBeenCalledTimes(2);
    expect(mockSaved!.turns).toHaveLength(1); expect(mockSaved!.turns[0].delivered).toBe(true);
  });

  it('starts B with the same saved opener audio and builds B follow-ups from B history', async () => {
    await mount(); await startWithoutAutoListen();
    const opener = clone(mockSaved!.turns[0]);
    await press('End current model run'); expect(mockSaved!.status).toBe('waiting_b');
    const textCalls = mockDecide.mock.calls.length, speechCalls = mockTTS.mock.calls.length;
    await press('Start Model B');
    expect(mockDecide).toHaveBeenCalledTimes(textCalls); expect(mockTTS).toHaveBeenCalledTimes(speechCalls);
    const b = mockSaved!.turns.find(t => t.run === 'B')!;
    expect(b.sourceText).toBe(opener.sourceText); expect(b.audioAssetId).toBe(opener.audioAssetId);
    const input = renderer!.root.findByType('TextInput' as any);
    await act(async () => { input.props.onChangeText('Only model B said this.'); await flush(); });
    await press('Submit typed model reply');
    const bState = mockDecide.mock.calls.at(-1)![1] as ABSession;
    expect(bState.activeRun).toBe('B');
    expect(contextForRun(bState).every(t => t.run === 'B')).toBe(true);
    expect(contextForRun(bState).map(t => t.sourceText)).toContain('Only model B said this.');
  });

  it('retries persistence after accepting a typed reply without accepting it twice', async () => {
    await mount(); await startWithoutAutoListen();
    await act(async () => { renderer!.root.findByType('TextInput' as any).props.onChangeText('An accepted answer.'); await flush(); });
    mockSave.mockRejectedValueOnce(new Error('Local storage busy'));
    await press('Submit typed model reply');
    expect(visibleText()).toContain('Local storage busy');
    await press('Retry failed action');
    expect(mockSaved!.turns.filter(t => t.speaker === 'model' && t.sourceText === 'An accepted answer.')).toHaveLength(1);
    expect(mockDecide).toHaveBeenCalledTimes(2);
  });

  it('resumes the saved undelivered opener after reopening without generating another turn',async()=>{
    mockTTS.mockRejectedValueOnce(new Error('TTS unavailable'));
    await mount();await press('Start Model A');
    const saved=clone(mockSaved!);
    await act(async()=>{renderer!.unmount();await flush();});renderer=null;
    mockSaved=saved;await mount('English',saved.id);await press('Resume saved run');
    expect(mockDecide).toHaveBeenCalledTimes(1);expect(mockSaved!.turns).toHaveLength(1);
    expect(mockSaved!.turns[0].id).toBe(saved.turns[0].id);expect(mockSaved!.turns[0].delivered).toBe(true);
  });

  it('retains an unsaved recording for retry when its durable audio write fails',async()=>{
    await mount();await press('Start Model A');
    (saveAudioAsset as jest.Mock).mockRejectedValueOnce(new Error('Audio storage full'));
    await press('Finish model reply');
    expect(visibleText()).toContain('Audio storage full');expect(mockReleaseTemporary).not.toHaveBeenCalled();
    await press('Retry failed action');
    expect(mockStopRecording).toHaveBeenCalledTimes(1);expect(mockTranscribe).toHaveBeenCalledTimes(1);
    expect(mockSaved!.turns.filter(t=>t.speaker==='model')).toHaveLength(1);
    expect(mockReleaseTemporary).toHaveBeenCalledTimes(1);
    expect(mockReleaseTemporary).toHaveBeenCalledWith('file:///cache/reply.m4a');
  });

  it('releases a temporary recording only after both audio and ownership metadata are durable', async () => {
    await mount(); await press('Start Model A');
    let failed = false;
    mockSave.mockImplementation(async session => {
      if (session.pendingReply && mockAssets.has(session.pendingReply.audioAssetId) && !failed) {
        failed = true; throw new Error('Ownership metadata write interrupted');
      }
      mockSaved = clone(session); mockJournal.push(clone(session));
    });
    mockReleaseTemporary.mockImplementation(async uri => {
      expect(uri).toBe('file:///cache/reply.m4a');
      expect(mockSaved!.pendingReply).toBeDefined();
      expect(mockAssets.has(mockSaved!.pendingReply!.audioAssetId)).toBe(true);
    });
    await press('Finish model reply');
    expect(visibleText()).toContain('Ownership metadata write interrupted');
    expect(mockReleaseTemporary).not.toHaveBeenCalled();
    expect(mockTranscribe).not.toHaveBeenCalled();
    await press('Retry failed action');
    expect(mockReleaseTemporary).toHaveBeenCalledTimes(1);
    expect(mockStopRecording).toHaveBeenCalledTimes(1);
    expect(mockTranscribe).toHaveBeenCalledTimes(1);
    expect(mockSaved!.turns.filter(turn => turn.speaker === 'model')).toHaveLength(1);
  });

  it('reserves audio ownership before a pending speech write and reuses it after closing and reopening', async () => {
    const write = deferred<string>();
    let reservedId = '', reservedAsset: { base64: string; mimeType: string } | null = null;
    (saveAudioAsset as jest.Mock).mockImplementationOnce((assetId: string, asset: any) => {
      reservedId = assetId; reservedAsset = clone(asset); return write.promise;
    });
    await mount(); await press('Start Model A');
    expect(reservedId).not.toBe('');
    expect(mockSaved!.turns[0].audioAssetId).toBe(reservedId);
    expect(mockAssets.has(reservedId)).toBe(false);
    await press('Close A/B chat'); await press('Save and close chat');
    expect(navigation.popToTop).toHaveBeenCalledTimes(1);
    expect(mockSaved!.turns[0]).toMatchObject({ audioAssetId: reservedId, delivered: false });
    await act(async () => {
      mockAssets.set(reservedId, reservedAsset!); write.resolve(reservedId); await flush();
    });
    expect(mockPlayback).not.toHaveBeenCalled();
    const saved = clone(mockSaved!);
    await act(async () => { renderer!.unmount(); await flush(); }); renderer = null;
    mockSaved = saved; await mount('English', saved.id); await press('Resume saved run');
    expect(mockTTS).toHaveBeenCalledTimes(1); expect(mockDecide).toHaveBeenCalledTimes(1);
    expect(mockSaved!.turns).toHaveLength(1);
    expect(mockSaved!.turns[0]).toMatchObject({ id: saved.turns[0].id, audioAssetId: reservedId, delivered: true });
  });

  it('continues after the saving retry button without accepting the existing reply twice',async()=>{
    await mount();await startWithoutAutoListen();
    await act(async()=>{renderer!.root.findByType('TextInput' as any).props.onChangeText('Keep this accepted reply.');await flush();});
    mockSave.mockRejectedValueOnce(new Error('Local storage busy'));
    await press('Submit typed model reply');await press('Retry saving session');
    expect(mockSaved!.turns.filter(t=>t.speaker==='model'&&t.sourceText==='Keep this accepted reply.')).toHaveLength(1);
    expect(mockDecide).toHaveBeenCalledTimes(2);
    expect(mockSaved!.turns.at(-1)?.speaker).toBe('tasker');
  });

  it('retries saving a completed comparison without invoking the evaluator again', async () => {
    await mount(); await startWithoutAutoListen(); await press('End current model run'); await press('Start Model B');
    let failed = false;
    mockSave.mockImplementation(async s => {
      if (s.status === 'completed' && !failed) { failed = true; throw new Error('Comparison save interrupted'); }
      mockSaved = clone(s); mockJournal.push(clone(s));
    });
    await press('End current model run');
    expect(mockCompare).toHaveBeenCalledTimes(1); expect(visibleText()).toContain('Comparison save interrupted');
    await press('Retry failed action');
    expect(mockCompare).toHaveBeenCalledTimes(1); expect(mockSaved!.status).toBe('completed');
  });

  it('retains Thai source and recorded audio when translation fails, showing English only', async () => {
    mockTranscribe.mockResolvedValue('คำตอบภาษาไทยของโมเดล');
    mockTranslate.mockRejectedValueOnce(new Error('Translation unavailable'));
    await mount('Thai'); await press('Start Model A'); await press('Finish model reply');
    const pending = mockSaved!.pendingReply!;
    expect(pending.sourceText).toBe('คำตอบภาษาไทยของโมเดล'); expect(mockAssets.has(pending.audioAssetId)).toBe(true);
    expect(visibleText()).not.toContain('คำตอบภาษาไทยของโมเดล');
    expect(visibleText()).not.toContain('ช่วยวางแผนเที่ยวหน่อย');
    await press('Retry English transcript');
    expect(mockTranscribe).toHaveBeenCalledTimes(1);
    expect(mockSaved!.turns.find(t => t.id === pending.id)).toMatchObject({ sourceText: pending.sourceText, englishText: 'The translated model reply.', audioAssetId: pending.audioAssetId });
  });

  it('closes while permission is pending without starting the microphone afterward', async () => {
    const permission = deferred<boolean>(); mockPermission.mockReturnValueOnce(permission.promise);
    await mount(); await press('Start Model A'); await press('Close A/B chat'); await press('Save and close chat');
    expect(navigation.popToTop).toHaveBeenCalledTimes(1);
    await act(async () => { permission.resolve(true); await flush(); });
    expect(mockStartRecording).not.toHaveBeenCalled();
  });

  it('recovers from an empty recording through explicit deletion without losing the opener or inventing a reply', async () => {
    mockTranscribe.mockResolvedValueOnce('');
    await mount(); await press('Start Model A'); await press('Finish model reply');
    const pending = clone(mockSaved!.pendingReply!);
    const openerAsset = mockSaved!.turns[0].audioAssetId!;
    expect(visibleText()).toContain('No speech detected');
    await press('Delete unfinished recording and retry capture');
    expect(deleteAudioAssets).toHaveBeenCalledWith([pending.audioAssetId]);
    expect(mockAssets.has(openerAsset)).toBe(true);
    expect(mockSaved!.pendingReply).toBeUndefined();
    expect(mockSaved!.turns.filter(t => t.speaker === 'model')).toHaveLength(0);
    expect(mockDecide).toHaveBeenCalledTimes(1);
    expect(mockStartRecording).toHaveBeenCalledTimes(2);
  });

  it('pauses the same capture for replay and resumes it without starting another recording', async () => {
    await mount(); await press('Start Model A');
    expect(mockStartRecording).toHaveBeenCalledTimes(1);
    await press('Play Coachie turn 1');
    expect(mockPauseRecording).toHaveBeenCalledTimes(1); expect(mockStopRecording).not.toHaveBeenCalled();
    await press('Resume conversation');
    expect(mockResumeRecording).toHaveBeenCalledTimes(1); expect(mockStartRecording).toHaveBeenCalledTimes(1);
  });

  it('retains and pauses the active recording on backgrounding until explicit resume', async () => {
    await mount(); await press('Start Model A');
    expect(mockStartRecording).toHaveBeenCalledTimes(1);
    await act(async () => { mockAppStateListener!('background'); await flush(); });
    expect(mockPauseRecording).toHaveBeenCalledTimes(1);
    expect(mockStopRecording).not.toHaveBeenCalled(); expect(mockTranscribe).not.toHaveBeenCalled();
    expect(control('Resume conversation')).toBeDefined();
    await act(async () => { mockAppStateListener!('active'); await flush(); });
    expect(mockResumeRecording).not.toHaveBeenCalled();
    await press('Resume conversation');
    expect(mockResumeRecording).toHaveBeenCalledTimes(1); expect(mockStartRecording).toHaveBeenCalledTimes(1);
  });

  it('responds to Pause during active playback and resumes the saved clip without new text or TTS', async () => {
    const playback = deferred<void>(); mockPlayback.mockReturnValueOnce(playback.promise);
    mockStopPlayback.mockImplementationOnce(async () => { playback.resolve(); });
    await mount(); await press('Start Model A'); await press('Pause conversation');
    expect(mockStopPlayback).toHaveBeenCalledTimes(1); expect(mockStartRecording).not.toHaveBeenCalled();
    expect(mockSaved!.turns[0].delivered).toBe(false);
    await press('Resume conversation');
    expect(mockDecide).toHaveBeenCalledTimes(1); expect(mockTTS).toHaveBeenCalledTimes(1);
    expect(mockSaved!.turns[0].delivered).toBe(true); expect(mockStartRecording).toHaveBeenCalledTimes(1);
  });
});
