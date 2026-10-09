import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { DESIGN } from './CoachieDesign';
import { easeOut, MotionPressable, useMotion } from './Motion';

export function TopicComposer({value,onChange,onSend}:{value:string;onChange:(value:string)=>void;onSend:()=>void}) {
  const {reduced}=useMotion();
  const [focused,setFocused]=useState(false),[contentHeight,setContentHeight]=useState(24);
  const input=useRef<TextInput>(null);
  const [width,setWidth]=useState(0);
  const height=useRef(new Animated.Value(72)).current;
  const glow=useRef(new Animated.Value(0)).current;
  const target=contentHeight<=30?72:Math.min(252,contentHeight+82);
  useLayoutEffect(()=>{
    if(Platform.OS!=='web')return;
    // Measure the actual textarea, including unbroken words and trailing newlines.
    const element=input.current as unknown as HTMLTextAreaElement|null;
    if(!element)return;
    const previous=element.style.height;
    const scrollTop=element.scrollTop;
    element.style.height='0px';
    setContentHeight(Math.max(24,element.scrollHeight));
    element.style.height=previous;
    element.scrollTop=scrollTop;
  },[value,width]);
  useEffect(()=>{Animated.timing(height,{toValue:target,duration:reduced?0:180,easing:easeOut,useNativeDriver:false}).start();},[height,target,reduced]);
  useEffect(()=>{Animated.timing(glow,{toValue:focused?1:0,duration:reduced?0:180,easing:easeOut,useNativeDriver:Platform.OS!=='web'}).start();},[focused,glow,reduced]);
  return <Animated.View onLayout={event=>setWidth(event.nativeEvent.layout.width)} style={[styles.composer,{height,borderColor:focused?'#FFAA72':'rgba(255,150,95,.35)'},focused&&Platform.OS==='web'&&({outline:'2px solid #FFAA72',outlineOffset:3} as any)]}>
    <LinearGradient pointerEvents="none" colors={['rgba(33,18,12,.96)','rgba(96,34,12,.82)']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,{opacity:glow}]}><LinearGradient colors={['rgba(255,130,55,.02)','rgba(255,112,35,.17)']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/></Animated.View>
    <TextInput ref={input} nativeID="coachie-topic" accessibilityLabel="Interview topic" multiline maxLength={1000} value={value} onChangeText={text=>{onChange(text);if(!text)setContentHeight(24);}}
      scrollEnabled={contentHeight>168}
      onContentSizeChange={event=>{if(Platform.OS!=='web')setContentHeight(Math.max(24,event.nativeEvent.contentSize.height));}}
      onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
      onKeyPress={event=>{if(Platform.OS==='web'&&event.nativeEvent.key==='Enter'&&!(event as any).shiftKey&&!(event.nativeEvent as any).shiftKey&&!(event.nativeEvent as any).isComposing){event.preventDefault();if(value.trim())onSend();}}}
      placeholder="Your interview topic…" placeholderTextColor="#C5AEA0" style={[styles.input,{bottom:contentHeight>30?62:22},Platform.OS==='web'&&({outline:'none',boxShadow:'none',resize:'none',scrollbarWidth:'none',overflowY:contentHeight>168?'auto':'hidden',overflowX:'hidden'} as any)]}/>
    {Platform.OS==='web'&&React.createElement('style',null,'#coachie-topic::-webkit-scrollbar{display:none} #coachie-topic:focus{outline:none!important;box-shadow:none!important}')}
    <View style={styles.actions}><MotionPressable accessibilityRole="button" accessibilityLabel="Send topic and start conversation" disabled={!value.trim()} onPress={onSend} style={[styles.send,value.trim()?styles.ready:undefined]}><Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 19V5m-6 6 6-6 6 6"/></Svg></MotionPressable></View>
  </Animated.View>;
}
const styles=StyleSheet.create({composer:{minHeight:72,borderRadius:26,borderWidth:1,overflow:'hidden'},input:{zIndex:1,position:'absolute',top:18,left:16,right:64,color:'#FFF',fontFamily:DESIGN.font,fontSize:16,lineHeight:24,padding:0,borderWidth:0,textAlignVertical:'top',minHeight:24},actions:{zIndex:1,position:'absolute',right:12,bottom:12,alignItems:'flex-end',height:44,justifyContent:'flex-end'},send:{width:44,height:44,borderRadius:22,borderWidth:1,borderColor:'rgba(255,255,255,.22)',backgroundColor:'rgba(0,0,0,.18)',alignItems:'center',justifyContent:'center'},ready:{backgroundColor:'#BD481A',borderColor:'#FFA773'}});
