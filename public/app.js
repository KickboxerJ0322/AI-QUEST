import {WORLD,W,H,createGame,initialize,dispatch,observe} from './game.js';
const $=id=>document.getElementById(id);
const STORAGE='ai-quest-step1-v1';
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
 document.querySelectorAll('[data-action]').forEach(el=>{el.disabled=state.gameOver||(state.battle?!['attack','heal','potion','escape'].includes(el.dataset.action):['attack','escape'].includes(el.dataset.action));});
 localStorage.setItem(STORAGE,JSON.stringify(state));
}
function act(action){state=dispatch(state,action);render();}
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>act({type:b.dataset.action,item:b.dataset.item})));
$('reset').addEventListener('click',()=>{if(confirm('現在の冒険をリセットしますか？')){state=initialize(createGame());render();}});
$('save').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({state,observation:observe(state),exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ai-quest-adventure.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
window.addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;const k={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'}[e.key];if(k){e.preventDefault();act({type:k});}});
render();
