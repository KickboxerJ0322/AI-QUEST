import test from 'node:test';import assert from 'node:assert/strict';import {sanitizeDecision,getModel} from '../agent.mjs';
const observation={availableActions:['up','attack','buy'],visibleTiles:[]};
test('valid action is converted to game action',()=>assert.deepEqual(sanitizeDecision({action:'up',note:'北に進む',reason:'探索'},observation).action,{type:'up'}));
test('reject action not in observation',()=>assert.throws(()=>sanitizeDecision({action:'down'},observation)));
test('reject arbitrary tool execution',()=>assert.throws(()=>sanitizeDecision({action:'shell',command:'rm -rf /'},observation)));
test('reject invalid shop item',()=>assert.throws(()=>sanitizeDecision({action:'buy',item:'secret'},observation)));
test('truncates AI memory note',()=>assert.equal(sanitizeDecision({action:'up',note:'x'.repeat(500)},observation).note.length,350));
test('default Gemini model has safe syntax',()=>assert.match(getModel(),/^[\w.-]+$/));
