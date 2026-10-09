import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList, AppSettings } from '../types';
import { loadSettings, updateSettings } from '../store/settingsStore';
import { SettingsPage, SettingRow, SettingIcon, Group, Action, S } from '../components/SettingsDesign';
import { Orb } from '../components/CoachieDesign';
import app from '../../app.json';

type Props=StackScreenProps<RootStackParamList,'Settings'>;
const languages=[['English','English'],['French','Français'],['Spanish','Español'],['Portuguese','Português'],['German','Deutsch'],['Arabic','العربية'],['Hindi','हिन्दी'],['Japanese','日本語']];
const voices=[['Kore','Firm and composed'],['Puck','Upbeat'],['Charon','Informative'],['Aoede','Breezy'],['Zephyr','Bright'],['Achernar','Soft']];
export default function SettingsScreen({navigation}:Props) {
 const [settings,setSettings]=useState<AppSettings|null>(null);
 useFocusEffect(useCallback(()=>{let active=true;void loadSettings().then(s=>{if(active)setSettings(s);});return()=>{active=false;};},[]));
 return <SettingsPage title="Settings" back={()=>navigation.goBack()}>
  <Group><View style={{padding:20,flexDirection:'row',gap:16,alignItems:'center'}}><View style={{width:48,height:48,borderRadius:24,backgroundColor:'rgba(255,92,28,.16)',alignItems:'center',justifyContent:'center'}}><Orb/></View><View style={{flex:1}}><Text style={S.title}>Your Coachie</Text><Text style={S.detail}>Make every conversation yours.</Text></View></View></Group>
  <View><Text style={S.label}>INTERVIEW PREFERENCES</Text><Group><SettingRow icon="language" title="Language" detail={settings?.language||'English'} onPress={()=>navigation.navigate('Preferences',{page:'language'})}/><SettingRow icon="voice" title="Voice" detail={settings?.ttsProvider==='elevenlabs'?'ElevenLabs':`Gemini · ${settings?.geminiVoice||'Kore'}`} last onPress={()=>navigation.navigate('Preferences',{page:'voice'})}/></Group></View>
  <View><Text style={S.label}>APP & CONNECTIONS</Text><Group><SettingRow icon="key" title="API keys" detail={settings?.geminiApiKey?'Gemini connected':'Add a key to get started'} onPress={()=>navigation.navigate('Preferences',{page:'keys'})}/><SettingRow icon="info" title="About Coachie" detail={`Version ${app.expo.version}`} last onPress={()=>navigation.navigate('Preferences',{page:'about'})}/></Group></View>
  <Text style={S.body}>Your preferences apply to the next interview. The app interface stays in English.</Text>
 </SettingsPage>;
}
export function PreferencesScreen({navigation,route}:StackScreenProps<RootStackParamList,'Preferences'>) {
 const page=route.params.page;
 const [settings,setSettings]=useState<AppSettings|null>(null),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [visible,setVisible]=useState<Record<string,boolean>>({});
 useFocusEffect(useCallback(()=>{let active=true;void loadSettings().then(s=>{if(active)setSettings(s);});return()=>{active=false;};},[]));
 const change=(patch:Partial<AppSettings>)=>{setSettings(s=>s?{...s,...patch}:s);setMessage('');setError('');};
 const save=async()=>{
  if(!settings)return;
  if(page==='keys'&&!settings.geminiApiKey.trim()){setError('Enter a Gemini API key to continue.');return;}
  if((page==='voice'||page==='keys')&&settings.ttsProvider==='elevenlabs'&&!settings.elevenLabsApiKey.trim()){setError('Add an ElevenLabs API key before using this voice engine.');return;}
  if(page==='voice'&&settings.ttsProvider==='elevenlabs'&&!settings.elevenLabsVoiceId?.trim()){setError('Enter an ElevenLabs voice ID.');return;}
  setSaving(true);setError('');try {
   const patch=page==='language'?{language:settings.language}:page==='voice'?{ttsProvider:settings.ttsProvider,geminiVoice:settings.geminiVoice,elevenLabsVoiceId:settings.elevenLabsVoiceId?.trim()}:{geminiApiKey:settings.geminiApiKey.trim(),elevenLabsApiKey:settings.elevenLabsApiKey.trim()};
   await updateSettings(patch);setMessage('Saved. Ready for your next interview.');
  }catch{setError('Could not save. Please try again.');}finally{setSaving(false);}
 };
 const field=(label:string,key:'geminiApiKey'|'elevenLabsApiKey'|'elevenLabsVoiceId',secret=false)=><View style={{gap:10}}><Text style={S.title}>{label}</Text><View style={{flexDirection:'row',gap:8,alignItems:'center'}}><TextInput accessibilityLabel={label} value={settings?.[key]||''} onChangeText={value=>change({[key]:value})} secureTextEntry={secret&&!visible[key]} autoCapitalize="none" autoCorrect={false} style={S.input}/>{secret&&<Pressable accessibilityRole="button" accessibilityLabel={`${visible[key]?'Hide':'Show'} ${label}`} onPress={()=>setVisible(v=>({...v,[key]:!v[key]}))} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><SettingIcon name="eye"/></Pressable>}</View></View>;
 const titles={language:'Language',voice:'Voice',keys:'API keys',about:'About Coachie'};
 return <SettingsPage title={titles[page]} back={()=>navigation.goBack()}>
  {page==='about'?<><View style={{gap:16}}><Orb/><Text style={S.heading}>{'A little practice.\nA lot more confidence.'}</Text><Text style={S.body}>Coachie is your AI interview practice companion. Choose a topic, answer five questions, and leave with feedback you can use.</Text></View><Group><View style={{padding:20,gap:8}}><Text style={S.title}>Coachie {app.expo.version}</Text><Text style={S.body}>Built with Expo and React Native. Questions and transcription use Gemini. Speech uses your selected Gemini or ElevenLabs voice.</Text></View></Group><View style={{gap:10}}><Text style={S.title}>Your data</Text><Text style={S.body}>API keys stay in this app’s local storage, which is not encrypted. Requests go to the provider needed for the feature. Recorded answers are sent to Gemini for transcription. Your session transcript is held in memory; sharing it is your choice.</Text></View></>:!settings?<Text style={S.body}>Loading preferences…</Text>:<>
  {page==='language'&&<><View style={{gap:8}}><Text style={S.heading}>Speak your language.</Text><Text style={S.body}>Choose the language Coachie uses for questions, spoken responses, and feedback.</Text></View><Group>{languages.map(([value,native],i)=><SettingRow key={value} title={value} detail={native!==value?native:undefined} selected={settings.language===value} last={i===languages.length-1} onPress={()=>change({language:value})}/>)}</Group></>}
  {page==='voice'&&<><View style={{gap:8}}><Text style={S.heading}>Find your voice.</Text><Text style={S.body}>Choose how your interviewer sounds.</Text></View><View><Text style={S.label}>VOICE ENGINE</Text><Group><SettingRow title="Gemini" detail="Uses your Gemini API key" selected={settings.ttsProvider==='gemini'} onPress={()=>change({ttsProvider:'gemini'})}/><SettingRow title="ElevenLabs" detail="Requires an ElevenLabs API key" selected={settings.ttsProvider==='elevenlabs'} last onPress={()=>change({ttsProvider:'elevenlabs'})}/></Group></View>{settings.ttsProvider==='gemini'?<View><Text style={S.label}>GEMINI VOICE</Text><Group>{voices.map(([name,description],i)=><SettingRow key={name} title={name} detail={description} selected={settings.geminiVoice===name} last={i===voices.length-1} onPress={()=>change({geminiVoice:name})}/>)}</Group></View>:<><Text style={S.body}>Use a voice ID available in your ElevenLabs account. Rachel is the default voice ID.</Text>{field('ElevenLabs voice ID','elevenLabsVoiceId')}<Action secondary title="Manage API keys" onPress={()=>navigation.push('Preferences',{page:'keys'})}/></>}</>}
  {page==='keys'&&<><View style={{gap:8}}><Text style={S.heading}>Connect your coach.</Text><Text style={S.body}>Gemini powers questions, transcription, and its own voices. ElevenLabs is optional.</Text></View><Group><View style={{padding:16,gap:20}}>{field('Gemini API key','geminiApiKey',true)}{field('ElevenLabs API key','elevenLabsApiKey',true)}</View></Group><Text style={S.body}>Keys are stored locally. Saving a key does not verify provider access; requests use your provider’s account and limits.</Text></>}
  <Text accessibilityLiveRegion="polite" style={message?S.message:S.error}>{error||message}</Text><Action title={saving?'Saving…':'Save changes'} disabled={saving} onPress={()=>void save()}/>
  </>}
 </SettingsPage>;
}
