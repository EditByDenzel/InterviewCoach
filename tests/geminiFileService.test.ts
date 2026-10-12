import { uploadComparisonAudio } from '../src/services/geminiFileService';

const origin='https://generativelanguage.googleapis.com';
const file={name:'files/test-audio',uri:`${origin}/v1beta/files/test-audio`,mimeType:'audio/wav',state:'ACTIVE'};
const response=(json:unknown,headers:Record<string,string>={})=>({ok:true,json:async()=>json,headers:{get:(name:string)=>headers[name]||null}});
const originalFetch=global.fetch;
afterEach(()=>{global.fetch=originalFetch;jest.useRealTimers();});

it('uploads unchanged decoded bytes, returns an active file reference and deletes only that temporary file',async()=>{
 global.fetch=jest.fn().mockResolvedValueOnce(response(null,{'x-goog-upload-url':`${origin}/upload/v1beta/files?upload_id=private`}))
   .mockResolvedValueOnce(response({file})).mockResolvedValueOnce(response(null));
 const uploaded=await uploadComparisonAudio('private-key',{base64:'AQID',mimeType:'audio/wav'});
 expect(uploaded.fileData).toEqual({fileUri:file.uri,mimeType:file.mimeType});
 const calls=(global.fetch as jest.Mock).mock.calls;
 expect(calls[0][1].headers['X-Goog-Upload-Header-Content-Length']).toBe('3');
 expect(Array.from(new Uint8Array(calls[1][1].body))).toEqual([1,2,3]);
 await uploaded.remove();
 expect(calls[2][0]).toBe(`${origin}/v1beta/files/test-audio?key=private-key`);
 expect(calls[2][1].method).toBe('DELETE');
});

it('waits for processing before handing audio to the judging model',async()=>{
 jest.useFakeTimers();
 global.fetch=jest.fn().mockResolvedValueOnce(response(null,{'x-goog-upload-url':`${origin}/upload/v1beta/files?upload_id=private`}))
  .mockResolvedValueOnce(response({file:{...file,state:'PROCESSING'}})).mockResolvedValueOnce(response(file));
 const pending=uploadComparisonAudio('key',{base64:'AQID',mimeType:'audio/wav'});
 await jest.advanceTimersByTimeAsync(1000);
 expect((await pending).fileData.fileUri).toBe(file.uri);
 expect((global.fetch as jest.Mock).mock.calls[2][1].method).toBe('GET');
});

it('removes a failed processed file instead of returning an unusable reference',async()=>{
 global.fetch=jest.fn().mockResolvedValueOnce(response(null,{'x-goog-upload-url':`${origin}/upload/v1beta/files?upload_id=private`}))
  .mockResolvedValueOnce(response({file:{...file,state:'FAILED'}})).mockResolvedValueOnce(response(null));
 await expect(uploadComparisonAudio('key',{base64:'AQID',mimeType:'audio/wav'})).rejects.toThrow('could not prepare');
 expect((global.fetch as jest.Mock).mock.calls[2][1].method).toBe('DELETE');
});

it('rejects non-Google upload addresses without sending recording bytes',async()=>{
 global.fetch=jest.fn().mockResolvedValue(response(null,{'x-goog-upload-url':'https://untrusted.example/upload'}));
 await expect(uploadComparisonAudio('key',{base64:'AQID',mimeType:'audio/wav'})).rejects.toThrow('invalid audio upload address');
 expect(global.fetch).toHaveBeenCalledTimes(1);
});

it('times out a hung upload without exposing the key or signed URL',async()=>{
 jest.useFakeTimers();
 global.fetch=jest.fn().mockReturnValue(new Promise(()=>{}));
 const checked=expect(uploadComparisonAudio('private-key',{base64:'AQID',mimeType:'audio/wav'})).rejects.toThrow('timed out');
 await jest.advanceTimersByTimeAsync(240000);
 await checked;
});
