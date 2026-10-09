import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { SavedConversation } from '../types';
import { DESIGN, DesignIcon } from './CoachieDesign';
import { easeDrawer, LiveDots, MotionPressable, useMotion } from './Motion';

type Props = {
  open: boolean;
  onClose: () => void;
  conversations: SavedConversation[];
  error: string;
  loading: boolean;
  onSelect: (id: string) => void;
  onRetry: () => void;
  onNew?: () => void;
};

export function ConversationSidebar({
  open,
  onClose,
  conversations,
  error,
  loading,
  onSelect,
  onRetry,
  onNew,
}: Props) {
  const { reduced } = useMotion();
  const window = useWindowDimensions();
  const [mounted, setMounted] = useState(open);
  const progress = useRef(new Animated.Value(0)).current;
  const width = Math.min(340, window.width * 0.88);

  useEffect(() => {
    if (open) setMounted(true);
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: reduced ? 0 : open ? 260 : 180,
      easing: easeDrawer,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
    return () => animation.stop();
  }, [open, progress, reduced]);

  // Find index of most recent non-sample conversation
  const mostRecentId = conversations.find((c) => !c.isSample)?.id || conversations[0]?.id;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} accessibilityViewIsModal>
      <View style={styles.modal}>
        {/* Dim Backdrop */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#000',
              opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.78] }),
            },
          ]}
        >
          <MotionPressable accessible={false} aria-hidden focusable={false} onPress={onClose} style={StyleSheet.absoluteFill} />
        </Animated.View>

        {/* Drawer Container */}
        <View
          pointerEvents="box-none"
          style={[
            styles.bounds,
            {
              width: Math.min(390, window.width),
              height: Platform.OS === 'web' && window.width > 600 ? Math.min(900, window.height - 48) : window.height,
            },
          ]}
        >
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.panel,
              {
                width,
                opacity: reduced ? progress : 1,
                transform: [
                  {
                    translateX: reduced
                      ? 0
                      : progress.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] }),
                  },
                ],
              },
            ]}
          >
            <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
              <View style={styles.header}>
                <View>
                  <Text accessibilityRole="header" style={styles.title}>
                    Conversations
                  </Text>
                  <Text style={styles.caption}>Your practice history</Text>
                </View>
                <MotionPressable
                  accessibilityRole="button"
                  accessibilityLabel="Close sidebar"
                  onPress={onClose}
                  style={styles.close}
                >
                  <DesignIcon name="close" />
                </MotionPressable>
              </View>

              {onNew && (
                <View style={styles.newSection}>
                  <MotionPressable
                    accessibilityRole="button"
                    accessibilityLabel="Start a new interview"
                    onPress={() => {
                      onClose();
                      onNew();
                    }}
                    style={styles.newButton}
                  >
                    <LinearGradient
                      colors={['#FF6F26', '#E04E10']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <Text style={styles.newButtonText}>+ New interview</Text>
                  </MotionPressable>
                </View>
              )}

              <ScrollView
                style={{ flex: 1, minHeight: 0 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.list}
              >
                {loading ? (
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', padding: 16 }}>
                    <Text style={styles.description}>Loading conversations…</Text>
                    <LiveDots active />
                  </View>
                ) : error ? (
                  <View style={{ gap: 12, padding: 16 }}>
                    <Text accessibilityLiveRegion="polite" style={styles.description}>
                      {error}
                    </Text>
                    <MotionPressable accessibilityRole="button" onPress={onRetry} style={styles.item}>
                      <Text style={styles.itemTitle}>Try again</Text>
                    </MotionPressable>
                  </View>
                ) : conversations.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={styles.itemTitle}>Your next conversation starts here.</Text>
                    <Text style={styles.description}>
                      Practice a topic and your questions, answers, and feedback will appear here.
                    </Text>
                  </View>
                ) : (
                  conversations.map((item) => {
                    const isLatest = item.id === mostRecentId && !item.isSample;
                    return (
                      <MotionPressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open conversation: ${item.topic}`}
                        key={item.id}
                        onPress={() => onSelect(item.id)}
                        style={[styles.item, isLatest && styles.itemLatest]}
                      >
                        <View style={styles.itemHeaderRow}>
                          <Text numberOfLines={2} style={[styles.itemTitle, isLatest && { color: '#FFF' }]}>
                            {item.topic}
                          </Text>
                          {isLatest && <View style={styles.recentDot} />}
                        </View>
                        <Text style={styles.meta}>
                          {item.isSample
                            ? 'Sample'
                            : new Date(item.updatedAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}{' '}
                          • {item.rounds.length} {item.rounds.length === 1 ? 'answer' : 'answers'} •{' '}
                          {item.status === 'completed' ? 'Completed' : 'In progress'}
                        </Text>
                      </MotionPressable>
                    );
                  })
                )}
              </ScrollView>
            </SafeAreaView>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bounds: { position: 'relative' },
  panel: {
    height: '100%',
    backgroundColor: '#140B07',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,140,60,0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 8, height: 0 },
  },
  fill: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontFamily: DESIGN.semibold, color: '#FFF', fontSize: 22 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: { fontFamily: DESIGN.font, color: '#B8ADA7', fontSize: 12, marginTop: 2 },
  newSection: { paddingHorizontal: 16, paddingBottom: 12 },
  newButton: {
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newButtonText: { fontFamily: DESIGN.semibold, color: '#FFF', fontSize: 13 },
  list: { paddingHorizontal: 12, paddingBottom: 24, gap: 10 },
  item: {
    padding: 16,
    gap: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemLatest: {
    backgroundColor: 'rgba(255,100,30,0.09)',
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  recentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6F26',
    marginTop: 6,
  },
  itemTitle: { fontFamily: DESIGN.medium, color: '#F4ECE6', fontSize: 14, lineHeight: 20, flex: 1 },
  meta: { fontFamily: DESIGN.font, color: '#9E928A', fontSize: 11, lineHeight: 16 },
  empty: { padding: 16, gap: 12 },
  description: { fontFamily: DESIGN.font, color: '#B8ADA7', fontSize: 13, lineHeight: 20 },
});
