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
export async function decide({observation,command,memory}){
 const key=process.env.GEMINI_API_KEY;
 if(!key)throw Error('GEMINI_API_KEY is not configured');
 const model=getModel();
 const system=`You are the autonomous hero in an ORIGINAL Japanese 2D RPG. The user is the king; follow the king's initial order as your primary objective. You have NO access to screenshots or the full world map. Only the provided observation and your own memory. Your goal is to defeat the demon king. Explore unknown territory, learn from events, prepare equipment, heal, and survive. Decide ONE valid action per call. You may add or update ONE brief factual or planning note. Do not claim unverified information as fact. If you see a wall, choose another route. Do not get stuck repeatedly attempting an impossible action. Respond with a single JSON object: {"action":"up|down|left|right|attack|heal|potion|escape|talk|buy","item":"potion|sword|armor (only for buy)","reason":"short Japanese explanation","note":"optional Japanese memory note"}. No markdown.`;
 const body={systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:JSON.stringify({kingCommand:command,observation,memory})}]}],generationConfig:{responseMimeType:'application/json',temperature:0.35,maxOutputTokens:600}};
 const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),25000);
 let response;
 try{response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(body),signal:ctrl.signal});}
 finally{clearTimeout(timer);}
 const data=await response.json();
 if(!response.ok)throw Error(`Gemini API ${response.status}: ${String(data.error?.message||'request failed').slice(0,180)}`);
 const text=(data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');
 if(!text)throw Error('Gemini returned no text');
 const result=sanitizeDecision(JSON.parse(text),observation);
 return {...result,model,usage:{inputTokens:data.usageMetadata?.promptTokenCount||0,outputTokens:data.usageMetadata?.candidatesTokenCount||0,totalTokens:data.usageMetadata?.totalTokenCount||0}};
}
