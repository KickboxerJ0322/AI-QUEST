// Navigation uses discovered tiles only. Hidden map locations never enter the plan.
import {WORLD,observe} from './public/game.js';
const directions=[['up',0,-1],['down',0,1],['left',-1,0],['right',1,0]];
export function progressPlan(state,history=[],stalledBatches=0){
 const o=observe(state);
 if(o.battle||state.gameOver)return {objective:o.quest.objective,route:[],recover:false};
 const known=new Set(state.discovered),start=state.x+','+state.y;
 const tile=(x,y)=>known.has(x+','+y)?WORLD[y]?.[x]:undefined;
 const paths=new Map([[start,[]]]),queue=[[state.x,state.y]];
 for(let i=0;i<queue.length;i++){
  const [x,y]=queue[i];
  for(const [type,dx,dy] of directions){
   const nx=x+dx,ny=y+dy,key=nx+','+ny,t=tile(nx,ny);
   if(!t||t==='#'||paths.has(key))continue;
   paths.set(key,[...paths.get(x+','+y),{type}]);queue.push([nx,ny]);
  }
 }
 let target=!state.key?'D':state.level>=3?'M':null;
 if(state.hp<state.maxHp/2)target='T';
 const candidates=queue.filter(([x,y])=>x+','+y!==start);
 let destination=candidates.find(([x,y])=>tile(x,y)===target);
 if(!destination&&state.key&&state.level<3)destination=candidates.find(([x,y])=>'gf'.includes(tile(x,y)));
 if(!destination)destination=candidates.find(([x,y])=>directions.some(([,dx,dy])=>!known.has((x+dx)+','+(y+dy))));
 if(!destination)destination=candidates[0];
 const recent=history.slice(-8);
 const stuck=recent.length===8&&recent.every(h=>!h.battle&&!['attack','buy','potion','heal'].includes(h.action))&&new Set(recent.map(h=>h.to)).size<=2;
 return {objective:o.quest.objective,location:o.location,route:destination?paths.get(destination.join(',')).slice(0,12):[],recover:stalledBatches>=2||stuck};
}
