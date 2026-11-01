import http from 'node:http';
import { readFile } from 'node:fs/promises';
const port = Number(process.env.PORT || 8080);
const page = await readFile(new URL('./public/index.html', import.meta.url));
http.createServer((req, res) => {
  if (req.method !== 'GET') { res.writeHead(405); res.end('Method Not Allowed'); return; }
  if (req.url === '/healthz') { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ ok: true, service: 'ai-quest' })); return; }
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }); res.end(page); return;
  }
  res.writeHead(404); res.end('Not Found');
}).listen(port, '0.0.0.0', () => console.log('AI QUEST listening on ' + port));
