import React, { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, PressableProps, StyleProp, ViewStyle, View } from 'react-native';

export const easeOut = Easing.bezier(.23, 1, .32, 1);
export const easeDrawer = Easing.bezier(.32, .72, 0, 1);
const MotionContext = createContext({ reduced: true, canHover: false });
export const useMotion = () => useContext(MotionContext);

export function MotionProvider({ children }: PropsWithChildren) {
  const [reduced, setReduced] = useState(true);
  const [canHover, setCanHover] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
      const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
      const update = () => { setReduced(preference.matches); setCanHover(pointer.matches); };
      update(); preference.addEventListener('change', update); pointer.addEventListener('change', update);
      return () => { preference.removeEventListener('change', update); pointer.removeEventListener('change', update); };
    }
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduced(value); });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; listener.remove(); };
  }, []);
  return <MotionContext.Provider value={{ reduced, canHover }}>{children}</MotionContext.Provider>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
type Props = Omit<PressableProps, 'style' | 'children'> & PropsWithChildren<{ style?: StyleProp<ViewStyle>; lift?: boolean }>;
export function MotionPressable({ children, style, lift = false, disabled, onPressIn, onPressOut, onHoverIn, onHoverOut, onFocus, onBlur, ...props }: Props) {
  const { reduced, canHover } = useMotion();
  const [hover, setHover] = useState(false), [pressed, setPressed] = useState(false), [focus, setFocus] = useState(false);
  const press = useRef(new Animated.Value(0)).current;
  const highlight = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(press, { toValue: pressed && !disabled ? 1 : 0, duration: reduced ? 0 : 120, easing: easeOut, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [pressed, disabled, reduced, press]);
  useEffect(() => {
    Animated.timing(highlight, { toValue: !disabled && (hover || focus) ? 1 : 0, duration: reduced ? 0 : 140, easing: easeOut, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [hover, focus, disabled, reduced, highlight]);
  return <AnimatedPressable {...props} disabled={disabled} accessibilityState={{...props.accessibilityState, disabled:!!disabled}}
    onPressIn={e=>{setPressed(true);onPressIn?.(e);}} onPressOut={e=>{setPressed(false);onPressOut?.(e);}}
    onHoverIn={e=>{if(canHover)setHover(true);onHoverIn?.(e);}} onHoverOut={e=>{setHover(false);onHoverOut?.(e);}}
    onFocus={e=>{setFocus(true);onFocus?.(e);}} onBlur={e=>{setFocus(false);setPressed(false);onBlur?.(e);}}
    style={[style, { opacity: disabled ? .4 : press.interpolate({inputRange:[0,1],outputRange:[1,.88]}), transform:[{scale:reduced?1:press.interpolate({inputRange:[0,1],outputRange:[1,.96]})},{translateY:lift&&!reduced?highlight.interpolate({inputRange:[0,1],outputRange:[0,-2]}):0}] }, focus && Platform.OS==='web' && ({outline:'2px solid #FFB083',outlineOffset:3} as ViewStyle)]}>
    <Animated.View pointerEvents="none" style={{position:'absolute',top:0,right:0,bottom:0,left:0,borderRadius:24,backgroundColor:'#FFF',opacity:highlight.interpolate({inputRange:[0,1],outputRange:[0,.07]})}}/>
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
  const {reduced}=useMotion();
  const values=useRef([new Animated.Value(1),new Animated.Value(1),new Animated.Value(1)]).current;
  useEffect(()=>{
    if(!active||reduced){values.forEach(value=>value.setValue(1));return;}
    const animations=values.map((value,index)=>Animated.loop(Animated.sequence([Animated.delay(index*100),Animated.timing(value,{toValue:.3,duration:400,useNativeDriver:Platform.OS!=='web'}),Animated.timing(value,{toValue:1,duration:400,useNativeDriver:Platform.OS!=='web'})])));
    animations.forEach(animation=>animation.start());return()=>animations.forEach(animation=>animation.stop());
  },[active,reduced,values]);
  if(!active)return null;
  return <View accessible={false} style={{flexDirection:'row',gap:4,height:12,alignItems:'center'}}>{values.map((opacity,index)=><Animated.View key={index} style={{width:4,height:4,borderRadius:2,backgroundColor:'#FB923C',opacity,transform:[{translateY:reduced?0:opacity.interpolate({inputRange:[.3,1],outputRange:[2,-2]})}]}}/>)}</View>;
}

export function BreathingHalo({size,active,recording,children}:PropsWithChildren<{size:number;active:boolean;recording?:boolean}>) {
  const {reduced}=useMotion();
  const breath=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    breath.setValue(0);
    if(!active||reduced)return;
    const animation=Animated.loop(Animated.sequence([
      Animated.timing(breath,{toValue:1,duration:recording?800:1400,easing:Easing.inOut(Easing.sin),useNativeDriver:Platform.OS!=='web',isInteraction:false}),
      Animated.timing(breath,{toValue:0,duration:recording?800:1400,easing:Easing.inOut(Easing.sin),useNativeDriver:Platform.OS!=='web',isInteraction:false}),
    ]));animation.start();return()=>animation.stop();
  },[active,reduced,recording,breath]);
  return <View style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}>
    <Animated.View pointerEvents="none" style={{position:'absolute',width:size+16,height:size+16,borderRadius:(size+16)/2,backgroundColor:'#FF751E',opacity:active?breath.interpolate({inputRange:[0,1],outputRange:[.08,.2]}):0,transform:[{scale:breath.interpolate({inputRange:[0,1],outputRange:[1,1.17]})}],shadowColor:'#FF641C',shadowRadius:20,shadowOpacity:.8,shadowOffset:{width:0,height:0}}}/>
    {children}
  </View>;
}

export function Reveal({open,children}:PropsWithChildren<{open:boolean}>) {
  const {reduced}=useMotion();
  const [height,setHeight]=useState(0);
  const size=useRef(new Animated.Value(0)).current;
  const opacity=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    const animation=Animated.parallel([
      Animated.timing(size,{toValue:open?height:0,duration:reduced?0:200,easing:easeOut,useNativeDriver:false}),
      Animated.timing(opacity,{toValue:open?1:0,duration:reduced?0:160,useNativeDriver:false}),
    ]);animation.start();return()=>animation.stop();
  },[open,height,reduced,size,opacity]);
  return <Animated.View aria-hidden={!open} accessibilityElementsHidden={!open} importantForAccessibility={open?'auto':'no-hide-descendants'} style={{height:size,overflow:'hidden',opacity}}>
    <View onLayout={event=>setHeight(event.nativeEvent.layout.height)} style={{position:'absolute',left:0,right:0,top:0}}>{children}</View>
  </Animated.View>;
}
