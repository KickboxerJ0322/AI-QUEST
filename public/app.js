import {WORLD,W,H,createGame,initialize,dispatch,observe} from './game.js';
const $=id=>document.getElementById(id);
const STORAGE='ai-quest-step1-v1';
let running=false,abortAgent=false,apiCalls=0,totalTokens=0,kingOrder='',accessToken='';
let state;try{state=JSON.parse(localStorage.getItem(STORAGE))}catch{}
if(!state||typeof state.x!=='number')state=initialize(createGame());
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
 $('memory').replaceChildren(...(state.notes||[]).map((v,i)=>{const p=document.createElement('p');p.textContent=(i+1)+'. '+v;return p;}));
 $('aiStatus').textContent=running?'Geminiが冒険中… API呼出 '+apiCalls+'回 / '+totalTokens+' tokens':state.gameOver?'冒険終了':'待機中';
 document.querySelectorAll('[data-action]').forEach(el=>{el.disabled=state.gameOver||(state.battle?!['attack','heal','potion','escape'].includes(el.dataset.action):['attack','escape'].includes(el.dataset.action));});
 localStorage.setItem(STORAGE,JSON.stringify(state));
}
function act(action){if(running&&document.activeElement?.hasAttribute('data-action'))return;state=dispatch(state,action);render();}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function runAgent(){
 if(running)return;
 accessToken=$('accessToken').value.trim();kingOrder=$('kingCommand').value.trim();
 if(!accessToken||!kingOrder){alert('王様の命令とアクセス・トークンを入力してください。');return;}
 if(state.gameOver){alert('冒険が終了しています。「最初から」で再開してください。');return;}
 running=true;abortAgent=false;apiCalls=0;totalTokens=0;
 $('startAi').disabled=true;$('stopAi').disabled=false;$('kingCommand').disabled=true;
 const deadline=Date.now()+30*60*1000;
 try{
  while(!abortAgent&&!state.gameOver&&Date.now()<deadline&&apiCalls<120){
   const observation=observe(state);
   const res=await fetch('/api/agent/decide',{method:'POST',headers:{'Content-Type':'application/json','x-ai-quest-token':accessToken},body:JSON.stringify({observation,command:kingOrder,memory:state.notes||[]})});
   const data=await res.json();if(!res.ok)throw Error(data.error||'HTTP '+res.status);
   if(abortAgent)break;
   if(typeof data.note==='string'&&data.note.trim()){
    state.notes=state.notes||[];const note=data.note.trim().slice(0,350);
    if(!state.notes.includes(note)){state.notes.push(note);if(state.notes.length>30)state.notes.shift();}
   }
   state.log.unshift('🤖 '+(data.reason||'行動を決定')+' → '+data.action.type);
   act(data.action);apiCalls++;totalTokens+=data.usage?.totalTokens||0;
   await sleep(3800);
  }
  if(Date.now()>=deadline)state.log.unshift('⏰ 30分の制限時間に達しました。');
  else if(apiCalls>=120)state.log.unshift('⚠️ STEP 2のAPI呼出上限120回に達しました。');
 }catch(e){state.log.unshift('⚠️ AI停止: '+String(e.message).slice(0,180));}
 finally{running=false;accessToken='';$('accessToken').value='';$('startAi').disabled=false;$('stopAi').disabled=true;$('kingCommand').disabled=false;render();}
}
$('startAi').addEventListener('click',runAgent);
$('stopAi').addEventListener('click',()=>{abortAgent=true;$('aiStatus').textContent='停止処理中…';});
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>act({type:b.dataset.action,item:b.dataset.item})));
$('reset').addEventListener('click',()=>{if(running){alert('AIを停止してからリセットしてください。');return;}if(confirm('現在の冒険をリセットしますか？')){state=initialize(createGame());render();}});
$('save').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({state,observation:observe(state),exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ai-quest-adventure.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
window.addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;const k={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'}[e.key];if(k){e.preventDefault();if(!running)act({type:k});}});
render();
