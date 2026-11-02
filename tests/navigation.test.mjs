import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD,createGame,initialize,observe,dispatch} from '../public/game.js';
import {progressPlan} from '../navigation.mjs';
function at(x,y,extra={}){return initialize(Object.assign(createGame(),{x,y},extra));}
test('empty ground is never described as a town and has no town actions',()=>{
 const o=observe(at(3,13));
 assert.equal(o.location.isTown,false);
 assert.equal(o.availableActions.includes('buy'),false);
 assert.equal(o.availableActions.includes('talk'),false);
 assert.equal(o.availableActions.includes('heal'),false);
});
test('completed cave has no wait/talk/buy action and points to next objective',()=>{
 const s=at(11,7,{key:true,level:3}),o=observe(s);
 assert.equal(o.location.name,'洞窟');assert.equal(o.location.taskComplete,true);
 assert.equal(o.quest.readyForBoss,true);assert.match(o.quest.objective,/魔王城/);
 assert.ok(o.availableActions.every(a=>['up','down','left','right'].includes(a)));
 const p=progressPlan(s,[],2);assert.equal(p.recover,true);assert.ok(p.route.length>0);
 assert.notEqual(dispatch(s,p.route[0]).x+','+dispatch(s,p.route[0]).y,'11,7');
});
test('town recovery happens on entry and one conversation cannot repeat',()=>{
 let s=at(3,13,{hp:5,mp:0,gold:0});
 s=dispatch(s,{type:'left'});
 assert.equal(s.hp,s.maxHp);assert.equal(s.mp,s.maxMp);
 assert.equal(observe(s).location.taskComplete,true);
 assert.ok(observe(s).availableActions.includes('talk'));
 s=dispatch(s,{type:'talk'});
 assert.equal(observe(s).availableActions.includes('talk'),false);
 assert.equal(observe(s).availableActions.includes('buy'),false);
});
test('ready hero gets a discovered route directly to the boss',()=>{
 const s=at(18,21,{key:true,level:3});
 const p=progressPlan(s);
 assert.deepEqual(p.route,[{type:'right'},{type:'right'}]);
});
test('a cave key is collected once and no further cave objective is given',()=>{
 let s=at(10,7);s=dispatch(s,{type:'right'});
 assert.equal(s.key,true);assert.equal(s.gold,39);
 assert.match(observe(s).quest.objective,/Lv3/);
 s=dispatch(dispatch(s,{type:'left'}),{type:'right'});
 assert.equal(s.gold,39);
});
test('unknown landmarks and hidden routes never enter guidance',()=>{
 const s=at(1,1,{key:true,level:3}),p=progressPlan(s);
 assert.equal(observe(s).knownLocations.some(l=>l.tile==='M'),false);
 let x=s.x,y=s.y;
 for(const a of p.route){const [dx,dy]=({up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]})[a.type];x+=dx;y+=dy;assert.ok(s.discovered.includes(x+','+y));assert.notEqual(WORLD[y][x],'#');}
});
test('repeated stationary history activates movement recovery, combat does not',()=>{
 const s=at(11,7,{key:true,level:3});
 const history=Array.from({length:8},()=>({to:'11,7',action:'talk',battle:false}));
 assert.equal(progressPlan(s,history).recover,true);
 s.battle={name:'テスト',hp:10,atk:3};
 assert.equal(progressPlan(s,history,5).recover,false);
});
