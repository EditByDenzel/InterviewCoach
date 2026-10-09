// ============================================================
// src/screens/SettingsScreen.tsx
// MD3-styled settings with React Native Paper components
// ============================================================

import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert, StyleSheet } from 'react-native';
import {
  Text,
  Surface,
  Button,
  TextInput,
  ActivityIndicator,
  useTheme,
  SegmentedButtons,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList, AppSettings, TTSProvider } from '../types';
import { loadSettings, saveSettings } from '../store/settingsStore';
import { COLORS } from '../theme';

type Props = StackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const theme = useTheme();
  const [geminiKey, setGeminiKey] = useState('');
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [ttsProvider, setTTSProvider] = useState<TTSProvider>('gemini');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showGemini, setShowGemini] = useState(false);
  const [showElevenLabs, setShowElevenLabs] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => {
      setGeminiKey(s.geminiApiKey);
      setElevenLabsKey(s.elevenLabsApiKey);
      setTTSProvider(s.ttsProvider);
      setLoaded(true);
    });
  }, []);

  const handleSave = async () => {
    if (!geminiKey.trim()) {
      Alert.alert('Required', 'Gemini API key is required to use InterviewCoach.');
      return;
    }
    if (ttsProvider === 'elevenlabs' && !elevenLabsKey.trim()) {
      Alert.alert(
        'ElevenLabs Key Missing',
        'You selected ElevenLabs TTS but haven\'t entered an API key.',
      );
      return;
    }

    setSaving(true);
    try {
      const settings: AppSettings = {
        geminiApiKey: geminiKey.trim(),
        elevenLabsApiKey: elevenLabsKey.trim(),
        ttsProvider,
      };
      await saveSettings(settings);
      Alert.alert('Saved ✓', 'Settings saved successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator animating size="large" color={theme.colors.primary} />
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 12 }}>
          Loading settings…
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Gemini API Key */}
        <Surface style={styles.card} elevation={2}>
          <Text variant="titleMedium" style={[styles.cardTitle, { color: theme.colors.primary }]}>
            🔑  Gemini API Key
          </Text>
          <Text variant="bodySmall" style={[styles.desc, { color: theme.colors.onSurfaceVariant }]}>
            Required for interview questions, transcription, and Gemini TTS.{'\n'}
            Get yours at{' '}
            <Text style={{ color: theme.colors.primary }}>aistudio.google.com</Text>
          </Text>
          <TextInput
            mode="outlined"
            label="Gemini API Key"
            value={geminiKey}
            onChangeText={setGeminiKey}
            secureTextEntry={!showGemini}
            autoCorrect={false}
            autoCapitalize="none"
            right={
              <TextInput.Icon
                icon={showGemini ? 'eye-off' : 'eye'}
                onPress={() => setShowGemini((v) => !v)}
              />
            }
            style={styles.textInput}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            textColor={theme.colors.onSurface}
            placeholder="AIza..."
          />
        </Surface>

        {/* TTS Provider */}
        <Surface style={styles.card} elevation={2}>
          <Text variant="titleMedium" style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
            🔊  TTS Provider
          </Text>
          <Text variant="bodySmall" style={[styles.desc, { color: theme.colors.onSurfaceVariant }]}>
            Choose the voice engine for the AI interviewer.
          </Text>
          <SegmentedButtons
            value={ttsProvider}
            onValueChange={(v) => setTTSProvider(v as TTSProvider)}
            buttons={[
              {
                value: 'gemini',
                label: 'Gemini TTS',
                icon: 'google',
              },
              {
                value: 'elevenlabs',
                label: 'ElevenLabs',
                icon: 'microphone',
              },
            ]}
            style={styles.segmented}
          />
          <Text variant="bodySmall" style={[styles.providerNote, { color: theme.colors.onSurfaceVariant }]}>
            {ttsProvider === 'gemini'
              ? '✓ Free with your Gemini API key. Uses the "Kore" voice.'
              : '✓ High-quality natural voice. Requires an ElevenLabs paid plan.'}
          </Text>
        </Surface>

        {/* ElevenLabs API Key */}
        <Surface style={[styles.card, ttsProvider === 'elevenlabs' && { borderColor: theme.colors.primary, borderWidth: 1 }]} elevation={1}>
          <Text variant="titleMedium" style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
            🎵  ElevenLabs API Key{' '}
            <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: 'normal', fontSize: 13 }}>
              (optional)
            </Text>
          </Text>
          <Text variant="bodySmall" style={[styles.desc, { color: theme.colors.onSurfaceVariant }]}>
            Only required when using ElevenLabs as TTS provider.
          </Text>
          <TextInput
            mode="outlined"
            label="ElevenLabs API Key"
            value={elevenLabsKey}
            onChangeText={setElevenLabsKey}
            secureTextEntry={!showElevenLabs}
            autoCorrect={false}
            autoCapitalize="none"
            right={
              <TextInput.Icon
                icon={showElevenLabs ? 'eye-off' : 'eye'}
                onPress={() => setShowElevenLabs((v) => !v)}
              />
            }
            style={styles.textInput}
            outlineColor={ttsProvider === 'elevenlabs' ? theme.colors.primary : theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            textColor={theme.colors.onSurface}
            placeholder="sk_..."
          />
        </Surface>

        {/* Save */}
        <Button
          mode="contained"
          onPress={handleSave}
          disabled={saving}
          contentStyle={styles.saveContent}
          labelStyle={styles.saveLabel}
          style={styles.saveButton}
          icon={saving ? undefined : 'content-save'}
          loading={saving}
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>

        {/* Privacy note */}
        <Surface style={styles.noteCard} elevation={0}>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 18 }}>
            🔒  API keys are stored locally on your device only via AsyncStorage.
            They are never shared with any server other than Google and ElevenLabs.
          </Text>
        </Surface>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    backgroundColor: COLORS.surface,
  },
  cardTitle: {
    fontWeight: '700',
    marginBottom: 6,
  },
  desc: {
    lineHeight: 20,
    marginBottom: 14,
  },
  textInput: {
    backgroundColor: COLORS.surfaceElevated,
  },
  segmented: {
    marginBottom: 10,
  },
  providerNote: {
    fontStyle: 'italic',
    lineHeight: 18,
  },
  saveButton: {
    borderRadius: 14,
    marginBottom: 12,
    backgroundColor: COLORS.accent,
  },
  saveContent: { paddingVertical: 8 },
  saveLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
    color: '#0F172A',
  },
  noteCard: {
    borderRadius: 12,
    padding: 14,
    backgroundColor: COLORS.surfaceElevated,
  },
});
