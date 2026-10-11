import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList, InterviewRound, InterviewPhase, AppSettings, SavedConversation } from '../types';
import { loadSettings, updateSettings } from '../store/settingsStore';
import { createConversationId, saveConversation } from '../store/conversationStore';
import { FadeIn, LiveDots, MotionPressable, Reveal, useMotion } from '../components/Motion';
import { generateInterviewText, generateGeminiTTS, transcribeAudio, GeminiMessage } from '../services/geminiService';
import { generateElevenLabsTTS } from '../services/elevenLabsService';
import { createRecordingSession } from '../services/recordingSession';
import {
  playBase64Audio,
  startRecording,
  stopRecording,
  pauseRecording,
  resumeRecording,
  stopPlayback,
  setPlaybackMuted,
  readAudioAsBase64,
  requestMicrophonePermission,
  subscribeAudioLevel,
  setPlaybackMode,
} from '../services/audioService';
import {
  DESIGN,
  DesignFrame,
  DesignIcon,
  GlowButton,
  GlassButton,
  Orb,
  HeroOrb,
  ProgressiveSpokenText,
  TranscriptionIcon,
  VoiceSettingsIcon,
} from '../components/CoachieDesign';

import { conversationStyles as styles } from '../components/conversationStyles';
import { AudioWaveform } from '../components/AudioWaveform';

type Props = StackScreenProps<RootStackParamList, 'Interview'>;
type Voice = { base64: string; extension: 'wav' | 'mp3' };
const TOTAL_ROUNDS = 5;

const phaseLabels: Record<InterviewPhase, string> = {
  idle: 'Aira is listening...',
  generating_question: 'Aira is drafting the question...',
  speaking: 'Aira is speaking...',
  recording: 'Aira is listening...',
  transcribing: 'Transcribing your answer...',
  closing: 'Preparing your feedback...',
  done: 'Interview complete',
};

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

function renderFormattedMessage(text: string) {
  const parts = text.split(/(`[^`]+`|\[[^\]]+\]|\b[\w-]+\.(?:sh|ts|js|cpp|py|json|jsx|tsx)\b)/g);
  return (
    <Text style={styles.messageText}>
      {parts.map((part, i) => {
        const isCode =
          (part.startsWith('`') && part.endsWith('`')) ||
          (part.startsWith('[') && part.endsWith(']')) ||
          /\b[\w-]+\.(?:sh|ts|js|cpp|py|json|jsx|tsx)\b/.test(part);
        if (isCode) {
          const clean = part.replace(/^[`\[]|[`\]]$/g, '');
          return (
            <View key={i} style={styles.codeBadge}>
              <Text style={styles.codeBadgeText}>{clean}</Text>
            </View>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

export default function InterviewScreen({ navigation, route }: Props) {
  const { topic } = route.params;
  const [phase, setPhaseState] = useState<InterviewPhase>('generating_question');
  const phaseRef = useRef<InterviewPhase>('generating_question');
  const setPhase = (next: InterviewPhase) => { phaseRef.current = next; setPhaseState(next); };
  const [rounds, setRounds] = useState<InterviewRound[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [historyWarning, setHistoryWarning] = useState('');
  const [viewMode, setViewMode] = useState<'chat' | 'voice'>('chat');
  const { reduced } = useMotion();

  const conversation = useRef<SavedConversation>({
    id: createConversationId(),
    topic,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rounds: [],
    currentQuestion: '',
    closingMessage: '',
    status: 'in_progress',
    language: 'English',
    voice: 'Kore',
  });

  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);
  const setPaused = (next: boolean) => { pausedRef.current = next; setPausedState(next); };
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState('English');
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [playProgress, setPlayProgress] = useState(0);
  const [micLevel, setMicLevel] = useState(0);

  useEffect(() => {
    const unsub = subscribeAudioLevel((lvl) => {
      if (alive.current) setMicLevel(lvl);
    });
    return unsub;
  }, []);

  const durations = useRef<Record<number, number>>({});
  const alive = useRef(true);
  const exiting = useRef(false);
  const locked = useRef(false);
  const history = useRef<GeminiMessage[]>([]);
  const completed = useRef<InterviewRound[]>([]);
  const settings = useRef<AppSettings>({ geminiApiKey: '', elevenLabsApiKey: '', ttsProvider: 'gemini' });
  const voices = useRef<Record<number, Voice>>({});
  const voiceKeys = useRef<Record<number, string>>({});
  const recordings = useRef<Record<number, { uri: string; seconds: number }>>({});
  const candidateSound = useRef<Audio.Sound | null>(null);
  const candidatePlaybackGeneration = useRef(0);
  const recordingSession = useRef<ReturnType<typeof createRecordingSession> | null>(null);
  const resumeSpeech = useRef<(() => void) | null>(null);
  const pauseBusy = useRef(false);
  const secondsRef = useRef(0);

  const questionRef = useRef('');
  const pendingUri = useRef<string | null>(null);
  const retry = useRef<(() => Promise<void>) | null>(null);
  const log = useRef<ScrollView>(null);

  const stopCandidate = async () => {
    candidatePlaybackGeneration.current++;
    const sound = candidateSound.current;
    candidateSound.current = null;
    if (sound) {
      sound.setOnPlaybackStatusUpdate(null);
      await sound.unloadAsync();
    }
    if (alive.current) {
      setPlayingKey((key) => (key?.startsWith('a-') ? null : key));
      setPlayProgress(0);
    }
  };

  const persist = async (patch: Partial<SavedConversation> = {}) => {
    conversation.current = {
      ...conversation.current,
      rounds: completed.current.map((r) => ({ ...r })),
      language: settings.current.language || 'English',
      voice: settings.current.ttsProvider === 'gemini' ? settings.current.geminiVoice || 'Kore' : 'ElevenLabs',
      updatedAt: new Date().toISOString(),
      ...patch,
    };
    try {
      await saveConversation(conversation.current);
      if (alive.current) setHistoryWarning('');
      return '';
    } catch {
      const warning = 'This conversation could not be saved locally.';
      if (alive.current) setHistoryWarning(warning);
      return warning;
    }
  };

  const ensureActive = () => {
    if (!alive.current || exiting.current) throw new Error('Session closed');
  };

  const perform = async (action: () => Promise<void>) => {
    if (locked.current || !alive.current) return;
    locked.current = true;
    setError('');
    try {
      await action();
    } catch (err) {
      if (alive.current) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        setPhase('idle');
      }
    } finally {
      locked.current = false;
    }
  };

  const speak = async (text: string, index: number, respectSessionPause = true) => {
    ensureActive();
    setPhase('speaking');
    const voiceKey = (s: AppSettings) => JSON.stringify([text, s.language || 'English', s.ttsProvider, s.geminiVoice || 'Kore', s.elevenLabsVoiceId || '']);
    const key = voiceKey(settings.current);
    let voice = voiceKeys.current[index] === key ? voices.current[index] : undefined;
    if (!voice) {
      const s = settings.current;
      voice =
        s.ttsProvider === 'elevenlabs' && s.elevenLabsApiKey
          ? { base64: await generateElevenLabsTTS(s.elevenLabsApiKey, text, s.elevenLabsVoiceId), extension: 'mp3' }
          : { base64: await generateGeminiTTS(s.geminiApiKey, text, s.geminiVoice), extension: 'wav' };
      ensureActive();
      if (voiceKey(settings.current) === key) { voices.current[index] = voice; voiceKeys.current[index] = key; }
    }
    try {
      let repeat = false;
      do {
      if (respectSessionPause && pausedRef.current) await new Promise<void>(resolve => { resumeSpeech.current = resolve; });
      ensureActive();
      setPhase('speaking');
      setPlayingKey(`q-${index}`);
      setPlayProgress(0);
      await playBase64Audio(voice.base64, voice.extension, (position, duration) => {
        if (alive.current && duration) {
          durations.current[index] = Math.ceil(duration / 1000);
          setPlayProgress(Math.min(1, position / duration));
        }
      });
      ensureActive();
      // Pausing stops the device sound. Resume replays this cached complete clip.
      repeat = respectSessionPause && pausedRef.current;
      } while (repeat);
    } finally {
      if (alive.current) {
        setPlayingKey(null);
        setPlayProgress(0);
      }
    }
  };

  const runRound = async () => {
    retry.current = runRound;
    setPhase('generating_question');
    setQuestion('');
    questionRef.current = '';
    const q = await generateInterviewText(
      settings.current.geminiApiKey,
      topic,
      history.current,
      completed.current.length === 0
        ? 'Start the interview immediately with your first technical or situational question. Do NOT include any greetings, pleasantries, or introductions.'
        : "Continue the interview. Ask the next question based on the candidate's previous answer.",
      settings.current.language
    );
    ensureActive();
    questionRef.current = q;
    setQuestion(q);
    history.current.push({ role: 'model', parts: [{ text: q }] });
    await persist({ currentQuestion: q });
    const play = async () => {
      await speak(q, completed.current.length);
      ensureActive();
      setPhase('idle');
      retry.current = null;
      if (!pausedRef.current && alive.current && !exiting.current) {
        await stopCandidate();
        await recordingSession.current?.start();
      }
    };
    retry.current = play;
    await play();
  };

  const closing = async () => {
    retry.current = closing;
    setPhase('closing');
    setQuestion('');
    const feedback = await generateInterviewText(
      settings.current.geminiApiKey,
      topic,
      history.current,
      "The interview is now complete. Provide a warm, constructive closing summary of the candidate's performance based on all their answers. Be specific and encouraging.",
      settings.current.language
    );
    ensureActive();
    setQuestion(feedback);
    const saveWarning = await persist({ currentQuestion: '', closingMessage: feedback, status: 'completed' });
    const finish = async () => {
      await speak(feedback, TOTAL_ROUNDS);
      ensureActive();
      setPhase('done');
      exiting.current = true;
      navigation.replace('Summary', {
        rounds: completed.current,
        closingMessage: feedback,
        topic,
        saveWarning,
      });
    };
    retry.current = finish;
    await finish();
  };

  const submit = async (text: string) => {
    ensureActive();
    if (!text.trim()) throw new Error('No speech detected. Record again or type your answer.');
    await stopCandidate();
    ensureActive();
    history.current.push({ role: 'user', parts: [{ text }] });
    completed.current = [
      ...completed.current,
      { roundNumber: completed.current.length + 1, question: questionRef.current, answer: text },
    ];
    setRounds(completed.current);
    setAnswer('');
    pendingUri.current = null;
    setPaused(false);
    await persist({ currentQuestion: '' });
    if (completed.current.length < TOTAL_ROUNDS) await runRound();
    else await closing();
  };

  const transcribe = async () => {
    retry.current = transcribe;
    setPhase('transcribing');
    if (!pendingUri.current) throw new Error('Recording was not saved. Please record again.');
    const audio = await readAudioAsBase64(pendingUri.current);
    ensureActive();
    const dataUri = `data:${audio.mimeType};base64,${audio.base64}`;
    recordings.current[completed.current.length] = { uri: dataUri, seconds: secondsRef.current };
    const text = await transcribeAudio(settings.current.geminiApiKey, audio.base64, audio.mimeType);
    ensureActive();
    if (!text.trim()) {
      pendingUri.current = null;
      retry.current = null;
      throw new Error('No speech detected. Record again or type your answer.');
    }
    await submit(text);
  };

  const record = () => {
    if (locked.current || !alive.current || exiting.current) return;
    void (async () => {
      await stopCandidate(); await stopPlayback();
      if (recordingSession.current?.getSnapshot().recording) await recordingSession.current.end();
      else if (phaseRef.current === 'idle') await recordingSession.current?.start();
    })().catch(err => { if (alive.current) setError(err instanceof Error ? err.message : 'Could not record audio.'); });
  };

  // Pause remains available while TTS/playback holds the main operation lock.
  const pause = async () => {
    if (pauseBusy.current || !alive.current || exiting.current) return;
    pauseBusy.current = true;
    try {
      const capture = recordingSession.current?.getSnapshot();
      if (capture?.recording) {
        if (capture.paused) {
          await stopCandidate(); await stopPlayback();
          await recordingSession.current?.resume();
        } else await recordingSession.current?.pause();
      } else if (phaseRef.current === 'speaking') {
        if (pausedRef.current) {
          setPaused(false);
          const resume = resumeSpeech.current; resumeSpeech.current = null; resume?.();
        } else { setPaused(true); await stopPlayback(); }
      }
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'Could not pause audio.'); }
    finally { pauseBusy.current = false; }
  };

  const send = () => {
    if (recordingSession.current?.getSnapshot().recording) record();
    else if (answer.trim()) void perform(() => submit(answer.trim()));
  };

  const replay = async (index: number, candidate = false) => {
    if (locked.current) return;
    const targetKey = candidate ? `a-${index}` : `q-${index}`;
    if (playingKey === targetKey) {
      if (candidate) await stopCandidate();
      else await stopPlayback();
      setPlayingKey(null);
      setPlayProgress(0);
      return;
    }
    const captureWasActive = recordingSession.current?.getSnapshot().recording;
    if (captureWasActive && !(await recordingSession.current?.prepareForReplay())) return;
    await perform(async () => {
      try {
        if (candidate) {
          await stopPlayback();
          await stopCandidate();
          const recording = recordings.current[index];
          if (!recording?.uri) return;
          const generation = candidatePlaybackGeneration.current;
          await setPlaybackMode();
          ensureActive();
          const { sound } = await Audio.Sound.createAsync(
            { uri: recording.uri },
            { shouldPlay: false, isMuted: muted, progressUpdateIntervalMillis: 100 }
          );
          if (!alive.current || exiting.current || generation !== candidatePlaybackGeneration.current) {
            await sound.unloadAsync(); return;
          }
          candidateSound.current = sound;
          setPlayingKey(`a-${index}`);
          setPlayProgress(0);
          sound.setOnPlaybackStatusUpdate((status) => {
            if (candidateSound.current !== sound) return;
            if (status.isLoaded && alive.current && status.durationMillis) {
              setPlayProgress(Math.min(1, status.positionMillis / status.durationMillis));
            }
            if (status.isLoaded && status.didJustFinish) {
              void stopCandidate().catch(err => { if (alive.current) setError(err instanceof Error ? err.message : 'Could not release audio.'); });
            } else if (!status.isLoaded && status.error) {
              void stopCandidate().catch(() => {});
              if (alive.current) setError('Could not replay this recording.');
            }
          });
          try { await sound.playAsync(); }
          catch (err) { await stopCandidate(); throw err; }
        } else {
          await stopCandidate();
          await stopPlayback();
          const textToSpeak = index === rounds.length ? question : rounds[index]?.question;
          if (!textToSpeak) return;
          await speak(textToSpeak, index, false);
          if (!captureWasActive) setPhase('idle');
        }
      } catch (err) {
        if (alive.current) setError(err instanceof Error ? err.message : 'Could not play audio.');
      } finally {
        if (alive.current && captureWasActive) {
          const capture = recordingSession.current?.getSnapshot();
          if (capture?.recording) { setPhase('recording'); setPaused(capture.paused); }
        }
      }
    });
  };

  const toggleMute = async () => {
    try {
      await setPlaybackMuted(!muted);
      await candidateSound.current?.setIsMutedAsync(!muted);
      if (alive.current) setMuted(!muted);
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : 'Could not change audio volume.');
    }
  };

  const close = async () => {
    if (exiting.current) return;
    exiting.current = true;
    alive.current = false;
    resumeSpeech.current?.(); resumeSpeech.current = null;
    const warning = await persist();
    if (warning) {
      alive.current = true; exiting.current = false;
      setHistoryWarning(warning); setError('Could not save this chat. Please retry before closing.'); retry.current = close;
      return;
    }
    await Promise.allSettled([stopPlayback(), recordingSession.current?.dispose(), stopCandidate()]);
    navigation.popToTop();
  };

  const applyQuickSettings = async (lang: string, voiceName: string) => {
    setSelectedLang(lang);
    setSelectedVoice(voiceName);
    settings.current = {
      ...settings.current,
      language: lang,
      geminiVoice: voiceName,
      ...(lang === 'Thai' ? { ttsProvider: 'gemini' as const } : {}),
    };
    voices.current = {}; voiceKeys.current = {}; durations.current = {};
    try { await updateSettings({ language: lang, geminiVoice: voiceName, ...(lang === 'Thai' ? { ttsProvider: 'gemini' as const } : {}) }); }
    catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'Could not save voice preferences.'); }
  };

  if (!recordingSession.current) recordingSession.current = createRecordingSession({
    requestPermission: requestMicrophonePermission,
    start: startRecording, stop: stopRecording, pause: pauseRecording, resume: resumeRecording,
    canAccept: () => alive.current && !exiting.current,
    onChange: snapshot => {
      if (!alive.current) return;
      secondsRef.current = snapshot.elapsedSeconds;
      setSeconds(snapshot.elapsedSeconds);
      if (snapshot.recording) { setPhase('recording'); setPaused(snapshot.paused); }
    },
    onFinalized: async (uri, elapsedSeconds) => {
      await perform(async () => {
        ensureActive();
        setPhase('transcribing');
        pendingUri.current = uri;
        secondsRef.current = elapsedSeconds;
        recordings.current[completed.current.length] = { uri, seconds: elapsedSeconds };
        await transcribe();
      });
    },
    onError: err => {
      if (alive.current) { setError(err.message); setPhase('idle'); }
    },
  });

  useEffect(() => {
    alive.current = true;
    void perform(async () => {
      settings.current = await loadSettings();
      ensureActive();
      setSelectedLang(settings.current.language || 'English');
      setSelectedVoice(settings.current.geminiVoice || 'Kore');
      if (!settings.current.geminiApiKey)
        throw new Error('Add your Gemini API key in Settings before starting.');
      await persist();
      await runRound();
    });
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (exiting.current) return;
      e.preventDefault();
      void close();
    });
    return () => {
      alive.current = false;
      resumeSpeech.current?.(); resumeSpeech.current = null;
      unsub();
      void stopPlayback().catch(() => {});
      void recordingSession.current?.dispose();
      void stopCandidate().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (phase !== 'recording' || paused) return;
    const timer = setInterval(() => {
      recordingSession.current?.tick();
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, paused]);

  useEffect(() => {
    const timer = setTimeout(() => {
      log.current?.scrollToEnd({ animated: !reduced });
    }, 60);
    return () => clearTimeout(timer);
  }, [rounds.length, phase, question, answer, reduced]);

  const canRecord = (phase === 'idle' && !!question && !error) || phase === 'recording';

  // Renders the AI Question Bubble with attached Waveform Bar
  const renderAiBubble = (q: string, index: number, isCurrent = false) => {
    const isPlaying = playingKey === `q-${index}`;
    const durationSec = durations.current[index];
    const isDrafting = isCurrent && phase === 'generating_question';

    return (
      <FadeIn key={`ai-${index}`} style={styles.aiMessageGroup}>
        {/* Persistent Aira pill header on every message */}
        <View style={styles.draftingRow}>
          <Orb size={28} />
          <View style={styles.draftingPill}>
            <Text style={styles.draftingText}>
              {isDrafting ? 'Aira is drafting the question...' : 'Aira · Synthetic Voice'}
            </Text>
            {isDrafting && <LiveDots active />}
          </View>
        </View>

        {!!q && (
          <View style={styles.aiBubbleWrapper}>
            <View style={styles.aiBubbleContainer}>
              {/* Glass Card content */}
              <View style={styles.aiQuestionContent}>
                {renderFormattedMessage(q)}
              </View>

              {/* Attached Audio Player Bar */}
              <View style={styles.attachedAudioBar}>
                <MotionPressable
                  accessibilityRole="button"
                  accessibilityLabel={isPlaying ? 'Pause audio' : 'Play interview question audio'}
                  onPress={() => {
                    if (isPlaying) void stopPlayback();
                    else void replay(index, false);
                  }}
                  style={styles.aiPlayButton}
                >
                  <LinearGradient
                    colors={['#D97706', '#FB923C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  {isPlaying ? (
                    <View style={styles.miniPauseBars}>
                      <View style={styles.miniPauseBar} />
                      <View style={styles.miniPauseBar} />
                    </View>
                  ) : (
                    <DesignIcon name="play" />
                  )}
                </MotionPressable>

                <View style={styles.aiWaveformArea}>
                  <AudioWaveform base64={voices.current[index]?.base64} active={isPlaying || (isCurrent && phase === 'speaking')} progress={isPlaying || (isCurrent && phase === 'speaking') ? playProgress : 0} />
                </View>

                {durationSec ? (
                  <Text style={styles.aiDurationText}>{formatTime(durationSec)}</Text>
                ) : (
                  <View style={{ width: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="small" color="#FF8C38" />
                  </View>
                )}
              </View>
            </View>

            {/* Subtitle meta */}
            <Text style={styles.aiMetaCaption}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Synthetic Voice (Aira)
            </Text>
          </View>
        )}
      </FadeIn>
    );
  };

  // Renders Candidate Response Card
  const renderCandidateCard = (answerText: string, index: number, isPending = false) => {
    const isPlaying = playingKey === `a-${index}`;
    const isCollapsed = collapsed[index];
    const recSeconds = recordings.current[index]?.seconds;
    const estKb = recSeconds ? Math.max(24, Math.round(recSeconds * 3.6)) : 0;

    return (
      <FadeIn key={`cand-${index}`} style={styles.candidateCardWrapper}>
        <View style={styles.candidateCard}>
          {/* Top Audio Player Row */}
          <View style={styles.candidateAudioRow}>
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Stop playback' : 'Play recorded answer'}
              disabled={isPending}
              onPress={() => {
                if (isPlaying) void stopCandidate();
                else void replay(index, true);
              }}
              style={styles.candidatePlayButton}
            >
              {isPlaying ? (
                <View style={styles.miniPauseBars}>
                  <View style={styles.miniPauseBar} />
                  <View style={styles.miniPauseBar} />
                </View>
              ) : (
                <DesignIcon name="play" />
              )}
            </MotionPressable>

            <View style={styles.candidateWaveArea}>
              <AudioWaveform uri={recordings.current[index]?.uri} candidate active={isPlaying || isPending} progress={isPlaying ? playProgress : 0} />
              <Text style={styles.candidateSizeCaption}>
                {isPending ? 'Transcribing...' : recSeconds ? `${formatTime(recSeconds)}, ${estKb} KB` : 'Processing...'}
              </Text>
            </View>

            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel={isCollapsed ? 'Expand transcript' : 'Collapse transcript'}
              onPress={() => setCollapsed((c) => ({ ...c, [index]: !c[index] }))}
              style={styles.collapseButton}
            >
              <TranscriptionIcon open={!isCollapsed} />
            </MotionPressable>
          </View>

          {/* Expandable Transcript Body */}
          <Reveal open={!isCollapsed}>
            <View style={styles.candidateTranscript}>
              <Text style={styles.candidateText}>{answerText}</Text>
              <View style={styles.candidateMetaRow}>
                <Text style={styles.candidateTimestamp}>
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <DesignIcon name="check" />
              </View>
            </View>
          </Reveal>
        </View>
      </FadeIn>
    );
  };

  return (
    <DesignFrame chat>
      {/* Top Header Navigation */}
      <View style={styles.topHeader}>
        <GlassButton label="Close chat" onPress={() => void close()} style={styles.closePill}>
          <DesignIcon name="close" />
          <Text style={styles.closeLabel}>Close chat</Text>
        </GlassButton>

        <View style={styles.headerRightControls}>
          {/* View Mode Toggle Pill (Voice Screen vs Chat View) */}
          <GlassButton
            label={viewMode === 'voice' ? 'Switch to chat view' : 'Switch to voice screen'}
            onPress={() => setViewMode(viewMode === 'voice' ? 'chat' : 'voice')}
            style={styles.modeTogglePill}
          >
            <Text style={styles.modeToggleText}>{viewMode === 'voice' ? 'Chat View' : 'Voice Mode'}</Text>
          </GlassButton>

          {/* Round Indicator Tracker */}
          <View style={styles.roundTrackerPill}>
            <View style={styles.roundDot} />
            <Text style={styles.roundLabel}>Round {Math.min(rounds.length + 1, TOTAL_ROUNDS)} of 5</Text>
          </View>

          {/* Speaker Switch Button */}
          <GlassButton
            label={muted ? 'Unmute voice' : 'Mute voice'}
            onPress={toggleMute}
            style={[styles.speakerButton, muted && { opacity: 0.45 }]}
          >
            <DesignIcon name="speaker" />
          </GlassButton>
        </View>
      </View>

      {/* Main Content Area */}
      {viewMode === 'voice' ? (
        /* Fullscreen Voice Listening Screen (Figma Frame 8:270) */
        <View style={styles.voiceScreenContainer}>
          <View style={styles.voiceCenterHero}>
            <HeroOrb size={180} />
            <Text style={styles.voiceListeningStatus}>
              {error ? 'Something went wrong' : paused ? 'Paused' : phaseLabels[phase]}
            </Text>
            <ProgressiveSpokenText
              text={question || topic}
              progress={playProgress}
              active={phase === 'speaking'}
              style={styles.voiceSpokenHeading}
            />
          </View>

          {/* Bottom Voice Controls */}
          <View style={styles.voiceFooterControls}>
            <View style={styles.actionControlsRow}>
              <GlassButton
                label={paused ? 'Resume recording' : 'Pause recording'}
                onPress={pause}
                disabled={phase !== 'recording' && phase !== 'speaking'}
                style={styles.sideCircleButton}
              >
                {paused ? (
                  <DesignIcon name="play" />
                ) : (
                  <View style={styles.pauseBars}>
                    <View style={styles.pauseBar} />
                    <View style={styles.pauseBar} />
                  </View>
                )}
              </GlassButton>

              <GlowButton onPress={record} disabled={!canRecord} recording={phase === 'recording'} paused={paused} level={phase === 'recording' && !paused ? micLevel : 0} />

              <GlassButton
                label="Voice & language settings"
                onPress={() => setQuickSettingsOpen(true)}
                style={styles.sideCircleButton}
              >
                <VoiceSettingsIcon size={18} color="#FFF" />
              </GlassButton>
            </View>
            <View style={styles.homeIndicatorBar} />
          </View>
        </View>
      ) : (
        /* Fullscreen Chat View (Figma Frame 8:108) */
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.chatContainer}>
            <ScrollView
              ref={log}
              style={styles.chatScrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.chatScrollContent}
              onContentSizeChange={() => log.current?.scrollToEnd({ animated: !reduced })}
            >
              {/* Candidate Initial Topic Prompt (Right Aligned Sunset Orange Bubble) */}
              <View style={styles.topicRow}>
                <LinearGradient colors={['#FF6F26', '#FF500B', '#DE3400']} style={styles.topicBubble}>
                  <Text style={styles.topicText}>{topic}</Text>
                </LinearGradient>
                <Text style={styles.topicTimestamp}>
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              {/* Completed Interview Rounds */}
              {rounds.map((round, idx) => (
                <React.Fragment key={idx}>
                  {renderAiBubble(round.question, idx)}
                  {renderCandidateCard(round.answer, idx)}
                </React.Fragment>
              ))}

              {/* Current Active Round */}
              {phase === 'generating_question' && renderAiBubble('', rounds.length, true)}
              {!!question && renderAiBubble(question, rounds.length, true)}

              {/* Transcribing live candidate recording */}
              {phase === 'transcribing' && renderCandidateCard('Turning your words into text...', rounds.length, true)}
            </ScrollView>

            {/* Anchored Atmospheric Speaker Panel with soft feathered fade */}
            <View style={styles.anchoredSpeakerFooter}>
              <LinearGradient
                pointerEvents="none"
                colors={['transparent', 'rgba(13, 4, 2, 0.45)', 'rgba(13, 4, 2, 0.85)', '#0D0402']}
                locations={[0, 0.25, 0.65, 1]}
                style={[StyleSheet.absoluteFill, { top: -36 }]}
              />
              <BlurView intensity={Platform.OS === 'web' ? 15 : 25} tint="dark" style={StyleSheet.absoluteFill} />

              <View style={styles.footerInner}>
                {/* Status Subheader */}
                <View style={styles.statusSubheaderRow}>
                  <Text accessibilityLiveRegion="polite" style={styles.statusSubheaderText}>
                    {error ? 'Something went wrong' : paused ? 'Paused' : phaseLabels[phase]}
                    {phase === 'recording' ? ` · ${formatTime(seconds)}` : ''}
                  </Text>
                  {!error && !paused && phase !== 'idle' && phase !== 'done' && <LiveDots active />}
                </View>

                {/* Subtitle / Capped Input area */}
                {error ? (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                    <MotionPressable
                      accessibilityRole="button"
                      onPress={() => {
                        if (retry.current) void perform(retry.current);
                        else setError('');
                      }}
                    >
                      <Text style={styles.retryText}>{retry.current ? 'Try again' : 'Dismiss'}</Text>
                    </MotionPressable>
                  </View>
                ) : phase === 'idle' ? (
                  <View style={styles.spokenInputRow}>
                    <TextInput
                      accessibilityLabel="Type your answer"
                      value={answer}
                      onChangeText={setAnswer}
                      onSubmitEditing={send}
                      returnKeyType="send"
                      placeholder="Type an answer or tap mic to speak."
                      placeholderTextColor="#A1A1AA"
                      style={styles.spokenQueryInput}
                    />
                    {!!answer.trim() && (
                      <MotionPressable
                        accessibilityRole="button"
                        accessibilityLabel="Send answer"
                        onPress={send}
                        style={styles.inlineSendAction}
                      >
                        <DesignIcon name="send" />
                      </MotionPressable>
                    )}
                  </View>
                ) : (
                  <Text numberOfLines={2} style={styles.spokenFooterCaption}>
                    {phase === 'recording'
                      ? paused
                        ? 'Tap resume to continue speaking.'
                        : 'Aira is listening to your answer…'
                      : phase === 'speaking'
                      ? 'Listen to the interview question above.'
                      : 'Preparing next response…'}
                  </Text>
                )}

                {/* Action Controls Row */}
                <View style={styles.actionControlsRow}>
                  <GlassButton
                    label={paused ? 'Resume recording' : 'Pause recording'}
                    onPress={pause}
                    disabled={phase !== 'recording' && phase !== 'speaking'}
                    style={styles.sideCircleButton}
                  >
                    {paused ? (
                      <DesignIcon name="play" />
                    ) : (
                      <View style={styles.pauseBars}>
                        <View style={styles.pauseBar} />
                        <View style={styles.pauseBar} />
                      </View>
                    )}
                  </GlassButton>

                  <GlowButton onPress={record} disabled={!canRecord} recording={phase === 'recording'} paused={paused} level={phase === 'recording' && !paused ? micLevel : 0} />

                  <GlassButton
                    label="Voice & language settings"
                    onPress={() => setQuickSettingsOpen(true)}
                    style={styles.sideCircleButton}
                  >
                    <VoiceSettingsIcon size={18} color="#FFF" />
                  </GlassButton>
                </View>

                {/* iOS Home Indicator */}
                <View style={styles.homeIndicatorBar} />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Voice & Language Quick Setting Modal */}
      <Modal visible={quickSettingsOpen} transparent animationType="fade" onRequestClose={() => setQuickSettingsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.quickSettingsCard}>
            <View style={styles.quickSettingsHeader}>
              <View>
                <Text style={styles.modalTitle}>Voice & Language</Text>
                <Text style={styles.quickSettingsSubtitle}>Customize Aira for this session</Text>
              </View>
              <GlassButton label="Close settings" onPress={() => setQuickSettingsOpen(false)} style={styles.quickCloseButton}>
                <DesignIcon name="close" />
              </GlassButton>
            </View>

            {/* Language Selector */}
            <Text style={styles.quickSectionLabel}>INTERVIEW LANGUAGE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {['English', 'Spanish', 'French', 'German', 'Thai', 'Japanese', 'Hindi', 'Arabic'].map((lang) => {
                const isSelected = selectedLang === lang;
                return (
                  <MotionPressable
                    key={lang}
                    accessibilityRole="button"
                    accessibilityLabel={`Select language ${lang}`}
                    onPress={() => void applyQuickSettings(lang, selectedVoice)}
                    style={[styles.chip, isSelected && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{lang}</Text>
                  </MotionPressable>
                );
              })}
            </ScrollView>

            {/* Gemini Studio Voice Selector */}
            <Text style={styles.quickSectionLabel}>AI VOICE (GEMINI 3.8 FLASH)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {[
                ['Kore', 'Firm'],
                ['Puck', 'Upbeat'],
                ['Charon', 'Informative'],
                ['Aoede', 'Breezy'],
                ['Zephyr', 'Bright'],
                ['Fenrir', 'Excitable'],
                ['Leda', 'Youthful'],
              ].map(([vName, tone]) => {
                const isSelected = selectedVoice === vName;
                return (
                  <MotionPressable
                    key={vName}
                    accessibilityRole="button"
                    accessibilityLabel={`Select voice ${vName}`}
                    onPress={() => void applyQuickSettings(selectedLang, vName)}
                    style={[styles.chip, isSelected && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{vName}</Text>
                    <Text style={[styles.chipSubText, isSelected && styles.chipSubTextActive]}>{tone}</Text>
                  </MotionPressable>
                );
              })}
            </ScrollView>

            <View style={styles.quickFooterActions}>
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel="Open all preferences"
                onPress={() => {
                  setQuickSettingsOpen(false);
                  navigation.navigate('Preferences', { page: 'voice' });
                }}
                style={styles.morePreferencesButton}
              >
                <Text style={styles.morePreferencesText}>All settings & API keys →</Text>
              </MotionPressable>

              <GlassButton
                label="Done"
                onPress={() => setQuickSettingsOpen(false)}
                style={styles.quickDoneButton}
              >
                <Text style={styles.quickDoneText}>Done</Text>
              </GlassButton>
            </View>
          </View>
        </View>
      </Modal>
    </DesignFrame>
  );
}
