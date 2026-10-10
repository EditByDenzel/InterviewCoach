import React, { PropsWithChildren, useState, useId, useEffect, useRef, useMemo } from 'react';
import { View, Text, Animated, Easing, Image, StyleSheet, Platform, useWindowDimensions, StyleProp, ViewStyle, TextStyle, AccessibilityState } from 'react-native';
import { Asset } from 'expo-asset';
import { figmaSvg } from './FigmaSvg';
import Svg, { Defs, RadialGradient, Stop, Rect, Circle, SvgXml, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BreathingHalo, MotionPressable, useMotion } from './Motion';

export const DESIGN = {
  text: '#FFFFFF', muted: '#A1A1AA', orange: '#FF5C1C',
  panel: 'rgba(24,16,12,0.85)', border: 'rgba(255,120,60,0.16)',
  font: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold',
};

const icons = {
  logo: require('../../assets/figma/home-imgSvg.svg'),
  menu: require('../../assets/figma/home-imgSvg1.svg'),
  interview: require('../../assets/figma/home-imgSvg2.svg'),
  architecture: require('../../assets/figma/home-imgSvg3.svg'),
  chevron: require('../../assets/figma/home-imgVector.svg'),
  homeMic: require('../../assets/figma/home-imgSvg4.svg'),
  mic: require('../../assets/figma/chat-imgSvg.svg'),
  send: require('../../assets/figma/chat-imgSvg1.svg'),
  close: require('../../assets/figma/chat-imgSvg2.svg'),
  speaker: require('../../assets/figma/chat-imgSvg3.svg'),
  play: require('../../assets/figma/chat-imgSvg4.svg'),
  collapse: require('../../assets/figma/chat-imgSvg5.svg'),
  check: require('../../assets/figma/chat-imgSvg6.svg'),
  homeSignal: require('../../assets/figma/home-imgSvgCellularSignal.svg'),
  homeWifi: require('../../assets/figma/home-imgVector1.svg'),
  batteryOutline: require('../../assets/figma/home-imgVector2.svg'),
  batteryFill: require('../../assets/figma/home-imgVector3.svg'),
  batteryTip: require('../../assets/figma/home-imgVector4.svg'),
  chatSignal: require('../../assets/figma/chat-imgSvgCellular.svg'),
  chatWifi: require('../../assets/figma/chat-imgVector.svg'),
};

// Root geometry comes from Figma. Wrappers place each asset without stretching it.
const dimensions: Record<keyof typeof icons, [number,number]> = {
  logo:[26,26],menu:[18,18],interview:[20,20],architecture:[20,20],chevron:[10.2083,5.83333],homeMic:[20,20],
  mic:[28,28],send:[20,20],close:[12,12],speaker:[14,14],play:[14,14],collapse:[14,14],check:[12,12],
  homeSignal:[16,14],homeWifi:[14.4,10.2],batteryOutline:[21.8,11.8],batteryFill:[14.5,7],batteryTip:[1,3],chatSignal:[16,14],chatWifi:[17.0355,10.8303],
};
export function DesignIcon({ name }: { name: keyof typeof icons }) {
  const uri = Asset.fromModule(icons[name]).uri;
  const [width,height] = dimensions[name];
  return Platform.OS === 'web' ? <Image source={{uri}} style={{width,height}} /> : <SvgXml xml={figmaSvg[name]} />;
}

export function ProfileIcon({ size = 22, color = '#FFF' }: { size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="7.5" r="4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M4.5 19.5c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

export function DesignFrame({ children, chat = false }: PropsWithChildren<{ chat?: boolean }>) {
  const window = useWindowDimensions();
  const backdropId = `backdrop${useId().replace(/:/g,'')}`;
  const [bounds, setBounds] = useState({ width: 390, height: chat ? 982 : 874 });
  const wide = Platform.OS === 'web' && window.width > 600;
  return <View style={styles.stage}>
    <View onLayout={e => setBounds(e.nativeEvent.layout)} style={[styles.frame, wide && { maxWidth: 390, height: Math.min(900, window.height - 48), flex: undefined, marginVertical: 24 }]}>
      <Svg width={bounds.width} height={bounds.height} style={StyleSheet.absoluteFill}>
        <Defs><RadialGradient id={backdropId} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={10} gradientTransform={`matrix(${chat ? bounds.width * .2864 : bounds.width * .12} 0 0 ${chat ? bounds.width * .2864 : bounds.height * .08} ${bounds.width / 2} ${chat ? -bounds.height * .12 : bounds.height * .18})`}>
          {(chat ? [['0','#E8510C'],['.19','#B13906'],['.38','#7A2100'],['.54','#4A1400'],['.62','#320E00'],['.7','#1A0700'],['.95','#060404']] : [['0','#D74F08'],['.35','#AF3404'],['.525','#762204'],['.7','#3C0F03'],['.85','#250A03'],['1','#0D0402']]).map(([offset,color]) => <Stop key={offset} offset={offset} stopColor={color} />)}
        </RadialGradient></Defs>
        <Rect width="100%" height="100%" fill={`url(#${backdropId})`} />
      </Svg>
      {chat && <LinearGradient pointerEvents="none" colors={['transparent','transparent','rgba(0,0,0,.8)']} style={StyleSheet.absoluteFill} />}
      <SafeAreaView style={styles.safe} edges={['top','bottom']}>
        {children}

      </SafeAreaView>
    </View>
  </View>;
}

export function Orb({ size = 28 }: { size?: number }) {
  return <View style={[styles.orb, { width: size, height: size, borderRadius: size / 2 }]}>
    <Image source={require('../../assets/figma/mini_orb.png')} style={{ width: size, height: size }} resizeMode="contain" />
  </View>;
}

export function HeroOrb({ size = 176 }: { size?: number }) {
  const { reduced, foreground } = useMotion();
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    float.setValue(0);
    if (reduced || !foreground) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
        Animated.timing(float, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [float, reduced, foreground]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const scale = float.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.025, 1] });

  return <View style={[styles.heroOrbContainer, { width: size, height: size }]}>
    <View style={[styles.heroOrbGlow, { width: size * 1.4, height: size * 1.4, borderRadius: (size * 1.4) / 2 }]} />
    <Animated.Image
      source={require('../../assets/figma/hero_orb.png')}
      style={[{ width: size, height: size, transform: [{ translateY: reduced ? 0 : translateY }, { scale: reduced ? 1 : scale }] }]}
      resizeMode="contain"
    />
  </View>;
}

export function GlowButton({ onPress, disabled, recording, paused, size = 68, home = false, level = 0 }: { onPress: () => void; disabled?: boolean; recording?: boolean; paused?: boolean; size?: number; home?: boolean; level?: number }) {
  const haloSize = size + 24;
  return <BreathingHalo size={haloSize} active={!disabled && !paused} recording={recording} level={level}>
    <MotionPressable accessibilityRole="button" accessibilityLabel={home ? 'Start interview' : recording ? 'Stop recording and submit answer' : 'Record answer'} disabled={disabled} onPress={onPress} style={[{ width: size, height: size, borderRadius: size / 2 }, !home && styles.glow]}>
      <LinearGradient colors={['#E03A00', '#FF621E', '#FFA742']} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} style={[styles.glowInner, { borderRadius: size / 2 }]}>
        <DesignIcon name={home ? 'homeMic' : 'mic'} />
      </LinearGradient>
    </MotionPressable>
  </BreathingHalo>;
}

const AI_WAVE_HEIGHTS = [8, 14, 20, 16, 8, 20, 24, 12, 16, 20, 10, 16, 24, 12, 8, 18, 22, 14, 10, 16];
const CANDIDATE_WAVE_HEIGHTS = [6, 12, 16, 20, 12, 16, 20, 10, 12, 16, 20, 8, 12, 12, 6, 12, 16, 8, 14, 18];

export function Waveform({ candidate = false, active = false, progress = 0 }: { candidate?: boolean; active?: boolean; progress?: number }) {
  const { reduced, foreground } = useMotion();
  const [containerWidth, setContainerWidth] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulse.setValue(0);
    if (!active || reduced || !foreground) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false }),
      Animated.timing(pulse, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web', isInteraction: false })
    ]));
    animation.start(); return () => animation.stop();
  }, [active, reduced, foreground, pulse]);

  const step = candidate ? 7 : 5;
  const count = containerWidth > 0 ? Math.max(16, Math.floor(containerWidth / step)) : 34;
  const heights = useMemo(() => {
    const base = candidate ? CANDIDATE_WAVE_HEIGHTS : AI_WAVE_HEIGHTS;
    const res: number[] = [];
    for (let i = 0; i < count; i++) {
      res.push(base[i % base.length]);
    }
    return res;
  }, [count, candidate]);

  return (
    <View
      testID="audio-waveform"
      accessible={false}
      onLayout={(e) => {
        const w = Math.round(e.nativeEvent.layout.width);
        if (w > 0 && Math.abs(w - containerWidth) > 4) {
          setContainerWidth(w);
        }
      }}
      style={[
        styles.wave,
        {
          height: 26,
          width: '100%',
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
      ]}
    >
      {heights.map((baseH, i) => {
        const isPlayed = progress > 0 ? (i + 1) / count <= progress : active;
        const activeColor = '#FB923C';
        const inactiveColor = candidate ? 'rgba(251,146,60,0.45)' : '#52525B';
        const barColor = isPlayed ? activeColor : inactiveColor;
        return (
          <Animated.View
            key={i}
            style={{
              width: 2,
              height: baseH,
              borderRadius: 2,
              backgroundColor: barColor,
              transform: [{
                scaleY: active && !reduced ? pulse.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: i % 3 === 0 ? [0.6, 1.25, 0.8] : i % 3 === 1 ? [1.1, 0.65, 1.2] : [0.8, 1.2, 0.6]
                }) : 1
              }]
            }}
          />
        );
      })}
    </View>
  );
}

export function ProgressiveSpokenText({
  text,
  progress = 0,
  active = false,
  style,
}: {
  text: string;
  progress?: number;
  active?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  if (!text) return null;
  if (!active) {
    return <Text style={style}>{text}</Text>;
  }

  const tokens = text.split(/(\s+)/);
  const wordsOnly = tokens.filter((t) => t.trim().length > 0);
  const totalWords = wordsOnly.length;
  const currentWordIndex = Math.min(totalWords - 1, Math.floor(progress * totalWords));

  let wordCount = 0;
  return (
    <Text style={style}>
      {tokens.map((token, i) => {
        if (!token.trim()) {
          return <Text key={i}>{token}</Text>;
        }
        const isSpoken = wordCount <= currentWordIndex;
        wordCount++;
        return (
          <Text
            key={i}
            style={{
              color: isSpoken ? '#FFFFFF' : 'rgba(255, 255, 255, 0.38)',
              fontWeight: isSpoken ? '700' : '400',
              textShadowColor: isSpoken ? 'rgba(255, 255, 255, 0.25)' : 'transparent',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: isSpoken ? 3 : 0,
            }}
          >
            {token}
          </Text>
        );
      })}
    </Text>
  );
}

export function TranscriptionIcon({ open = false }: { open?: boolean }) {
  const color = open ? '#FF9E60' : '#D4C4BA';
  return (
    <View style={styles.transcribeBadge}>
      <Svg width={9} height={9} viewBox="0 0 10 10" fill="none">
        <Path d="M1 5h6.5m-2.5-2.5L7.5 5 5 7.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Text style={[styles.transcribeLetter, { color }]}>A</Text>
    </View>
  );
}

export function VoiceSettingsIcon({ size = 18, color = '#FFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />
    </Svg>
  );
}

export function RetryIcon({ size = 18, color = '#FFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <Path d="M3 3v5h5" />
    </Svg>
  );
}

export function TrashIcon({ size = 16, color = '#FF7B60' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
    </Svg>
  );
}

export function GlassButton({ children, onPress, label, style, disabled, accessibilityState }: PropsWithChildren<{ onPress: () => void; label: string; style?: StyleProp<ViewStyle>; disabled?: boolean; accessibilityState?: AccessibilityState }>) {
  return <MotionPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={accessibilityState} onPress={onPress} disabled={disabled} style={[styles.glassButton, style]}>{children}</MotionPressable>;
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: '#100A07', alignItems: 'center' },
  frame: { flex: 1, width: '100%', overflow: 'hidden', backgroundColor: '#0D0402' },
  safe: { flex: 1 },
  status: { height: 40, paddingHorizontal: 24, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  statusIcons: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 16 },
  battery: { width: 20, height: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,.7)', borderRadius: 3, padding: 2 },
  batteryInner: { flex: 1, backgroundColor: '#FFF', borderRadius: 1.5 },
  homeIndicator: { height: 18, alignItems: 'center', justifyContent: 'center' },
  homePill: { width: 136, height: 4.5, borderRadius: 99, backgroundColor: 'rgba(255,255,255,.45)' },
  orb: { width: 28, height: 28, borderRadius: 14, shadowColor: '#FF6E1E', shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  heroOrbContainer: { alignItems: 'center', justifyContent: 'center' },
  heroOrbGlow: { position: 'absolute', backgroundColor: 'rgba(255,92,28,0.28)', shadowColor: '#FF5C1C', shadowRadius: 45, shadowOpacity: 0.9, shadowOffset: { width: 0, height: 0 }, elevation: 12 },
  heroOrbImage: { width: 176, height: 176 },
  glow: { shadowColor: '#FF5A14', shadowOffset: { width: 0, height: 0 }, shadowRadius: 20, shadowOpacity: 0.8, elevation: 8 },
  glowInner: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,180,80,.5)' },
  wave: { flexDirection: 'row', alignItems: 'center' },
  glassButton: { backgroundColor: 'rgba(255,255,255,.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,.1)', borderRadius: 99, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  transcribeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  transcribeLetter: { fontSize: 11, fontFamily: DESIGN.semibold, fontWeight: '700', lineHeight: 12 },
});
