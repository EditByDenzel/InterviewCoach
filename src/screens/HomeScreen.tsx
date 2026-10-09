import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { loadSettings } from '../store/settingsStore';
import { DesignFrame, DesignIcon, GlassButton, DESIGN } from '../components/CoachieDesign';
import { LinearGradient } from 'expo-linear-gradient';

type Props = StackScreenProps<RootStackParamList, 'Home'>;
const suggestions = [
  { label: 'Mock Interview\nPrep Session', topic: 'Mock Interview Prep Session', icon: 'interview' as const },
  { label: 'System\nArchitecture\nReview', topic: 'System Architecture Review', icon: 'architecture' as const },
  { label: 'Behavioral STAR\nFramework', topic: 'Behavioral STAR Framework', icon: 'architecture' as const },
];

export default function HomeScreen({navigation}: Props) {
  const [topic, setTopic] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [validation, setValidation] = useState('');
  useEffect(()=>{
    let active = true;
    const check = async()=>{ const settings = await loadSettings(); if(active) setHasApiKey(!!settings.geminiApiKey); };
    void check(); const unsub = navigation.addListener('focus',check);
    return ()=>{active=false;unsub();};
  },[navigation]);
  const start = ()=>{
    if(!topic.trim()) {setValidation('Enter a topic or choose a prompt above.');return;}
    if(!hasApiKey) {setValidation('Add your Gemini API key in Settings to begin.');return;}
    navigation.navigate('Interview',{topic:topic.trim()});
  };
  return <DesignFrame>
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS==='ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.brand}><View style={styles.logo}><DesignIcon name="logo" /></View><View><Text style={styles.brandName}>Coachie,</Text><Text style={styles.welcome}>Welcome back</Text></View></View>
          <GlassButton label="Open Settings" onPress={()=>navigation.navigate('Settings')} style={styles.menu}><DesignIcon name="menu" /></GlassButton>
        </View>
        <View style={styles.hero}><Text style={styles.title}>Start a{'\n'}conversation here.</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards} style={styles.cardScroll}>
          {suggestions.map(item=><Pressable key={item.topic} accessibilityRole="button" accessibilityLabel={item.topic} accessibilityState={{selected:topic===item.topic}} onPress={()=>{setTopic(item.topic);setValidation('');}} style={({pressed})=>[styles.card,topic===item.topic&&styles.selected,{opacity:pressed ? .75 : 1}]}>
            <LinearGradient pointerEvents="none" colors={topic===item.topic?['#623017','#28130C']:['#44271A','#20130E']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
            <DesignIcon name={item.icon}/><Text style={styles.cardLabel}>{item.label}</Text>
          </Pressable>)}
        </ScrollView>
        <View style={styles.promptArea}>
          <TextInput accessibilityLabel="Interview topic" placeholder="Type in your topic here to begin." placeholderTextColor="rgba(255,255,255,.6)" value={topic} onChangeText={value=>{setTopic(value);setValidation('');}} multiline maxLength={1000} style={styles.input} />
          {!!validation && <Pressable accessibilityRole="button" onPress={()=>!hasApiKey&&navigation.navigate('Settings')}><Text accessibilityLiveRegion="polite" style={styles.validation}>{validation}</Text></Pressable>}
        </View>
        <Pressable accessibilityRole="button" onPress={start} style={({pressed})=>[styles.start,{opacity:pressed?.85:1,transform:[{scale:pressed?.96:1}]}]}><LinearGradient pointerEvents="none" colors={['#FFA742','#FF6220']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/><Text style={styles.startText}>Start conversation</Text><View style={{transform:[{rotate:'45deg'}]}}><DesignIcon name="send"/></View></Pressable>
        <View style={styles.toolbar}>
          <GlassButton label="AI model and API settings" onPress={()=>navigation.navigate('Settings')} style={styles.model}><Text style={styles.modelText}>Gemini 3.8 Flash</Text><View style={styles.chevron}><DesignIcon name="chevron" /></View></GlassButton>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </DesignFrame>;
}
const styles=StyleSheet.create({
  fill:{flex:1},content:{flexGrow:1,paddingHorizontal:24,paddingTop:16,paddingBottom:8,justifyContent:'space-between',minHeight:740},
  header:{height:44,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},brand:{flexDirection:'row',alignItems:'center',gap:12},logo:{width:40,height:40,borderRadius:20,backgroundColor:'rgba(0,0,0,.4)',borderWidth:1,borderColor:'rgba(255,255,255,.2)',alignItems:'center',justifyContent:'center'},brandName:{fontSize:14.5,fontWeight:'700',color:'#FFF',letterSpacing:-.36},welcome:{fontSize:12.5,color:'rgba(255,255,255,.6)',lineHeight:16},menu:{width:44,height:44,backgroundColor:'rgba(30,12,6,.35)',borderColor:'rgba(255,150,80,.18)'},
  hero:{paddingTop:96,paddingBottom:16},title:{fontSize:38,lineHeight:41,fontWeight:'700',letterSpacing:-1.14,color:'#FFF',fontFamily:Platform.OS==='web'?'Arial':undefined},
  cardScroll:{flexGrow:0,marginVertical:20,marginRight:-24},cards:{paddingVertical:8,paddingRight:24,gap:12},card:{width:148,height:122,padding:15,borderRadius:22,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,180,120,.18)',justifyContent:'space-between'},selected:{borderColor:'#FFAA72'},cardLabel:{fontSize:13,lineHeight:18,fontWeight:'700',letterSpacing:-.325,color:'rgba(255,255,255,.9)'},
  start:{marginTop:16,minHeight:54,borderRadius:27,overflow:'hidden',flexDirection:'row',gap:12,alignItems:'center',justifyContent:'center',padding:16},startText:{fontFamily:DESIGN.semibold,fontSize:16,color:'#311105'},
  promptArea:{paddingTop:12},input:{height:106,padding:17,paddingTop:17,textAlignVertical:'top',fontSize:16,lineHeight:24,color:'#FFF',backgroundColor:'rgba(25,9,5,.4)',borderWidth:1,borderColor:'rgba(255,120,50,.15)',borderRadius:26},validation:{fontSize:12,lineHeight:18,color:'#FFD7AA',paddingTop:8},toolbar:{paddingTop:16,paddingBottom:16,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},model:{height:42,paddingHorizontal:15,backgroundColor:'rgba(30,12,6,.35)',borderColor:'rgba(255,150,80,.18)'},modelText:{fontSize:13.5,color:'rgba(255,255,255,.9)',letterSpacing:-.337},chevron:{marginLeft:2},
});
