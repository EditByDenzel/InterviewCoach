// ============================================================
// src/screens/HomeScreen.tsx
// MD3-styled landing screen using React Native Paper + NativeWind
// ============================================================

import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert, StyleSheet } from 'react-native';
import {
  Text,
  Surface,
  Button,
  TextInput,
  Chip,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { loadSettings } from '../store/settingsStore';
import { COLORS } from '../theme';

type Props = StackScreenProps<RootStackParamList, 'Home'>;

/** Quick-pick topic suggestions */
const TOPIC_SUGGESTIONS = [
  'React Native Developer',
  'Full-Stack Engineer',
  'Product Manager',
  'Data Scientist',
  'DevOps Engineer',
  'UX Designer',
  'ML Engineer',
  'Backend Developer',
];

export default function HomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const [topic, setTopic] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);

  // Check API key on mount + screen focus
  useEffect(() => {
    const check = async () => {
      const settings = await loadSettings();
      setHasApiKey(!!settings.geminiApiKey);
    };
    check();
    const unsub = navigation.addListener('focus', check);
    return unsub;
  }, [navigation]);

  const handleStart = () => {
    const trimmed = topic.trim();
    if (!trimmed) {
      Alert.alert('Topic Required', 'Please enter an interview topic to continue.');
      return;
    }
    if (!hasApiKey) {
      Alert.alert(
        'API Key Missing',
        'Please add your Gemini API key in Settings before starting.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Settings', onPress: () => navigation.navigate('Settings') },
        ],
      );
      return;
    }
    navigation.navigate('Interview', { topic: trimmed });
  };

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
        {/* Hero section */}
        <View style={styles.hero}>
          <Text variant="displaySmall" style={[styles.heroEmoji]}>
            🎙️
          </Text>
          <Text
            variant="headlineLarge"
            style={[styles.heroTitle, { color: theme.colors.primary }]}
          >
            Interview Coach
          </Text>
          <Text
            variant="bodyLarge"
            style={[styles.heroSubtitle, { color: theme.colors.onSurfaceVariant }]}
          >
            AI-powered mock interview practice
          </Text>
        </View>

        {/* API key warning */}
        {!hasApiKey && (
          <Surface style={[styles.warningCard, { borderColor: COLORS.warning }]} elevation={1}>
            <Text
              variant="bodyMedium"
              style={{ color: COLORS.warning, textAlign: 'center' }}
              onPress={() => navigation.navigate('Settings')}
            >
              ⚠️  No API key configured. Tap to open Settings →
            </Text>
          </Surface>
        )}

        {/* Topic input card */}
        <Surface style={styles.card} elevation={2}>
          <Text
            variant="titleMedium"
            style={[styles.cardTitle, { color: theme.colors.primary }]}
          >
            Interview Topic / Role
          </Text>
          <TextInput
            mode="outlined"
            label="e.g. React Native Developer"
            value={topic}
            onChangeText={setTopic}
            returnKeyType="done"
            onSubmitEditing={handleStart}
            autoCorrect={false}
            style={styles.textInput}
            outlineColor={theme.colors.outline}
            activeOutlineColor={theme.colors.primary}
            textColor={theme.colors.onSurface}
          />

          <Text
            variant="labelSmall"
            style={[styles.suggestLabel, { color: theme.colors.onSurfaceVariant }]}
          >
            Quick picks:
          </Text>
          <View style={styles.chipRow}>
            {TOPIC_SUGGESTIONS.map((s) => (
              <Chip
                key={s}
                onPress={() => setTopic(s)}
                style={[
                  styles.chip,
                  topic === s && { backgroundColor: theme.colors.primaryContainer },
                ]}
                textStyle={{ color: topic === s ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant }}
                compact
              >
                {s}
              </Chip>
            ))}
          </View>
        </Surface>

        {/* How it works card */}
        <Surface style={styles.card} elevation={1}>
          <Text
            variant="titleMedium"
            style={[styles.cardTitle, { color: theme.colors.onSurface }]}
          >
            How It Works
          </Text>
          {[
            '🤖  AI asks you 5 realistic interview questions',
            '🎙️  Speak your answer aloud after each one',
            '📝  Your answer is transcribed automatically',
            '💡  AI uses your answers to shape follow-ups',
            '✅  Get a constructive closing summary',
          ].map((item) => (
            <Text
              key={item}
              variant="bodyMedium"
              style={[styles.howItem, { color: theme.colors.onSurfaceVariant }]}
            >
              {item}
            </Text>
          ))}
        </Surface>

        {/* Start button */}
        <Button
          mode="contained"
          onPress={handleStart}
          disabled={!topic.trim()}
          contentStyle={styles.startButtonContent}
          labelStyle={styles.startButtonLabel}
          style={styles.startButton}
          icon="play-circle"
        >
          Start Interview
        </Button>

        {/* Settings link */}
        <Button
          mode="text"
          onPress={() => navigation.navigate('Settings')}
          icon="cog"
          textColor={theme.colors.onSurfaceVariant}
          style={styles.settingsBtn}
        >
          Settings & API Keys
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 12,
  },
  heroEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  heroTitle: {
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  heroSubtitle: {
    marginTop: 4,
    textAlign: 'center',
  },
  warningCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    backgroundColor: '#2D1800',
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    backgroundColor: COLORS.surface,
  },
  cardTitle: {
    fontWeight: '700',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: COLORS.surfaceElevated,
    fontSize: 15,
  },
  suggestLabel: {
    marginTop: 14,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: COLORS.surfaceElevated,
  },
  howItem: {
    marginBottom: 6,
    lineHeight: 22,
  },
  startButton: {
    borderRadius: 14,
    marginBottom: 10,
    backgroundColor: COLORS.accent,
  },
  startButtonContent: {
    paddingVertical: 8,
  },
  startButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
    color: '#0F172A',
  },
  settingsBtn: {
    alignSelf: 'center',
  },
});
