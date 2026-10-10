import AsyncStorage from '@react-native-async-storage/async-storage';
import { SavedConversation } from '../types';
import { sampleConversations } from './sampleConversations';

const KEY = '@coachie_conversations_v1';
let queue: Promise<void> = Promise.resolve();
const historyError = () => new Error('Your saved conversation history could not be read. The stored data has been preserved.');
const isConversation = (value: any): value is SavedConversation => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const textFields = ['id', 'topic', 'createdAt', 'updatedAt', 'currentQuestion', 'closingMessage', 'language', 'voice'];
  return textFields.every(field => typeof value[field] === 'string') && !!value.id &&
    Number.isFinite(Date.parse(value.createdAt)) && Number.isFinite(Date.parse(value.updatedAt)) &&
    (value.status === 'in_progress' || value.status === 'completed') &&
    (value.isSample === undefined || typeof value.isSample === 'boolean') &&
    Array.isArray(value.rounds) && value.rounds.every((round: any) => round &&
      typeof round.question === 'string' && typeof round.answer === 'string' &&
      Number.isInteger(round.roundNumber) && round.roundNumber > 0);
};

export async function loadConversations(): Promise<SavedConversation[]> {
  const raw=await AsyncStorage.getItem(KEY);
  if(!raw)return [];
  let values:unknown;
  try {values=JSON.parse(raw);} catch {throw historyError();}
  // Do not filter malformed records: a later save would erase those records.
  if(!Array.isArray(values) || !values.every(isConversation))throw historyError();
  if(new Set(values.map(value=>value.id)).size!==values.length)throw historyError();
  return values.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}

export function saveConversation(conversation:SavedConversation):Promise<void> {
  if (!isConversation(conversation)) return Promise.reject(new Error('This conversation is incomplete and could not be saved.'));
  const snapshot = { ...conversation, rounds: conversation.rounds.map(round => ({ ...round })) };
  // Serialize read/modify/write so rapid answers never overwrite another save.
  const operation=queue.catch(()=>{}).then(async()=>{
    const existing=await loadConversations();
    await AsyncStorage.setItem(KEY,JSON.stringify([snapshot,...existing.filter(item=>item.id!==snapshot.id)]));
  });
  queue=operation;
  return operation;
}

const DELETED_SAMPLES_KEY = '@coachie_deleted_samples_v1';

async function loadDeletedSamples(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(DELETED_SAMPLES_KEY);
  if (!raw) return [];
  let values: unknown;
  try { values = JSON.parse(raw); } catch { throw historyError(); }
  if (!Array.isArray(values) || !values.every(value => typeof value === 'string')) throw historyError();
  return values;
}

export function deleteConversation(id: string): Promise<void> {
  const operation = queue.catch(() => {}).then(async () => {
    const existing = await loadConversations();
    const isSample = sampleConversations.some(s => s.id === id);
    const deleted = isSample ? await loadDeletedSamples() : [];
    // Validate both keys before changing either; corrupt tombstones must not
    // resurrect bundled examples or cause personal data to be rewritten.
    if (isSample) {
      if (!deleted.includes(id)) {
        await AsyncStorage.setItem(DELETED_SAMPLES_KEY, JSON.stringify([...deleted, id]));
      }
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(existing.filter(item => item.id !== id)));
  });
  queue = operation;
  return operation;
}

export function createConversationId() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`; }

/** Samples are bundled, clearly labeled, and never written over personal history. */
export async function loadConversationLibrary(): Promise<SavedConversation[]> {
  const saved = await loadConversations();
  const deletedSamples = await loadDeletedSamples();
  return [
    ...saved,
    ...sampleConversations.filter(sample => !saved.some(item => item.id === sample.id) && !deletedSamples.includes(sample.id))
  ];
}

