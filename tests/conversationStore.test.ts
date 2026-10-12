const mockStorage:Record<string,string>={};
jest.mock('@react-native-async-storage/async-storage',()=>({getItem:jest.fn(async(key:string)=>mockStorage[key]??null),setItem:jest.fn(async(key:string,value:string)=>{mockStorage[key]=value;})}));
import {deleteConversation,loadConversations,loadConversationLibrary,saveConversation} from '../src/store/conversationStore';
import {SavedConversation} from '../src/types';
import {homeConversationCards} from '../src/store/homeConversationCards';
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

it('Home shows every real chat ahead of only the surviving samples',async()=>{
 await saveConversation(conversation('older'));
 await saveConversation({...conversation('newer','2026-10-10T12:00:00Z'),isAB:true,status:'completed',rounds:[{roundNumber:1,question:'Q',answer:'A'}]});
 await deleteConversation('sample-mock-interview');
 const cards=homeConversationCards(await loadConversationLibrary());
 expect(cards.map(card=>card.id)).toEqual(['newer','older','sample-architecture','sample-behavioral']);
 expect(cards[0]).toMatchObject({isRecent:true,isAB:true,status:'Completed',rounds:1});
 expect(cards[2]).toMatchObject({isRecent:false,label:'System\nArchitecture\nReview',rounds:4});
});

it('Home does not recreate examples when all examples are deleted or the library is empty',async()=>{
 await Promise.all(['sample-mock-interview','sample-architecture','sample-behavioral'].map(deleteConversation));
 expect(homeConversationCards(await loadConversationLibrary())).toEqual([]);
 expect(homeConversationCards([])).toEqual([]);
});

it('a Home refresh observes pending saves and deletions without waiting for a vote',async()=>{
 const saving=saveConversation(conversation('in-progress'));
 const cards=homeConversationCards(await loadConversationLibrary());
 await saving;
 expect(cards[0]).toMatchObject({id:'in-progress',status:'In progress'});
 const deleting=deleteConversation('sample-architecture');
 const refreshed=homeConversationCards(await loadConversationLibrary());
 await deleting;
 expect(refreshed.some(card=>card.id==='sample-architecture')).toBe(false);
});

it('updated older chats move to the front without mutating the shared library',async()=>{
 await saveConversation(conversation('one'));
 await saveConversation(conversation('two','2026-10-10T12:00:00Z'));
 await saveConversation({...conversation('one','2026-10-11T12:00:00Z'),topic:'Updated topic'});
 const library=await loadConversationLibrary();
 const before=library.map(item=>item.id);
 expect(homeConversationCards(library).slice(0,2).map(card=>card.id)).toEqual(['one','two']);
 expect(homeConversationCards(library)[0].topic).toBe('Updated topic');
 expect(library.map(item=>item.id)).toEqual(before);
});
