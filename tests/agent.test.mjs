import test from 'node:test';import assert from 'node:assert/strict';import {sanitizeDecision,getModel,decideBatch} from '../agent.mjs';
const observation={availableActions:['up','attack','buy'],visibleTiles:[]};
test('valid action is converted to game action',()=>assert.deepEqual(sanitizeDecision({action:'up',note:'北に進む',reason:'探索'},observation).action,{type:'up'}));
test('reject action not in observation',()=>assert.throws(()=>sanitizeDecision({action:'down'},observation)));
test('reject arbitrary tool execution',()=>assert.throws(()=>sanitizeDecision({action:'shell',command:'rm -rf /'},observation)));
test('reject invalid shop item',()=>assert.throws(()=>sanitizeDecision({action:'buy',item:'secret'},observation)));
test('truncates AI memory note',()=>assert.equal(sanitizeDecision({action:'up',note:'あ'.repeat(500)},observation).note.length,350));
test('default Gemini model has safe syntax',()=>assert.match(getModel(),/^[\w.-]+$/));

test('reject untranslated notebook and reason',()=>{
 for(const field of ['note','reason'])assert.throws(()=>sanitizeDecision({action:'up',[field]:'Explore north'},observation),e=>e.code==='GEMINI_LANGUAGE'&&e.retryable);
});
test('accept Japanese prose with coordinates and game abbreviations',()=>assert.equal(sanitizeDecision({action:'up',note:'座標(2,3)でHPを回復する。'},observation).note,'座標(2,3)でHPを回復する。'));

test('STEP 3 batch validates Japanese before returning notes and log reason',async t=>{
 const originalFetch=globalThis.fetch,originalKey=process.env.GEMINI_API_KEY;
 process.env.GEMINI_API_KEY='test-only';
 t.after(()=>{globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=originalKey;});
 const reply=value=>{globalThis.fetch=async()=>({ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify(value)}]}}]})});};
 const args={observation,command:'魔王を倒せ',memory:[],remainingSeconds:1800};
 reply({actions:[{action:'up'},{action:'right'}],reason:'北東を探索する',note:'町を探す'});
 const result=await decideBatch(args);
 assert.equal(result.actions.length,2);assert.equal(result.note,'町を探す');
 reply({actions:[{action:'escape'}],reason:'逃げる',note:''});
 await assert.rejects(decideBatch({...args,observation:{...observation,battle:{boss:true,canEscape:false},availableActions:['attack']}}),e=>e.code==='GEMINI_INVALID_ACTION');

 for(const field of ['note','reason']){
  reply({actions:[{action:'up'}],reason:'北を探索する',note:'町を探す',[field]:'Explore north'});
  await assert.rejects(decideBatch(args),e=>e.code==='GEMINI_LANGUAGE'&&e.retryable);
 }
});
