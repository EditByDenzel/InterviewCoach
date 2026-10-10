import React, { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, Platform, Pressable, PressableProps, StyleProp, StyleSheet, ViewStyle, View } from 'react-native';
import { designPreviewEnabled } from '../dev/designPreview';

export const easeOut = Easing.bezier(.23, 1, .32, 1);
export const easeDrawer = Easing.bezier(.32, .72, 0, 1);
const MotionContext = createContext({ reduced: true, canHover: false, foreground: true });
export const useMotion = () => useContext(MotionContext);

export function MotionProvider({ children }: PropsWithChildren) {
  const [reduced, setReduced] = useState(true);
  const [canHover, setCanHover] = useState(false);
  const [foreground, setForeground] = useState(true);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const update = () => setForeground(document.visibilityState !== 'hidden');
      update();
      document.addEventListener('visibilitychange', update);
      return () => document.removeEventListener('visibilitychange', update);
    }
    setForeground(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
    const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window.matchMedia !== 'function') return;
      const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
      const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
      // A development-only override lets the silent fixture exercise accessibility
      // behavior without changing the tester's operating-system preferences.
      const forceReduced = designPreviewEnabled && new URLSearchParams(window.location.search).get('reducedMotion') === '1';
      const update = () => { setReduced(forceReduced || preference.matches); setCanHover(pointer.matches); };
      update(); preference.addEventListener('change', update); pointer.addEventListener('change', update);
      return () => { preference.removeEventListener('change', update); pointer.removeEventListener('change', update); };
    }
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; listener.remove(); };
  }, []);
  return <MotionContext.Provider value={{ reduced, canHover, foreground }}>{children}</MotionContext.Provider>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
type Props = Omit<PressableProps, 'style' | 'children'> & PropsWithChildren<{ style?: StyleProp<ViewStyle>; lift?: boolean }>;
export function MotionPressable({ children, style, lift = false, disabled, onPressIn, onPressOut, onHoverIn, onHoverOut, onFocus, onBlur, ...props }: Props) {
  const { reduced, canHover } = useMotion();
  const [hover, setHover] = useState(false), [pressed, setPressed] = useState(false), [focus, setFocus] = useState(false);
  const press = useRef(new Animated.Value(0)).current;
  const highlight = useRef(new Animated.Value(0)).current;
  const shape = (StyleSheet.flatten(style) || {}) as ViewStyle;
  const radius = shape.borderRadius ?? 0;
  const tl = shape.borderTopLeftRadius ?? radius;
  const tr = shape.borderTopRightRadius ?? radius;
  const bl = shape.borderBottomLeftRadius ?? radius;
  const br = shape.borderBottomRightRadius ?? radius;
  const highlighted = !disabled && ((canHover && hover) || focus);
  const webFeedback = Platform.OS === 'web' ? ({
    opacity: disabled ? .4 : pressed ? .88 : 1,
    transform: [{ scale: !reduced && pressed && !disabled ? .97 : 1 }, { translateY: lift && !reduced && highlighted ? -2 : 0 }],
    transitionProperty: 'transform, opacity',
    transitionDuration: reduced ? '0ms' : pressed ? '100ms' : '160ms',
    transitionTimingFunction: 'cubic-bezier(.23,1,.32,1)',
  } as ViewStyle) : undefined;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const animation = Animated.timing(press, { toValue: pressed && !disabled ? 1 : 0, duration: reduced ? 0 : pressed ? 100 : 160, easing: easeOut, useNativeDriver: true, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [pressed, disabled, reduced, press]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const animation = Animated.timing(highlight, { toValue: !disabled && ((canHover && hover) || focus) ? 1 : 0, duration: reduced ? 0 : 140, easing: easeOut, useNativeDriver: true, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [hover, focus, canHover, disabled, reduced, highlight]);
  return <AnimatedPressable {...props} disabled={disabled} aria-pressed={props.accessibilityState?.selected} aria-checked={props.accessibilityState?.checked} accessibilityState={{...props.accessibilityState, disabled:!!disabled}}
    onPressIn={e=>{setPressed(!String((e.nativeEvent as any).type || '').startsWith('key'));onPressIn?.(e);}} onPressOut={e=>{setPressed(false);onPressOut?.(e);}}
    onHoverIn={e=>{if(canHover)setHover(true);onHoverIn?.(e);}} onHoverOut={e=>{setHover(false);onHoverOut?.(e);}}
    onFocus={e=>{setFocus(Platform.OS!=='web'||!!(e.target as unknown as HTMLElement)?.matches?.(':focus-visible'));onFocus?.(e);}} onBlur={e=>{setFocus(false);setPressed(false);onBlur?.(e);}}
    style={[style, webFeedback || { opacity: disabled ? .4 : press.interpolate({inputRange:[0,1],outputRange:[1,.88]}), transform:[{scale:reduced?1:press.interpolate({inputRange:[0,1],outputRange:[1,.97]})},{translateY:lift&&!reduced?highlight.interpolate({inputRange:[0,1],outputRange:[0,-2]}):0}] }, focus && Platform.OS==='web' && ({boxShadow:'0 0 0 2px #FFB083'} as ViewStyle)]}>
    <Animated.View pointerEvents="none" style={{position:'absolute',top:0,right:0,bottom:0,left:0,borderRadius:radius,borderTopLeftRadius:tl,borderTopRightRadius:tr,borderBottomLeftRadius:bl,borderBottomRightRadius:br,backgroundColor:'#FFF',opacity:Platform.OS==='web'?(highlighted ? .07 : 0):highlight.interpolate({inputRange:[0,1],outputRange:[0,.07]}),...(Platform.OS==='web'?{transitionProperty:'opacity',transitionDuration:reduced?'0ms':'140ms',transitionTimingFunction:'ease'}:{})} as ViewStyle}/>
    {children}
  </AnimatedPressable>;
}

export function FadeIn({ children, style }: PropsWithChildren<{style?:StyleProp<ViewStyle>}>) {
  const {reduced}=useMotion();
  const progress=useRef(new Animated.Value(reduced?1:0)).current;
  useEffect(()=>{const animation=Animated.timing(progress,{toValue:1,duration:reduced?0:220,easing:easeOut,useNativeDriver:Platform.OS!=='web'});animation.start();return()=>animation.stop();},[progress,reduced]);
  return <Animated.View style={[style,{opacity:progress,transform:[{translateY:reduced?0:progress.interpolate({inputRange:[0,1],outputRange:[8,0]})}]}]}>{children}</Animated.View>;
}

export function LiveDots({active}:{active:boolean}) {
  const {reduced,foreground}=useMotion();
  const values=useRef([new Animated.Value(1),new Animated.Value(1),new Animated.Value(1)]).current;
  useEffect(()=>{
    if(!active||reduced||!foreground){values.forEach(value=>value.setValue(1));return;}
    const animations=values.map((value,index)=>Animated.loop(Animated.sequence([Animated.delay(index*100),Animated.timing(value,{toValue:.3,duration:400,easing:Easing.inOut(Easing.sin),useNativeDriver:Platform.OS!=='web',isInteraction:false}),Animated.timing(value,{toValue:1,duration:400,easing:Easing.inOut(Easing.sin),useNativeDriver:Platform.OS!=='web',isInteraction:false})])));
    animations.forEach(animation=>animation.start());return()=>animations.forEach(animation=>animation.stop());
  },[active,reduced,foreground,values]);
  if(!active)return null;
  return <View accessible={false} style={{flexDirection:'row',gap:4,height:12,alignItems:'center'}}>{values.map((opacity,index)=><Animated.View key={index} style={{width:4,height:4,borderRadius:2,backgroundColor:'#FB923C',opacity,transform:[{translateY:reduced?0:opacity.interpolate({inputRange:[.3,1],outputRange:[2,-2]})}]}}/>)}</View>;
}

export function BreathingHalo({
  size,
  active,
  recording,
  level = 0,
  children,
}: PropsWithChildren<{ size: number; active: boolean; recording?: boolean; level?: number }>) {
  const { reduced, foreground } = useMotion();
  const breath = useRef(new Animated.Value(0)).current;
  const audioAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    breath.setValue(0);
    if (!active || reduced || !foreground) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: recording ? 800 : 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: recording ? 800 : 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
          isInteraction: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [active, reduced, foreground, recording, breath]);

  useEffect(() => {
    const animation = Animated.timing(audioAnim, {
      toValue: active && recording && !reduced && foreground && Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0,
      duration: reduced ? 0 : 90,
      easing: easeOut,
      useNativeDriver: Platform.OS !== 'web',
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [active, level, recording, reduced, foreground, audioAnim]);

  const haloScale = Animated.add(
    breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }),
    audioAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] })
  );

  const haloOpacity = Animated.add(
    breath.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.22] }),
    audioAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] })
  );

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size + 16,
          height: size + 16,
          borderRadius: (size + 16) / 2,
          backgroundColor: '#FF751E',
          opacity: active ? haloOpacity : 0,
          transform: [{ scale: reduced ? 1 : haloScale }],
          shadowColor: '#FF641C',
          shadowRadius: 24,
          shadowOpacity: 0.9,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
      {children}
    </View>
  );
}

export function Reveal({open,children}:PropsWithChildren<{open:boolean}>) {
  const {reduced}=useMotion();
  const [height,setHeight]=useState(0);
  const size=useRef(new Animated.Value(0)).current;
  const opacity=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    const animation=Animated.parallel([
      Animated.timing(size,{toValue:open?height:0,duration:reduced?0:200,easing:easeOut,useNativeDriver:false}),
      Animated.timing(opacity,{toValue:open?1:0,duration:reduced?0:160,easing:easeOut,useNativeDriver:false}),
    ]);animation.start();return()=>animation.stop();
  },[open,height,reduced,size,opacity]);
  return <Animated.View aria-hidden={!open} accessibilityElementsHidden={!open} importantForAccessibility={open?'auto':'no-hide-descendants'} style={{height:size,overflow:'hidden',opacity}}>
    <View onLayout={event=>setHeight(event.nativeEvent.layout.height)} style={{position:'absolute',left:0,right:0,top:0}}>{children}</View>
  </Animated.View>;
}
