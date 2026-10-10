import React, { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { SavedConversation } from '../types';
import { DESIGN, DesignIcon, TrashIcon } from './CoachieDesign';
import { deleteConversation } from '../store/conversationLibrary';
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const deletePending = useRef(false);
  const alive = useRef(true);
  const panel = useRef<View>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    if (!open) { setConfirmDeleteId(null); setDeleteError(''); }
  }, [open]);

  useEffect(() => {
    if (!open || !mounted) return;
    if (Platform.OS !== 'web') {
      const listener = BackHandler.addEventListener('hardwareBackPress', () => { close.current(); return true; });
      return () => listener.remove();
    }
    const element = panel.current as unknown as HTMLElement | null;
    if (!element) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')).filter(item => item.getAttribute('aria-disabled') !== 'true' && item.getClientRects().length > 0);
    focusable()[0]?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const targets = focusable();
      if (!targets.length) { event.preventDefault(); return; }
      const first = targets[0], last = targets[targets.length - 1];
      if (!element.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open, mounted]);

  useEffect(() => {
    if (open) setMounted(true);
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: reduced ? 0 : open ? 260 : 180,
      easing: easeDrawer,
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    animation.start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
    return () => animation.stop();
  }, [open, progress, reduced]);

  const handleDelete = async (id: string, e?: any) => {
    e?.stopPropagation?.();
    if (deletePending.current) return;
    if (confirmDeleteId === id) {
      deletePending.current = true;
      setDeletingId(id);
      setDeleteError('');
      try {
        await deleteConversation(id);
        if (!alive.current) return;
        setConfirmDeleteId(null);
        onRetry();
      } catch (_) {
        if (alive.current) setDeleteError('Could not delete this conversation. Please try again.');
      } finally {
        deletePending.current = false;
        if (alive.current) setDeletingId(null);
      }
    } else {
      setConfirmDeleteId(id);
    }
  };

  // Find index of most recent non-sample conversation
  const mostRecentId = conversations.find((c) => !c.isSample)?.id || conversations[0]?.id;

  if (!mounted) return null;

  const panelWidth = Math.min(320, window.width * 0.84);

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlayWrapper]} pointerEvents={open ? 'auto' : 'none'}>
      {/* Dim Backdrop inside phone frame */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: '#000',
            opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.72] }),
          },
        ]}
      >
        <MotionPressable accessible={false} aria-hidden focusable={false} onPress={onClose} style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* Drawer Panel inside phone frame */}
      <Animated.View
        ref={panel}
        accessibilityViewIsModal={open}
        accessibilityLabel="Conversation history"
        aria-hidden={!open}
        style={[
          styles.panel,
          {
            width: panelWidth,
            opacity: reduced ? progress : 1,
            transform: [
              {
                translateX: reduced
                  ? 0
                  : progress.interpolate({ inputRange: [0, 1], outputRange: [-panelWidth - 10, 0] }),
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
                  <Text style={styles.caption}>Your saved conversations</Text>
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
                    accessibilityLabel="Start a new conversation"
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
                    <Text style={styles.newButtonText}>+ New conversation</Text>
                  </MotionPressable>
                </View>
              )}

              <ScrollView
                style={{ flex: 1, minHeight: 0 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.list}
              >
                {!!deleteError && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.description, { padding: 12, color: '#FCA5A5' }]}>{deleteError}</Text>}
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
                      Start a scenario and your conversations and comparison will appear here.
                    </Text>
                  </View>
                ) : (
                  conversations.map((item) => {
                    const isLatest = item.id === mostRecentId && !item.isSample;
                    return (
                      <View key={item.id} style={[styles.item, isLatest && styles.itemLatest, { padding: 0 }]}>
                      <MotionPressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open conversation: ${item.topic}`}
                        onPress={() => onSelect(item.id)}
                        style={{ padding: 16, gap: 8, borderRadius: 16 }}
                      >
                        <View style={styles.itemHeaderRow}>
                          <Text numberOfLines={2} style={[styles.itemTitle, { paddingRight: confirmDeleteId === item.id ? 64 : 44 }, isLatest && { color: '#FFF' }]}>
                            {item.topic}
                          </Text>
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
                      <View style={[styles.actionsCluster, { position: 'absolute', top: 10, right: 10 }]}>
                        {isLatest && <View pointerEvents="none" style={styles.recentDot} />}
                        <MotionPressable accessibilityRole="button" accessibilityLabel={`Delete conversation: ${item.topic}`} disabled={deletingId !== null} onPress={(e) => handleDelete(item.id, e)} style={[styles.deleteButton, confirmDeleteId === item.id && styles.deleteButtonConfirm]}>
                          {confirmDeleteId === item.id ? <Text style={styles.deleteConfirmLabel}>{deletingId === item.id ? 'Deleting…' : 'Delete?'}</Text> : <TrashIcon size={14} color="#9E928A" />}
                        </MotionPressable>
                      </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  panel: {
    height: '100%',
    overflow: 'hidden',
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
  actionsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteButton: {
    minWidth: 36,
    minHeight: 36,
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonConfirm: {
    backgroundColor: 'rgba(239,68,68,0.22)',
    paddingHorizontal: 8,
  },
  deleteConfirmLabel: {
    fontFamily: DESIGN.medium,
    fontSize: 11,
    color: '#F87171',
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
