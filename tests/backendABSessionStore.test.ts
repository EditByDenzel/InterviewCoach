const mockLocal:Record<string,string>={};
const mockBackend={list:jest.fn(),migrate:jest.fn(async()=>{}),save:jest.fn(async()=>{}),remove:jest.fn(async()=>{})};
const mockMigrateAudio=jest.fn(async()=>{}),mockDeleteAudio=jest.fn(async()=>{});
jest.mock('@react-native-async-storage/async-storage',()=>({getItem:jest.fn(async(key:string)=>mockLocal[key]??null),setItem:jest.fn(async(key:string,value:string)=>{mockLocal[key]=value;})}));
jest.mock('../src/services/historyBackend',()=>({historyBackendEnabled:()=>true,backendHistory:mockBackend}));
jest.mock('../src/store/audioAssetStore',()=>({migrateAudioAssets:(...args:any[])=>(mockMigrateAudio as any)(...args),deleteAudioAssets:(...args:any[])=>(mockDeleteAudio as any)(...args)}));
import {createABSession,startA,appendTurn} from '../src/domain/abSession';
const session=(id:string,audio='clip')=>appendTurn({...startA(createABSession({id:'scenario',title:'Life after school',objective:'Discuss',role:'Tasker',facts:[],constraints:[],language:'Thai',minMinutes:1,maxMinutes:5},{voice:'Onyi',style:'Ordinary adult'})),id},
 {id:'reply',run:'A',speaker:'model',sourceText:'Original',englishText:'English',createdAt:new Date().toISOString(),audioAssetId:audio});
beforeEach(()=>{jest.resetModules();jest.clearAllMocks();mockBackend.list.mockReset();for(const key of Object.keys(mockLocal))delete mockLocal[key];});

it('migrates recordings before metadata and returns backend history',async()=>{
 const local=session('old');mockLocal['@coachie_ab_sessions_v1']=JSON.stringify([local]);
 mockBackend.list.mockResolvedValueOnce({records:[],deleted:[]}).mockResolvedValue({records:[{id:'old',value:local,revision:1}],deleted:[]});
 const store=require('../src/store/abSessionStore');
 expect((await store.listABSessions())[0].id).toBe('old');
 expect(mockMigrateAudio).toHaveBeenCalledWith(['clip']);
 expect(mockMigrateAudio.mock.invocationCallOrder[0]).toBeLessThan(mockBackend.migrate.mock.invocationCallOrder[0]);
});

it('does not upload recordings or restore metadata for backend-deleted chats',async()=>{
 mockLocal['@coachie_ab_sessions_v1']=JSON.stringify([session('deleted')]);
 mockBackend.list.mockResolvedValue({records:[],deleted:['deleted']});
 const store=require('../src/store/abSessionStore');
 expect(await store.listABSessions()).toEqual([]);
 expect(mockMigrateAudio).toHaveBeenCalledWith([]);
 expect(mockBackend.migrate).toHaveBeenCalledWith('ab',[]);
});

it('preserves local history when recording migration fails and retries later',async()=>{
 const raw=JSON.stringify([session('old')]);mockLocal['@coachie_ab_sessions_v1']=raw;
 mockBackend.list.mockResolvedValue({records:[],deleted:[]});
 mockMigrateAudio.mockRejectedValueOnce(new Error('upload failed'));
 const store=require('../src/store/abSessionStore');
 await expect(store.listABSessions()).rejects.toThrow('upload failed');
 expect(mockLocal['@coachie_ab_sessions_v1']).toBe(raw);
 expect(mockBackend.migrate).not.toHaveBeenCalled();
 await store.listABSessions();expect(mockBackend.migrate).toHaveBeenCalledTimes(1);
});

it('saves new replies only through the backend and retains original source context',async()=>{
 mockBackend.list.mockResolvedValue({records:[],deleted:[]});
 const store=require('../src/store/abSessionStore');
 const next=session('new');await store.saveABSession(next);
 expect(mockBackend.save).toHaveBeenCalledWith('ab','new',next);
 expect(mockLocal['@coachie_ab_sessions_v1']).toBeUndefined();
});
