import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator, Share, KeyboardAvoidingView, Platform, AppState } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList, AppSettings } from '../types';
import { ABSession, ABTurn, ABVote, createABSession, startA, startB, appendTurn, addElapsed, endRun, completeComparison, setVote, contextForRun, cacheKey, completionForRun } from '../domain/abSession';
import { personaProfiles } from '../domain/personas';
import { loadSettings } from '../store/settingsStore';
import { saveABSession, loadABSession, deleteABSession } from '../store/abSessionStore';
import { saveAudioAsset, loadAudioAsset, deleteAudioAssets } from '../store/audioAssetStore';
import { decideNextTurn, translateToEnglish, compareRuns } from '../services/abConversationService';
import { generateGeminiTTS, transcribeAudio } from '../services/geminiService';
import { createRecordingSession } from '../services/recordingSession';
import { playBase64Audio, stopPlayback, startRecording, stopRecording, pauseRecording, resumeRecording, requestMicrophonePermission, readAudioAsBase64, releaseTemporaryRecording, subscribeAudioLevel, AudioExtension } from '../services/audioService';
import { DesignFrame, DESIGN, GlassButton, Waveform } from '../components/CoachieDesign';
import { FadeIn, LiveDots, MotionPressable, useMotion, BreathingHalo } from '../components/Motion';

type Props = StackScreenProps<RootStackParamList, 'ABSession'>;
type Phase = 'ready' | 'thinking' | 'speaking' | 'listening' | 'paused' | 'transcribing' | 'ending' | 'waiting' | 'comparing' | 'complete' | 'error';
const labels: Record<Phase, string> = { ready: 'Ready when you are', thinking: 'Choosing a natural follow-up', speaking: 'Coachie is speaking', listening: 'Listening to the model', paused: 'Paused', transcribing: 'Preparing the English transcript', ending: 'Finishing this model run', waiting: 'Switch to Model B on your computer', comparing: 'Comparing the evidence', complete: 'Comparison ready', error: 'An action needs your attention' };
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
const audioExtension = (mime: string): AudioExtension => ({ 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mp4': 'mp4', 'audio/m4a': 'm4a', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/aac': 'aac', 'audio/x-caf': 'caf' }[mime.split(';')[0]] as AudioExtension) || 'm4a';
const id = (session: ABSession, speaker: 'tasker' | 'model') => `${session.id}-${session.activeRun}-${speaker}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export default function ABSessionScreen({ navigation, route }: Props) {
  const [session, setSession] = useState(() => createABSession(route.params.scenario, personaProfiles(route.params.scenario.language)[0]));
  const [phase, setPhase] = useState<Phase>('ready');
  const [loaded, setLoaded] = useState(false), [error, setError] = useState(''), [saveWarning, setSaveWarning] = useState('');
  const [draft, setDraft] = useState(''), [recording, setRecording] = useState(false), [paused, setPaused] = useState(false), [seconds, setSeconds] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null), [progress, setProgress] = useState(0), [level, setLevel] = useState(0);
  const [confirmClose, setConfirmClose] = useState(false), [confirmDelete, setConfirmDelete] = useState(false);
  const [autoListen, setAutoListen] = useState(true);
  const state = useRef(session), alive = useRef(true), exiting = useRef(false), busy = useRef(false), pausedRef = useRef(false), phaseRef = useRef<Phase>('ready');
  const automatic = useRef(true), settings = useRef<AppSettings | null>(null), finishRequested = useRef(false), retry = useRef<(() => Promise<void>) | null>(null);
  const log = useRef<ScrollView>(null), clipCache = useRef(new Map<string, string>()), lastTick = useRef(Date.now());
  const finalized = useRef<(uri: string) => Promise<void>>(async () => {});
  const temporaryReply = useRef<{ id: string; uri: string; run: 'A' | 'B' } | null>(null);
  const retainingReply = useRef<Promise<void> | null>(null);
  const { reduced } = useMotion();

  const showPhase = (value: Phase) => { phaseRef.current = value; if (alive.current) setPhase(value); };
  const update = (value: ABSession) => { state.current = value; if (alive.current) setSession(value); };
  const active = () => alive.current && !exiting.current;
  const ensureActive = () => { if (!active()) throw new Error('Session closed'); };
  const persist = async () => {
    try { await saveABSession(state.current); if (active()) setSaveWarning(''); }
    catch (err) { if (active()) setSaveWarning(`${(err as Error).message} Keep this chat open and retry saving.`); throw err; }
  };
  const persistThen = async (continuation: () => Promise<void>) => {
    // State mutations have already happened. Retry the durable boundary and
    // continuation, never the operation that generated/accepted the turn.
    const resume = async () => { await persist(); ensureActive(); await continuation(); };
    retry.current = resume;
    await resume();
  };
  const capture = useRef<ReturnType<typeof createRecordingSession> | null>(null);
  if (!capture.current) capture.current = createRecordingSession({
    requestPermission: requestMicrophonePermission, start: startRecording, stop: stopRecording, pause: pauseRecording, resume: resumeRecording, canAccept: active,
    onFinalized: uri => finalized.current(uri),
    onError: err => { if (active()) { setError(err.message); showPhase('error'); } },
    onChange: snap => { if (active()) { setRecording(snap.recording); setSeconds(snap.elapsedSeconds); setPaused(snap.paused); if (snap.recording) { pausedRef.current = snap.paused; showPhase(snap.paused ? 'paused' : 'listening'); } } },
  });

  const operate = async (action: () => Promise<void>) => {
    if (busy.current || !active()) return;
    busy.current = true; setError(''); retry.current = action;
    try { await action(); }
    catch (err) { if (active()) { setError((err as Error).message || 'Please try again.'); showPhase('error'); } }
    finally { busy.current = false; }
  };
  const patchTurn = (turnId: string, patch: Partial<ABTurn>) => update({ ...state.current, turns: state.current.turns.map(t => t.id === turnId ? { ...t, ...patch } : t) });
  const apiKey = () => settings.current?.geminiApiKey || '';
  const endCurrent = async () => {
    update(endRun(state.current, { force: true })); finishRequested.current = false; pausedRef.current = false; setPaused(false);
    await persistThen(async () => {
      if (state.current.status === 'waiting_b') { showPhase('waiting'); retry.current = null; }
      else await evaluate();
    });
  };
  const evaluate = async () => {
    retry.current = evaluate; showPhase('comparing');
    const result = await compareRuns(apiKey(), state.current); ensureActive();
    update(completeComparison(state.current, result));
    await persistThen(async () => { showPhase('complete'); retry.current = null; });
  };

  const speakTurn = async (turn: ABTurn, listeningAfter = true) => {
    retry.current = () => speakTurn(state.current.turns.find(t => t.id === turn.id) || turn, listeningAfter);
    ensureActive();
    const current = state.current;
    const key = cacheKey({ text: turn.sourceText, language: current.scenario.language, voice: current.persona.voice, style: current.persona.style, model: 'gemini-3.8-flash-tts', encoding: 'wav' });
    let assetId = turn.audioAssetId || clipCache.current.get(key);
    let audio = assetId ? await loadAudioAsset(assetId) : null;
    if (!audio) {
      showPhase('thinking');
      const base64 = await generateGeminiTTS(apiKey(), turn.sourceText, current.persona.voice, current.persona.style); ensureActive();
      assetId = `${current.id}-${turn.id}-speech`;
      // Reserve ownership before the asynchronous file write, so closing or
      // deleting during it still knows which asset belongs to this session.
      patchTurn(turn.id, { audioAssetId: assetId }); await persist(); ensureActive();
      await saveAudioAsset(assetId, { base64, mimeType: 'audio/wav' });
      audio = { base64, mimeType: 'audio/wav' }; clipCache.current.set(key, assetId);
    }
    ensureActive();
    patchTurn(turn.id, { audioAssetId: assetId }); await persist();
    if (pausedRef.current) { showPhase('paused'); return; }
    showPhase('speaking'); setPlayingId(turn.id); setProgress(0);
    try {
      await playBase64Audio(audio.base64, audio.mimeType.includes('mpeg') ? 'mp3' : 'wav', (position, duration) => {
        if (active()) { setProgress(duration ? position / duration : 0); if (duration && state.current.turns.find(t => t.id === turn.id)?.audioDurationSeconds !== duration / 1000) patchTurn(turn.id, { audioDurationSeconds: duration / 1000 }); }
      });
      ensureActive();
    } finally { if (active()) { setPlayingId(null); setProgress(0); } }
    if (pausedRef.current) { showPhase('paused'); return; }
    patchTurn(turn.id, { delivered: true }); await persist();
    if (!listeningAfter) return;
    if (finishRequested.current) { await endCurrent(); return; }
    showPhase('listening'); retry.current = null;
    if (automatic.current) await capture.current!.start();
  };

  const next = async () => {
    retry.current = next; ensureActive();
    if (completionForRun(state.current).shouldEnd || finishRequested.current) { await endCurrent(); return; }
    showPhase('thinking');
    const s = state.current;
    const used = new Set(contextForRun(s).filter(t => t.speaker === 'tasker').map(t => t.sourceText));
    const eligible = s.turns.filter(t => t.speaker === 'tasker' && t.scenarioOnly && t.delivered && !used.has(t.sourceText));
    const decision = await decideNextTurn(apiKey(), s, eligible); ensureActive();
    if (finishRequested.current || completionForRun(state.current, { goalResolved: decision.goalResolved }).shouldEnd) { await endCurrent(); return; }
    const reused = eligible.find(t => t.id === decision.reuseTurnId);
    const turn: ABTurn = { id: id(state.current, 'tasker'), run: state.current.activeRun, speaker: 'tasker', sourceText: decision.sourceText, englishText: decision.englishText,
      audioAssetId: reused?.audioAssetId, scenarioOnly: decision.scenarioOnly, delivered: false, createdAt: new Date().toISOString() };
    update(appendTurn(state.current, turn));
    await persistThen(() => speakTurn(turn));
  };

  const acceptReply = async (sourceText: string, englishText: string, replyId: string, audioAssetId?: string) => {
    ensureActive();
    update(appendTurn(state.current, { id: replyId, run: state.current.activeRun, speaker: 'model', sourceText, englishText, audioAssetId, createdAt: new Date().toISOString() }));
    update({ ...state.current, pendingReply: undefined }); setDraft(''); setPaused(false); pausedRef.current = false;
    await persistThen(next);
  };
  const finalizePending = async () => {
    retry.current = finalizePending; showPhase('transcribing');
    const pending = state.current.pendingReply;
    if (!pending) throw new Error('No saved reply is waiting for transcription.');
    const audio = await loadAudioAsset(pending.audioAssetId);
    if (!audio) throw new Error('The recorded reply is unavailable. Please record again.');
    let source = pending.sourceText;
    if (!source) {
      source = await transcribeAudio(apiKey(), audio.base64, audio.mimeType); ensureActive();
      if (!source.trim()) throw new Error('No speech detected. Record again or type a reply.');
      update({ ...state.current, pendingReply: { ...pending, sourceText: source } }); await persist();
    }
    const english = await translateToEnglish(apiKey(), source, state.current.scenario.language); ensureActive();
    await acceptReply(source, english, pending.id, pending.audioAssetId);
  };
  const deletePendingRecording = async () => {
    const pending = state.current.pendingReply;
    if (!pending || temporaryReply.current) return;
    // Explicit user deletion only. On failure the pending reference remains
    // available for an idempotent retry; accepted replies are never touched.
    await deleteAudioAssets([pending.audioAssetId]); ensureActive();
    update({ ...state.current, pendingReply: undefined });
    await persistThen(async () => {
      showPhase('listening'); retry.current = null;
      if (automatic.current) await capture.current!.start();
    });
  };
  const retainCapturedReply = (): Promise<void> => {
    if (retainingReply.current) return retainingReply.current;
    const pending = temporaryReply.current;
    if (!pending) return Promise.resolve();
    const action = (async () => {
      const audio = await readAudioAsBase64(pending.uri);
      const assetId = `${state.current.id}-${pending.id}-reply`;
      update({ ...state.current, pendingReply: { id: pending.id, run: pending.run, audioAssetId: assetId } });
      await persist();
      await saveAudioAsset(assetId, { base64: audio.base64, mimeType: audio.mimeType });
      await persist();
      await releaseTemporaryRecording(pending.uri);
      if (temporaryReply.current === pending) temporaryReply.current = null;
    })();
    retainingReply.current = action.finally(() => { retainingReply.current = null; });
    return retainingReply.current;
  };
  finalized.current = async uri => {
    temporaryReply.current = { id: id(state.current, 'model'), uri, run: state.current.activeRun };
    await operate(async () => {
      showPhase('transcribing');
      await retainCapturedReply(); ensureActive(); await finalizePending();
    });
  };

  const begin = async () => {
    retry.current = begin;
    if (!settings.current?.geminiApiKey) throw new Error('Add a Gemini API key in Settings before starting.');
    pausedRef.current = false; setPaused(false); lastTick.current = Date.now();
    if (state.current.status === 'ready_a') { update(startA(state.current)); await persistThen(next); }
    else if (state.current.status === 'waiting_b') {
      const opener = state.current.turns.find(t => t.run === 'A' && t.speaker === 'tasker' && t.delivered);
      if (!opener) throw new Error('Model A has no delivered opener to reuse. Resume A or start a new scenario.');
      update(startB(state.current));
      const turn = { ...opener, id: id(state.current, 'tasker'), run: 'B' as const, delivered: false, createdAt: new Date().toISOString() };
      update(appendTurn(state.current, turn)); await persistThen(() => speakTurn(turn));
    } else if (state.current.status === 'comparing') await evaluate();
    else if (state.current.pendingReply) await finalizePending();
    else {
      const latest = state.current.turns.filter(t => t.run === state.current.activeRun).at(-1);
      if (latest?.speaker === 'tasker') await speakTurn(latest);
      else await next();
    }
  };
  const togglePause = async () => {
    if (capture.current!.getSnapshot().recording) {
      if (capture.current!.getSnapshot().paused) await capture.current!.resume(); else await capture.current!.pause();
      return;
    }
    if (!pausedRef.current) {
      pausedRef.current = true; setPaused(true); await stopPlayback(); if (active()) showPhase('paused');
    } else if (!busy.current) { pausedRef.current = false; setPaused(false); await operate(begin); }
  };
  const replay = async (turn: ABTurn) => {
    if (playingId === turn.id) {
      if (busy.current && turn.speaker === 'tasker' && phaseRef.current === 'speaking') { pausedRef.current = true; setPaused(true); showPhase('paused'); }
      await stopPlayback(); setPlayingId(null); return;
    }
    if (busy.current) return;
    const hadCapture = await capture.current!.prepareForReplay();
    await operate(async () => {
      const audio = turn.audioAssetId ? await loadAudioAsset(turn.audioAssetId) : null;
      if (!audio) throw new Error('No saved audio is available for this turn.');
      ensureActive(); setPlayingId(turn.id); setProgress(0);
      try { await playBase64Audio(audio.base64, audioExtension(audio.mimeType), (position, duration) => { if (active()) setProgress(duration ? position / duration : 0); }); }
      finally { if (active()) { setPlayingId(null); setProgress(0); if (hadCapture) { pausedRef.current = true; setPaused(true); showPhase('paused'); } } }
    });
  };
  const finish = async () => {
    if (state.current.activeRun === 'A' && !state.current.turns.some(t => t.run === 'A' && t.speaker === 'tasker' && t.delivered)) return;
    finishRequested.current = true;
    showPhase('ending');
    if (capture.current!.getSnapshot().recording) { await capture.current!.end(); return; }
    if (!busy.current) await operate(endCurrent);
  };
  const close = async () => {
    exiting.current = true;
    try {
      if (capture.current!.getSnapshot().recording) {
        const uri = await stopRecording();
        if (uri) temporaryReply.current = { id: id(state.current, 'model'), uri, run: state.current.activeRun };
      }
      await retainCapturedReply();
      await capture.current!.dispose(); await stopPlayback(); await persist();
    } catch (err) {
      await capture.current!.dispose(); await stopPlayback(); capture.current = null;
      exiting.current = false; setRecording(false); setPaused(false); pausedRef.current = false;
      setError((err as Error).message); setConfirmClose(false); showPhase('error'); return;
    }
    navigation.popToTop();
  };

  useEffect(() => {
    alive.current = true;
    const initialize = async () => {
      setError('');
      try {
        settings.current = await loadSettings();
        const saved = route.params.id ? await loadABSession(route.params.id) : null;
        ensureActive();
        if (route.params.id && !saved) throw new Error('This A/B session is no longer available.');
        if (saved) { update(saved); showPhase(saved.status === 'completed' ? 'complete' : saved.status === 'waiting_b' ? 'waiting' : 'ready'); }
        else { const profiles = personaProfiles(route.params.scenario.language); update(createABSession(route.params.scenario, { voice: settings.current.geminiVoice || profiles[0].voice, style: profiles[0].style })); }
        setLoaded(true);
        retry.current = null;
      } catch (err) { if (active()) { setError((err as Error).message); retry.current = initialize; } }
    };
    void initialize();
    const unsubscribe = subscribeAudioLevel(value => { if (active()) setLevel(value); });
    const appState = AppState?.addEventListener('change', nextState => {
      if (nextState === 'active' || !active() || !['active_a', 'active_b'].includes(state.current.status)) return;
      pausedRef.current = true; setPaused(true);
      if (capture.current!.getSnapshot().recording) void capture.current!.pause();
      else { void stopPlayback(); showPhase('paused'); }
    });
    const back = navigation.addListener('beforeRemove', e => { if (!exiting.current) { e.preventDefault(); setConfirmClose(true); } });
    return () => { alive.current = false; unsubscribe(); appState?.remove(); back(); void capture.current!.dispose(); void stopPlayback(); };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      capture.current!.tick();
      const now = Date.now(), elapsed = Math.max(0, (now - lastTick.current) / 1000); lastTick.current = now;
      if (!active() || pausedRef.current || !['active_a', 'active_b'].includes(state.current.status) || ['ready', 'error'].includes(phaseRef.current)) return;
      update(addElapsed(state.current, elapsed));
      if (completionForRun(state.current).shouldEnd) finishRequested.current = true;
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { const timer = setTimeout(() => log.current?.scrollToEnd({ animated: !reduced }), 80); return () => clearTimeout(timer); }, [session.turns.length, phase, reduced]);

  const ongoing = ['active_a', 'active_b'].includes(session.status);
  const canStart = loaded && !ongoing && session.status !== 'completed';
  const total = session.turns.filter(t => t.run === session.activeRun && t.speaker === 'model').length;
  const maxReached = session.elapsed[session.activeRun] >= session.scenario.maxMinutes * 60;
  const profileChoices = personaProfiles(session.scenario.language);
  const renderTurn = (turn: ABTurn, index: number) => <FadeIn key={turn.id} style={[styles.bubble, turn.speaker === 'model' && styles.modelBubble]}>
    <Text style={styles.meta}>{turn.speaker === 'tasker' ? 'Coachie · Synthetic voice' : `Model ${turn.run}`} · {index + 1}</Text>
    <Text selectable style={styles.body}>{turn.englishText}</Text>
    {turn.audioAssetId && <View style={styles.audioRow}><MotionPressable accessibilityRole="button" accessibilityLabel={`${playingId === turn.id ? 'Stop' : 'Play'} ${turn.speaker === 'tasker' ? 'Coachie' : `Model ${turn.run}`} turn ${index + 1}`} onPress={() => void replay(turn)} style={styles.play}><Text style={styles.buttonText}>{playingId === turn.id ? '■' : '▶'}</Text></MotionPressable><View style={{ flex: 1 }}><Waveform active={playingId === turn.id} progress={playingId === turn.id ? progress : 0} candidate={turn.speaker === 'model'} /></View><Text style={styles.meta}>{turn.audioDurationSeconds ? time(turn.audioDurationSeconds) : 'Audio'}</Text></View>}
    {turn.speaker === 'tasker' && turn.delivered === false && <Text style={styles.meta}>Not yet fully delivered · resume to replay</Text>}
  </FadeIn>;

  return <DesignFrame chat><KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.header}><GlassButton label="Close A/B chat" onPress={() => setConfirmClose(true)} style={styles.smallButton}><Text style={styles.buttonText}>Close</Text></GlassButton><Text style={styles.headerText}>Model {session.activeRun} · {time(session.elapsed[session.activeRun])}</Text><GlassButton label="Delete A/B session" onPress={() => setConfirmDelete(true)} style={styles.smallButton}><Text style={styles.buttonText}>Delete</Text></GlassButton></View>
    <ScrollView ref={log} style={styles.fill} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{session.scenario.title}</Text><Text style={styles.meta}>{session.scenario.language} speech · English transcript · {session.scenario.minMinutes}–{session.scenario.maxMinutes} min per model{session.scenario.minTurns ? ` · ${session.scenario.minTurns}+ exchanges` : ''}</Text>
      <Text style={styles.body}>{session.scenario.objective}</Text>
      {session.status === 'ready_a' && <View style={styles.card}><Text style={styles.cardTitle}>Choose a character</Text><Text style={styles.meta}>Keep the same character for both models. Audition these directions before judging accent quality.</Text>{profileChoices.map(p => <GlassButton key={p.id} label={`Select ${p.label}`} accessibilityState={{ selected: session.persona.style === p.style }} onPress={() => update({ ...state.current, persona: { voice: p.voice, style: p.style } })} style={[styles.choice, session.persona.style === p.style && styles.selected]}><Text style={styles.buttonText}>{p.label} · {p.voice}</Text></GlassButton>)}<GlassButton label="Preview character voice" onPress={() => void operate(async () => { const script = session.scenario.language === 'Thai' ? 'ช่วยอธิบายเรื่องนี้ให้ฉันเข้าใจหน่อยได้ไหม' : 'Could you explain a little more about what you mean?'; const audio = await generateGeminiTTS(apiKey(), script, state.current.persona.voice, state.current.persona.style); ensureActive(); await playBase64Audio(audio); })} style={styles.choice}><Text style={styles.buttonText}>Preview voice</Text></GlassButton></View>}
      <View style={styles.divider}><View style={styles.line}/><Text style={styles.cardTitle}>Model A</Text><View style={styles.line}/></View>
      {session.turns.filter(t => t.run === 'A').map(renderTurn)}
      {session.status !== 'ready_a' && session.status !== 'active_a' && <View style={styles.divider}><View style={styles.line}/><Text style={styles.cardTitle}>Model B</Text><View style={styles.line}/></View>}
      {session.status === 'waiting_b' && <View style={styles.card}><Text style={styles.body}>Model A is saved. Switch the evaluated model on your computer, then start B. Its history begins fresh with the same opener.</Text></View>}
      {session.turns.filter(t => t.run === 'B').map(renderTurn)}
      {session.pendingReply && <View style={styles.card}><Text style={styles.body}>Recorded reply retained. Its English transcript is waiting for completion.</Text><GlassButton label="Retry English transcript" onPress={() => void operate(finalizePending)} style={styles.choice}><Text style={styles.buttonText}>Retry transcript</Text></GlassButton><GlassButton label="Replay retained reply" onPress={() => void operate(async () => { const a = await loadAudioAsset(state.current.pendingReply!.audioAssetId); if (!a) throw new Error('Recorded audio unavailable.'); ensureActive(); await playBase64Audio(a.base64, audioExtension(a.mimeType)); })} style={styles.choice}><Text style={styles.buttonText}>Replay reply</Text></GlassButton>{!temporaryReply.current && <GlassButton label="Delete unfinished recording and retry capture" onPress={() => void operate(deletePendingRecording)} style={styles.choice}><Text style={styles.buttonText}>Delete this recording & try again</Text></GlassButton>}</View>}
      {session.comparison && <View style={styles.card}><Text style={styles.title}>Suggested: {session.comparison.recommendation.replace('_', ' ')}</Text><Text style={styles.body}>{session.comparison.summary}</Text><Text style={styles.body}>A: {session.comparison.outcomes.A}{'\n'}B: {session.comparison.outcomes.B}</Text>{session.comparison.findings.map((f, i) => <View key={i} style={styles.finding}><Text style={styles.cardTitle}>{f.dimension}</Text><Text style={styles.body}>{f.detail}</Text><Text style={styles.meta}>Evidence: {f.turnIds.map(turnId => { const t = session.turns.find(t => t.id === turnId); return t ? `Model ${t.run} · turn ${session.turns.filter(t2 => t2.run === t.run).findIndex(t2 => t2.id === turnId) + 1}` : ''; }).join(', ')}</Text></View>)}{session.comparison.limitations.map((l, i) => <Text key={i} style={styles.meta}>{l}</Text>)}<Text style={styles.cardTitle}>Your final choice</Text><View style={styles.voteRow}>{(['A', 'B', 'tie', 'insufficient_evidence'] as ABVote[]).map(v => <GlassButton key={v} label={`Choose ${v}`} accessibilityState={{ selected: session.vote === v }} onPress={() => void operate(async () => { update(setVote(state.current, v)); await persist(); })} style={[styles.vote, session.vote === v && styles.selected]}><Text style={styles.buttonText}>{v === 'insufficient_evidence' ? 'Unsure' : v}</Text></GlassButton>)}</View><GlassButton label="Share comparison and English transcript" onPress={() => void Share.share({ message: `${session.scenario.title}\n\n${session.turns.map(t => `${t.run} ${t.speaker}: ${t.englishText}`).join('\n\n')}\n\n${session.comparison!.summary}\nUser vote: ${session.vote || 'not selected'}` })} style={styles.choice}><Text style={styles.buttonText}>Share transcript</Text></GlassButton></View>}
      {!!error && <View style={styles.card}><Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text>{(loaded || retry.current) && <GlassButton label="Retry failed action" onPress={() => void operate(retry.current || begin)} style={styles.choice}><Text style={styles.buttonText}>Retry</Text></GlassButton>}</View>}
      {!!saveWarning && <View style={styles.card}><Text style={styles.error}>{saveWarning}</Text><GlassButton label="Retry saving session" onPress={() => void operate(retry.current || persist)} style={styles.choice}><Text style={styles.buttonText}>Retry saving</Text></GlassButton></View>}
      {confirmClose && <View style={styles.card}><Text style={styles.cardTitle}>Save and close?</Text><Text style={styles.body}>Turns and recordings stay until you delete this chat. Any active recording is saved for transcription when you return.</Text><View style={styles.voteRow}><GlassButton label="Keep chatting" onPress={() => setConfirmClose(false)} style={styles.vote}><Text style={styles.buttonText}>Stay</Text></GlassButton><GlassButton label="Save and close chat" onPress={() => void close()} style={styles.vote}><Text style={styles.buttonText}>Save & close</Text></GlassButton></View></View>}
      {confirmDelete && <View style={styles.card}><Text style={styles.cardTitle}>Delete chat and recordings?</Text><View style={styles.voteRow}><GlassButton label="Cancel deletion" onPress={() => setConfirmDelete(false)} style={styles.vote}><Text style={styles.buttonText}>Cancel</Text></GlassButton><GlassButton label="Confirm delete recordings and transcripts" onPress={() => void operate(async () => { await capture.current!.dispose(); await stopPlayback(); await deleteABSession(session.id); exiting.current = true; navigation.popToTop(); })} style={styles.vote}><Text style={styles.buttonText}>Delete</Text></GlassButton></View></View>}
    </ScrollView>
    {!confirmClose && !confirmDelete && <View style={styles.footer}><View style={styles.statusRow}><Text accessibilityLiveRegion="polite" style={styles.meta}>{labels[phase]}</Text>{['thinking', 'transcribing', 'comparing'].includes(phase) && <LiveDots active/>}</View>
      {!loaded && !error && <ActivityIndicator color="#FF8C38"/>}
      {canStart && <GlassButton style={styles.choice} label={session.status === 'waiting_b' ? 'Start Model B' : session.status === 'comparing' ? 'Compare models' : 'Start Model A'} onPress={() => void operate(begin)}><Text style={styles.buttonText}>{session.status === 'waiting_b' ? 'Start Model B' : session.status === 'comparing' ? 'Compare models' : 'Start Model A'}</Text></GlassButton>}
      {ongoing && <><Text style={styles.meta}>{total} replies · {maxReached ? 'Time reached. Finish this reply; no further questions.' : 'Transcription appears after you finish each reply.'}</Text>{phase === 'ready' && <GlassButton style={styles.choice} label="Resume saved run" onPress={() => void operate(begin)}><Text style={styles.buttonText}>Resume run</Text></GlassButton>}<View style={styles.controls}><GlassButton label={paused ? 'Resume conversation' : 'Pause conversation'} onPress={() => void togglePause()} style={styles.vote}><Text style={styles.buttonText}>{paused ? 'Resume' : 'Pause'}</Text></GlassButton><BreathingHalo size={88} active={recording && !paused} recording={recording} level={level}><GlassButton label={recording ? 'Finish model reply' : 'Start microphone capture'} onPress={() => { if (busy.current || state.current.pendingReply || temporaryReply.current) return; if (capture.current!.getSnapshot().recording) void capture.current!.end(); else void capture.current!.start(); }} style={styles.mic}><Text style={styles.buttonText}>{recording ? time(seconds) + ' · Stop' : 'Listen'}</Text></GlassButton></BreathingHalo><GlassButton label="End current model run" disabled={phase === 'ending' || (session.activeRun === 'A' && !session.turns.some(t => t.run === 'A' && t.speaker === 'tasker' && t.delivered))} onPress={() => void finish()} style={styles.vote}><Text style={styles.buttonText}>End {session.activeRun}</Text></GlassButton></View><MotionPressable accessibilityRole="switch" accessibilityState={{ checked: autoListen }} accessibilityLabel="Automatic microphone capture after Coachie speaks" onPress={() => { automatic.current = !automatic.current; setAutoListen(automatic.current); }} style={styles.switch}><Text style={styles.meta}>Auto listen {autoListen ? 'on' : 'off'}</Text></MotionPressable>{!recording && !['thinking', 'speaking', 'transcribing', 'comparing'].includes(phase) && !session.pendingReply && !temporaryReply.current && <View style={styles.inputRow}><TextInput accessibilityLabel="Type model reply in selected speaking language" placeholder="Or type the model’s reply" placeholderTextColor="#C9A997" value={draft} onChangeText={setDraft} multiline style={styles.input}/><GlassButton label="Submit typed model reply" onPress={() => { if (!draft.trim()) return; const text = draft.trim(); void operate(async () => { const english = await translateToEnglish(apiKey(), text, state.current.scenario.language); await acceptReply(text, english, id(state.current, 'model')); }); }} style={styles.smallButton}><Text style={styles.buttonText}>Send</Text></GlassButton></View>}</>}
    </View>}
  </KeyboardAvoidingView></DesignFrame>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, gap: 8 }, headerText: { color: '#FFD7BD', fontFamily: DESIGN.medium, fontSize: 13 },
  content: { padding: 20, gap: 16, paddingBottom: 24 }, title: { color: '#FFF', fontFamily: DESIGN.semibold, fontSize: 24, lineHeight: 30 }, body: { color: '#F2DBCD', fontFamily: DESIGN.font, fontSize: 15, lineHeight: 23 }, meta: { color: '#C7A994', fontFamily: DESIGN.font, fontSize: 12, lineHeight: 18 },
  bubble: { borderRadius: 22, padding: 16, borderWidth: 1, borderColor: 'rgba(255,164,102,.2)', backgroundColor: 'rgba(45,21,12,.7)', gap: 10, marginRight: 14 }, modelBubble: { marginRight: 0, marginLeft: 14, backgroundColor: 'rgba(125,49,17,.55)' },
  card: { backgroundColor: 'rgba(30,15,10,.78)', borderWidth: 1, borderColor: 'rgba(255,164,102,.2)', padding: 16, borderRadius: 22, gap: 12 }, cardTitle: { color: '#FFE5D2', fontFamily: DESIGN.semibold, fontSize: 15, lineHeight: 21 }, choice: { padding: 12, borderRadius: 18, minHeight: 44 }, selected: { borderColor: '#FF9B58', backgroundColor: 'rgba(255,113,42,.18)' },
  buttonText: { color: '#FFF', fontFamily: DESIGN.medium, fontSize: 13 }, smallButton: { minHeight: 44, paddingHorizontal: 12, borderRadius: 22 }, audioRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, play: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,137,63,.2)' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 10 }, line: { height: 1, flex: 1, backgroundColor: 'rgba(255,184,120,.3)' }, finding: { gap: 6, paddingTop: 10 }, voteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, vote: { minHeight: 44, paddingHorizontal: 12, borderRadius: 20 },
  footer: { padding: 16, paddingTop: 10, backgroundColor: 'rgba(20,10,6,.9)', gap: 10 }, statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, micWrap: { minWidth: 110, alignItems: 'center', justifyContent: 'center' }, mic: { minHeight: 48, paddingHorizontal: 12, borderRadius: 26, backgroundColor: '#A44317' }, switch: { alignSelf: 'center', minHeight: 32, justifyContent: 'center' }, inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, input: { flex: 1, maxHeight: 90, color: '#FFF', fontFamily: DESIGN.font, borderColor: 'rgba(255,190,150,.25)', borderWidth: 1, padding: 12, borderRadius: 18 }, error: { color: '#FFD0A7', fontFamily: DESIGN.font, fontSize: 13, lineHeight: 20 },
});
