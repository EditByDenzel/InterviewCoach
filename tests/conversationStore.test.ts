const mockStorage:Record<string,string>={};
jest.mock('@react-native-async-storage/async-storage',()=>({getItem:jest.fn(async(key:string)=>mockStorage[key]??null),setItem:jest.fn(async(key:string,value:string)=>{mockStorage[key]=value;})}));
import {loadConversations,saveConversation} from '../src/store/conversationStore';
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
