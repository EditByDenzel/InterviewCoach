import React, { PropsWithChildren } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { DESIGN, DesignFrame } from './CoachieDesign';
import { MotionPressable } from './Motion';

export function SettingIcon({name, color='#D5CBC5'}:{name:string;color?:string}) {
  const paths:Record<string,string> = {
    back:'M19 12H5m6-6-6 6 6 6', chevron:'m9 6 6 6-6 6', check:'m5 12 4 4L19 6',
    language:'M3 5h12M9 3v2M5 5c0 6 4 9 9 11M13 5c0 5-4 9-10 11m12 4 4-11 4 11m-6-4h5',
    voice:'M9 18v3m6-3v3M5 10v2a7 7 0 0 0 14 0v-2M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3',
    key:'M14 10l7-7m-3 3 3 3M14 10a6 6 0 1 1-4-4',
    info:'M12 11v6m0-10v.1', eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12',
  };
  return <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><Path d={paths[name]||paths.info}/>{name==='info'&&<Circle cx={12} cy={12} r={9}/>} {name==='eye'&&<Circle cx={12} cy={12} r={3}/>}</Svg>;
}
export function SettingsPage({title,back,children,footer}:{title:string;back:()=>void;children:React.ReactNode;footer?:React.ReactNode}) {
  return <DesignFrame chat><View style={S.header}><MotionPressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={S.back}><SettingIcon name="back"/></MotionPressable><Text accessibilityRole="header" style={S.headerTitle}>{title}</Text><View style={{width:44}}/></View><ScrollView style={{flex:1,minHeight:0,...(Platform.OS==='web'?{scrollbarWidth:'thin',scrollbarColor:'#88563B transparent'}:{})} as any} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator contentContainerStyle={S.content}>{children}</ScrollView>{footer&&<View style={{paddingHorizontal:24,paddingVertical:16,backgroundColor:'rgba(10,5,3,.92)'}}>{footer}</View>}</DesignFrame>;
}
export function Group({children}:PropsWithChildren) {return <View style={S.group}>{children}</View>;}
export function SettingRow({title,detail,icon,onPress,selected,last=false,disabled=false}:{title:string;detail?:string;icon?:string;onPress:()=>void;selected?:boolean;last?:boolean;disabled?:boolean}) {
 return <MotionPressable accessibilityRole="button" accessibilityLabel={detail?`${title}, ${detail}`:title} accessibilityState={{selected}} disabled={disabled} onPress={onPress} style={[S.row,!last&&S.separator]}>{icon&&<View style={S.icon}><SettingIcon name={icon}/></View>}<View style={S.rowText}><Text style={S.title}>{title}</Text>{detail&&<Text style={S.detail}>{detail}</Text>}</View>{selected===false?<Svg width={20} height={20} viewBox="0 0 24 24"><Circle cx={12} cy={12} r={8} fill="none" stroke="#9D8D82" strokeWidth={1.5}/></Svg>:<SettingIcon name={selected?'check':'chevron'} color={selected?'#FFB083':'#9D8D82'}/>}</MotionPressable>;
}
export function Action({title,onPress,disabled=false,secondary=false}:{title:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}) {return <MotionPressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[S.action,secondary&&{backgroundColor:'rgba(255,255,255,.08)',borderWidth:1,borderColor:'rgba(255,255,255,.12)'}]}><Text style={[S.actionText,secondary&&{color:'#FFF'}]}>{title}</Text></MotionPressable>;}
export const S=StyleSheet.create({
 header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingVertical:12},back:{width:44,height:44,borderRadius:22,backgroundColor:'rgba(255,255,255,.08)',alignItems:'center',justifyContent:'center'},headerTitle:{fontFamily:DESIGN.medium,fontSize:17,color:DESIGN.text},content:{padding:24,paddingTop:20,paddingBottom:40,gap:24},
 group:{borderRadius:24,backgroundColor:'rgba(37,29,24,.9)',overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,.07)'},row:{minHeight:68,paddingHorizontal:16,paddingVertical:16,flexDirection:'row',alignItems:'center',gap:12},separator:{borderBottomWidth:1,borderBottomColor:'rgba(255,255,255,.06)'},icon:{width:24,alignItems:'center'},rowText:{flex:1,minWidth:0,gap:4},title:{fontFamily:DESIGN.medium,color:DESIGN.text,fontSize:15,lineHeight:21},detail:{fontFamily:DESIGN.font,color:'#B8ADA7',fontSize:13,lineHeight:19},label:{fontFamily:DESIGN.medium,fontSize:12,letterSpacing:1,color:'#C4B4A9',marginBottom:10},heading:{fontFamily:DESIGN.semibold,color:DESIGN.text,fontSize:30,lineHeight:34,letterSpacing:-.8},body:{fontFamily:DESIGN.font,color:'#E3D8D2',fontSize:15,lineHeight:23},action:{minHeight:52,padding:16,borderRadius:26,backgroundColor:'#FFB083',alignItems:'center',justifyContent:'center'},actionText:{color:'#311105',fontFamily:DESIGN.semibold,fontSize:15},input:{fontFamily:DESIGN.font,fontSize:16,color:'#FFF',minHeight:54,padding:16,borderRadius:16,backgroundColor:'rgba(0,0,0,.25)',borderWidth:1,borderColor:'#574338',flex:1,minWidth:0},error:{color:'#FFC0B8',fontFamily:DESIGN.font,fontSize:14,lineHeight:21},message:{color:'#FFD4B9',fontFamily:DESIGN.font,fontSize:14,lineHeight:21},
});
