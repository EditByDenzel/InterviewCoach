// ============================================================
// src/screens/SummaryScreen.tsx
// Displays session summary: all Q&A rounds + closing message
// MD3-styled with React Native Paper
// ============================================================

import React from 'react';
import { View, ScrollView, StyleSheet, Share } from 'react-native';
import {
  Text,
  Surface,
  Button,
  Divider,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList, InterviewRound } from '../types';
import { COLORS } from '../theme';

type Props = StackScreenProps<RootStackParamList, 'Summary'>;

export default function SummaryScreen({ navigation, route }: Props) {
  const { rounds, closingMessage, topic } = route.params;
  const theme = useTheme();

  /** Share the full session transcript as plain text */
  const handleShare = async () => {
    const lines: string[] = [
      `InterviewCoach Session — ${topic}`,
      '='.repeat(40),
      '',
    ];
    rounds.forEach((r) => {
      lines.push(`Q${r.roundNumber}: ${r.question}`);
      lines.push(`A: ${r.answer}`);
      lines.push('');
    });
    lines.push('--- Closing Summary ---');
    lines.push(closingMessage);

    await Share.share({ message: lines.join('\n') });
  };

  const handleNewSession = () => {
    navigation.replace('Home');
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['bottom']}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerEmoji}>🎉</Text>
          <Text
            variant="headlineMedium"
            style={[styles.headerTitle, { color: theme.colors.primary }]}
          >
            Session Complete!
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}
          >
            {topic}
          </Text>
        </View>

        {/* Closing / AI summary */}
        <Surface style={[styles.closingCard, { borderColor: theme.colors.primary }]} elevation={3}>
          <Text
            variant="labelSmall"
            style={{ color: theme.colors.primary, letterSpacing: 1, marginBottom: 10 }}
          >
            AI COACH FEEDBACK
          </Text>
          <Text
            variant="bodyLarge"
            style={{ color: theme.colors.onSurface, lineHeight: 26 }}
          >
            {closingMessage}
          </Text>
        </Surface>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <Surface style={styles.statCard} elevation={2}>
            <Text variant="displaySmall" style={{ color: theme.colors.primary, fontWeight: 'bold' }}>
              {rounds.length}
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Questions
            </Text>
          </Surface>
          <Surface style={styles.statCard} elevation={2}>
            <Text variant="displaySmall" style={{ color: COLORS.success, fontWeight: 'bold' }}>
              ✓
            </Text>
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Completed
            </Text>
          </Surface>
        </View>

        {/* Q&A breakdown */}
        <Text
          variant="titleMedium"
          style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
        >
          Full Transcript
        </Text>

        {rounds.map((round, idx) => (
          <React.Fragment key={round.roundNumber}>
            <Surface style={styles.roundCard} elevation={2}>
              {/* Question */}
              <View style={styles.turnRow}>
                <View style={[styles.roleTag, { backgroundColor: theme.colors.primaryContainer }]}>
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.onPrimaryContainer, fontWeight: 'bold' }}
                  >
                    Q{round.roundNumber}
                  </Text>
                </View>
                <Text
                  variant="bodyMedium"
                  style={{ flex: 1, color: theme.colors.onSurface, lineHeight: 22 }}
                >
                  {round.question}
                </Text>
              </View>

              <Divider style={styles.divider} />

              {/* Answer */}
              <View style={styles.turnRow}>
                <View style={[styles.roleTag, { backgroundColor: '#0D2B1A' }]}>
                  <Text
                    variant="labelSmall"
                    style={{ color: COLORS.success, fontWeight: 'bold' }}
                  >
                    YOU
                  </Text>
                </View>
                <Text
                  variant="bodyMedium"
                  style={{
                    flex: 1,
                    color: theme.colors.onSurfaceVariant,
                    lineHeight: 22,
                    fontStyle: round.answer ? 'normal' : 'italic',
                  }}
                >
                  {round.answer || '(no answer recorded)'}
                </Text>
              </View>
            </Surface>
          </React.Fragment>
        ))}

        {/* Action buttons */}
        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={handleNewSession}
            style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
            contentStyle={styles.actionBtnContent}
            labelStyle={{ color: '#0F172A', fontWeight: 'bold', fontSize: 15 }}
            icon="refresh"
          >
            New Interview
          </Button>
          <Button
            mode="outlined"
            onPress={handleShare}
            style={styles.actionBtn}
            contentStyle={styles.actionBtnContent}
            textColor={theme.colors.primary}
            icon="share-variant"
          >
            Share Transcript
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerEmoji: {
    fontSize: 52,
    marginBottom: 8,
  },
  headerTitle: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  closingCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 12,
  },
  roundCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    backgroundColor: COLORS.surface,
  },
  turnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 4,
  },
  roleTag: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    minWidth: 38,
    alignItems: 'center',
  },
  divider: {
    marginVertical: 12,
    backgroundColor: COLORS.border,
  },
  actions: {
    marginTop: 8,
    gap: 12,
  },
  actionBtn: {
    borderRadius: 14,
  },
  actionBtnContent: {
    paddingVertical: 8,
  },
});
