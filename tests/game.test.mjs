import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD,W,H,createGame,initialize,dispatch,observe} from '../public/game.js';
test('map is rectangular and bordered',()=>{assert.equal(H,24);assert.equal(W,25);for(const row of WORLD)assert.equal(row.length,W);});
test('initial state is visible only nearby',()=>{const s=initialize(createGame());const o=observe(s);assert.equal(o.position.x,1);assert.ok(o.visibleTiles.length<50);assert.equal(o.visibleTiles.some(t=>t.x===20&&t.y===21),false);});
test('blocked movement does not advance turn',()=>{const s=initialize(createGame());const n=dispatch(s,{type:'up'});assert.equal(n.turn,s.turn);assert.equal(n.y,s.y);});
test('movement advances turn and discovers tiles',()=>{const s=initialize(createGame());const n=dispatch(s,{type:'right'});assert.equal(n.x,2);assert.equal(n.turn,1);assert.ok(n.discovered.length>=s.discovered.length);});
test('shopping is only allowed in town',()=>{const s=initialize(createGame());const n=dispatch(s,{type:'buy',item:'potion'});assert.equal(n.gold,s.gold);});
test('game ends when hero loses battle',()=>{let s=initialize(createGame());s.battle={name:'テスト',hp:999,atk:999,boss:false};s.hp=1;s=dispatch(s,{type:'attack'});assert.equal(s.gameOver,true);});
