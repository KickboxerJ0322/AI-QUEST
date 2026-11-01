// AI QUEST STEP 1: deterministic, browser-only RPG engine.
// No paid APIs or server-side session storage are used in this milestone.
export const WORLD = [
"########################",
"#C....g...f...g...T....#",
"#.##..gg..f..##..g.....#",
"#....gg....f......g.....#",
"#..gg....##....g........#",
"#.....g...f...g...##....#",
"#..##....f...g.....g....#",
"#.......f..D...g........#",
"#..g....f..##.....g.....#",
"#..g...g.....g..###.....#",
"#......g....g...........#",
"#..##..g.....g...g......#",
"#......g....g....g......#",
"#.T........g......g.....#",
"#.....##..g....##.......#",
"#...g.....g.....g.......#",
"#....g....g.....g.......#",
"#....g....g..##.........#",
"#..g...g......g.........#",
"#..g....g....g....g.....#",
"#......g....g....g......#",
"#..##.......g.......M...#",
"#.......................#",
"########################"
];
export const W=WORLD[0].length,H=WORLD.length;
export const LOCATIONS={castle:[1,1],town:[18,1],village:[2,13],dungeon:[11,7],boss:[20,21]};
const ITEMS={potion:{name:"回復薬",price:12},sword:{name:"鋼の剣",price:55},armor:{name:"鉄の鎧",price:45}};
const ENEMIES=[
{name:"スライム",hp:10,atk:3,exp:5,gold:7},
{name:"コウモリ",hp:17,atk:5,exp:9,gold:11},
{name:"オオカミ",hp:25,atk:7,exp:15,gold:16}
];
const copy=v=>structuredClone(v);
export function createGame(seed=42){
 return {seed,x:1,y:1,hp:30,maxHp:30,mp:8,maxMp:8,level:1,exp:0,gold:24,attack:6,defense:2,turn:0,steps:0,potions:2,sword:false,armor:false,key:false,visited:[],discovered:[],log:["王様の命令を待つ勇者が城にいる。"],battle:null,won:false,gameOver:false,notes:[],rng:seed>>>0};
}
function random(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
function log(s,msg){s.log.unshift(msg);s.log=s.log.slice(0,80);}
function tile(x,y){return WORLD[y]?.[x]??"#";}
function heal(s,n){const before=s.hp;s.hp=Math.min(s.maxHp,s.hp+n);return s.hp-before;}
function discover(s){for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){let x=s.x+dx,y=s.y+dy;if(x>=0&&y>=0&&x<W&&y<H&&Math.abs(dx)+Math.abs(dy)<=4){let k=x+","+y;if(!s.discovered.includes(k))s.discovered.push(k);}}}
function levelUp(s){while(s.exp>=s.level*20){s.exp-=s.level*20;s.level++;s.maxHp+=8;s.maxMp+=3;s.attack+=3;s.defense+=1;s.hp=s.maxHp;s.mp=s.maxMp;log(s,"レベル "+s.level+" に上がった！ HPとMPが全回復した。");}}
function fight(s,action){
 const b=s.battle;if(!b)return;
 if(action==="potion"){if(s.potions<1){log(s,"回復薬がない。");return;}s.potions--;log(s,"回復薬でHPを "+heal(s,22)+" 回復。");}
 else if(action==="heal"){if(s.mp<3){log(s,"MPが足りない。");return;}s.mp-=3;log(s,"回復魔法でHPを "+heal(s,16+s.level*2)+" 回復。");}
 else if(action==="escape"&&!b.boss){if(random(s)<.7){s.battle=null;log(s,"戦闘から逃げた。");return;}log(s,"逃げられなかった。");}
 else if(action==="attack"){const damage=Math.max(1,s.attack+(s.sword?7:0)+Math.floor(random(s)*5)-2);b.hp-=damage;log(s,b.name+" に "+damage+" ダメージ。");}
 else return;
 if(b.hp<=0){log(s,b.name+" を倒した！");if(b.boss){s.won=true;s.gameOver=true;log(s,"魔王を討伐した！ 王国に平和が戻った。");}else{s.exp+=b.exp;s.gold+=b.gold;levelUp(s);}s.battle=null;return;}
 const hit=Math.max(1,b.atk+Math.floor(random(s)*4)-s.defense-(s.armor?4:0));s.hp-=hit;log(s,b.name+" の攻撃！ "+hit+" ダメージ。");
 if(s.hp<=0){s.hp=0;s.gameOver=true;log(s,"勇者は倒れた。冒険失敗。");}
}
function enter(s){
 const t=tile(s.x,s.y);
 if(t==="T"){s.hp=s.maxHp;s.mp=s.maxMp;log(s,"町の宿屋で休み、HP・MPが回復した。");}
 if(t==="C"){s.hp=s.maxHp;s.mp=s.maxMp;log(s,"王城で休息した。");}
 if(t==="D"){if(!s.key){s.key=true;s.gold+=15;log(s,"洞窟で魔王城の鍵を発見！ 宝箱から15Gも入手。");}else log(s,"洞窟は探索済み。");}
 if(t==="M"){if(!s.key){log(s,"魔王城の門は閉ざされている。洞窟で鍵を探そう。");return;}
  if(s.level<3)log(s,"魔王の力は強大だ。準備不足かもしれない。");
  s.battle={name:"魔王",hp:95,atk:13,exp:0,gold:0,boss:true};log(s,"魔王が現れた！");}
}
export function dispatch(current,action){
 const s=copy(current);if(s.gameOver)return s;
 if(s.battle){fight(s,action.type);s.turn++;return s;}
 const d={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
 if(d[action.type]){
  const [dx,dy]=d[action.type],x=s.x+dx,y=s.y+dy,t=tile(x,y);
  if(t==="#"){log(s,"岩山で道が塞がれている。");return s;}
  s.x=x;s.y=y;s.steps++;s.turn++;enter(s);
  if(!s.battle&&["g","f"].includes(t)&&random(s)<(t==="f"?.28:.17)){
   const base=ENEMIES[Math.min(ENEMIES.length-1,Math.floor(s.steps/22))];
   s.battle=copy(base);log(s,base.name+" が現れた！");
  }
 }else if(action.type==="potion"){if(s.potions>0){s.potions--;log(s,"回復薬でHPを "+heal(s,22)+" 回復。");s.turn++;}else log(s,"回復薬がない。");}
 else if(action.type==="heal"){if(s.mp>=3){s.mp-=3;log(s,"回復魔法でHPを "+heal(s,16+s.level*2)+" 回復。");s.turn++;}else log(s,"MPが足りない。");}
 else if(action.type==="buy"){if(tile(s.x,s.y)!=="T"){log(s,"買い物は町でしかできない。");return s;}const item=ITEMS[action.item];if(!item){log(s,"商品が存在しない。");return s;}if(s.gold<item.price){log(s,"お金が足りない。");return s;}if(action.item!=="potion"&&s[action.item]){log(s,"すでに持っている。");return s;}s.gold-=item.price;if(action.item==="potion")s.potions++;else s[action.item]=true;log(s,item.name+" を購入した。");s.turn++;}
 else if(action.type==="talk"){const t=tile(s.x,s.y);log(s,t==="C"?"王様『北東の町で装備を整え、中央の洞窟で鍵を探せ。』":t==="T"?"町人『南の魔王城には鍵が必要だ。装備を整えて挑もう。』":"周囲に話せる人はいない。");s.turn++;}
 discover(s);return s;
}
export function observe(s){
 const visible=[];for(let y=Math.max(0,s.y-3);y<=Math.min(H-1,s.y+3);y++)for(let x=Math.max(0,s.x-3);x<=Math.min(W-1,s.x+3);x++)if(Math.abs(x-s.x)+Math.abs(y-s.y)<=4)visible.push({x,y,tile:tile(x,y)});
 return {position:{x:s.x,y:s.y},stats:{hp:s.hp,maxHp:s.maxHp,mp:s.mp,level:s.level,gold:s.gold},inventory:{potions:s.potions,sword:s.sword,armor:s.armor,key:s.key},visibleTiles:visible,battle:s.battle?{name:s.battle.name,hp:s.battle.hp}:null,latestLog:s.log.slice(0,8),availableActions:s.battle?["attack","heal","potion","escape"]:["up","down","left","right","heal","potion","talk","buy"],notes:s.notes};
}
export function initialize(s){const n=copy(s);discover(n);return n;}
