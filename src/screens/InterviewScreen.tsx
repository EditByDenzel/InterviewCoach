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
} from '../services/audioService';
import {
  DESIGN,
  DesignFrame,
  DesignIcon,
  GlowButton,
  GlassButton,
  Orb,
  HeroOrb,
  Waveform,
  ProgressiveSpokenText,
  TranscriptionIcon,
  VoiceSettingsIcon,
} from '../components/CoachieDesign';

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
  const [phase, setPhase] = useState<InterviewPhase>('generating_question');
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

  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState('English');
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [playProgress, setPlayProgress] = useState(0);

  const durations = useRef<Record<number, number>>({});
  const alive = useRef(true);
  const exiting = useRef(false);
  const locked = useRef(false);
  const history = useRef<GeminiMessage[]>([]);
  const completed = useRef<InterviewRound[]>([]);
  const settings = useRef<AppSettings>({ geminiApiKey: '', elevenLabsApiKey: '', ttsProvider: 'gemini' });
  const voices = useRef<Record<number, Voice>>({});
  const recordings = useRef<Record<number, { uri: string; seconds: number }>>({});
  const candidateSound = useRef<Audio.Sound | null>(null);

  const questionRef = useRef('');
  const pendingUri = useRef<string | null>(null);
  const retry = useRef<(() => Promise<void>) | null>(null);
  const log = useRef<ScrollView>(null);

  const stopCandidate = async () => {
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
    if (!alive.current) throw new Error('Session closed');
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

  const speak = async (text: string, index: number) => {
    ensureActive();
    setPhase('speaking');
    let voice = voices.current[index];
    if (!voice) {
      const s = settings.current;
      voice =
        s.ttsProvider === 'elevenlabs' && s.elevenLabsApiKey
          ? { base64: await generateElevenLabsTTS(s.elevenLabsApiKey, text, s.elevenLabsVoiceId), extension: 'mp3' }
          : { base64: await generateGeminiTTS(s.geminiApiKey, text, s.geminiVoice), extension: 'wav' };
      ensureActive();
      voices.current[index] = voice;
    }
    setPlayingKey(`q-${index}`);
    setPlayProgress(0);
    try {
      await playBase64Audio(voice.base64, voice.extension, (position, duration) => {
        if (alive.current && duration) {
          durations.current[index] = Math.ceil(duration / 1000);
          setPlayProgress(Math.min(1, position / duration));
        }
      });
      ensureActive();
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
        ? 'Start the interview. Ask your first question.'
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
      if (!paused && alive.current && !exiting.current) {
        try {
          if (await requestMicrophonePermission()) {
            await stopCandidate();
            await startRecording(
              () => {
                if (alive.current && !paused && !locked.current) {
                  record();
                }
              },
              () => {
                if (alive.current && !paused && !locked.current) {
                  void pause();
                }
              }
            );
            if (alive.current) {
              setSeconds(0);
              setPhase('recording');
            }
          }
        } catch (err) {
          console.warn('[auto-listen] Could not auto-start recording:', err);
        }
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
    recordings.current[completed.current.length] = { uri: dataUri, seconds };
    const text = await transcribeAudio(settings.current.geminiApiKey, audio.base64, audio.mimeType);
    ensureActive();
    if (!text.trim()) {
      pendingUri.current = null;
      retry.current = null;
      throw new Error('No speech detected. Record again or type your answer.');
    }
    await submit(text);
  };

  const record = () =>
    void perform(async () => {
      if (phase === 'recording') {
        setPhase('transcribing');
        const uri = await stopRecording();
        ensureActive();
        if (!uri) {
          retry.current = null;
          throw new Error('Recording failed. Please record again.');
        }
        pendingUri.current = uri;
        recordings.current[completed.current.length] = { uri, seconds };
        await transcribe();
      } else {
        if (!(await requestMicrophonePermission()))
          throw new Error('Microphone access is required. Allow it in your device settings or type an answer.');
        ensureActive();
        await startRecording(
          () => {
            if (alive.current && !paused && !locked.current) {
              record();
            }
          },
          () => {
            if (alive.current && !paused && !locked.current) {
              void pause();
            }
          }
        );
        if (!alive.current) {
          await stopRecording();
          return;
        }
        setSeconds(0);
        setPaused(false);
        setPhase('recording');
      }
    });

  const pause = () =>
    void perform(async () => {
      if (paused) {
        if (phase === 'recording') await resumeRecording();
        setPaused(false);
      } else {
        if (phase === 'recording') {
          await pauseRecording();
        } else if (phase === 'speaking') {
          await stopPlayback();
          setPhase('idle');
        }
        setPaused(true);
      }
      ensureActive();
    });

  const send = () => {
    if (phase === 'recording') record();
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
    if (phase === 'recording') {
      try {
        await pauseRecording();
        setPaused(true);
      } catch (_) {}
    }
    await perform(async () => {
      try {
        if (candidate) {
          await stopPlayback();
          await stopCandidate();
          const recording = recordings.current[index];
          if (!recording?.uri) return;
          const { sound } = await Audio.Sound.createAsync(
            { uri: recording.uri },
            { shouldPlay: true, isMuted: muted, progressUpdateIntervalMillis: 100 }
          );
          candidateSound.current = sound;
          setPlayingKey(`a-${index}`);
          setPlayProgress(0);
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && alive.current && status.durationMillis) {
              setPlayProgress(Math.min(1, status.positionMillis / status.durationMillis));
            }
            if (status.isLoaded && status.didJustFinish) {
              sound.setOnPlaybackStatusUpdate(null);
              void sound.unloadAsync();
              if (candidateSound.current === sound) {
                candidateSound.current = null;
                if (alive.current) {
                  setPlayingKey(null);
                  setPlayProgress(0);
                }
              }
            } else if (!status.isLoaded && status.error) {
              if (candidateSound.current === sound) {
                candidateSound.current = null;
                if (alive.current) {
                  setPlayingKey(null);
                  setError('Could not replay this recording.');
                }
              }
            }
          });
        } else {
          await stopCandidate();
          await stopPlayback();
          const textToSpeak = index === rounds.length ? question : rounds[index]?.question;
          if (!textToSpeak) return;
          await speak(textToSpeak, index);
          setPhase('idle');
        }
      } catch (err) {
        if (alive.current) setError(err instanceof Error ? err.message : 'Could not play audio.');
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
    exiting.current = true;
    alive.current = false;
    await persist();
    await Promise.allSettled([stopPlayback(), stopRecording(), stopCandidate()]);
    navigation.popToTop();
  };

  const applyQuickSettings = async (lang: string, voiceName: string) => {
    setSelectedLang(lang);
    setSelectedVoice(voiceName);
    settings.current = {
      ...settings.current,
      language: lang,
      geminiVoice: voiceName,
    };
    await updateSettings({ language: lang, geminiVoice: voiceName });
  };

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
      setConfirmClose(true);
    });
    return () => {
      alive.current = false;
      unsub();
      void stopPlayback();
      void stopRecording();
      void stopCandidate();
    };
  }, []);

  useEffect(() => {
    if (phase !== 'recording' || paused) return;
    const timer = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        // Idle silence protection: if no answer after 8 seconds, pause to conserve tokens
        if (next >= 8 && alive.current && !locked.current) {
          void pause();
        }
        return next;
      });
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
    const durationSec = durations.current[index] || 24;
    return (
      <FadeIn key={`ai-${index}`} style={styles.aiMessageGroup}>
        {/* Drafting pill during live generation */}
        {isCurrent && phase === 'generating_question' && (
          <View style={styles.draftingRow}>
            <Orb size={28} />
            <View style={styles.draftingPill}>
              <Text style={styles.draftingText}>Aira is drafting the question...</Text>
              <LiveDots active />
            </View>
          </View>
        )}

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
                  <Waveform active={isPlaying || (isCurrent && phase === 'speaking')} progress={isPlaying || (isCurrent && phase === 'speaking') ? playProgress : 0} />
                </View>

                <Text style={styles.aiDurationText}>{formatTime(durationSec)}</Text>
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
    const recSeconds = recordings.current[index]?.seconds || 18;
    const estKb = Math.max(24, Math.round(recSeconds * 3.6));

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
              <Waveform candidate active={isPlaying || isPending} progress={isPlaying ? playProgress : 0} />
              <Text style={styles.candidateSizeCaption}>
                {isPending ? 'Transcribing...' : `${formatTime(recSeconds)}, ${estKb} KB`}
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
        <GlassButton label="Close chat" onPress={() => setConfirmClose(true)} style={styles.closePill}>
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
              {error ? 'Something went wrong' : paused ? 'Recording paused' : phaseLabels[phase]}
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

              <GlowButton onPress={record} disabled={!canRecord} recording={phase === 'recording'} paused={paused} />

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

            {/* Anchored Atmospheric Speaker Panel (Backdrop blur - NO solid bg or stroke) */}
            <View style={styles.anchoredSpeakerFooter}>
              <BlurView intensity={Platform.OS === 'web' ? 25 : 35} tint="dark" style={StyleSheet.absoluteFill} />
              <LinearGradient
                pointerEvents="none"
                colors={['transparent', 'rgba(12, 5, 3, 0.72)', 'rgba(10, 4, 2, 0.95)']}
                style={StyleSheet.absoluteFill}
              />

              <View style={styles.footerInner}>
                {/* Status Subheader */}
                <View style={styles.statusSubheaderRow}>
                  <Text accessibilityLiveRegion="polite" style={styles.statusSubheaderText}>
                    {error ? 'Something went wrong' : paused ? 'Recording paused' : phaseLabels[phase]}
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
                        ? 'Recording paused. Tap resume to speak.'
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

                  <GlowButton onPress={record} disabled={!canRecord} recording={phase === 'recording'} paused={paused} />

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

      {/* Confirmation Modal to Exit Chat */}
      <Modal visible={confirmClose} transparent animationType="fade" onRequestClose={() => setConfirmClose(false)}>
        <View style={styles.modalBackdrop}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>End this interview?</Text>
            <Text style={styles.modalSubtitle}>
              {historyWarning ? 'Local saving is unavailable.' : 'Your session will be saved in Recent conversations.'}
            </Text>
            <View style={styles.modalButtonsRow}>
              <GlassButton label="Continue interview" onPress={() => setConfirmClose(false)} style={styles.modalButton}>
                <Text style={styles.modalButtonText}>Keep practicing</Text>
              </GlassButton>
              <GlassButton label="End session" onPress={() => void close()} style={[styles.modalButton, styles.endButton]}>
                <Text style={[styles.modalButtonText, { color: '#FF7536' }]}>End session</Text>
              </GlassButton>
            </View>
          </View>
        </View>
      </Modal>

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

const styles = StyleSheet.create({
  fill: { flex: 1 },

  // Top Header Navigation Bar
  topHeader: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  closePill: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 6,
  },
  closeLabel: {
    fontFamily: DESIGN.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeTogglePill: {
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modeToggleText: {
    fontFamily: DESIGN.medium,
    fontSize: 11,
    color: '#FFB083',
  },
  roundTrackerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 9999,
    paddingHorizontal: 10,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  roundDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F97316',
  },
  roundLabel: {
    fontFamily: DESIGN.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  speakerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.1)',
  },

  chatContainer: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
  },
  chatScrollView: {
    flex: 1,
    width: '100%',
  },
  chatScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 16,
  },

  // Right Aligned Sunset Orange Topic Prompt
  topicRow: {
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  topicBubble: {
    maxWidth: '85%',
    padding: 18,
    borderRadius: 24,
    borderTopRightRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#FF500B',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 6,
  },
  topicText: {
    fontFamily: DESIGN.medium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.35,
    color: '#FFF',
  },
  topicTimestamp: {
    fontFamily: DESIGN.font,
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    paddingTop: 4,
    paddingRight: 8,
  },

  // AI Message Group (Item 2)
  aiMessageGroup: {
    gap: 10,
    maxWidth: '92%',
  },
  draftingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  draftingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  draftingText: {
    fontFamily: DESIGN.medium,
    fontSize: 11,
    color: '#A1A1AA',
  },
  aiBubbleWrapper: {
    gap: 6,
  },
  aiBubbleContainer: {
    borderRadius: 24,
    borderTopLeftRadius: 6,
    backgroundColor: 'rgba(24,16,12,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,120,60,0.16)',
    padding: 16,
    gap: 12,
  },
  aiQuestionContent: {
    gap: 8,
  },
  messageText: {
    fontFamily: DESIGN.font,
    fontSize: 13,
    lineHeight: 21,
    color: '#E4E4E7',
  },
  codeBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'center',
    marginHorizontal: 3,
  },
  codeBadgeText: {
    fontFamily: DESIGN.font,
    fontSize: 11,
    color: '#FDBA74',
  },

  // Attached Audio Player Bar
  attachedAudioBar: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
    gap: 10,
  },
  aiPlayButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiWaveformArea: {
    flex: 1,
    justifyContent: 'center',
  },
  aiDurationText: {
    fontFamily: DESIGN.font,
    fontSize: 11,
    color: '#A1A1AA',
  },
  aiMetaCaption: {
    fontFamily: DESIGN.font,
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    paddingLeft: 4,
  },

  // Candidate Response Card (Item 3)
  candidateCardWrapper: {
    alignSelf: 'flex-end',
    width: '88%',
    marginTop: 4,
  },
  candidateCard: {
    borderRadius: 16,
    borderTopRightRadius: 6,
    backgroundColor: 'rgba(27,18,13,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
    padding: 12,
    gap: 10,
  },
  candidateAudioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  candidatePlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF5C1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateWaveArea: {
    flex: 1,
    gap: 2,
  },
  candidateSizeCaption: {
    fontFamily: DESIGN.font,
    fontSize: 10,
    color: 'rgba(254,215,170,0.6)',
  },
  collapseButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.2)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateTranscript: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 8,
    gap: 6,
  },
  candidateText: {
    fontFamily: DESIGN.font,
    fontSize: 13,
    lineHeight: 21,
    color: '#E4E4E7',
  },
  candidateMetaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
  },
  candidateTimestamp: {
    fontFamily: DESIGN.font,
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },

  // Floating Atmospheric Footer Bar
  anchoredSpeakerFooter: {
    width: '100%',
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  footerInner: {
    gap: 12,
    alignItems: 'center',
    width: '100%',
    maxWidth: 580,
  },
  statusSubheaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusSubheaderText: {
    fontFamily: DESIGN.medium,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.3,
    color: '#A1A1AA',
    textAlign: 'center',
  },
  spokenFooterCaption: {
    fontFamily: DESIGN.font,
    fontSize: 13,
    lineHeight: 18,
    color: '#D8C9C1',
    textAlign: 'center',
    paddingHorizontal: 16,
    maxHeight: 44,
  },
  spokenInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    minHeight: 46,
  },
  spokenQueryInput: {
    flex: 1,
    fontFamily: DESIGN.medium,
    fontSize: 14,
    color: '#FFF',
    paddingVertical: 10,
  },
  inlineSendAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6F26',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  spokenQueryText: {
    fontFamily: DESIGN.semibold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.3,
    textAlign: 'center',
    color: '#FFF',
    maxHeight: 46,
    paddingHorizontal: 12,
  },
  actionControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  sideCircleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pauseBars: {
    flexDirection: 'row',
    gap: 4,
  },
  pauseBar: {
    width: 4,
    height: 14,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  miniPauseBars: {
    flexDirection: 'row',
    gap: 3,
  },
  miniPauseBar: {
    width: 3,
    height: 10,
    borderRadius: 1.5,
    backgroundColor: '#FFF',
  },
  homeIndicatorBar: {
    width: 128,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginTop: 4,
  },

  // Fullscreen Voice Listening Screen (Figma 8:270)
  voiceScreenContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
  },
  voiceCenterHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  voiceListeningStatus: {
    fontFamily: DESIGN.medium,
    fontSize: 14,
    letterSpacing: 0.3,
    color: '#A1A1AA',
  },
  voiceSpokenHeading: {
    fontFamily: DESIGN.semibold,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.4,
    textAlign: 'center',
    color: '#FFF',
    maxWidth: 320,
  },
  voiceFooterControls: {
    alignItems: 'center',
    gap: 16,
  },

  // Errors & Retry
  errorContainer: {
    gap: 6,
    alignItems: 'center',
  },
  errorText: {
    fontFamily: DESIGN.font,
    fontSize: 13,
    lineHeight: 18,
    color: '#FFD7AA',
    textAlign: 'center',
  },
  retryText: {
    color: '#FB923C',
    fontFamily: DESIGN.semibold,
    fontSize: 13,
    padding: 6,
  },

  // Modal styling
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: 'rgba(28,16,10,0.95)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,120,60,0.2)',
    padding: 24,
    gap: 14,
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: DESIGN.semibold,
    fontSize: 18,
    color: '#FFF',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontFamily: DESIGN.font,
    fontSize: 13,
    lineHeight: 18,
    color: '#C4B4A9',
    textAlign: 'center',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  endButton: {
    backgroundColor: 'rgba(255,80,20,0.15)',
    borderColor: 'rgba(255,100,30,0.3)',
  },
  modalButtonText: {
    fontFamily: DESIGN.medium,
    fontSize: 13,
    color: '#FFF',
  },
  quickSettingsCard: {
    width: '90%',
    maxWidth: 420,
    backgroundColor: '#160D09',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,140,60,0.22)',
    padding: 20,
    gap: 14,
  },
  quickSettingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  quickSettingsSubtitle: {
    fontFamily: DESIGN.font,
    fontSize: 12,
    color: '#B8ADA7',
    marginTop: 2,
  },
  quickCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickSectionLabel: {
    fontFamily: DESIGN.semibold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: '#FF944D',
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: 'rgba(255,111,38,0.2)',
    borderColor: '#FF6F26',
  },
  chipText: {
    fontFamily: DESIGN.medium,
    fontSize: 13,
    color: '#D8C9C1',
  },
  chipTextActive: {
    color: '#FFF',
    fontFamily: DESIGN.semibold,
  },
  chipSubText: {
    fontFamily: DESIGN.font,
    fontSize: 10,
    color: '#A1A1AA',
    marginTop: 1,
  },
  chipSubTextActive: {
    color: '#FFB890',
  },
  quickFooterActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  morePreferencesButton: {
    paddingVertical: 6,
  },
  morePreferencesText: {
    fontFamily: DESIGN.font,
    fontSize: 12,
    color: '#FFA370',
  },
  quickDoneButton: {
    paddingHorizontal: 16,
    height: 34,
    borderRadius: 17,
  },
  quickDoneText: {
    fontFamily: DESIGN.semibold,
    fontSize: 13,
    color: '#FFF',
  },
});
