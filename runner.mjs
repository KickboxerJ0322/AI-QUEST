import {Firestore} from '@google-cloud/firestore';
import {randomUUID} from 'node:crypto';
import {createGame,initialize,dispatch,observe,WORLD,addNote,upgradeState,LOG_LIMIT} from './public/game.js';
import {progressPlan} from './navigation.mjs';
import {decideBatch} from './agent.mjs';
const db=new Firestore({projectId:process.env.GOOGLE_CLOUD_PROJECT||'jumpeicloud'});
const collection=db.collection('ai_quest_runs');
const DURATION=30*60*1000,MAX_CALLS=150,MAX_ACTIONS=1400;
const tasks=new Map();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function clean(run){const {secretHash,...safe}=run;return safe;}
export async function startRun(command,secretHash){
 if(typeof command!=='string'||!command.trim()||command.length>1500)throw Error('Invalid king command');
 const id=randomUUID(),now=Date.now();
 const active=await collection.where('status','==','running').limit(1).get();
 if(!active.empty)throw Error('Another cloud mission is already running');
 const recent=await collection.where('startedAt','>=',now-86400000).limit(12).get();
 if(recent.size>=10)throw Error('Daily mission limit reached (10)');
 const state=initialize(createGame(42));
 const run={id,command:command.trim(),secretHash,startedAt:now,deadline:now+DURATION,status:'running',state,history:[],calls:0,actions:0,tokens:0,lastError:'',updatedAt:now};
 await collection.doc(id).create(run);
 launch(id);
 return clean(run);
}
export async function getLatestRun(secretHash){
 const q=await collection.where('startedAt','>=',Date.now()-86400000).orderBy('startedAt','desc').limit(30).get();
 const found=q.docs.map(d=>d.data()).find(run=>run.secretHash===secretHash);
 return found?clean(found):null;
}
export async function getRun(id,secretHash){
 if(!/^[0-9a-f-]{36}$/.test(id))return null;
 const snap=await collection.doc(id).get();
 if(!snap.exists)return null;
 const run=snap.data();if(run.secretHash!==secretHash)return null;
 return clean(run);
}
export async function stopRun(id,secretHash){
 const run=await getRun(id,secretHash);if(!run)return null;
 await collection.doc(id).update({status:'stopped',updatedAt:Date.now()});
 return {...run,status:'stopped'};
}
function launch(id){if(tasks.has(id))return;const task=drive(id).catch(e=>console.error('run failed',id,String(e.message).slice(0,200))).finally(()=>tasks.delete(id));tasks.set(id,task);}
export async function resumeRuns(){
 const q=await collection.where('status','==','running').limit(20).get();
 for(const d of q.docs)launch(d.id);
}
async function drive(id){
 const ref=collection.doc(id);let failures=0;
 while(true){
  const snap=await ref.get();if(!snap.exists)return;
  let run=snap.data();
  if(run.status!=='running')return;
  const now=Date.now();
  if(now>=run.deadline||run.calls>=MAX_CALLS||run.actions>=MAX_ACTIONS||run.state.gameOver){
   const status=run.state.won?'won':run.state.gameOver?'lost':now>=run.deadline?'timeout':'budget';
   await ref.update({status,updatedAt:now});return;
  }
  try{
   upgradeState(run.state);
   const o=observe(run.state);
   // History is accumulated by the engine, never expose hidden world tiles.
   const guidance=progressPlan(run.state,run.history,run.stalledBatches||0);
   let result=await decideBatch({guidance,observation:o,command:run.command,memory:o.notes,history:run.history,remainingSeconds:Math.floor((run.deadline-now)/1000)});
   if((await ref.get()).data()?.status!=='running')return;
   failures=0;run.calls++;run.tokens+=result.usage.totalTokenCount||0;
   if(guidance.recover&&guidance.route.length)result={...result,actions:guidance.route,reason:'同じ場所での停滞を解消し、'+guidance.objective,note:''};
   addNote(run.state,result.note);
   let executed=0;
   for(const action of result.actions){
    if(Date.now()>=run.deadline||run.state.gameOver)break;
    const available=observe(run.state).availableActions;
    if(!available.includes(action.type))break;
    const before=run.state,from=before.x+','+before.y,wasBattle=!!before.battle;
    const next=dispatch(before,action);
    if(next.turn===before.turn&&next.x===before.x&&next.y===before.y){run.state=next;break;}
    run.state=next;executed++;run.actions++;
    run.history.push({from,to:next.x+','+next.y,action:action.type,battle:!!next.battle,turn:next.turn});
    if(run.history.length>60)run.history=run.history.slice(-60);
    // The batch must not blindly continue after discovering new information.
    if(!!next.battle!==wasBattle||next.key!==before.key||next.won||WORLD[next.y]?.[next.x]!==WORLD[before.y]?.[before.x]&&'CTDM'.includes(WORLD[next.y]?.[next.x]||'?'))break;
    if(executed>=12)break;
   }
   run.stalledBatches=executed===0?(run.stalledBatches||0)+1:0;
   run.state.log.unshift('🤖 '+result.reason+' / '+executed+'行動');
   run.state.log=run.state.log.slice(0,LOG_LIMIT);
   run.updatedAt=Date.now();
   await db.runTransaction(async tx=>{const current=await tx.get(ref);if(current.data()?.status==='running')tx.set(ref,run);});
   await pause(3500);
  }catch(e){
   failures++;console.error('AI QUEST run error',id,e.code||'ERROR',String(e.message).slice(0,180));
   const retryable=!!e.retryable;
   const wait=retryable?Math.min(120000,Math.max(5000,(e.retryAfter||0)*1000,5000*2**Math.min(failures,5))):0;
   await ref.update({lastError:String(e.code||e.message).slice(0,120),updatedAt:Date.now()});
   if(!retryable||failures>=6){await ref.update({status:'error',updatedAt:Date.now()});return;}
   await pause(wait);
  }
 }
}
