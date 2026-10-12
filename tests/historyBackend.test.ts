jest.mock('../src/store/settingsStore',()=>({loadSettings:jest.fn(async()=>({geminiApiKey:'test-owner'}))}));
jest.mock('../src/dev/designPreview',()=>({designPreviewEnabled:false}));
import {createBackendHistory, historyRequest} from '../src/services/historyBackend';

it('imports once and retries a failed migration without publishing success',async()=>{
 const request=jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({records:[],deleted:[]});
 const history=createBackendHistory(request);
 await expect(history.migrate('legacy',[{id:'old',value:{id:'old'}}])).rejects.toThrow('offline');
 await history.migrate('legacy',[{id:'old',value:{id:'old'}}]);
 await history.migrate('legacy',[]);
 expect(request).toHaveBeenCalledTimes(2);
});

it('uses revisions from loaded records and does not advance them after a conflict',async()=>{
 const request=jest.fn().mockResolvedValueOnce({records:[{id:'one',value:{id:'one'},revision:4}],deleted:[]})
  .mockRejectedValueOnce(new Error('conflict')).mockResolvedValueOnce({revision:5});
 const history=createBackendHistory(request);
 await history.list('ab');
 await expect(history.save('ab','one',{id:'one'})).rejects.toThrow('conflict');
 await history.save('ab','one',{id:'one'});
 expect(request.mock.calls[1][2]).toMatchObject({expectedRevision:4});
 expect(request.mock.calls[2][2]).toMatchObject({expectedRevision:4});
});

it('tracks successful saves for subsequent updates and deletion',async()=>{
 const request=jest.fn().mockResolvedValueOnce({revision:1}).mockResolvedValueOnce({revision:2}).mockResolvedValueOnce({revision:3});
 const history=createBackendHistory(request);
 await history.save('legacy','new',{id:'new'});
 await history.save('legacy','new',{id:'new',topic:'changed'});
 await history.remove('legacy','new');
 expect(request.mock.calls.map(call=>call[2].expectedRevision)).toEqual([0,1,2]);
});

it('authenticates requests and surfaces remote conflicts without exposing credentials',async()=>{
 const original=process.env.EXPO_PUBLIC_TTS_BACKEND_URL;
 process.env.EXPO_PUBLIC_TTS_BACKEND_URL='http://backend';
 const originalFetch=global.fetch;
 global.fetch=jest.fn(async()=>({status:409,ok:false}) as Response);
 try {
  await expect(historyRequest('/api/storage/ab/one','PUT',{expectedRevision:1})).rejects.toThrow('Reopen');
  expect(global.fetch).toHaveBeenCalledWith('http://backend/api/storage/ab/one',expect.objectContaining({headers:expect.objectContaining({Authorization:'Bearer test-owner'})}));
 } finally {global.fetch=originalFetch;if(original===undefined)delete process.env.EXPO_PUBLIC_TTS_BACKEND_URL;else process.env.EXPO_PUBLIC_TTS_BACKEND_URL=original;}
});

it.each([
 [{status:200,ok:true,redirected:true}, 'session expired'],
 [{status:200,ok:true,redirected:false,headers:{get:()=> 'text/html'}}, 'session expired'],
 [{status:403,ok:false,redirected:false}, 'HTTP 403'],
])('distinguishes an access login page from a backend HTTP failure: %j',async(response,message)=>{
 const original=process.env.EXPO_PUBLIC_TTS_BACKEND_URL;
 const originalFetch=global.fetch;
 process.env.EXPO_PUBLIC_TTS_BACKEND_URL='http://backend';
 global.fetch=jest.fn(async()=>response as Response);
 try {
  await expect(historyRequest('/api/storage/ab')).rejects.toThrow(message);
  expect(global.fetch).toHaveBeenCalledWith('http://backend/api/storage/ab',expect.objectContaining({credentials:'same-origin'}));
 } finally { global.fetch=originalFetch;if(original===undefined)delete process.env.EXPO_PUBLIC_TTS_BACKEND_URL;else process.env.EXPO_PUBLIC_TTS_BACKEND_URL=original; }
});
