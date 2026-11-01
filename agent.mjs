// Gemini decision endpoint. Browser sends only observe() output, not the entire world.
// This is a STEP 2 interactive demo, NOT a trusted server-authoritative mission.
export const ACTIONS=new Set(['up','down','left','right','attack','heal','potion','escape','talk','buy']);
const MODEL_PATTERN=/^[a-zA-Z0-9._-]{1,80}$/;
export function sanitizeDecision(value, observation){
 if(!value||typeof value!=='object'||!ACTIONS.has(value.action))throw Error('Gemini returned an invalid action');
 if(!Array.isArray(observation.availableActions)||!observation.availableActions.includes(value.action))throw Error('Action not available in current state');
 const action={type:value.action};
 if(value.action==='buy'){
  if(!['potion','sword','armor'].includes(value.item))throw Error('Invalid shop item');
  action.item=value.item;
 }
 const note=typeof value.note==='string'?value.note.trim().slice(0,350):'';
 const reason=typeof value.reason==='string'?value.reason.trim().slice(0,240):'';
 return {action,note,reason};
}
export function getModel(){const model=process.env.GEMINI_MODEL||'gemini-3-flash-preview';if(!MODEL_PATTERN.test(model))throw Error('Invalid model ID');return model;}
export class AgentError extends Error {constructor(code,message,retryable=false,retryAfter=0){super(message);this.code=code;this.retryable=retryable;this.retryAfter=retryAfter;}}
export async function decide({observation,command,memory}){
 const key=process.env.GEMINI_API_KEY;
 if(!key)throw Error('GEMINI_API_KEY is not configured');
 const model=getModel();
 const system=`You are the autonomous hero in an ORIGINAL Japanese 2D RPG. The user is the king; follow the king's initial order as your primary objective. You have NO access to screenshots or the full world map. Only the provided observation and your own memory. Your goal is to defeat the demon king. Explore unknown territory, learn from events, prepare equipment, heal, and survive. Decide ONE valid action per call. You may add or update ONE brief factual or planning note. Do not claim unverified information as fact. If you see a wall, choose another route. Do not get stuck repeatedly attempting an impossible action. Respond with a single JSON object: {"action":"up|down|left|right|attack|heal|potion|escape|talk|buy","item":"potion|sword|armor (only for buy)","reason":"short Japanese explanation","note":"optional Japanese memory note"}. No markdown.`;
 const schema={type:'OBJECT',properties:{action:{type:'STRING',enum:[...ACTIONS]},item:{type:'STRING',enum:['potion','sword','armor']},reason:{type:'STRING'},note:{type:'STRING'}},required:['action','reason'],propertyOrdering:['action','item','reason','note']};
 const body={systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:JSON.stringify({kingCommand:command,observation,memory})}]}],generationConfig:{responseMimeType:'application/json',responseSchema:schema,temperature:0.2,maxOutputTokens:4096,...(model.startsWith('gemini-3')?{thinkingConfig:{thinkingLevel:'minimal'}}:{})}};
 const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),25000);
 let response;
 try{response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body),signal:ctrl.signal});}
 finally{clearTimeout(timer);}
 const data=await response.json();
 if(!response.ok){
  const status=response.status;
  const code=status===429?'GEMINI_QUOTA':status===400?'GEMINI_BAD_REQUEST':status===403?'GEMINI_PERMISSION':status===404?'GEMINI_MODEL_NOT_FOUND':status>=500?'GEMINI_UPSTREAM':'GEMINI_API_ERROR';
  const retryable=status===429||status>=500;
  const retryAfter=Number(response.headers.get('retry-after'))||0;
  console.error('Gemini API failure',JSON.stringify({status,code,detail:String(data.error?.message||'').slice(0,400)}));
  throw new AgentError(code,'Gemini API returned HTTP '+status,retryable,retryAfter);
 }
 const text=(data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');
 const finishReason=data.candidates?.[0]?.finishReason||'UNKNOWN';
 if(!text){console.error('Gemini empty response',JSON.stringify({finishReason,usage:data.usageMetadata}));throw new AgentError('GEMINI_EMPTY','Gemini returned no text',true);}
 let parsed;try{parsed=JSON.parse(text);}catch{console.error('Gemini invalid JSON',JSON.stringify({finishReason,characters:text.length,usage:data.usageMetadata}));throw new AgentError(finishReason==='MAX_TOKENS'?'GEMINI_OUTPUT_TRUNCATED':'GEMINI_INVALID_JSON','Gemini response was not valid JSON',true);}
 let result;try{result=sanitizeDecision(parsed,observation);}catch(e){console.error('Gemini invalid decision:',String(e.message));throw new AgentError('GEMINI_INVALID_ACTION','Gemini returned an invalid game action',true);}
 return {...result,model,usage:{inputTokens:data.usageMetadata?.promptTokenCount||0,outputTokens:data.usageMetadata?.candidatesTokenCount||0,totalTokens:data.usageMetadata?.totalTokenCount||0}};
}
