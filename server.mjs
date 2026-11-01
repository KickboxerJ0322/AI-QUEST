import http from 'node:http';
import { readFile } from 'node:fs/promises';
import {decide} from './agent.mjs';
import {timingSafeEqual} from 'node:crypto';
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
const usage=new Map();
let active=0;let total=0;
function json(res,status,body){res.writeHead(status,{...securityHeaders,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));}
function authorized(req){const secret=process.env.AI_QUEST_ACCESS_TOKEN;if(!secret||secret.length<24)return false;const given=req.headers['x-ai-quest-token'];if(typeof given!=='string')return false;const a=Buffer.from(secret),b=Buffer.from(given);return a.length===b.length&&timingSafeEqual(a,b);}
async function handleAgent(req,res){
 if(!authorized(req)){json(res,403,{error:'AI agent is disabled or access token is invalid'});return;}
 if(!process.env.GEMINI_API_KEY){json(res,503,{error:'Gemini is not configured on Cloud Run'});return;}
 if(active>=1){json(res,429,{error:'Another Gemini request is running; retry later'});return;}
 const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].slice(0,80);
 const now=Date.now();const record=usage.get(ip)||{at:0,count:0,window:now};
 if(now-record.window>3600000){record.window=now;record.count=0;}
 if(now-record.at<3500||record.count>=120||total>=400){json(res,429,{error:'AI rate or budget limit reached'});return;}
 let raw='';
 try{for await(const chunk of req){raw+=chunk;if(raw.length>12000){json(res,413,{error:'Request too large'});return;}}}
 catch{json(res,400,{error:'Invalid request'});return;}
 let body;
 try{body=JSON.parse(raw);}catch{json(res,400,{error:'Invalid JSON'});return;}
 const {observation,command,memory}=body||{};
 if(!observation||typeof observation!=='object'||!Array.isArray(observation.availableActions)||observation.availableActions.length>15||!Array.isArray(observation.visibleTiles)||observation.visibleTiles.length>60||typeof command!=='string'||command.length>1500||!Array.isArray(memory)||memory.length>30||memory.some(x=>typeof x!=='string'||x.length>350)){json(res,400,{error:'Invalid observation, king command or memory'});return;}
 active++;total++;record.at=now;record.count++;usage.set(ip,record);
 try{const decision=await decide({observation,command,memory});json(res,200,decision);}
 catch(err){console.error('Gemini decision error:',String(err.message).slice(0,200));json(res,502,{error:'Gemini decision failed. Check Cloud Run logs and model configuration.'});}
 finally{active--;}
}
http.createServer((req, res) => {
  const path = (req.url || '').split('?')[0];
  if(path==='/api/agent/decide'&&req.method==='POST'){void handleAgent(req,res);return;}
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
