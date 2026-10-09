import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { StackScreenProps } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { RootStackParamList, SavedConversation } from '../types';
import { loadSettings } from '../store/settingsStore';
import { loadConversationLibrary } from '../store/conversationStore';
import { DesignFrame, DesignIcon, GlassButton, DESIGN, ProfileIcon } from '../components/CoachieDesign';
import { MotionPressable } from '../components/Motion';
import { TopicComposer } from '../components/TopicComposer';
import { ConversationSidebar } from '../components/ConversationSidebar';

type Props = StackScreenProps<RootStackParamList, 'Home'>;
const suggestions = [
 {id:'sample-mock-interview',label:'Mock Interview\nPrep Session',topic:'Mock Interview Prep Session',rounds:3,icon:'interview' as const},
 {id:'sample-architecture',label:'System\nArchitecture\nReview',topic:'System Architecture Review',rounds:4,icon:'architecture' as const},
 {id:'sample-behavioral',label:'Behavioral STAR\nFramework',topic:'Behavioral STAR Framework',rounds:5,icon:'architecture' as const},
];
export default function HomeScreen({navigation,route}:Props) {
 const [topic,setTopic]=useState(''),[hasApiKey,setHasApiKey]=useState(false),[validation,setValidation]=useState('');
 const [sidebar,setSidebar]=useState(false),[conversations,setConversations]=useState<SavedConversation[]>([]),[historyError,setHistoryError]=useState(''),[loadingHistory,setLoadingHistory]=useState(false);
 const refreshHistory=useCallback(async()=>{setLoadingHistory(true);try{setConversations(await loadConversationLibrary());setHistoryError('');}catch{setHistoryError('Could not load your saved conversations. Please try again.');}finally{setLoadingHistory(false);}},[]);
 useFocusEffect(useCallback(()=>{let active=true;void loadSettings().then(settings=>{if(active)setHasApiKey(!!settings.geminiApiKey);});void refreshHistory();return()=>{active=false;};},[refreshHistory]));
 useEffect(()=>{if(route.params?.topic){setTopic(route.params.topic);navigation.setParams({topic:undefined});}},[route.params?.topic,navigation]);
 const start=()=>{
  if(!topic.trim()){setValidation('Enter a topic or choose a prompt above.');return;}
  if(!hasApiKey){setValidation('Add your Gemini API key in Settings to begin.');return;}
  setValidation('');navigation.navigate('Interview',{topic:topic.trim()});
 };
 return <DesignFrame><KeyboardAvoidingView aria-hidden={sidebar} accessibilityElementsHidden={sidebar} importantForAccessibility={sidebar?'no-hide-descendants':'auto'} style={styles.fill} behavior={Platform.OS==='ios'?'padding':undefined}>
  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
   <View style={styles.header}><View style={styles.brand}><MotionPressable accessibilityRole="button" accessibilityLabel="Coachie settings" onPress={()=>navigation.navigate('Settings')} style={styles.logo}><ProfileIcon size={22} color="#FFF"/></MotionPressable><View><Text style={styles.brandName}>Coachie,</Text><Text style={styles.welcome}>Welcome back</Text></View></View><GlassButton label="Recent conversations" onPress={()=>{setSidebar(true);void refreshHistory();}} style={styles.menu}><DesignIcon name="menu"/></GlassButton></View>
   <View style={styles.heroGroup}><Text style={styles.title}>Start a{'\n'}conversation here.</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards} style={styles.cardScroll}>{suggestions.map(item=><MotionPressable lift key={item.id} accessibilityRole="button" accessibilityLabel={`Open ${item.topic}`} onPress={()=>navigation.navigate('Conversation',{id:item.id})} style={styles.card}><LinearGradient pointerEvents="none" colors={['#44271A','#20130E']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/><DesignIcon name={item.icon}/><View style={{gap:4}}><Text style={styles.cardLabel}>{item.label}</Text><Text style={styles.sampleMeta}>{item.rounds} rounds</Text></View></MotionPressable>)}</ScrollView></View>
   <View style={styles.composerArea}><TopicComposer value={topic} onChange={value=>{setTopic(value);setValidation('');}} onSend={start}/>{!!validation&&<View style={styles.validationArea}><Text accessibilityLiveRegion="polite" style={styles.validation}>{validation}</Text>{!hasApiKey&&<MotionPressable accessibilityRole="button" onPress={()=>navigation.navigate('Preferences',{page:'keys'})} style={styles.keyAction}><Text style={styles.keyLabel}>Add API key</Text></MotionPressable>}</View>}<View style={styles.toolbar}><GlassButton label="AI model and voice settings" onPress={()=>navigation.navigate('Preferences',{page:'voice'})} style={styles.model}><Text style={styles.modelText}>Gemini 3.8 Flash</Text><DesignIcon name="chevron"/></GlassButton><Text style={styles.hint}>{Platform.OS==='web'?'Enter to send':'5 questions'}</Text></View></View>
  </ScrollView>
 </KeyboardAvoidingView><ConversationSidebar open={sidebar} onClose={()=>setSidebar(false)} conversations={conversations} error={historyError} loading={loadingHistory} onRetry={()=>void refreshHistory()} onSelect={id=>{setSidebar(false);navigation.navigate('Conversation',{id});}}/></DesignFrame>;
}
const styles=StyleSheet.create({fill:{flex:1},content:{flexGrow:1,paddingHorizontal:24,paddingTop:24,paddingBottom:24,minHeight:650},header:{height:44,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},brand:{flexDirection:'row',alignItems:'center',gap:12},logo:{width:44,height:44,borderRadius:22,backgroundColor:'rgba(255,92,28,.16)',borderWidth:1,borderColor:'rgba(255,180,120,.3)',alignItems:'center',justifyContent:'center'},brandName:{fontSize:15,fontFamily:DESIGN.semibold,color:'#FFF'},welcome:{fontSize:13,fontFamily:DESIGN.font,color:'#E3C6B5',lineHeight:20},menu:{width:44,height:44,backgroundColor:'rgba(30,12,6,.35)',borderColor:'rgba(255,150,80,.18)'},heroGroup:{flex:1,justifyContent:'center',paddingTop:36,paddingBottom:28,gap:24},title:{fontSize:38,lineHeight:42,fontFamily:DESIGN.semibold,letterSpacing:-1.3,color:'#FFF'},cardScroll:{flexGrow:0,marginHorizontal:-24},cards:{paddingHorizontal:24,paddingVertical:6,gap:12},card:{width:156,minHeight:128,padding:16,borderRadius:22,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,180,120,.18)',justifyContent:'space-between',gap:14},selected:{borderColor:'#FFAA72'},cardLabel:{fontSize:13,lineHeight:18,fontFamily:DESIGN.semibold,color:'#FFF'},sampleMeta:{fontFamily:DESIGN.font,fontSize:11,lineHeight:15,color:'#C8AD9D'},composerArea:{gap:16},validationArea:{gap:8},validation:{fontFamily:DESIGN.font,fontSize:13,lineHeight:20,color:'#FFD7AA'},keyAction:{alignSelf:'flex-start',paddingVertical:10,paddingHorizontal:14,borderRadius:18,backgroundColor:'rgba(255,255,255,.08)'},keyLabel:{fontFamily:DESIGN.medium,fontSize:13,color:'#FFB083'},toolbar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},model:{minHeight:42,paddingHorizontal:15,gap:8,backgroundColor:'rgba(30,12,6,.35)',borderColor:'rgba(255,150,80,.18)'},modelText:{fontFamily:DESIGN.font,fontSize:13,color:'#D8C9C1'},hint:{fontFamily:DESIGN.font,fontSize:12,color:'#B8ADA7'}});
