// ============================================================
// src/screens/InterviewScreen.tsx
// Core interview loop — 5 rounds of Q&A with animated mic FAB
//
// Flow per round:
//   1. Generate question via Gemini text
//   2. Convert to audio via TTS (Gemini or ElevenLabs)
//   3. Play audio via expo-av (loudspeaker)
//   4. User presses FAB → records audio
//   5. User presses FAB again → stops recording
//   6. Audio sent to Gemini for transcription
//   7. Transcript added to history → next round
// After 5 rounds: closing message → Summary screen
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import {
  Text,
  Surface,
  FAB,
  ProgressBar,
  Chip,
  ActivityIndicator,
  useTheme,
  Button,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList, InterviewRound, InterviewPhase } from '../types';
import { loadSettings } from '../store/settingsStore';
import {
  generateInterviewText,
  generateGeminiTTS,
  transcribeAudio,
  GeminiMessage,
} from '../services/geminiService';
import { generateElevenLabsTTS } from '../services/elevenLabsService';
import {
  playBase64Audio,
  startRecording,
  stopRecording,
  readAudioAsBase64,
  requestMicrophonePermission,
} from '../services/audioService';
import { COLORS } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Interview'>;

const TOTAL_ROUNDS = 5;

/** Human-readable label + colour for each phase */
const PHASE_META: Record<InterviewPhase, { label: string; color: string; icon: string }> = {
  idle: { label: 'Getting ready…', color: COLORS.textSecondary, icon: 'clock-outline' },
  generating_question: { label: 'Thinking…', color: COLORS.warning, icon: 'brain' },
  speaking: { label: 'AI Speaking', color: COLORS.accent, icon: 'volume-high' },
  recording: { label: 'Listening…', color: COLORS.recordActive, icon: 'microphone' },
  transcribing: { label: 'Transcribing…', color: COLORS.warning, icon: 'text-recognition' },
  closing: { label: 'Wrapping up…', color: COLORS.accent, icon: 'star-circle' },
  done: { label: 'Complete!', color: COLORS.success, icon: 'check-circle' },
};

export default function InterviewScreen({ navigation, route }: Props) {
  const { topic } = route.params;
  const theme = useTheme();

  // ── State ──────────────────────────────────────────────
  const [phase, setPhase] = useState<InterviewPhase>('idle');
  const [currentRound, setCurrentRound] = useState(0);          // 0-indexed
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [rounds, setRounds] = useState<InterviewRound[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Gemini conversation history
  const historyRef = useRef<GeminiMessage[]>([]);

  // Settings loaded once
  const settingsRef = useRef({ geminiKey: '', elevenLabsKey: '', ttsProvider: 'gemini' as 'gemini' | 'elevenlabs' });

  // ── Mic pulse animation ─────────────────────────────────
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);

  const animatedRing = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const startPulse = useCallback(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.6, { duration: 700, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 700, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 700 }),
        withTiming(0, { duration: 700 }),
      ),
      -1,
      false,
    );
  }, [pulseScale, pulseOpacity]);

  const stopPulse = useCallback(() => {
    cancelAnimation(pulseScale);
    cancelAnimation(pulseOpacity);
    pulseScale.value = withTiming(1);
    pulseOpacity.value = withTiming(0);
  }, [pulseScale, pulseOpacity]);

  // ── Helpers ─────────────────────────────────────────────

  /** Append assistant turn to Gemini history */
  const appendToHistory = (role: 'user' | 'model', text: string) => {
    historyRef.current.push({ role, parts: [{ text }] });
  };

  /**
   * Convert text → audio → play it.
   * Handles both Gemini TTS and ElevenLabs.
   */
  const speakText = async (text: string) => {
    const { geminiKey, elevenLabsKey, ttsProvider } = settingsRef.current;
    setPhase('speaking');

    if (ttsProvider === 'elevenlabs' && elevenLabsKey) {
      const b64 = await generateElevenLabsTTS(elevenLabsKey, text);
      await playBase64Audio(b64, 'mp3');
    } else {
      // Gemini TTS
      const b64 = await generateGeminiTTS(geminiKey, text);
      await playBase64Audio(b64, 'wav');
    }
  };

  /**
   * Run one full interview round:
   *   generate question → speak → record → transcribe → store
   */
  const runRound = useCallback(
    async (roundIndex: number) => {
      const { geminiKey } = settingsRef.current;
      setCurrentTranscript('');
      setError(null);

      // 1️⃣ Generate question
      setPhase('generating_question');
      const prompt =
        roundIndex === 0
          ? 'Start the interview. Ask your first question.'
          : 'Continue the interview. Ask the next question based on the candidate\'s previous answer.';

      const question = await generateInterviewText(
        geminiKey,
        topic,
        historyRef.current,
        prompt,
      );
      setCurrentQuestion(question);
      appendToHistory('model', question);

      // 2️⃣ Speak question
      await speakText(question);

      // 3️⃣ Wait for user to press RECORD
      // (phase stays 'idle' — the FAB press handler kicks off recording)
      setPhase('idle');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topic],
  );

  /** Handle FAB press: start or stop recording */
  const handleFABPress = async () => {
    if (phase === 'idle') {
      // Start recording
      const granted = await requestMicrophonePermission();
      if (!granted) {
        Alert.alert(
          'Permission Denied',
          'Microphone access is required to record your answer.',
        );
        return;
      }
      setPhase('recording');
      startPulse();
      await startRecording();
    } else if (phase === 'recording') {
      // Stop recording → transcribe → next round
      stopPulse();
      setPhase('transcribing');

      const uri = await stopRecording();
      if (!uri) {
        setError('Recording failed. Please try again.');
        setPhase('idle');
        return;
      }

      const { base64, mimeType } = await readAudioAsBase64(uri);
      const transcript = await transcribeAudio(
        settingsRef.current.geminiKey,
        base64,
        mimeType,
      );

      setCurrentTranscript(transcript);
      appendToHistory('user', transcript);

      // Store this round
      const newRound: InterviewRound = {
        roundNumber: currentRound + 1,
        question: currentQuestion,
        answer: transcript,
      };
      const updatedRounds = [...rounds, newRound];
      setRounds(updatedRounds);

      const nextRound = currentRound + 1;
      setCurrentRound(nextRound);

      if (nextRound < TOTAL_ROUNDS) {
        // More rounds
        await runRound(nextRound);
      } else {
        // Final round — generate closing
        await runClosing(updatedRounds);
      }
    }
  };

  /** Generate + speak the closing summary, then navigate to Summary */
  const runClosing = async (completedRounds: InterviewRound[]) => {
    const { geminiKey } = settingsRef.current;
    setPhase('closing');
    setCurrentQuestion('');

    const closingPrompt =
      'The interview is now complete. Please provide a warm, constructive closing summary of the candidate\'s performance based on all their answers so far. Be specific and encouraging.';

    const closingMessage = await generateInterviewText(
      geminiKey,
      topic,
      historyRef.current,
      closingPrompt,
    );
    setCurrentQuestion(closingMessage);

    await speakText(closingMessage);
    setPhase('done');

    navigation.replace('Summary', {
      rounds: completedRounds,
      closingMessage,
      topic,
    });
  };

  // ── Mount: load settings then start first round ─────────
  useEffect(() => {
    const init = async () => {
      try {
        const s = await loadSettings();
        if (!s.geminiApiKey) {
          Alert.alert(
            'API Key Missing',
            'Please configure your Gemini API key in Settings.',
            [{ text: 'OK', onPress: () => navigation.goBack() }],
          );
          return;
        }
        settingsRef.current = {
          geminiKey: s.geminiApiKey,
          elevenLabsKey: s.elevenLabsApiKey,
          ttsProvider: s.ttsProvider,
        };
        await runRound(0);
      } catch (err: any) {
        setError(err?.message ?? 'An unexpected error occurred.');
        setPhase('idle');
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render helpers ──────────────────────────────────────

  const phaseMeta = PHASE_META[phase];
  const progress = TOTAL_ROUNDS > 0 ? currentRound / TOTAL_ROUNDS : 0;
  const isRecording = phase === 'recording';
  const isBusy = ['generating_question', 'speaking', 'transcribing', 'closing'].includes(phase);
  const canRecord = phase === 'idle' || phase === 'recording';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressLabelRow}>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Question {Math.min(currentRound + 1, TOTAL_ROUNDS)} of {TOTAL_ROUNDS}
            </Text>
            <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
          <ProgressBar
            progress={progress}
            color={theme.colors.primary}
            style={styles.progressBar}
          />
        </View>

        {/* Phase status chip */}
        <View style={styles.phaseRow}>
          <Chip
            icon={phaseMeta.icon}
            style={[styles.phaseChip, { borderColor: phaseMeta.color }]}
            textStyle={{ color: phaseMeta.color, fontWeight: '600' }}
          >
            {phaseMeta.label}
          </Chip>
          {isBusy && (
            <ActivityIndicator
              animating
              color={theme.colors.primary}
              size="small"
              style={{ marginLeft: 10 }}
            />
          )}
        </View>

        {/* Question card */}
        {currentQuestion ? (
          <Surface style={styles.questionCard} elevation={3}>
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.primary, marginBottom: 8, letterSpacing: 1 }}
            >
              INTERVIEWER
            </Text>
            <Text
              variant="bodyLarge"
              style={{ color: theme.colors.onSurface, lineHeight: 26 }}
            >
              {currentQuestion}
            </Text>
          </Surface>
        ) : (
          <Surface style={styles.questionCard} elevation={1}>
            <ActivityIndicator animating color={theme.colors.primary} />
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant, marginTop: 12, textAlign: 'center' }}
            >
              Generating question…
            </Text>
          </Surface>
        )}

        {/* Transcript card */}
        {currentTranscript ? (
          <Surface style={styles.transcriptCard} elevation={2}>
            <Text
              variant="labelSmall"
              style={{ color: COLORS.success, marginBottom: 8, letterSpacing: 1 }}
            >
              YOUR ANSWER
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurface, lineHeight: 22 }}
            >
              {currentTranscript}
            </Text>
          </Surface>
        ) : null}

        {/* Error display */}
        {error ? (
          <Surface style={[styles.errorCard, { borderColor: theme.colors.error }]} elevation={1}>
            <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
              ⚠️  {error}
            </Text>
            <Button
              mode="text"
              textColor={theme.colors.primary}
              onPress={() => runRound(currentRound)}
              style={{ marginTop: 8 }}
            >
              Retry
            </Button>
          </Surface>
        ) : null}

        {/* Spacer so FAB doesn't overlap content */}
        <View style={{ height: 160 }} />
      </ScrollView>

      {/* Pulsing ring behind FAB (visible when recording) */}
      {isRecording && (
        <View style={styles.fabContainer} pointerEvents="none">
          <Animated.View
            style={[
              styles.pulseRing,
              { borderColor: COLORS.recordActive },
              animatedRing,
            ]}
          />
        </View>
      )}

      {/* FAB microphone button */}
      <View style={styles.fabContainer}>
        <FAB
          icon={isRecording ? 'stop' : 'microphone'}
          label={isRecording ? 'Stop Recording' : canRecord && !isBusy ? 'Record Answer' : ''}
          onPress={handleFABPress}
          disabled={isBusy}
          style={[
            styles.fab,
            {
              backgroundColor: isRecording
                ? COLORS.recordActive
                : isBusy
                ? COLORS.surfaceElevated
                : theme.colors.primary,
            },
          ]}
          color={isRecording || !isBusy ? '#0F172A' : COLORS.textSecondary}
          size="medium"
        />
      </View>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────

const COLORS_LOCAL = COLORS; // alias for clarity

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    padding: 20,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.surfaceElevated,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  phaseChip: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  questionCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    backgroundColor: COLORS.surface,
    minHeight: 120,
    justifyContent: 'center',
  },
  transcriptCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    backgroundColor: COLORS.surface,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
  },
  errorCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    backgroundColor: '#1F0D0D',
    borderWidth: 1,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    borderRadius: 32,
    minWidth: 180,
    elevation: 8,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
  },
});
