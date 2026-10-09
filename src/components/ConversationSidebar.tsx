import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SavedConversation } from '../types';
import { DESIGN, DesignIcon } from './CoachieDesign';
import { easeDrawer, LiveDots, MotionPressable, useMotion } from './Motion';

type Props={open:boolean;onClose:()=>void;conversations:SavedConversation[];error:string;loading:boolean;onSelect:(id:string)=>void;onRetry:()=>void};
export function ConversationSidebar({open,onClose,conversations,error,loading,onSelect,onRetry}:Props) {
 const {reduced}=useMotion();
 const window=useWindowDimensions();
 const [mounted,setMounted]=useState(open);
 const progress=useRef(new Animated.Value(0)).current;
 const width=Math.min(320,window.width-24);
 useEffect(()=>{
  if(open)setMounted(true);
  const animation=Animated.timing(progress,{toValue:open?1:0,duration:reduced?0:open?260:180,easing:easeDrawer,useNativeDriver:Platform.OS!=='web'});
  animation.start(({finished})=>{if(finished&&!open)setMounted(false);});
  return()=>animation.stop();
 },[open,progress,reduced]);
 return <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} accessibilityViewIsModal><View style={styles.modal}>
  <Animated.View style={[StyleSheet.absoluteFill,{backgroundColor:'#000',opacity:progress.interpolate({inputRange:[0,1],outputRange:[0,.6]})}]}><MotionPressable accessible={false} aria-hidden focusable={false} onPress={onClose} style={StyleSheet.absoluteFill}/></Animated.View>
  <View pointerEvents="box-none" style={[styles.bounds,{width:Math.min(390,window.width),height:Platform.OS==='web'&&window.width>600?Math.min(900,window.height-48):window.height}]}>
   <Animated.View accessibilityViewIsModal style={[styles.panel,{width,opacity:reduced?progress:1,transform:[{translateX:reduced?0:progress.interpolate({inputRange:[0,1],outputRange:[-width,0]})}]}]}>
    <SafeAreaView style={styles.fill} edges={['top','bottom']}><View style={styles.header}><Text accessibilityRole="header" style={styles.title}>Conversations</Text><MotionPressable accessibilityRole="button" accessibilityLabel="Close sidebar" onPress={onClose} style={styles.close}><DesignIcon name="close"/></MotionPressable></View>
     <Text style={styles.caption}>Your practice, saved on this device.</Text>
     <ScrollView style={{flex:1,minHeight:0}} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
      {loading?<View style={{flexDirection:'row',gap:8,alignItems:'center'}}><Text style={styles.description}>Loading conversations…</Text><LiveDots active/></View>:error?<View style={{gap:12}}><Text accessibilityLiveRegion="polite" style={styles.description}>{error}</Text><MotionPressable accessibilityRole="button" onPress={onRetry} style={styles.item}><Text style={styles.itemTitle}>Try again</Text></MotionPressable></View>:conversations.length===0?<View style={styles.empty}><Text style={styles.itemTitle}>Your next conversation starts here.</Text><Text style={styles.description}>Practice a topic and your questions, answers, and feedback will appear here.</Text></View>:conversations.map(item=><MotionPressable accessibilityRole="button" accessibilityLabel={`Open conversation: ${item.topic}`} key={item.id} onPress={()=>onSelect(item.id)} style={styles.item}><Text numberOfLines={2} style={styles.itemTitle}>{item.topic}</Text><Text style={styles.meta}>{item.isSample?'Sample':new Date(item.updatedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})} · {item.rounds.length} {item.rounds.length===1?'answer':'answers'} · {item.status==='completed'?'Completed':'In progress'}</Text></MotionPressable>)}
     </ScrollView>
    </SafeAreaView>
   </Animated.View>
  </View>
 </View></Modal>;
}
const styles=StyleSheet.create({modal:{flex:1,justifyContent:'center',alignItems:'center'},bounds:{position:'relative'},panel:{height:'100%',backgroundColor:'#160D09',borderRightWidth:1,borderRightColor:'rgba(255,180,130,.12)',shadowColor:'#000',shadowOpacity:.4,shadowRadius:24,shadowOffset:{width:8,height:0}},fill:{flex:1},header:{paddingHorizontal:20,paddingTop:20,paddingBottom:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{fontFamily:DESIGN.semibold,color:'#FFF',fontSize:22},close:{width:44,height:44,borderRadius:22,backgroundColor:'rgba(255,255,255,.07)',alignItems:'center',justifyContent:'center'},caption:{fontFamily:DESIGN.font,color:'#B8ADA7',fontSize:13,lineHeight:20,paddingHorizontal:20,paddingBottom:20},list:{paddingHorizontal:12,paddingBottom:24,gap:8},item:{padding:16,gap:8,borderRadius:18,backgroundColor:'rgba(255,255,255,.045)'},itemTitle:{fontFamily:DESIGN.medium,color:'#FFF',fontSize:15,lineHeight:22},meta:{fontFamily:DESIGN.font,color:'#B8ADA7',fontSize:12,lineHeight:18},empty:{padding:12,gap:12},description:{fontFamily:DESIGN.font,color:'#B8ADA7',fontSize:14,lineHeight:22}});
