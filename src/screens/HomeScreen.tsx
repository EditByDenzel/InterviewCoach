import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { StackScreenProps } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { RootStackParamList, SavedConversation } from '../types';
import { loadSettings } from '../store/settingsStore';
import { loadConversationLibrary } from '../store/conversationLibrary';
import { DesignFrame, DesignIcon, GlassButton, DESIGN, ProfileIcon } from '../components/CoachieDesign';
import { MotionPressable } from '../components/Motion';
import { TopicComposer } from '../components/TopicComposer';
import { ConversationSidebar } from '../components/ConversationSidebar';

type Props = StackScreenProps<RootStackParamList, 'Home'>;
const suggestions = [
 {id:'sample-mock-interview',label:'Deploy Autonomous\nAI Agent',topic:'Deploy an autonomous AI agent to monitor liquidity pools. Make it a tactical trading bot.',rounds:3,icon:'interview' as const},
 {id:'sample-architecture',label:'System\nArchitecture\nReview',topic:'System Architecture Review',rounds:4,icon:'architecture' as const},
 {id:'sample-behavioral',label:'Behavioral STAR\nFramework',topic:'Behavioral STAR Framework',rounds:5,icon:'architecture' as const},
];
export default function HomeScreen({navigation,route}:Props) {
 const [topic,setTopic]=useState(''),[hasApiKey,setHasApiKey]=useState(false),[validation,setValidation]=useState('');
 const [sidebar,setSidebar]=useState(false),[conversations,setConversations]=useState<SavedConversation[]>([]),[historyError,setHistoryError]=useState(''),[loadingHistory,setLoadingHistory]=useState(false);
 const scrollRef = React.useRef<ScrollView>(null);
 const starting = React.useRef(false);
 useEffect(() => {
   if (Platform.OS !== 'web') return;
   const getEl = () => (scrollRef.current as any)?.getScrollableNode?.() || (scrollRef.current as any);
   const node = getEl();
   if (!node) return;
   let down = false;
   let startX = 0;
   let scrollLeft = 0;
   let dragged = false;
   const onMouseDown = (e: MouseEvent) => {
     if (e.button !== 0) return;
     down = true;
     dragged = false;
     startX = e.pageX - (node.getBoundingClientRect?.().left || 0);
     scrollLeft = node.scrollLeft;
     node.style.cursor = 'grabbing';
     node.style.userSelect = 'none';
   };
   const onMouseMove = (e: MouseEvent) => {
     if (!down) return;
     e.preventDefault();
     const x = e.pageX - (node.getBoundingClientRect?.().left || 0);
     const walk = (x - startX) * 1.35;
     if (Math.abs(x - startX) > 6) dragged = true;
     node.scrollLeft = scrollLeft - walk;
   };
   const onClick = (e: MouseEvent) => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } };
   const onMouseUp = () => {
     down = false;
     node.style.cursor = 'grab';
     node.style.removeProperty('user-select');
   };
   node.style.cursor = 'grab';
   node.addEventListener('mousedown', onMouseDown);
   node.addEventListener('click', onClick, true);
   window.addEventListener('mousemove', onMouseMove);
   window.addEventListener('mouseup', onMouseUp);
   window.addEventListener('blur', onMouseUp);
   return () => {
     node.removeEventListener('mousedown', onMouseDown);
     node.removeEventListener('click', onClick, true);
     window.removeEventListener('mousemove', onMouseMove);
     window.removeEventListener('mouseup', onMouseUp);
     window.removeEventListener('blur', onMouseUp);
   };
 }, []);
 const refreshHistory=useCallback(async()=>{setLoadingHistory(true);try{setConversations(await loadConversationLibrary());setHistoryError('');}catch{setHistoryError('Could not load your saved conversations. Please try again.');}finally{setLoadingHistory(false);}},[]);
 useFocusEffect(useCallback(()=>{let active=true;void loadSettings().then(settings=>{if(active)setHasApiKey(!!settings.geminiApiKey);});void refreshHistory();return()=>{active=false;};},[refreshHistory]));
 useEffect(()=>{if(route.params?.topic){setTopic(route.params.topic);navigation.setParams({topic:undefined});}},[route.params?.topic,navigation]);

 const mostRecentUserConv = conversations.find((c) => !c.isSample);
 const displaySuggestions = React.useMemo(() => {
  if (!mostRecentUserConv) return suggestions;
  const recentCard = {
   id: mostRecentUserConv.id,
   label: mostRecentUserConv.topic.length > 32 ? mostRecentUserConv.topic.slice(0, 30) + '…' : mostRecentUserConv.topic,
   topic: mostRecentUserConv.topic,
   rounds: mostRecentUserConv.rounds.length,
   status: mostRecentUserConv.status === 'completed' ? 'Completed' : 'In progress',
   isRecent: true,
   isAB: mostRecentUserConv.isAB,
   icon: 'interview' as const,
  };
  return [recentCard, ...suggestions.slice(0, 2)];
 }, [mostRecentUserConv]);

 const start=()=>{
  if(starting.current)return;
  if(!topic.trim()){setValidation('Enter a topic or choose a prompt above.');return;}
  starting.current=true;
  void loadSettings().then(settings=>{
    const key=(settings.geminiApiKey||'').trim();
    if(!key){
      setHasApiKey(false);
      setValidation('Add your Gemini API key in Settings to begin.');
      return;
    }
    setHasApiKey(true);
    setValidation('');
    navigation.navigate('Scenario',{draft:topic.trim()});
  }).catch(()=>setValidation('Could not load your settings. Please try again.')).finally(()=>{starting.current=false;});
 };
 return <DesignFrame><KeyboardAvoidingView aria-hidden={sidebar} accessibilityElementsHidden={sidebar} importantForAccessibility={sidebar?'no-hide-descendants':'auto'} style={styles.fill} behavior={Platform.OS==='ios'?'padding':undefined}>
  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
   <View style={styles.header}><View style={styles.brand}><MotionPressable accessibilityRole="button" accessibilityLabel="Coachie settings" onPress={()=>navigation.navigate('Settings')} style={styles.logo}><ProfileIcon size={22} color="#FFF"/></MotionPressable><View><Text style={styles.brandName}>Coachie,</Text><Text style={styles.welcome}>Welcome back</Text></View></View><GlassButton label="Recent conversations" onPress={()=>{setSidebar(true);void refreshHistory();}} style={styles.menu}><DesignIcon name="menu"/></GlassButton></View>
    <View style={styles.heroGroup}><Text style={styles.title}>{mostRecentUserConv ? 'Continue or start\na conversation.' : 'Start a\nconversation here.'}</Text><ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards} style={styles.cardScroll}>{displaySuggestions.map(item=><MotionPressable lift key={item.id} accessibilityRole="button" accessibilityLabel={`Open ${item.topic}`} onPress={()=>navigation.navigate('Conversation',{id:item.id})} style={styles.card}><LinearGradient pointerEvents="none" colors={(item as any).isRecent ? ['#6E2C10', '#321307'] : ['#44271A', '#20130E']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/><View style={styles.cardTopRow}><DesignIcon name={item.icon}/></View><View style={{gap:4}}><Text numberOfLines={2} style={styles.cardLabel}>{item.label}</Text><Text style={styles.sampleMeta}>{(item as any).isRecent ? `${item.rounds} ${(item as any).isAB?'replies · A/B':item.rounds===1?'round':'rounds'} · ${(item as any).status}` : `${item.rounds} rounds`}</Text></View></MotionPressable>)}</ScrollView></View>
    <View style={styles.composerArea}><TopicComposer value={topic} onChange={value=>{setTopic(value);setValidation('');}} onSend={start}/>{!!validation&&<View style={styles.validationArea}><Text accessibilityLiveRegion="polite" style={styles.validation}>{validation}</Text>{!hasApiKey&&<MotionPressable accessibilityRole="button" onPress={()=>navigation.navigate('Preferences',{page:'keys'})} style={styles.keyAction}><Text style={styles.keyLabel}>Add API key</Text></MotionPressable>}</View>}<View style={styles.toolbar}><GlassButton label="AI model and voice settings" onPress={()=>navigation.navigate('Preferences',{page:'voice'})} style={styles.model}><Text style={styles.modelText}>Gemini 3.8 Flash</Text><DesignIcon name="chevron"/></GlassButton><GlassButton label="Import scenario from photo" onPress={()=>navigation.navigate('Scenario',{draft:topic,photo:true})} style={[styles.model,{paddingHorizontal:12}]}><Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#D8C9C1" strokeWidth={1.6}><Path d="M8 5l1-2h6l1 2h4v15H4V5h4Z"/><Circle cx={12} cy={12} r={4}/></Svg><Text style={styles.modelText}>Photo</Text></GlassButton></View></View>
   </ScrollView>
  </KeyboardAvoidingView><ConversationSidebar open={sidebar} onClose={()=>setSidebar(false)} conversations={conversations} error={historyError} loading={loadingHistory} onRetry={()=>void refreshHistory()} onNew={()=>{setTopic('');setValidation('');}} onSelect={id=>{setSidebar(false);navigation.navigate('Conversation',{id});}}/></DesignFrame>;
}
const styles=StyleSheet.create({fill:{flex:1},content:{flexGrow:1,paddingHorizontal:24,paddingTop:24,paddingBottom:24,minHeight:650},header:{height:44,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},brand:{flexDirection:'row',alignItems:'center',gap:12},logo:{width:44,height:44,borderRadius:22,backgroundColor:'rgba(255,92,28,.16)',borderWidth:1,borderColor:'rgba(255,180,120,.3)',alignItems:'center',justifyContent:'center'},brandName:{fontSize:15,fontFamily:DESIGN.semibold,color:'#FFF'},welcome:{fontSize:13,fontFamily:DESIGN.font,color:'#E3C6B5',lineHeight:20},menu:{width:44,height:44,backgroundColor:'rgba(30,12,6,.35)',borderColor:'rgba(255,150,80,.18)'},heroGroup:{flex:1,justifyContent:'center',paddingTop:36,paddingBottom:28,gap:24},title:{fontSize:38,lineHeight:42,fontFamily:DESIGN.semibold,letterSpacing:-1.3,color:'#FFF'},cardScroll:{flexGrow:0,marginHorizontal:-24},cards:{paddingHorizontal:24,paddingVertical:6,gap:12},card:{width:156,minHeight:128,padding:16,borderRadius:22,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,180,120,.18)',justifyContent:'space-between',gap:14},cardTopRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},selected:{borderColor:'#FFAA72'},cardLabel:{fontSize:13,lineHeight:18,fontFamily:DESIGN.semibold,color:'#FFF'},sampleMeta:{fontFamily:DESIGN.font,fontSize:11,lineHeight:15,color:'#C8AD9D'},composerArea:{gap:16},validationArea:{gap:8},validation:{fontFamily:DESIGN.font,fontSize:13,lineHeight:20,color:'#FFD7AA'},keyAction:{alignSelf:'flex-start',paddingVertical:10,paddingHorizontal:14,borderRadius:18,backgroundColor:'rgba(255,255,255,.08)'},keyLabel:{fontFamily:DESIGN.medium,fontSize:13,color:'#FFB083'},toolbar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},model:{minHeight:42,paddingHorizontal:15,gap:8,backgroundColor:'rgba(30,12,6,.35)',borderColor:'rgba(255,150,80,.18)'},modelText:{fontFamily:DESIGN.font,fontSize:13,color:'#D8C9C1'},hint:{fontFamily:DESIGN.font,fontSize:12,color:'#B8ADA7'}});
