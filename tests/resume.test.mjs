import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as game from '../public/game.js';

const source=(await readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import .*\n/,'');
async function setup({saved='',status=200,latestStatus=200,runStatus='won'}={}){
 const elements=new Map(),requests=[],alerts=[],local=new Map(saved?[['ai-quest-cloud-run-id',saved]]:[]);
 const element=id=>{
  if(!elements.has(id))elements.set(id,{value:'',disabled:false,textContent:'',children:[],addEventListener(event,fn){this[event]=fn;},replaceChildren(...children){this.children=children;},getContext(){return new Proxy({},{get:()=>()=>{},set:()=>true});}});
  return elements.get(id);
 };
 const run={id:'new-run',command:'装備を整えて魔王を倒せ',status:runStatus,state:game.initialize(game.createGame()),deadline:Date.now()+60000,calls:2,actions:5};
 run.state.notes=['町で装備を整える'];run.state.log=['北へ進んだ'];
 const storage=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)});
 let polls=0;
 const context=vm.createContext({...game,console,Date,JSON,Set,Math,String,Number,Promise,
  localStorage:storage(local),sessionStorage:storage(new Map()),
  document:{getElementById:element,querySelectorAll:()=>[],createElement:()=>({}),activeElement:null},
  window:{addEventListener(){}},alert:s=>alerts.push(s),
  setTimeout:fn=>{fn();},clearTimeout(){},
  fetch:async(path,options)=>{
   requests.push({path,options});
   const code=path.endsWith('/latest')?latestStatus:path.includes(saved)&&saved?status:200;
   const result={...run,status:runStatus==='running'&&polls++>0?'won':runStatus};
   return {ok:code===200,status:code,json:async()=>code===200?{run:result}:{error:'テストエラー'}};
  }});
 vm.runInContext(source,context);
 element('accessToken').value='test-only-token';
 await element('resumeAi').click();
 return {element,requests,alerts,local};
}
test('recover latest adventure without a saved ID and render Japanese records',async()=>{
 const x=await setup();
 assert.equal(x.requests[0].path,'/api/runs/latest');
 assert.equal(x.element('runId').value,'new-run');
 assert.equal(x.element('kingCommand').value,'装備を整えて魔王を倒せ');
 assert.equal(x.element('memory').children[0].textContent,'1. 町で装備を整える');
 assert.equal(x.element('events').children[0].textContent,'北へ進んだ');
 assert.equal(x.element('accessToken').value,'');
 assert.equal(x.element('startAi').disabled,false);
});
test('stale saved ID falls back to latest adventure',async()=>{
 const x=await setup({saved:'old-id',status:404});
 assert.deepEqual(x.requests.map(r=>r.path),['/api/runs/old-id','/api/runs/latest']);
 assert.equal(x.local.get('ai-quest-cloud-run-id'),'new-run');
});
test('authorization failure does not trigger latest fallback',async()=>{
 const x=await setup({saved:'old-id',status:403});
 assert.equal(x.requests.length,1);assert.equal(x.alerts.length,1);
 assert.equal(x.element('stopAi').disabled,true);
 assert.equal(x.element('accessToken').value,'');
});
test('missing latest adventure restores controls and clears token',async()=>{
 const x=await setup({latestStatus:404});
 assert.equal(x.alerts.length,1);assert.equal(x.element('kingCommand').disabled,false);
 assert.equal(x.element('accessToken').value,'');
});
test('running adventure continues polling until completion',async()=>{
 const x=await setup({runStatus:'running'});
 assert.ok(x.requests.some(r=>r.path==='/api/runs/new-run'));
 assert.match(x.element('aiStatus').textContent,/魔王討伐成功/);
 assert.equal(x.element('stopAi').disabled,true);
});
