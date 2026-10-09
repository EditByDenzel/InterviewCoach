import React, { PropsWithChildren, useState, useId } from 'react';
import { View, Text, Pressable, Image, StyleSheet, Platform, useWindowDimensions, StyleProp, ViewStyle } from 'react-native';
import { Asset } from 'expo-asset';
import { figmaSvg } from './FigmaSvg';
import Svg, { Defs, RadialGradient, Stop, Rect, Circle, SvgXml } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

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

export function DesignFrame({ children, chat = false }: PropsWithChildren<{ chat?: boolean }>) {
  const window = useWindowDimensions();
  const backdropId = `backdrop${useId().replace(/:/g,'')}`;
  const [bounds, setBounds] = useState({ width: 390, height: chat ? 982 : 874 });
  const wide = Platform.OS === 'web' && window.width > 600;
  return <View style={styles.stage}>
    <View onLayout={e => setBounds(e.nativeEvent.layout)} style={[styles.frame, wide && { maxWidth: 390, height: Math.min(chat ? 982 : 874, window.height - 48), flex: undefined, marginVertical: 24 }]}>
      <Svg width={bounds.width} height={bounds.height} style={StyleSheet.absoluteFill}>
        <Defs><RadialGradient id={backdropId} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={10} gradientTransform={`matrix(${chat ? bounds.width * .2864 : bounds.width * .12} 0 0 ${chat ? bounds.width * .2864 : bounds.height * .08} ${bounds.width / 2} ${chat ? -bounds.height * .12 : bounds.height * .18})`}>
          {(chat ? [['0','#E8510C'],['.19','#B13906'],['.38','#7A2100'],['.54','#4A1400'],['.62','#320E00'],['.7','#1A0700'],['.95','#060404']] : [['0','#D74F08'],['.35','#AF3404'],['.525','#762204'],['.7','#3C0F03'],['.85','#250A03'],['1','#0D0402']]).map(([offset,color]) => <Stop key={offset} offset={offset} stopColor={color} />)}
        </RadialGradient></Defs>
        <Rect width="100%" height="100%" fill={`url(#${backdropId})`} />
      </Svg>
      {chat && <LinearGradient pointerEvents="none" colors={['transparent','transparent','rgba(0,0,0,.8)']} style={StyleSheet.absoluteFill} />}
      <SafeAreaView style={styles.safe} edges={['top','bottom']}>
        {Platform.OS === 'web' && <View style={styles.status}>
          <Text style={styles.time}>9:41</Text>
          <View style={styles.statusIcons}>
            <DesignIcon name={chat ? 'chatSignal' : 'homeSignal'} />
            <DesignIcon name={chat ? 'chatWifi' : 'homeWifi'} />
            {chat ? <View style={styles.battery}><View style={styles.batteryInner} /></View> : <View style={{ width: 24, height: 12 }}>
              <View style={{ position: 'absolute', left: 1, top: 1 }}><DesignIcon name="batteryOutline" /></View>
              <View style={{ position: 'absolute', left: 2.5, top: 2.5 }}><DesignIcon name="batteryFill" /></View>
              <View style={{ position: 'absolute', left: 22, top: 4.5 }}><DesignIcon name="batteryTip" /></View>
            </View>}
          </View>
        </View>}
        {children}
        {Platform.OS === 'web' && <View style={styles.homeIndicator}><View style={styles.homePill} /></View>}
      </SafeAreaView>
    </View>
  </View>;
}

export function Orb() {
  const orbId = `orb${useId().replace(/:/g,'')}`;
  return <View style={styles.orb}><Svg width={28} height={28}><Defs><RadialGradient id={orbId} cx="35%" cy="30%" r="95%"><Stop offset="0" stopColor="#FFE29F"/><Stop offset=".3" stopColor="#FF9036"/><Stop offset=".6" stopColor="#D84200"/><Stop offset="1" stopColor="#200400"/></RadialGradient></Defs><Circle cx={14} cy={14} r={14} fill={`url(#${orbId})`} /></Svg></View>;
}

export function GlowButton({ onPress, disabled, recording, size = 68, home = false }: { onPress: () => void; disabled?: boolean; recording?: boolean; size?: number; home?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={home ? 'Start interview' : recording ? 'Stop recording and submit answer' : 'Record answer'} disabled={disabled} onPress={onPress} style={({pressed})=>[{ width:size, height:size, borderRadius:size/2, opacity: disabled ? .45 : pressed ? .8 : 1 }, !home && styles.glow]}>
    <LinearGradient colors={['#FFA742','#FF6220','#C93300']} start={{x:0,y:0}} end={{x:1,y:1}} style={[styles.glowInner, {borderRadius:size/2}]}>
      <DesignIcon name={home ? 'homeMic' : 'mic'} />
    </LinearGradient>
  </Pressable>;
}

export function Waveform({ candidate = false }: { candidate?: boolean }) {
  const heights = candidate ? [6,12,16,20,12,16,20,10,12,16,20,8,12,12,6,12,16,8] : [8,14,20,16,8,20,24,12,16,20,10,16,24,12,8];
  return <View style={[styles.wave, {height:candidate ? 20 : 24}]}>{heights.map((height,i)=><View key={i} style={{ width:candidate ? 2 : 2.5, height, borderRadius:2, backgroundColor: i < 8 ? '#FB923C' : '#71717A', marginRight:candidate ? 2 : 2.5 }} />)}</View>;
}

export function GlassButton({children, onPress, label, style, disabled}: PropsWithChildren<{onPress:()=>void;label:string;style?:StyleProp<ViewStyle>;disabled?:boolean}>) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} style={({pressed})=>[styles.glassButton,style,{opacity:disabled ? .35 : pressed ? .7 : 1}]}>{children}</Pressable>;
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
