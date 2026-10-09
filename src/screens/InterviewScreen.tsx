import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList, InterviewRound, InterviewPhase, AppSettings } from '../types';
import { loadSettings } from '../store/settingsStore';
import { generateInterviewText, generateGeminiTTS, transcribeAudio, GeminiMessage } from '../services/geminiService';
import { generateElevenLabsTTS } from '../services/elevenLabsService';
import { playBase64Audio, startRecording, stopRecording, pauseRecording, resumeRecording, stopPlayback, setPlaybackMuted, readAudioAsBase64, requestMicrophonePermission } from '../services/audioService';
import { DESIGN, DesignFrame, DesignIcon, GlowButton, GlassButton, Orb, Waveform } from '../components/CoachieDesign';

type Props = StackScreenProps<RootStackParamList, 'Interview'>;
type Voice = { base64: string; extension: 'wav' | 'mp3' };
const TOTAL_ROUNDS = 5;
const labels: Record<InterviewPhase, string> = {
  idle:'Your turn',generating_question:'Coachie is drafting the question…',speaking:'Coachie is speaking…',
  recording:'Coachie is listening…',transcribing:'Transcribing your answer…',closing:'Preparing your feedback…',done:'Interview complete',
};
const time = (seconds:number)=>`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;

export default function InterviewScreen({navigation,route}:Props) {
  const {topic}=route.params;
  const [phase,setPhase]=useState<InterviewPhase>('generating_question');
  const [rounds,setRounds]=useState<InterviewRound[]>([]);
  const [question,setQuestion]=useState('');
  const [answer,setAnswer]=useState('');
  const [error,setError]=useState('');
  const [paused,setPaused]=useState(false);
  const [seconds,setSeconds]=useState(0);
  const [muted,setMuted]=useState(false);
  const [confirmClose,setConfirmClose]=useState(false);
  const [collapsed,setCollapsed]=useState<Record<number,boolean>>({});
  const [replaying,setReplaying]=useState<number|null>(null);
  const alive=useRef(true), exiting=useRef(false), locked=useRef(false);
  const history=useRef<GeminiMessage[]>([]);
  const completed=useRef<InterviewRound[]>([]);
  const settings=useRef<AppSettings>({geminiApiKey:'',elevenLabsApiKey:'',ttsProvider:'gemini'});
  const voices=useRef<Record<number,Voice>>({});
  const recordings=useRef<Record<number,{uri:string;seconds:number}>>({});
  const candidateSound=useRef<Audio.Sound|null>(null);
  const stopCandidate=async()=>{const sound=candidateSound.current;candidateSound.current=null;if(sound){sound.setOnPlaybackStatusUpdate(null);await sound.unloadAsync();}if(alive.current)setReplaying(null);};
  const questionRef=useRef('');
  const pendingUri=useRef<string|null>(null);
  const retry=useRef<(()=>Promise<void>)|null>(null);
  const log=useRef<ScrollView>(null);

  const ensureActive=()=>{if(!alive.current) throw new Error('Session closed');};
  const perform=async(action:()=>Promise<void>)=>{
    if(locked.current || !alive.current) return;
    locked.current=true;setError('');
    try {await action();} catch(err) {if(alive.current){setError(err instanceof Error?err.message:'Something went wrong. Please try again.');setPhase('idle');}}
    finally {locked.current=false;}
  };
  const speak=async(text:string,index:number)=>{
    ensureActive();setPhase('speaking');
    let voice=voices.current[index];
    if(!voice) {
      const s=settings.current;
      voice=s.ttsProvider==='elevenlabs'&&s.elevenLabsApiKey ? {base64:await generateElevenLabsTTS(s.elevenLabsApiKey,text,s.elevenLabsVoiceId),extension:'mp3'} : {base64:await generateGeminiTTS(s.geminiApiKey,text,s.geminiVoice),extension:'wav'};
      ensureActive();voices.current[index]=voice;
    }
    await playBase64Audio(voice.base64,voice.extension);ensureActive();
  };
  const runRound=async()=>{
    retry.current=runRound;setPhase('generating_question');setQuestion('');questionRef.current='';
    const q=await generateInterviewText(settings.current.geminiApiKey,topic,history.current,completed.current.length===0?'Start the interview. Ask your first question.':"Continue the interview. Ask the next question based on the candidate's previous answer.",settings.current.language);
    ensureActive();questionRef.current=q;setQuestion(q);history.current.push({role:'model',parts:[{text:q}]});
    const play=async()=>{await speak(q,completed.current.length);setPhase('idle');retry.current=null;};
    retry.current=play;await play();
  };
  const closing=async()=>{
    retry.current=closing;setPhase('closing');
    const feedback=await generateInterviewText(settings.current.geminiApiKey,topic,history.current,"The interview is now complete. Provide a warm, constructive closing summary of the candidate's performance based on all their answers. Be specific and encouraging.",settings.current.language);
    ensureActive();setQuestion(feedback);
    const finish=async()=>{
      await speak(feedback,TOTAL_ROUNDS);ensureActive();setPhase('done');exiting.current=true;
      navigation.replace('Summary',{rounds:completed.current,closingMessage:feedback,topic});
    };
    retry.current=finish;await finish();
  };
  const submit=async(text:string)=>{
    ensureActive();if(!text.trim()) throw new Error('No speech detected. Record again or type your answer.');
    history.current.push({role:'user',parts:[{text}]});
    completed.current=[...completed.current,{roundNumber:completed.current.length+1,question:questionRef.current,answer:text}];
    setRounds(completed.current);setAnswer('');pendingUri.current=null;setPaused(false);
    if(completed.current.length<TOTAL_ROUNDS) await runRound(); else await closing();
  };
  const transcribe=async()=>{
    retry.current=transcribe;setPhase('transcribing');
    if(!pendingUri.current) throw new Error('Recording was not saved. Please record again.');
    const audio=await readAudioAsBase64(pendingUri.current);ensureActive();
    const text=await transcribeAudio(settings.current.geminiApiKey,audio.base64,audio.mimeType);ensureActive();
    if(!text.trim()){pendingUri.current=null;retry.current=null;throw new Error('No speech detected. Record again or type your answer.');}
    await submit(text);
  };
  const record=()=>void perform(async()=>{
    if(phase==='recording'){
      setPhase('transcribing');const uri=await stopRecording();ensureActive();
      if(!uri){retry.current=null;throw new Error('Recording failed. Please record again.');}
      pendingUri.current=uri;recordings.current[completed.current.length]={uri,seconds};await transcribe();
    }else{
      if(!await requestMicrophonePermission()) throw new Error('Microphone access is required. Allow it in your device settings or type an answer.');
      ensureActive();await stopCandidate();
      await startRecording();if(!alive.current){await stopRecording();return;}setSeconds(0);setPaused(false);setPhase('recording');
    }
  });
  const pause=()=>void perform(async()=>{if(paused) await resumeRecording();else await pauseRecording();ensureActive();setPaused(!paused);});
  const send=()=>{if(phase==='recording') record();else if(answer.trim()) void perform(()=>submit(answer.trim()));};
  const replay=async(index:number,candidate=false)=>{
    if(phase!=='idle'||locked.current||error) return;
    await perform(async()=>{
      setReplaying(index);
      try {
        if(candidate){
          await stopCandidate();
          const recording=recordings.current[index];if(!recording) return;
          const {sound}=await Audio.Sound.createAsync({uri:recording.uri},{shouldPlay:true,isMuted:muted});
          candidateSound.current=sound;setReplaying(index);
          sound.setOnPlaybackStatusUpdate(status=>{if(status.isLoaded&&status.didJustFinish){sound.setOnPlaybackStatusUpdate(null);void sound.unloadAsync();if(candidateSound.current===sound){candidateSound.current=null;if(alive.current)setReplaying(null);}}else if(!status.isLoaded&&status.error){if(candidateSound.current===sound){candidateSound.current=null;if(alive.current){setReplaying(null);setError('Could not replay this recording.');}}}});
        }else{await stopCandidate();setReplaying(index);await speak(index===rounds.length?question:rounds[index].question,index);setPhase('idle');}
      }finally{if(alive.current&&!candidate)setReplaying(null);}
    });
  };
  const toggleMute=async()=>{try {await setPlaybackMuted(!muted);await candidateSound.current?.setIsMutedAsync(!muted);if(alive.current)setMuted(!muted);}catch(err){if(alive.current)setError(err instanceof Error?err.message:'Could not change audio volume.');}};
  const close=async()=>{
    exiting.current=true;alive.current=false;
    await Promise.allSettled([stopPlayback(),stopRecording(),stopCandidate()]);
    navigation.popToTop();
  };
  useEffect(()=>{
    alive.current=true;
    void perform(async()=>{settings.current=await loadSettings();ensureActive();if(!settings.current.geminiApiKey)throw new Error('Add your Gemini API key in Settings before starting.');await runRound();});
    const unsub=navigation.addListener('beforeRemove',e=>{if(exiting.current)return;e.preventDefault();setConfirmClose(true);});
    return ()=>{alive.current=false;unsub();void stopPlayback();void stopRecording();void stopCandidate();};
    // The interview owns one session; settings and history live in refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(()=>{if(phase!=='recording'||paused)return;const timer=setInterval(()=>setSeconds(s=>s+1),1000);return ()=>clearInterval(timer);},[phase,paused]);
  const canRecord=(phase==='idle'&&!!question&&!error)||phase==='recording';
  const audioRow=(index:number,candidate=false)=><View style={styles.audioRow}>
    <Pressable accessibilityRole="button" accessibilityLabel={candidate?'Play your recorded answer':'Replay interview question'} disabled={phase!=='idle'||!!error} onPress={()=>void replay(index,candidate)} style={styles.play}><DesignIcon name="play"/></Pressable>
    <Waveform candidate={candidate}/><Text style={styles.duration}>{candidate?time(recordings.current[index]?.seconds??0):replaying===index?'Playing':'Voice'}</Text>
    {candidate&&<Pressable accessibilityRole="button" accessibilityLabel={collapsed[index]?'Expand transcript':'Collapse transcript'} onPress={()=>setCollapsed(c=>({...c,[index]:!c[index]}))} style={styles.collapse}><View style={{transform:[{rotate:collapsed[index]?'180deg':'0deg'}]}}><DesignIcon name="collapse"/></View></Pressable>}
  </View>;
  const ai=(q:string,index:number,active=false)=><View key={`q-${index}`} style={styles.aiRow}>
    <View style={styles.orbMargin}><Orb/></View><View style={styles.aiContent}>
      {active&&<View style={styles.phasePill}><Text style={styles.small}>{labels[phase]}</Text><Text style={styles.dots}>•••</Text></View>}
      <View style={styles.aiBubble}><Text style={styles.message}>{q}</Text></View>
      {!!voices.current[index]&&<View>{audioRow(index)}<Text style={styles.voiceCaption}>Synthetic voice · {settings.current.ttsProvider==='gemini'?(settings.current.geminiVoice||'Kore'):'ElevenLabs'}</Text></View>}
    </View>
  </View>;
  return <DesignFrame chat>
    <View style={styles.header}>
      <GlassButton label="Close interview" onPress={()=>setConfirmClose(true)} style={styles.close}><DesignIcon name="close"/><Text style={styles.headerLabel}>Close chat</Text></GlassButton>
      <View style={styles.headerRight}><View style={styles.round}><View style={styles.dot}/><Text style={styles.headerLabel}>Round {Math.min(rounds.length+1,TOTAL_ROUNDS)} of 5</Text></View><GlassButton label={muted?'Unmute voice':'Mute voice'} onPress={toggleMute} style={[styles.speaker,muted&&{opacity:.45}]}><DesignIcon name="speaker"/></GlassButton></View>
    </View>
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView ref={log} showsVerticalScrollIndicator={false} contentContainerStyle={styles.log} onContentSizeChange={()=>log.current?.scrollToEnd({animated:true})}>
        <View style={styles.topicRow}><LinearGradient colors={['#FF6F26','#FF500B','#DE3400']} style={styles.topicBubble}><Text style={styles.topicText}>{topic}</Text></LinearGradient><Text style={styles.timestamp}>Interview topic</Text></View>
        {rounds.map((round,index)=><React.Fragment key={index}>
          {ai(round.question,index)}
          <View style={styles.answerBubble}>
            {recordings.current[index]&&audioRow(index,true)}
            {!collapsed[index]&&<View style={styles.transcript}><Text style={styles.message}>{round.answer}</Text><View style={styles.answerMeta}><Text style={styles.timestamp}>Your answer</Text><DesignIcon name="check"/></View></View>}
          </View>
        </React.Fragment>)}
        {question ? ai(question,rounds.length,true) : <View style={styles.thinking}><Orb/><Text style={styles.small}>{labels[phase]}</Text><ActivityIndicator size="small" color={DESIGN.orange}/></View>}
      </ScrollView>
      <View style={styles.footer}>
        <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill}/><LinearGradient pointerEvents="none" colors={['rgba(7,5,4,.55)','rgba(7,5,4,.97)','#000']} style={StyleSheet.absoluteFill}/>
        <View style={styles.footerContent}>{confirmClose?<View style={styles.confirm}><Text style={styles.footerText}>End this interview?</Text><Text style={styles.status}>This session won't be saved.</Text><View style={styles.confirmButtons}><GlassButton label="Continue interview" onPress={()=>setConfirmClose(false)} style={styles.confirmButton}><Text style={styles.headerLabel}>Keep practicing</Text></GlassButton><GlassButton label="End interview" onPress={()=>void close()} style={styles.confirmButton}><Text style={styles.headerLabel}>End session</Text></GlassButton></View></View>:<>
          <Text accessibilityLiveRegion="polite" style={styles.status}>{error?'Something went wrong':paused?'Recording paused':labels[phase]}{phase==='recording'?` · ${time(seconds)}`:''}</Text>
          {error?<View style={styles.error}><Text style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" onPress={()=>{if(retry.current)void perform(retry.current);else setError('');}}><Text style={styles.retry}>{retry.current?'Try again':'Dismiss'}</Text></Pressable></View>:phase==='idle'?<TextInput accessibilityLabel="Type your interview answer" multiline value={answer} onChangeText={setAnswer} placeholder="Type an answer or tap the mic to speak." placeholderTextColor="#FFF" style={styles.answerInput}/>:<Text style={styles.footerText}>{phase==='recording'?(paused?'Tap pause to resume.':'Speak freely. Tap send when you’re ready.') : phase==='transcribing'?'Turning your words into text…':phase==='speaking'?'Listen to the question, then take your time.':'Preparing your next question…'}</Text>}
          <View style={styles.controls}>
            <GlassButton label={paused?'Resume recording':'Pause recording'} onPress={pause} disabled={phase!=='recording'} style={styles.sideControl}><View style={styles.pauseBars}><View style={styles.pauseBar}/><View style={styles.pauseBar}/></View></GlassButton>
            <GlowButton onPress={record} disabled={!canRecord} recording={phase==='recording'}/>
            <GlassButton label="Submit answer" onPress={send} disabled={!!error||(phase!=='recording'&&!(phase==='idle'&&answer.trim()))} style={styles.sideControl}><View style={{transform:[{rotate:'45deg'}]}}><DesignIcon name="send"/></View></GlassButton>
          </View>
        </>}</View>
      </View>
    </KeyboardAvoidingView>
  </DesignFrame>;
}
const styles=StyleSheet.create({
  fill:{flex:1},header:{paddingHorizontal:16,paddingTop:12,paddingBottom:0,flexDirection:'row',justifyContent:'space-between',alignItems:'center',height:56},close:{paddingHorizontal:12,height:44},headerLabel:{fontFamily:DESIGN.medium,fontSize:12,color:'rgba(255,255,255,.9)'},headerRight:{flexDirection:'row',gap:8,alignItems:'center'},round:{flexDirection:'row',alignItems:'center',gap:6,borderWidth:1,borderColor:'rgba(255,255,255,.1)',borderRadius:99,paddingHorizontal:10,height:32,backgroundColor:'rgba(255,255,255,.1)'},dot:{width:6,height:6,borderRadius:3,backgroundColor:'#F97316'},speaker:{width:44,height:44},
  log:{padding:16,gap:16,paddingBottom:24},topicRow:{alignItems:'flex-end'},topicBubble:{maxWidth:'85%',padding:17,borderWidth:1,borderColor:'rgba(255,255,255,.2)',borderRadius:24,borderTopRightRadius:6},topicText:{fontFamily:DESIGN.medium,fontSize:14,lineHeight:19.6,letterSpacing:-.35,color:'#FFF'},timestamp:{fontFamily:DESIGN.font,fontSize:12,lineHeight:18,color:'rgba(255,255,255,.4)',paddingTop:4,paddingRight:8},
  aiRow:{flexDirection:'row',gap:10},orbMargin:{paddingTop:4},aiContent:{flex:1,gap:10},aiBubble:{padding:17,borderWidth:1,borderColor:DESIGN.border,backgroundColor:DESIGN.panel,borderRadius:24,borderTopLeftRadius:6},message:{fontFamily:DESIGN.font,fontSize:15,lineHeight:23,color:'#E4E4E7'},phasePill:{flexDirection:'row',alignItems:'center',gap:8,alignSelf:'flex-start',paddingHorizontal:11,paddingVertical:5,backgroundColor:'rgba(0,0,0,.4)',borderRadius:99,borderWidth:1,borderColor:'rgba(255,255,255,.05)'},small:{fontFamily:DESIGN.medium,fontSize:12,lineHeight:18,color:'#A1A1AA'},dots:{color:'#FB923C',letterSpacing:2},
  audioRow:{height:50,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:13,backgroundColor:'rgba(24,16,12,.65)',borderWidth:1,borderColor:DESIGN.border,borderRadius:16},play:{width:28,height:28,borderRadius:14,backgroundColor:'#F58C1E',alignItems:'center',justifyContent:'center'},duration:{fontFamily:DESIGN.font,color:'#A1A1AA',fontSize:12},voiceCaption:{fontFamily:DESIGN.font,fontSize:12,color:'#B8ADA7',paddingLeft:4,paddingTop:4},answerBubble:{alignSelf:'flex-end',width:'88%',padding:12,gap:10,borderRadius:24,borderTopRightRadius:6,backgroundColor:'rgba(24,20,18,.8)',borderWidth:1,borderColor:'rgba(249,115,22,.25)'},transcript:{borderTopWidth:1,borderTopColor:'rgba(255,255,255,.05)',paddingTop:4},answerMeta:{flexDirection:'row',justifyContent:'flex-end',alignItems:'center',gap:4},collapse:{width:24,height:24,borderRadius:12,borderWidth:1,borderColor:'rgba(249,115,22,.2)',backgroundColor:'rgba(0,0,0,.4)',alignItems:'center',justifyContent:'center'},thinking:{flexDirection:'row',alignItems:'center',gap:10},
  footerContent:{zIndex:1,gap:20},footer:{paddingHorizontal:24,paddingTop:28,paddingBottom:28,gap:20,overflow:'hidden',minHeight:282},status:{fontFamily:DESIGN.medium,fontSize:12,lineHeight:18,letterSpacing:.3,color:'#A1A1AA',textAlign:'center'},footerText:{fontFamily:DESIGN.semibold,fontSize:20,lineHeight:27,letterSpacing:-.4,textAlign:'center',color:'#FFF',minHeight:81,paddingHorizontal:8},answerInput:{fontFamily:DESIGN.semibold,fontSize:20,lineHeight:27,letterSpacing:-.4,textAlign:'center',color:'#FFF',height:81,paddingHorizontal:8},controls:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:24,paddingTop:4},sideControl:{width:48,height:48},pauseBars:{flexDirection:'row',gap:4},pauseBar:{width:4,height:14,borderRadius:9,backgroundColor:'rgba(255,255,255,.8)'},error:{gap:8,minHeight:81},errorText:{fontFamily:DESIGN.font,fontSize:13,lineHeight:20,color:'#FFD7AA',textAlign:'center'},retry:{color:'#FB923C',fontFamily:DESIGN.semibold,textAlign:'center',padding:8},confirm:{gap:16},confirmButtons:{flexDirection:'row',justifyContent:'center',gap:12},confirmButton:{paddingHorizontal:16,paddingVertical:12},
});
