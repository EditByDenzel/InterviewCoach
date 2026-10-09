import React, { useState } from 'react';
import { View, Text, Share } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import { SettingsPage, Group, Action, S } from '../components/SettingsDesign';
import { Orb } from '../components/CoachieDesign';
export default function SummaryScreen({navigation,route}:StackScreenProps<RootStackParamList,'Summary'>) {
 const {rounds,closingMessage,topic}=route.params;
 const [error,setError]=useState('');
 const home=()=>navigation.popToTop();
 const share=async()=>{try{await Share.share({message:[`Coachie session — ${topic}`,...rounds.flatMap(r=>[`\nQ${r.roundNumber}: ${r.question}`,`You: ${r.answer}`]),'\nCoach feedback',closingMessage].join('\n')});}catch{setError('Sharing is unavailable here. You can select and copy your transcript below.');}};
 return <SettingsPage title="Session summary" back={home}><View style={{gap:12}}><Orb/><Text style={S.heading}>Practice complete.</Text><Text style={S.body}>{topic} · {rounds.length} questions answered</Text></View><View><Text style={S.label}>COACH FEEDBACK</Text><Group><Text selectable style={[S.title,{padding:20,lineHeight:24}]}>{closingMessage}</Text></Group></View><Action title="Start another interview" onPress={home}/><Action secondary title="Share transcript" onPress={()=>void share()}/>{!!error&&<Text accessibilityLiveRegion="polite" style={S.error}>{error}</Text>}<View style={{gap:16}}><Text style={S.label}>YOUR CONVERSATION</Text>{rounds.map(r=><Group key={r.roundNumber}><View style={{padding:20,gap:12}}><Text style={S.detail}>Question {r.roundNumber}</Text><Text selectable style={[S.title,{lineHeight:24}]}>{r.question}</Text><View style={{height:1,backgroundColor:'rgba(255,255,255,.08)',marginVertical:4}}/><Text style={[S.detail,{color:'#FFB083'}]}>Your answer</Text><Text selectable style={[S.body,{color:'#E3D8D2'}]}>{r.answer}</Text></View></Group>)}</View></SettingsPage>;
}
