import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD,W,H,createGame,initialize,dispatch,observe,BOSS,addNote,upgradeState} from '../public/game.js';
test('map is rectangular and bordered',()=>{assert.equal(H,24);assert.equal(W,25);for(const row of WORLD)assert.equal(row.length,W);});
test('initial state is visible only nearby',()=>{const s=initialize(createGame());const o=observe(s);assert.equal(o.position.x,1);assert.ok(o.visibleTiles.length<50);assert.equal(o.visibleTiles.some(t=>t.x===20&&t.y===21),false);});
test('blocked movement does not advance turn',()=>{const s=initialize(createGame());const n=dispatch(s,{type:'up'});assert.equal(n.turn,s.turn);assert.equal(n.y,s.y);});
test('movement advances turn and discovers tiles',()=>{const s=initialize(createGame());const n=dispatch(s,{type:'right'});assert.equal(n.x,2);assert.equal(n.turn,1);assert.ok(n.discovered.length>=s.discovered.length);});
test('shopping is only allowed in town',()=>{const s=initialize(createGame());const n=dispatch(s,{type:'buy',item:'potion'});assert.equal(n.gold,s.gold);});
test('game ends when hero loses battle',()=>{let s=initialize(createGame());s.battle={name:'テスト',hp:999,atk:999,boss:false};s.hp=1;s=dispatch(s,{type:'attack'});assert.equal(s.gameOver,true);});

test('level 3 hero defeats the boss without healing over 1000 random seeds',()=>{
 for(let seed=0;seed<1000;seed++){
  let s=initialize(createGame(seed));
  Object.assign(s,{x:19,y:21,key:true,level:3,hp:46,maxHp:46,attack:12,defense:4});
  s=dispatch(s,{type:'right'});
  assert.equal(s.battle.hp,60);assert.equal(s.battle.atk,9);
  for(let turn=0;turn<10&&!s.gameOver;turn++)s=dispatch(s,{type:'attack'});
  assert.equal(s.won,true,'seed '+seed);
 }
});
test('boss escape is unavailable and cannot consume fake turns',()=>{
 const s=initialize(createGame());s.battle={...BOSS};
 assert.equal(observe(s).battle.canEscape,false);
 assert.equal(observe(s).availableActions.includes('escape'),false);
 const next=dispatch(s,{type:'escape'});
 assert.equal(next.turn,s.turn);assert.equal(next.battle.hp,BOSS.hp);
 assert.match(next.log[0],/逃げられない/);
 s.battle.boss=false;
 assert.equal(observe(s).availableActions.includes('escape'),true);
});
test('persisted boss is rebalanced without restoring damage already dealt',()=>{
 const s=initialize(createGame());s.battle={...BOSS,hp:95,atk:13};
 upgradeState(s);assert.equal(s.battle.hp,60);assert.equal(s.battle.atk,9);
 s.battle.hp=20;upgradeState(s);assert.equal(s.battle.hp,20);
});
test('notebook retains newest 12 notes and exposes newest first',()=>{
 const s=initialize(createGame());
 for(let i=0;i<20;i++)addNote(s,'記録'+i);
 assert.equal(s.notes.length,12);
 assert.equal(observe(s).notes[0],'記録19');assert.equal(observe(s).notes.at(-1),'記録8');
 addNote(s,'記録10');assert.equal(observe(s).notes[0],'記録10');assert.equal(s.notes.length,12);
});
test('adventure log keeps only latest 80 events in reverse chronological order',()=>{
 let s=initialize(createGame());
 for(let i=0;i<100;i++){s.x= i%2?1:2;s.y=i%2?1:13;s=dispatch(s,{type:'talk'});}
 assert.equal(s.log.length,80);assert.match(s.log[0],/王様/);assert.match(s.log[1],/町人/);
});
