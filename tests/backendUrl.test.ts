import {resolveBackendUrl} from '../src/services/backendUrl';
it('keeps main PC and native backend configuration unchanged',()=>{
 expect(resolveBackendUrl('http://localhost:8787/','http://localhost:8083')).toBe('http://localhost:8787');
 expect(resolveBackendUrl('http://localhost:8787/')).toBe('http://localhost:8787');
});
it('uses the secure phone gateway for history, custom voice and timing requests',()=>{
 expect(resolveBackendUrl('http://localhost:8787','https://test.trycloudflare.com')).toBe('https://test.trycloudflare.com');
 expect(resolveBackendUrl('http://127.0.0.1:8787','https://private.ts.net')).toBe('https://private.ts.net');
 expect(resolveBackendUrl('http://localhost:8787','http://127.0.0.1:8085')).toBe('http://127.0.0.1:8085');
});
it('preserves intentional remote backends and rejects implicit insecure routing',()=>{
 expect(resolveBackendUrl('https://api.example.com/','https://phone.example.com')).toBe('https://api.example.com');
 expect(resolveBackendUrl('http://localhost:8787','http://192.168.1.2')).toBe('http://localhost:8787');
 expect(resolveBackendUrl('','https://test.trycloudflare.com')).toBe('');
});
