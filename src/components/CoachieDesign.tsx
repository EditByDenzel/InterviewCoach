import React, { PropsWithChildren, useState, useId, useEffect, useRef } from 'react';
import { View, Animated, Easing, Image, StyleSheet, Platform, useWindowDimensions, StyleProp, ViewStyle } from 'react-native';
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

export function Orb() {
  const orbId = `orb${useId().replace(/:/g,'')}`;
  return <View style={styles.orb}><Svg width={28} height={28}><Defs><RadialGradient id={orbId} cx="35%" cy="30%" r="95%"><Stop offset="0" stopColor="#FFE29F"/><Stop offset=".3" stopColor="#FF9036"/><Stop offset=".6" stopColor="#D84200"/><Stop offset="1" stopColor="#200400"/></RadialGradient></Defs><Circle cx={14} cy={14} r={14} fill={`url(#${orbId})`} /></Svg></View>;
}

export function GlowButton({ onPress, disabled, recording, paused, size = 68, home = false }: { onPress: () => void; disabled?: boolean; recording?: boolean; paused?:boolean; size?: number; home?: boolean }) {
  return <BreathingHalo size={size} active={!disabled&&!paused} recording={recording}><MotionPressable accessibilityRole="button" accessibilityLabel={home ? 'Start interview' : recording ? 'Stop recording and submit answer' : 'Record answer'} disabled={disabled} onPress={onPress} style={[{ width:size, height:size, borderRadius:size/2 }, !home && styles.glow]}>
    <LinearGradient colors={['#FFA742','#FF6220','#C93300']} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.glowInner, {borderRadius:size/2}]}>
      <DesignIcon name={home ? 'homeMic' : 'mic'} />
    </LinearGradient>
  </MotionPressable></BreathingHalo>;
}

export function Waveform({ candidate = false, active=false, progress=0 }: { candidate?: boolean;active?:boolean;progress?:number }) {
  const {reduced}=useMotion();
  const [width,setWidth]=useState(120);
  const pulse=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    pulse.setValue(0);
    if(!active||reduced)return;
    const animation=Animated.loop(Animated.sequence([Animated.timing(pulse,{toValue:1,duration:480,easing:Easing.inOut(Easing.sin),useNativeDriver:Platform.OS!=='web',isInteraction:false}),Animated.timing(pulse,{toValue:0,duration:480,easing:Easing.inOut(Easing.sin),useNativeDriver:Platform.OS!=='web',isInteraction:false})]));
    animation.start();return()=>animation.stop();
  },[active,reduced,pulse]);
  const count=Math.max(8,Math.floor(width/5));
  return <View testID="audio-waveform" accessible={false} onLayout={event=>setWidth(event.nativeEvent.layout.width)} style={[styles.wave,{height:26,justifyContent:'space-between',overflow:'hidden'}]}>{Array.from({length:count},(_,i)=>{
    const height=5+((i*7+(candidate?3:0))%20);
    return <Animated.View key={i} style={{width:2,height,borderRadius:2,backgroundColor:(i+1)/count<=progress?'#FB923C':'#88796F',transform:[{scaleY:active&&!reduced?pulse.interpolate({inputRange:[0,.5,1],outputRange:i%3===0?[.45,1.2,.7]:i%3===1?[1,.5,1.15]:[.7,1.1,.4]}):1}]}}/>;
  })}</View>;
}

export function TranscriptionIcon({open=false}:{open?:boolean}) {
  return <Svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke={open?'#FFAB72':'#D8C3B5'} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 12h7m-3-3 3 3-3 3m6 3 4-12 4 12m-6.5-4h5"/></Svg>;
}

export function GlassButton({children, onPress, label, style, disabled}: PropsWithChildren<{onPress:()=>void;label:string;style?:StyleProp<ViewStyle>;disabled?:boolean}>) {
  return <MotionPressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} style={[styles.glassButton,style]}>{children}</MotionPressable>;
}

const styles = StyleSheet.create({
  stage:{flex:1,backgroundColor:'#100A07',alignItems:'center'},frame:{flex:1,width:'100%',overflow:'hidden',backgroundColor:'#0D0402'},safe:{flex:1},
  status:{height:40,paddingHorizontal:24,paddingTop:12,flexDirection:'row',justifyContent:'space-between'},time:{color:'#FFF',fontSize:15,fontWeight:'700'},statusIcons:{flexDirection:'row',alignItems:'center',gap:6,height:16},
  battery:{width:20,height:10,borderWidth:1,borderColor:'rgba(255,255,255,.7)',borderRadius:3,padding:2},batteryInner:{flex:1,backgroundColor:'#FFF',borderRadius:1.5},
  homeIndicator:{height:18,alignItems:'center',justifyContent:'center'},homePill:{width:136,height:4.5,borderRadius:99,backgroundColor:'rgba(255,255,255,.45)'},
  orb:{width:28,height:28,borderRadius:14,shadowColor:'#FF6E1E',shadowOpacity:.6,shadowRadius:14,shadowOffset:{width:0,height:0}},
  glow:{shadowColor:'#FF5A14',shadowOffset:{width:0,height:0},shadowRadius:20,shadowOpacity:.8,elevation:8},glowInner:{flex:1,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'rgba(255,180,80,.5)'},
  wave:{flexDirection:'row',alignItems:'center',flex:1},glassButton:{backgroundColor:'rgba(255,255,255,.1)',borderWidth:1,borderColor:'rgba(255,255,255,.1)',borderRadius:99,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6},
});
