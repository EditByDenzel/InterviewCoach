import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList, SavedConversation } from '../types';
import { loadConversationLibrary } from '../store/conversationStore';
import { DESIGN, DesignFrame, DesignIcon, GlassButton, Orb, Waveform } from '../components/CoachieDesign';
import { FadeIn, MotionPressable, Reveal } from '../components/Motion';

type Props = StackScreenProps<RootStackParamList, 'Conversation'>;

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

export default function ConversationScreen({ navigation, route }: Props) {
  const [conversation, setConversation] = useState<SavedConversation | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadConversationLibrary()
        .then((items) => {
          if (active) {
            const item = items.find((it) => it.id === route.params.id);
            setConversation(item || null);
            if (!item) setError('This conversation is no longer available.');
          }
        })
        .catch(() => {
          if (active) setError('Could not load this conversation.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [route.params.id])
  );

  const totalRounds = conversation?.rounds.length || 1;

  return (
    <DesignFrame chat>
      {/* Top Header Navigation (Figma style) */}
      <View style={styles.topHeader}>
        <GlassButton label="Back to Home" onPress={() => navigation.goBack()} style={styles.closePill}>
          <DesignIcon name="close" />
          <Text style={styles.closeLabel}>Close chat</Text>
        </GlassButton>

        <View style={styles.headerRightControls}>
          <View style={styles.roundTrackerPill}>
            <View style={styles.roundDot} />
            <Text style={styles.roundLabel}>
              {conversation?.isSample ? 'Sample Session' : `${totalRounds} Rounds`}
            </Text>
          </View>

          <GlassButton label="Audio setting" onPress={() => {}} style={styles.speakerButton}>
            <DesignIcon name="speaker" />
          </GlassButton>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.chatScrollContent}>
        {loading ? (
          <Text style={styles.metaNotice}>Loading conversation…</Text>
        ) : error ? (
          <Text style={styles.errorNotice}>{error}</Text>
        ) : (
          conversation && (
            <>
              {/* Candidate Initial Topic Prompt (Right Aligned Sunset Orange Bubble) */}
              <View style={styles.topicRow}>
                <LinearGradient colors={['#FF6F26', '#FF500B', '#DE3400']} style={styles.topicBubble}>
                  <Text style={styles.topicText}>{conversation.topic}</Text>
                </LinearGradient>
                <Text style={styles.topicTimestamp}>
                  {new Date(conversation.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              {/* Rounds List */}
              {conversation.rounds.map((round, idx) => {
                const isPlayingAi = playingKey === `q-${idx}`;
                const isPlayingCand = playingKey === `a-${idx}`;
                const isCollapsed = collapsed[idx];
                const estKb = Math.max(24, Math.round(18 * 3.6));

                return (
                  <React.Fragment key={round.roundNumber}>
                    {/* AI Question Bubble */}
                    <FadeIn style={styles.aiMessageGroup}>
                      <View style={styles.aiBubbleWrapper}>
                        <View style={styles.aiBubbleContainer}>
                          <View style={styles.aiQuestionContent}>
                            {renderFormattedMessage(round.question)}
                          </View>

                          {/* Attached Audio Player Bar */}
                          <View style={styles.attachedAudioBar}>
                            <MotionPressable
                              accessibilityRole="button"
                              accessibilityLabel={isPlayingAi ? 'Pause' : 'Play'}
                              onPress={() => setPlayingKey(isPlayingAi ? null : `q-${idx}`)}
                              style={styles.aiPlayButton}
                            >
                              <LinearGradient
                                colors={['#D97706', '#FB923C']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFill}
                              />
                              <DesignIcon name="play" />
                            </MotionPressable>

                            <View style={styles.aiWaveformArea}>
                              <Waveform active={isPlayingAi} progress={isPlayingAi ? 0.6 : 0} />
                            </View>

                            <Text style={styles.aiDurationText}>0:24</Text>
                          </View>
                        </View>

                        <Text style={styles.aiMetaCaption}>
                          {new Date(conversation.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          • Synthetic Voice ({conversation.voice || 'Aira'})
                        </Text>
                      </View>
                    </FadeIn>

                    {/* Candidate Answer Card */}
                    <FadeIn style={styles.candidateCardWrapper}>
                      <View style={styles.candidateCard}>
                        {/* Top Audio Player Row */}
                        <View style={styles.candidateAudioRow}>
                          <MotionPressable
                            accessibilityRole="button"
                            accessibilityLabel={isPlayingCand ? 'Pause' : 'Play candidate answer'}
                            onPress={() => setPlayingKey(isPlayingCand ? null : `a-${idx}`)}
                            style={styles.candidatePlayButton}
                          >
                            <DesignIcon name="play" />
                          </MotionPressable>

                          <View style={styles.candidateWaveArea}>
                            <Waveform candidate active={isPlayingCand} progress={isPlayingCand ? 0.5 : 0} />
                            <Text style={styles.candidateSizeCaption}>00:18, {estKb} KB</Text>
                          </View>

                          <MotionPressable
                            accessibilityRole="button"
                            accessibilityLabel={isCollapsed ? 'Expand transcript' : 'Collapse transcript'}
                            onPress={() => setCollapsed((c) => ({ ...c, [idx]: !c[idx] }))}
                            style={styles.collapseButton}
                          >
                            <View style={{ transform: [{ rotate: isCollapsed ? '180deg' : '0deg' }] }}>
                              <DesignIcon name="collapse" />
                            </View>
                          </MotionPressable>
                        </View>

                        {/* Collapsible Transcript Body */}
                        <Reveal open={!isCollapsed}>
                          <View style={styles.candidateTranscript}>
                            <Text style={styles.candidateText}>{round.answer}</Text>
                            <View style={styles.candidateMetaRow}>
                              <Text style={styles.candidateTimestamp}>
                                {new Date(conversation.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </Text>
                              <DesignIcon name="check" />
                            </View>
                          </View>
                        </Reveal>
                      </View>
                    </FadeIn>
                  </React.Fragment>
                );
              })}

              {/* Coach Closing Feedback */}
              {!!conversation.closingMessage && (
                <FadeIn style={styles.feedbackCard}>
                  <Text style={styles.feedbackHeading}>Coach feedback</Text>
                  <Text style={styles.feedbackBody}>{conversation.closingMessage}</Text>
                </FadeIn>
              )}

              {/* Practice Again CTA */}
              <GlassButton
                label="Practice this topic again"
                onPress={() => navigation.navigate('Home', { topic: conversation.topic })}
                style={styles.practiceButton}
              >
                <Text style={styles.practiceText}>Practice this topic again</Text>
              </GlassButton>
            </>
          )
        )}
      </ScrollView>
    </DesignFrame>
  );
}

const styles = StyleSheet.create({
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

  // Chat Log Scroll
  chatScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 48,
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

  // AI Message Group
  aiMessageGroup: {
    gap: 10,
    maxWidth: '92%',
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

  // Candidate Response Card
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

  // Feedback Card
  feedbackCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: DESIGN.panel,
    borderWidth: 1,
    borderColor: DESIGN.border,
    gap: 10,
  },
  feedbackHeading: {
    fontFamily: DESIGN.medium,
    fontSize: 14,
    color: '#FFB083',
  },
  feedbackBody: {
    fontFamily: DESIGN.font,
    fontSize: 14,
    lineHeight: 22,
    color: '#E4E4E7',
  },

  // Practice Again Button
  practiceButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 9999,
    backgroundColor: 'rgba(255,92,28,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,140,60,0.3)',
    marginTop: 8,
  },
  practiceText: {
    fontFamily: DESIGN.medium,
    fontSize: 15,
    color: '#FFF',
  },

  metaNotice: {
    fontFamily: DESIGN.font,
    fontSize: 13,
    color: '#C4B4A9',
    textAlign: 'center',
    paddingVertical: 24,
  },
  errorNotice: {
    fontFamily: DESIGN.font,
    fontSize: 13,
    color: '#FFB083',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
