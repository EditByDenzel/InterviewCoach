const mockStorage:Record<string,string>={};
jest.mock('@react-native-async-storage/async-storage',()=>({getItem:jest.fn(async(key:string)=>mockStorage[key]??null),setItem:jest.fn(async(key:string,value:string)=>{mockStorage[key]=value;})}));
import {deleteConversation,loadConversations,loadConversationLibrary,saveConversation} from '../src/store/conversationStore';
import {SavedConversation} from '../src/types';
const conversation=(id:string,updatedAt='2026-10-09T12:00:00Z'):SavedConversation=>({id,topic:'Engineering',createdAt:updatedAt,updatedAt,rounds:[],currentQuestion:'How would you design this?',closingMessage:'',status:'in_progress',language:'Thai',voice:'Kore'});
beforeEach(()=>{for(const key of Object.keys(mockStorage))delete mockStorage[key];});
it('saves unfinished questions and then replaces the same session with its full transcript',async()=>{
 await saveConversation(conversation('one'));
 expect((await loadConversations())[0].currentQuestion).toBe('How would you design this?');
 await saveConversation({...conversation('one'),rounds:[{roundNumber:1,question:'How would you design this?',answer:'With a queue.'}],currentQuestion:'',closingMessage:'Good reasoning.',status:'completed'});
 const loaded=await loadConversations();expect(loaded).toHaveLength(1);expect(loaded[0]).toMatchObject({language:'Thai',voice:'Kore',status:'completed',closingMessage:'Good reasoning.'});expect(loaded[0].rounds[0].answer).toBe('With a queue.');
});
it('serializes concurrent saves and returns the newest conversations first',async()=>{
 await Promise.all([saveConversation(conversation('first')),saveConversation(conversation('second','2026-10-09T13:00:00Z'))]);
 expect((await loadConversations()).map(item=>item.id)).toEqual(['second','first']);
});
it('does not overwrite unreadable history with a new session',async()=>{
 mockStorage['@coachie_conversations_v1']='broken';
 await expect(saveConversation(conversation('new'))).rejects.toThrow('could not be read');
 expect(mockStorage['@coachie_conversations_v1']).toBe('broken');
});
it('includes distinct 3, 4 and 5 round samples without modifying saved history',async()=>{
 await saveConversation(conversation('personal'));
 const library=await loadConversationLibrary();
 const samples=library.filter(item=>item.isSample);
 expect(samples.map(item=>item.rounds.length)).toEqual([3,4,5]);
 expect(new Set(samples.map(item=>item.id)).size).toBe(3);
 expect(samples.every(item=>item.rounds.every(round=>!!round.question&&!!round.answer)&&!!item.closingMessage)).toBe(true);
 expect((await loadConversations()).map(item=>item.id)).toEqual(['personal']);
 expect((await loadConversationLibrary()).map(item=>item.id)).toEqual(library.map(item=>item.id));
});

it.each([
 {...conversation('bad'),rounds:[{roundNumber:1,question:null,answer:'Answer'}]},
 {...conversation('bad'),rounds:[{roundNumber:1,question:'Question',answer:7}]},
 {...conversation('bad'),status:'unknown'},
 {...conversation('bad'),createdAt:'not-a-date'},
])('preserves malformed nested history instead of crashing or filtering it away',async bad=>{
 const raw=JSON.stringify([conversation('good'),bad]);
 mockStorage['@coachie_conversations_v1']=raw;
 await expect(loadConversations()).rejects.toThrow('preserved');
 await expect(saveConversation(conversation('new'))).rejects.toThrow('preserved');
 await expect(deleteConversation('good')).rejects.toThrow('preserved');
 expect(mockStorage['@coachie_conversations_v1']).toBe(raw);
});

it('snapshots pending saves before caller mutation',async()=>{
 const original={...conversation('one'),rounds:[{roundNumber:1,question:'Original',answer:'Answer'}]};
 const saving=saveConversation(original);
 original.rounds[0].question='Changed later';
 await saving;
 expect((await loadConversations())[0].rounds[0].question).toBe('Original');
});

it('keeps personal records when deleting a sample and remembers the deletion',async()=>{
 await saveConversation(conversation('personal'));
 const sample=(await loadConversationLibrary()).find(item=>item.isSample)!;
 await deleteConversation(sample.id);
 expect((await loadConversationLibrary()).some(item=>item.id===sample.id)).toBe(false);
 expect((await loadConversations()).map(item=>item.id)).toEqual(['personal']);
});

it('preserves both keys when sample deletion metadata is malformed',async()=>{
 await saveConversation(conversation('personal'));
 const sample=(await loadConversationLibrary()).find(item=>item.isSample)!;
 const before=mockStorage['@coachie_conversations_v1'];
 mockStorage['@coachie_deleted_samples_v1']='{"broken":true}';
 await expect(loadConversationLibrary()).rejects.toThrow('preserved');
 await expect(deleteConversation(sample.id)).rejects.toThrow('preserved');
 expect(mockStorage['@coachie_conversations_v1']).toBe(before);
 expect(mockStorage['@coachie_deleted_samples_v1']).toBe('{"broken":true}');
});
