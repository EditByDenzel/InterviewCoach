import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedConversation } from '../types';
import { sampleConversations } from './sampleConversations';

const KEY = '@coachie_conversations_v1';
let queue: Promise<void> = Promise.resolve();
const isConversation = (value: any): value is SavedConversation => value && typeof value.id==='string' && typeof value.topic==='string' && Array.isArray(value.rounds) && typeof value.updatedAt==='string';

export async function loadConversations(): Promise<SavedConversation[]> {
  const raw=await AsyncStorage.getItem(KEY);
  if(!raw)return [];
  let values:unknown;
  try {values=JSON.parse(raw);} catch {throw new Error('Your saved conversation history could not be read.');}
  if(!Array.isArray(values))throw new Error('Your saved conversation history could not be read.');
  return values.filter(isConversation).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}

export function saveConversation(conversation:SavedConversation):Promise<void> {
  // Serialize read/modify/write so rapid answers never overwrite another save.
  const operation=queue.catch(()=>{}).then(async()=>{
    const existing=await loadConversations();
    await AsyncStorage.setItem(KEY,JSON.stringify([conversation,...existing.filter(item=>item.id!==conversation.id)]));
  });
  queue=operation;
  return operation;
}

export function createConversationId() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`; }

/** Samples are bundled, clearly labeled, and never written over personal history. */
export async function loadConversationLibrary(): Promise<SavedConversation[]> {
  const saved = await loadConversations();
  return [...saved, ...sampleConversations.filter(sample => !saved.some(item => item.id === sample.id))];
}

