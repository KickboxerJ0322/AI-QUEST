import {WORLD,W,H,createGame,initialize,dispatch,observe,upgradeState} from './game.js';
const $=id=>document.getElementById(id);
const STORAGE='ai-quest-step1-v1';
let running=false,abortAgent=false,apiCalls=0,totalTokens=0,kingOrder='',accessToken='';
let state;try{state=JSON.parse(localStorage.getItem(STORAGE))}catch{}
if(!state||typeof state.x!=='number')state=initialize(createGame());
upgradeState(state);
const COLORS={"#":"#43536a",".":"#b6ba84","g":"#568c51","f":"#276f4d","C":"#ddd0b2","T":"#c9a16c","D":"#5b536e","M":"#5e345d"};
const ICONS={"C":"🏰","T":"🏘️","D":"🕳️","M":"🏯"};
const canvas=$('map'),ctx=canvas.getContext('2d');const tileSize=24;
function draw(){
 ctx.clearRect(0,0,canvas.width,canvas.height);
 const known=new Set(state.discovered);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const px=x*tileSize,py=y*tileSize,k=x+','+y,t=WORLD[y][x];
  ctx.fillStyle=known.has(k)?COLORS[t]:"#131d30";ctx.fillRect(px,py,tileSize,tileSize);
  if(known.has(k)){ctx.strokeStyle="rgba(0,0,0,.12)";ctx.strokeRect(px+.5,py+.5,tileSize-1,tileSize-1);if(ICONS[t]){ctx.font="17px system-ui";ctx.textAlign="center";ctx.fillText(ICONS[t],px+12,py+18);}}
 }
 ctx.font="22px system-ui";ctx.textAlign="center";ctx.fillText("🛡️",state.x*tileSize+12,state.y*tileSize+20);
}
function render(){
 draw();
 $('stats').textContent=`Lv.${state.level}  HP ${state.hp}/${state.maxHp}  MP ${state.mp}/${state.maxMp}  G ${state.gold}  EXP ${state.exp}`;
 $('inventory').textContent=`回復薬 ×${state.potions} ｜ 剣 ${state.sword?'あり':'なし'} ｜ 鎧 ${state.armor?'あり':'なし'} ｜ 魔王城の鍵 ${state.key?'あり':'なし'}`;
 $('location').textContent=`座標 (${state.x}, ${state.y}) ／ ${state.turn}ターン`;
 $('events').replaceChildren(...state.log.slice(0,13).map(v=>{const p=document.createElement('p');p.textContent=v;return p;}));
 $('battle').hidden=!state.battle;
 $('peace').hidden=!!state.battle;
 $('outcome').textContent=state.won?'🏆 魔王討伐成功！':state.gameOver?'💀 勇者は倒れた。再挑戦してください。':'';
 $('observation').textContent=JSON.stringify(observe(state),null,2);
 $('memory').replaceChildren(...[...(state.notes||[])].reverse().slice(0,12).map((v,i)=>{const p=document.createElement('p');p.textContent=(i+1)+'. '+v;return p;}));
 $('aiStatus').textContent=running?'Geminiが冒険中… API呼出 '+apiCalls+'回 / '+totalTokens+' tokens':state.gameOver?'冒険終了':'待機中';
 document.querySelectorAll('[data-action]').forEach(el=>{el.disabled=state.gameOver||!observe(state).availableActions.includes(el.dataset.action);});
 localStorage.setItem(STORAGE,JSON.stringify(state));
}
function act(action){if(running&&document.activeElement?.hasAttribute('data-action'))return;state=dispatch(state,action);render();}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const RUN_ID_STORAGE='ai-quest-cloud-run-id';
let currentRunId=localStorage.getItem(RUN_ID_STORAGE)||sessionStorage.getItem('ai-quest-run-id')||'';
function rememberRun(id){currentRunId=id;localStorage.setItem(RUN_ID_STORAGE,id);sessionStorage.setItem('ai-quest-run-id',id);$('runId').value=id;}
$('runId').value=currentRunId;
$('copyRunId').addEventListener('click',async()=>{if(!$('runId').value.trim())return;try{await navigator.clipboard.writeText($('runId').value.trim());}catch{alert('コピーできません。冒険IDを手動でコピーしてください。');}});
async function cloudRequest(path,method='GET',payload){const r=await fetch(path,{method,headers:{'Content-Type':'application/json','x-ai-quest-token':accessToken},...(payload?{body:JSON.stringify(payload)}:{})});const d=await r.json();if(!r.ok){const error=Error(d.error||'HTTP '+r.status);error.status=r.status;throw error;}return d;}
function displayCloudRun(run){
 if(run.state){state=upgradeState(run.state);apiCalls=run.calls||0;totalTokens=run.tokens||0;render();}
 const remaining=Math.max(0,Math.ceil((run.deadline-Date.now())/1000));
 const statusNames={running:'冒険中',won:'魔王討伐成功',lost:'冒険失敗',timeout:'制限時間終了',budget:'利用上限到達',stopped:'停止済み',error:'エラー'};
 $('aiStatus').textContent='クラウド '+(statusNames[run.status]||run.status)+' ｜残り '+Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0')+' ｜API '+apiCalls+'回 ｜行動 '+(run.actions||0)+'回 ｜'+totalTokens+' tokens'+(run.lastError?' ｜'+run.lastError:'');
}
async function runAgent(){
 if(running)return;
 accessToken=$('accessToken').value.trim();kingOrder=$('kingCommand').value.trim();
 if(!accessToken||!kingOrder){alert('王様の命令とアクセス・トークンを入力してください。');return;}
 running=true;abortAgent=false;$('startAi').disabled=true;$('stopAi').disabled=false;$('kingCommand').disabled=true;
 try{
  const result=await cloudRequest('/api/runs','POST',{command:kingOrder});
  rememberRun(result.run.id);
  while(!abortAgent){
   const {run}=await cloudRequest('/api/runs/'+currentRunId);
   displayCloudRun(run);
   if(run.status!=='running')break;
   await sleep(3500);
  }
 }catch(e){state.log.unshift('⚠️ クラウド実行: '+String(e.message).slice(0,160));render();}
 finally{running=false;accessToken='';$('accessToken').value='';$('startAi').disabled=false;$('stopAi').disabled=true;$('kingCommand').disabled=false;}
}
$('startAi').addEventListener('click',runAgent);
$('resumeAi').addEventListener('click',async()=>{
 if(running)return;
 accessToken=$('accessToken').value.trim();currentRunId=$('runId').value.trim()||currentRunId;if(!accessToken){alert('管理者アクセス・トークンを入力してください。');return;}
 running=true;abortAgent=false;$('startAi').disabled=true;$('stopAi').disabled=true;$('kingCommand').disabled=true;
 try{
  let run;
  if(currentRunId){
   try{({run}=await cloudRequest('/api/runs/'+currentRunId));}
   catch(e){if(e.status!==404)throw e;}
  }
  if(!run)({run}=await cloudRequest('/api/runs/latest'));
  rememberRun(run.id);
  $('kingCommand').value=run.command;
  while(!abortAgent){
   displayCloudRun(run);
   if(run.status!=='running')break;
   $('stopAi').disabled=false;
   await sleep(3500);
   if(abortAgent)break;
   ({run}=await cloudRequest('/api/runs/'+currentRunId));
  }
 }catch(e){alert('冒険を読み込めません: '+e.message);}
 finally{running=false;accessToken='';$('accessToken').value='';$('startAi').disabled=false;$('stopAi').disabled=true;$('kingCommand').disabled=false;}
});
$('stopAi').addEventListener('click',async()=>{abortAgent=true;if(currentRunId&&accessToken){try{await cloudRequest('/api/runs/'+currentRunId+'/stop','POST');}catch(e){alert('停止に失敗しました: '+e.message);}}$('aiStatus').textContent='停止処理中…';});
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>act({type:b.dataset.action,item:b.dataset.item})));
$('reset').addEventListener('click',()=>{if(running){alert('AIを停止してからリセットしてください。');return;}if(confirm('現在の冒険をリセットしますか？')){currentRunId='';$('runId').value='';sessionStorage.removeItem('ai-quest-run-id');localStorage.removeItem(RUN_ID_STORAGE);state=initialize(createGame());render();}});
$('save').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({state,observation:observe(state),exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ai-quest-adventure.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
window.addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;const k={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'}[e.key];if(k){e.preventDefault();if(!running)act({type:k});}});
render();
