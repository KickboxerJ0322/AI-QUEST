import http from 'node:http';
import { readFile } from 'node:fs/promises';
const port = Number(process.env.PORT || 8080);
const assets = new Map([
  ['/', ['public/index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['public/index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['public/style.css', 'text/css; charset=utf-8']],
  ['/game.js', ['public/game.js', 'text/javascript; charset=utf-8']],
  ['/app.js', ['public/app.js', 'text/javascript; charset=utf-8']]
]);
const files = new Map();
for (const [url, [path, type]] of assets) files.set(url, { data: await readFile(new URL('./'+path, import.meta.url)), type });
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  'Cache-Control': 'no-store'
};
http.createServer((req, res) => {
  const path = (req.url || '').split('?')[0];
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, {...securityHeaders,'Allow':'GET, HEAD'}); res.end(); return; }
  if (path === '/healthz') {
    res.writeHead(200, {...securityHeaders, 'Content-Type':'application/json; charset=utf-8'});
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ok:true,service:'ai-quest'}));return;
  }
  const file = files.get(path);
  if (!file) { res.writeHead(404, securityHeaders);res.end();return; }
  res.writeHead(200,{...securityHeaders,'Content-Type':file.type});
  res.end(req.method === 'HEAD' ? undefined : file.data);
}).listen(port,'0.0.0.0',()=>console.log('AI QUEST listening on '+port));
