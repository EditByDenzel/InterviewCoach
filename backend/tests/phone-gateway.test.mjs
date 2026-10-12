import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPhoneGateway} from '../phone-gateway.mjs';

test('phone gateway serves only exported app files and preserves backend bearer auth',async t=>{
 const root=await mkdtemp(join(tmpdir(),'coachie-phone-'));
 await writeFile(join(root,'index.html'),'phone build');await writeFile(join(root,'.env'),'must never be served');
 const backend=http.createServer((request,response)=>{
  assert.equal(request.headers.authorization,'Bearer test-owner');assert.equal(request.headers.origin,undefined);assert.equal(request.headers.cookie,undefined);
  response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify({records:[],deleted:[]}));
 });
 await new Promise(resolve=>backend.listen(0,'127.0.0.1',resolve));
 const gateway=createPhoneGateway({root,backendPort:backend.address().port});
 await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await Promise.all([new Promise(resolve=>gateway.close(resolve)),new Promise(resolve=>backend.close(resolve))]);await rm(root,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${gateway.address().port}`;
 assert.equal(await (await fetch(base)).text(),'phone build');
 assert.equal((await fetch(base+'/.env')).status,404);
 assert.equal((await fetch(base+'/api/other')).status,404);
 const response=await fetch(base+'/api/storage/ab',{headers:{authorization:'Bearer test-owner',origin:'https://phone.trycloudflare.com',cookie:'CF_Authorization=private'}});
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{records:[],deleted:[]});
 assert.equal((await fetch(base+'/index.html',{method:'POST'})).status,405);
});
