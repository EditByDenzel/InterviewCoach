import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const types = { '.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json',
  '.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.otf':'font/otf' };

/** Loopback only. Publish exclusively behind email-protected Cloudflare access. */
export function createPhoneGateway({ root, backendPort = 8787, onRequest = () => {} }) {
  const directory = resolve(root);
  return http.createServer(async (request,response)=>{
    response.setHeader('Cache-Control','no-store');
    response.setHeader('X-Content-Type-Options','nosniff');
    response.setHeader('Referrer-Policy','no-referrer');
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname); }
    catch { response.writeHead(400);response.end();return; }
    // Protected Quick Tunnel middleware can intercept root /api requests.
    // Keep public app routes under their own namespace and proxy internally.
    const apiPath = pathname.replace(/^\/coachie(?=\/api\/)/, '');
    const started = Date.now();
    // Metadata only: never log credentials, cookies, chat IDs, bodies or text.
    response.once('finish', () => onRequest({ time: new Date().toISOString(),
      kind: apiPath.startsWith('/api/') ? apiPath.split('/').slice(0,3).join('/') : extname(pathname) || 'page',
      method: request.method, status: response.statusCode, durationMs: Date.now()-started,
      hasBearer: !!(request.headers.authorization || request.headers['x-coachie-authorization']), throughTunnel: !!request.headers['cf-ray'] }));
    if (apiPath.startsWith('/api/')) {
      // This proxy never injects a Gemini key. The app still authenticates every API call.
      if (!/^\/api\/(tts|telemetry|storage\/(ab|legacy|samples)(\/[^/]+)?|assets\/[^/]+)$/.test(apiPath)) {response.writeHead(404);response.end();return;}
      const headers={...request.headers,host:`127.0.0.1:${backendPort}`};
      // Cloudflare owns its access headers; our independent bearer still has
      // to pass the backend's existing constant-time owner-key check.
      if (headers['x-coachie-authorization']) headers.authorization=headers['x-coachie-authorization'];
      delete headers['x-coachie-authorization'];
      // The gateway and backend are trusted local peers. Remote requests are
      // same-origin; preserve bearer auth and let the backend validate it.
      delete headers.origin;delete headers.cookie;delete headers['cf-access-jwt-assertion'];
      const upstream=http.request({hostname:'127.0.0.1',port:backendPort,path:request.url.replace(/^\/coachie(?=\/api\/)/, ''),method:request.method,headers},remote=>{
        response.writeHead(remote.statusCode,remote.headers);remote.pipe(response);
      });
      upstream.setTimeout(250000,()=>upstream.destroy());
      upstream.on('error',()=>{if(!response.headersSent)response.writeHead(502,{'Content-Type':'application/json'});response.end(JSON.stringify({error:'The PC backend is unavailable. Please retry.'}));});
      request.on('aborted',()=>upstream.destroy());request.pipe(upstream);return;
    }
    if (!['GET','HEAD'].includes(request.method)) {response.writeHead(405);response.end();return;}
    const relative=pathname.replace(/^\/+/, '') || 'index.html';
    const file=resolve(directory,relative);
    if (!file.startsWith(directory+sep) || relative.split(/[\\/]/).some(part=>part.startsWith('.'))) {response.writeHead(404);response.end();return;}
    try {
      const data=await stat(file);
      if(!data.isFile())throw new Error('not a file');
      const contents=request.method==='HEAD'?undefined:await readFile(file);
      response.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});
      response.end(contents);
    } catch {response.writeHead(404);response.end();}
  });
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const root=fileURLToPath(new URL('../artifacts/phone/web/',import.meta.url));
  createPhoneGateway({root, onRequest: event => console.log(JSON.stringify(event))}).listen(8085,'127.0.0.1',()=>console.log('Coachie protected-phone origin ready on loopback port 8085'));
}
