// ── Car Thief 6 — game engine (pure logic, no DOM) ──────────────────
import { SKILLS, CLASSES, DIFFS, CARS, ITEMS, HIDEOUTS, NAMES, FACES, MISSIONS,
         CITIES, CAR_EQUIP, FLY_BASE, FLY_PER, DRIVE_PER, FENCE_BUDGET, RECOG_VALUE, FENCES, PACK_SIZE, THUG, TUNE_STAGES,
         PROPERTIES, LAUNDER_STREET_FEE, LAUNDER_BIZ_FEE, TRAITS, QUIRKS, PAPER_NAME, HEADLINES, MUTATORS, PRESTIGE_PERKS } from "./data.js";

export const rnd = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;
export const pick = a=>a[rnd(0,a.length-1)];
export const fmt$ = n=>"$"+Math.round(n).toLocaleString("en-US");
export const cap = s=>s[0].toUpperCase()+s.slice(1);

export const ENERGY_MAX = 10;

/* ── two kinds of money: clean spends anywhere, dirty can't touch the legit world ── */
export const funds = g => (g.cash||0) + (g.dirty||0);
export function addDirty(g, amt){ amt=Math.round(amt); g.dirty=(g.dirty||0)+amt; g.week && (g.week.earned+=amt); return amt; }
export function addClean(g, amt){ amt=Math.round(amt); g.cash+=amt; g.week && (g.week.earned+=amt); return amt; }
export function spend(g, amt, cleanOnly=false){
  amt = Math.round(amt);
  if(cleanOnly){ if(g.cash<amt) return false; g.cash-=amt; return true; }
  if(funds(g)<amt) return false;
  const d = Math.min(g.dirty||0, amt);
  g.dirty -= d; g.cash -= (amt-d);
  return true;
}
export function spendUpTo(g, amt){ // pay what you can, return shortfall
  amt = Math.round(amt);
  const pay = Math.min(funds(g), amt);
  spend(g, pay);
  return amt - pay;
}
export function launder(g, amt, fee=LAUNDER_STREET_FEE){
  amt = Math.min(Math.round(amt), g.dirty||0);
  if(amt<=0) return 0;
  const net = Math.round(amt*(1-fee));
  g.dirty -= amt; g.cash += net;
  return net;
}
export const maxEnergy = g => ENERGY_MAX + (g.hideout>=2?1:0) + (g.hideout>=4?1:0)
  + ((g.props||[]).some(id=>{const p=PROPERTIES.find(x=>x.id===id);return p?.perk==="rest" && p.city===g.city;}) ? 1 : 0);


/* ── creation & migration ──────────────────────────────────────────── */
export function newGame(name, classId, diffIdx, avatar, mutators, prestige){
  const cls = CLASSES.find(c=>c.id===classId) || CLASSES[0];
  const d = DIFFS[diffIdx];
  const g = {
    ver:3, name:name||"Duke", face:cls.face, cls:cls.id, diff:diffIdx,
    avatar: avatar||{skin:0,hair:1,hc:0,acc:0,jc:0},
    day:1, cash:d.cash, dirty:0, debt:d.debt, debtStart:d.debt, wanted:0, disg:100,
    fame:0, fenceRep:[0,0,0,0], props:[], propsHit:{}, lotUntil:0,
    week:{earned:0, cars:0, races:0, big:0}, collection:Array(12).fill(false), collRewards:{},
    mutators:mutators||{}, prestige:prestige||null,
    en:ENERGY_MAX, hp:100, lvl:1, xp:0, xpNext:100, skillPts:0,
    skills:{...cls.sk}, eq:{melee:null,gun:null,vest:null,tools:[null,null,null],pack:[]}, stash:{}, crew:[], garage:[],
    city:0, ride:null, nextUid:1, wantedBy:[0,0,0,0], cityLeft:[0,0,0,0], gangBy:[0,0,0,0],
    hideout:0, arrests:0, over:false, overReason:null, won:false,
    missions:[], barOffers:[], barOffersDay:0, loot:[], enc:null,
    dealer:null, crackdown:false, tipped:false, fenceUsed:0, pending:[], impound:[], transits:[], recorded:{}, finale:{offered:false, cased:false, legend:false, cooldown:0},
    log:[], stats:{jobs:0, jobsOk:0, carsStolen:0, carsSold:0, earned:0, paid:0, racesWon:0, cities:1},
  };
  if(g.prestige==="skills") for(const s of SKILLS) g.skills[s] = Math.min(8, g.skills[s]+1);
  if(g.prestige==="cash") g.cash += 20000;
  if(g.prestige==="kit"){ for(const id of ["picks","laptop","scanner"]) placeItem(g, id); }
  if(g.prestige==="rep") g.fenceRep = [10,10,10,10];
  genMissions(g);
  rollDealer(g);
  rollStreet(g);
  rollMarket(g);
  pushLog(g, `Day 1, ${CITIES[0].n}. You owe the Syndicate ${fmt$(g.debt)}. The meter is running.`, "bad");
  pushLog(g, `Interest is ${(d.interest*100).toFixed(1)}% nightly. Get stealing.`, "");
  return g;
}

// upgrade any older save to the current shape
export function migrate(g){
  if(!g) return g;
  if(g.ver>=3){
    g.enc = g.enc||null;
    for(const c of (g.garage||[])){ if(c.city===undefined) c.city = g.city||0; const tm=CARS[c.car]?.tmax??100; if((c.tune||0)>tm) c.tune=tm; }
    if(!g.wantedBy){ g.wantedBy=[0,0,0,0]; g.cityLeft=[0,0,0,0]; g.wantedBy[g.city]=g.wanted; }
    for(const m of (g.crew||[])) upgradeCrew(g, m);
    if(!g.quests) g.quests=[];
    if(g.trainedDay===undefined) g.trainedDay=0;
    if(!g.street) rollStreet(g);
    if(!g.gangBy) g.gangBy=[0,0,0,0];
    if(!g.finale) g.finale={offered:false, cased:false, legend:false, cooldown:0};
    if(!g.impound) g.impound=[];
    // pooled-HP combat → individual fighters
    const _f1 = en => ({id:"mf"+rnd(1000,9999)+"_"+rnd(100,999), n:en.n, face:en.face, hp:en.hp, max:en.max||en.hp, atk:en.atk});
    if(g.enc?.enemy){ g.enc.foes = [_f1(g.enc.enemy)]; delete g.enc.enemy; }
    if(g.enc?.standoff?.cops && !Array.isArray(g.enc.standoff.cops)){
      const c = g.enc.standoff.cops;
      g.enc.standoff.label = c.n;
      g.enc.standoff.cops = [{..._f1(c), face:"👮", cop:true}];
    }
    for(const m of (g.missions||[])) if(m.resume?.enemy){ m.resume.foes = [_f1(m.resume.enemy)]; delete m.resume.enemy; }
    if(!g.recorded) g.recorded={};
    if(!g.transits) g.transits=[];
    if(!g.market) rollMarket(g);
    if(g.dirty===undefined) g.dirty=0;
    if(g.fame===undefined) g.fame=0;
    if(!g.fenceRep) g.fenceRep=[0,0,0,0];
    if(!g.props){ g.props=[]; g.propsHit={}; g.lotUntil=0; }
    if(!g.week) g.week={earned:0,cars:0,races:0,big:0};
    if(!g.collection){ g.collection=Array(12).fill(false); g.collRewards={}; for(const c of g.garage) g.collection[c.car]=true; }
    if(!g.mutators) g.mutators={};
    for(const m of (g.crew||[])) if(m.trait===undefined) m.trait=null;
    if(g.eq && g.eq.tools.length<3) g.eq.tools.push(null);
    if(!g.eq){
      g.eq = {melee:null,gun:null,vest:null,tools:[null,null,null],pack:[]};
      for(const id of (g.carry||[])) if(!placeItem(g,id)) g.stash[id]=(g.stash[id]||0)+1;
      delete g.carry;
      if(g.enc) g.enc=null; // old mid-scene state predates the slot system — safest to clear
    }
    return g;
  }
  g.ver = 3;
  g.eq = {melee:null,gun:null,vest:null,tools:[null,null,null],pack:[]};
  g.stash = {};
  for(const id of (g.gear||[])) if(!placeItem(g,id)) g.stash[id]=(g.stash[id]||0)+1;
  delete g.gear;
  g.gangBy=[0,0,0,0];
  g.finale={offered:false, cased:false, legend:false, cooldown:0};
  g.impound=[]; g.recorded={};
  g.disg = 100; g.city = 0; g.ride = null; g.nextUid = 1;
  g.loot = g.loot||[]; g.enc = null; g.dealer = null;
  g.crackdown = false; g.tipped = false; g.fenceUsed = g.fenceUsed||0;
  g.avatar = g.avatar||{skin:0,hair:1,hc:0,acc:0,jc:0};
  g.pending = g.pending||[];
  g.wantedBy=[0,0,0,0]; g.cityLeft=[0,0,0,0]; g.wantedBy[g.city||0]=g.wanted||0;
  g.quests=[]; g.trainedDay=0;
  for(const m of (g.crew||[])) upgradeCrew(g, m);
  g.diff = Math.min(g.diff??1, DIFFS.length-1);
  g.stats = {jobs:0,jobsOk:0,carsStolen:0,carsSold:0,earned:0,paid:0,racesWon:0,cities:1, ...(g.stats||{})};
  g.garage = (g.garage||[]).map(c=>({
    uid:g.nextUid++, car:c.car, heat:c.heat??0, city:0,
    cond: c.dmg?85:100, disguise:rnd(0,15), tune:rnd(0,30), inv:[],
  }));
  // class ids changed in v3 — map old ones
  const clsMap = {joyrider:"driver", conman:"actor", hacker:"electrician", enforcer:"shooter", locksmith:"locksmith"};
  if(clsMap[g.cls]) g.cls = clsMap[g.cls];
  return g;
}

export function pushLog(g, m, c=""){ g.log.unshift({m, c, day:g.day}); g.log = g.log.slice(0,80); }

/* ── inventory: equipment slots + backpack + stash ─────────────────── */
export const eqItem = (g, slot) => g.eq[slot] ? ITEMS.find(i=>i.id===g.eq[slot]) : null;
export function carriedList(g){
  return [g.eq.melee, g.eq.gun, g.eq.vest, ...g.eq.tools, ...g.eq.pack].filter(Boolean);
}
export function carried(g, id){ return carriedList(g).includes(id); }
export function packSpace(g){ return PACK_SIZE - g.eq.pack.length - (g.loot||[]).length; }
// place an item on your person: its slot first, then a tool slot, then the backpack
export function placeItem(g, id){
  const it = ITEMS.find(i=>i.id===id);
  if(!it) return false;
  if(it.slot!=="tool" && !g.eq[it.slot]){ g.eq[it.slot] = id; return true; }
  if(it.slot==="tool"){
    const ti = g.eq.tools.indexOf(null);
    if(ti>=0){ g.eq.tools[ti] = id; return true; }
  }
  if(packSpace(g)>0){ g.eq.pack.push(id); return true; }
  return false;
}
export function buyItem(g, id){
  const it = ITEMS.find(i=>i.id===id);
  if(!it || funds(g)<it.cost) return false;
  if(g.mutators?.pacifist && (it.slot==="gun"||it.slot==="melee")) return false;
  spend(g, it.cost);
  if(carried(g,id) || !placeItem(g,id)) g.stash[id] = (g.stash[id]||0)+1;
  pushLog(g, `🛠️ Bought ${it.n}`);
  return true;
}
export function equipItem(g, id){ // stash → on you
  if(carried(g,id) || !(g.stash[id]>0)) return false;
  if(!placeItem(g,id)) return false;
  g.stash[id]--; if(g.stash[id]<=0) delete g.stash[id];
  return true;
}
export function unequipItem(g, id){ // on you → stash
  if(g.eq.melee===id) g.eq.melee=null;
  else if(g.eq.gun===id) g.eq.gun=null;
  else if(g.eq.vest===id) g.eq.vest=null;
  else if(g.eq.tools.includes(id)) g.eq.tools[g.eq.tools.indexOf(id)]=null;
  else if(g.eq.pack.includes(id)) g.eq.pack.splice(g.eq.pack.indexOf(id),1);
  else return false;
  g.stash[id] = (g.stash[id]||0)+1;
  return true;
}
// crew equipment: melee / gun / vest, fed from the stash
export function giveCrew(g, ci, id){
  const m = g.crew[ci]; const it = ITEMS.find(i=>i.id===id);
  if(!m || !it || it.slot==="tool" || !(g.stash[id]>0)) return false;
  m.eq = m.eq||{melee:null,gun:null,vest:null};
  if(m.eq[it.slot]) g.stash[m.eq[it.slot]] = (g.stash[m.eq[it.slot]]||0)+1; // swap old back
  m.eq[it.slot] = id;
  g.stash[id]--; if(g.stash[id]<=0) delete g.stash[id];
  pushLog(g, `🤝 ${m.name} now carries the ${it.n}.`);
  return true;
}
export function takeCrew(g, ci, slot){
  const m = g.crew[ci];
  if(!m?.eq?.[slot]) return false;
  g.stash[m.eq[slot]] = (g.stash[m.eq[slot]]||0)+1;
  m.eq[slot] = null;
  return true;
}
export const crewEqItem = (m, slot) => m?.eq?.[slot] ? ITEMS.find(i=>i.id===m.eq[slot]) : null;

/* ── derived values ────────────────────────────────────────────────── */
export function dailyCosts(g){
  let c = HIDEOUTS[g.hideout].costs;
  for(const m of g.crew) c += m.wage;
  for(const id of (g.props||[])) c += PROPERTIES.find(p=>p.id===id)?.upkeep||0;
  return c;
}
export function garageCap(g){
  return HIDEOUTS[g.hideout].cap + (ownsProp(g,"storage") && g.city===3 ? 4 : 0);
}
export const localCars = g => g.garage.filter(c=>(c.city??0)===g.city);
export function rideCar(g){
  if(g.ride==null) return null;
  const c = g.garage.find(c=>c.uid===g.ride);
  return c && (c.city??0)===g.city ? c : null;
}
export function hasTowTruck(g){ return localCars(g).some(c=>CARS[c.car].tow); }
export function skillOf(g, sk){
  let v = g.skills[sk];
  for(const id of [g.eq.melee, g.eq.gun, g.eq.vest, ...g.eq.tools]){
    if(!id) continue;
    const it = ITEMS.find(i=>i.id===id);
    if(it && it.sk===sk) v += it.b;
  }
  if(sk==="driving"){
    const r = rideCar(g);
    if(r) v += (r.tune>=80 ? 2 : r.tune>=40 ? 1 : 0) - (r.quirk==="pullsLeft"?1:0);
  }
  return v;
}
export function blockPct(g){ const v = eqItem(g,"vest"); return v?.block||0; }
export function crewBonus(g, sk){
  let best=0, who=null;
  for(const m of g.crew){ if(!m.out && m.sk[sk]>best){ best=m.sk[sk]; who=m; } }
  return { b: Math.ceil(best/2), who };
}
export function missionDiff(m){
  const t = tpl(m);
  return t.diff + (m.car!==undefined ? Math.ceil(CARS[m.car].d/2) : 0);
}
export function checkBonus(g, m){
  const t = tpl(m);
  return skillOf(g,t.chk[0]) + Math.ceil(skillOf(g,t.chk[1])/2) + crewBonus(g,t.chk[0]).b;
}
export function successChance(g, m){
  const need = missionDiff(m) - checkBonus(g, m);
  const p = (21 - Math.max(2, Math.min(20, need))) / 20;
  return Math.max(.05, Math.min(.95, p));
}
export function carEquipVal(c){ return (c.inv||[]).reduce((s,id)=>{const e=CAR_EQUIP.find(x=>x.id===id);return s+(e?e.v:0);},0); }
export function fencePrice(c){
  const v = CARS[c.car].v;
  const condF = 0.4 + 0.6*(c.cond??100)/100;
  const heatPen = (c.heat??0)*0.15*(1-(c.disguise??0)/130);
  const tuneBonus = v * (c.tune||0)/100 * 0.08;
  const quirkF = c.quirk==="exmayor"?1.2 : c.quirk==="lemon"?0.85 : 1;
  return Math.round((v*condF + carEquipVal(c)*0.4 + tuneBonus) * quirkF * Math.max(0.1, 1-heatPen));
}
export const fence = g => FENCES[g.city];
export function fenceCarMult(g, c){
  const f = fence(g), v = CARS[c.car].v;
  let m = 1 + (f.carB||0);
  if(f.exoticB && v>=RECOG_VALUE) m += f.exoticB;
  if(f.cheapPen && v<10000) m -= f.cheapPen;
  return m;
}
export function fenceQuote(g, c){ return Math.round(fencePrice(c)*fenceCarMult(g, c)); }
export function repTier(g){ const r=(g.fenceRep||[0,0,0,0])[g.city]||0; return r>=50?0.5:r>=25?0.25:r>=10?0.1:0; }
export function ownsProp(g, id){ return (g.props||[]).includes(id); }
export function fenceBudget(g){
  let b = FENCE_BUDGET[g.hideout]*(fence(g).budgetMult||1);
  b *= 1 + repTier(g);
  b *= 1 + (g.fame||0)/200;
  if(ownsProp(g,"pawn") && g.city===2) b *= 1.25;
  return Math.round(b);
}
export function fenceLeft(g){ return Math.max(0, fenceBudget(g) - (g.fenceUsed||0)); }
export function isRecognizable(c){ return CARS[c.car].v >= RECOG_VALUE && (c.disguise??0) < 50; }
export function lootValue(g){ return (g.loot||[]).reduce((s,L)=>s+L.v, 0); }
export function sellLoot(g){
  const v = lootValue(g);
  if(v<=0) return 0;
  const n = g.loot.length;
  const left = fenceLeft(g);
  const vq = Math.round(v*(1+(fence(g).lootB||0)));
  const paid = Math.min(vq, left) + Math.round(Math.max(0, vq-left)*0.35);
  g.fenceUsed = (g.fenceUsed||0) + vq;
  addDirty(g, paid); g.stats.earned += paid; g.loot = [];
  g.fenceRep[g.city] = (g.fenceRep[g.city]||0)+1;
  pushLog(g, `💰 Fenced ${n} item${n>1?"s":""} for ${fmt$(paid)}`, "good");
  gainXP(g, 3);
  return paid;
}
// scores over $15K pay 40% in hand; the rest gets wired over the next two days
export function bigPay(g, amt, label){
  amt = Math.round(amt);
  if(amt<=15000){ addDirty(g, amt); g.stats.earned += amt; return amt; }
  const now = Math.round(amt*0.4), later = amt-now, half = Math.round(later/2);
  addDirty(g, now); g.stats.earned += amt;
  g.pending = g.pending||[];
  g.pending.push({day:g.day+1, amt:half, label});
  g.pending.push({day:g.day+2, amt:later-half, label});
  pushLog(g, `💼 ${label}: ${fmt$(now)} in hand — the remaining ${fmt$(later)} gets wired over two days.`, "good");
  return now;
}
export function processPending(g){
  if(!g.pending?.length) return 0;
  let got = 0;
  g.pending = g.pending.filter(p=>{
    if(p.day<=g.day){ if(p.clean) g.cash += p.amt; else addDirty(g, p.amt); got += p.amt; pushLog(g, `💼 Wire received: ${fmt$(p.amt)} (${p.label})${p.clean?" — clean":""}`, "good"); return false; }
    return true;
  });
  return got;
}
export function pendingTotal(g){ return (g.pending||[]).reduce((s,p)=>s+p.amt,0); }
export function netWorthDirty(g){ return g.dirty||0; }
export function netWorth(g){
  return g.cash + (g.dirty||0) + pendingTotal(g) + g.garage.reduce((s,c)=>s+fencePrice(c),0) + lootValue(g)
    + (g.props||[]).reduce((s,id)=>s+(PROPERTIES.find(p=>p.id===id)?.cost||0),0) - g.debt;
}
export const tpl = m => MISSIONS.find(x=>x.id===m.t);
export const cityMult = g => CITIES[g.city].mult;
export const gangHeat = g => (g.gangBy||[0,0,0,0])[g.city]||0;
export function bumpGang(g, n){
  g.gangBy = g.gangBy||[0,0,0,0];
  g.gangBy[g.city] = Math.max(0, Math.min(12, (g.gangBy[g.city]||0)+n));
}

/* ── missions ──────────────────────────────────────────────────────── */
export function genMissions(g){
  g.missions = [];
  const n = rnd(8,11);
  const avail = MISSIONS.filter(m=>g.lvl>=m.minLvl);
  // tow trucks are a rare find — rarer still if you already own one
  const weights = avail.map(t=>t.truck ? (hasTowTruck(g)?0.15:0.5) : (1 + 0.2*(t.minLvl-1)) * (t.car && t.car[0]>=7 ? 0.5 : 1));
  const wsum = weights.reduce((a,b)=>a+b,0);
  const wpick = ()=>{ let r=Math.random()*wsum; for(let k=0;k<avail.length;k++){ r-=weights[k]; if(r<=0) return avail[k]; } return avail[avail.length-1]; };
  const spots = shuffledSpots();
  const shift = g.city>=2 ? 1 : 0; // richer cities, richer cars
  for(let i=0;i<n;i++){
    const t = wpick();
    const s = spots[i % spots.length];
    const m = { t:t.id, x:s.x, y:s.y, dist:pick(CITIES[g.city].districts), done:false };
    if(t.car)  m.car = Math.min(9, rnd(t.car[0], t.car[1]) + shift);
    if(t.truck) m.car = 10;
    if(t.order){ m.car = Math.min(9, rnd(4,9)+shift); m.bonus = +((1.15+Math.random()*0.3+(g.fame||0)/500)*(CITIES[g.city].perk==="collectors"?1.15:1)).toFixed(2); }
    if(t.race){
      m.stake = Math.round([1000,2000,4000,8000,18000][rnd(0, Math.min(4, g.lvl-1))]*cityMult(g)*(CITIES[g.city].perk==="collectors"?1.15:1));
      m.rival = { name:pick(["Knuckles Reyes","La Flecha","Tommy Two-Lane","Sasha Redline","El Fantasma","Dee Burnout"]),
                  face:pick(["😎","🦊","🐍","👹","🤡","🦂"]),
                  car: Math.min(9, Math.max(2, g.lvl + rnd(-1,2))) };
      if(g.lvl>=3 && Math.random()<0.3){ m.pink = true; m.stake = 0; }
    }
    g.missions.push(m);
  }
  if(((g.fenceRep||[])[g.city]||0)>=25 && Math.random()<0.5 && g.lvl>=4){
    g.missions.push({t:"order", x:rnd(10,90), y:rnd(12,88), dist:pick(CITIES[g.city].districts), done:false,
      car:Math.min(9, rnd(4,9)+shift), bonus:+(1.3+Math.random()*0.3).toFixed(2)});
  }
  if(g.city===2 && g.lvl>=7 && Math.random()<0.35){
    g.missions.push({t:"casino", x:rnd(40,58), y:rnd(20,75), dist:"The Strip", done:false});
  }
  if((g.impound||[]).some(c=>(c.city??0)===g.city)){
    g.missions.push({t:"impound", x:rnd(70,88), y:rnd(70,88), dist:"Police impound lot", done:false});
  }
  if(g.tipped){ // tip from last night's event: a fat special order
    g.tipped = false;
    g.missions.push({t:"order", x:rnd(20,80), y:rnd(20,80), dist:pick(CITIES[g.city].districts),
      done:false, car:Math.min(9, rnd(6,9)+shift), bonus:+(1.8+Math.random()*0.3).toFixed(2)});
    pushLog(g, "📞 The tip was good — a collector wants a special delivery tonight.", "good");
  }
}
function shuffledSpots(){
  const spots=[];
  for(let r=0;r<4;r++) for(let c=0;c<5;c++)
    spots.push({x:10+c*18+rnd(-4,4), y:12+r*22+rnd(-5,5)});
  for(let i=spots.length-1;i>0;i--){ const j=rnd(0,i); [spots[i],spots[j]]=[spots[j],spots[i]]; }
  return spots;
}

/* ── d20 check + learn-by-doing ────────────────────────────────────── */
export function check(g, sk1, sk2, diff){
  const cb = crewBonus(g, sk1);
  const bonus = skillOf(g,sk1) + Math.ceil(skillOf(g,sk2)/2) + cb.b;
  const roll = rnd(1,20);
  const r = { roll, bonus, total:roll+bonus, diff, crit:roll===20, fumble:roll===1,
              ok: roll===20 || (roll!==1 && roll+bonus>=diff), who:cb.who, learn:null };
  // skills sharpen with successful use — rarer as you get better
  if(r.ok && g.skills[sk1]<8 && rnd(1,100) <= 14-g.skills[sk1]){
    g.skills[sk1]++;
    r.learn = sk1;
    pushLog(g, `📈 Gained 1 of ${cap(sk1)} (${g.skills[sk1]})`, "good");
  }
  return r;
}

function bumpWanted(g, n){
  if(n<=0) return 0;
  let inc=0;
  for(let i=0;i<n;i++) if(Math.random()<0.3) inc++;
  if(n>=4 && inc===0) inc=1;
  inc = Math.min(2, inc);
  const before=g.wanted;
  g.wanted = Math.min(6, g.wanted+inc);
  return g.wanted-before;
}
export function bumpWantedPub(g, n){ return bumpWanted(g, n); }
export function injure(g, d){
  d = Math.max(1, Math.ceil(d*(1-blockPct(g)/100)));
  g.hp = Math.max(0, g.hp-d);
  return d;
}
export function addFame(g, n){
  if(n>0 && g.mutators?.speed) n*=2;
  g.fame = Math.max(0, Math.min(100, (g.fame||0)+n));
}
export function fameBand(g){ return g.fame>=75?"legend":g.fame>=50?"hot":g.fame>=25?"rising":"quiet"; }
export function gainXP(g, n){
  if(g.mutators?.pacifist) n = Math.round(n*1.2);
  g.xp += n;
  let ups = 0;
  while(g.xp >= g.xpNext){
    g.xp -= g.xpNext; g.lvl++; g.xpNext = Math.round(g.xpNext*1.6);
    g.skillPts += 2; ups++;
    pushLog(g, `⭐ Level up! Now level ${g.lvl}. +2 skill points.`, "good");
  }
  return ups;
}

// police pressure multiplier: difficulty × crackdown × how well they know your face
export function copPressure(g){
  return DIFFS[g.diff].copMult * (g.crackdown?1.5:1) * (1.5 - g.disg/100*0.8);
}

/* ── races resolve instantly (everything else is a crime scene) ────── */
export function attemptMission(g, i){
  const m = g.missions[i], t = tpl(m);
  if(g.over || m.done || g.en < t.en) return null;
  if(m.stake && g.cash < m.stake) return { kind:"blocked", msg:`You need ${fmt$(m.stake)} for the buy-in.` };
  g.en -= t.en;
  m.done = true;
  g.stats.jobs++;
  const diff = missionDiff(m);
  const r = check(g, t.chk[0], t.chk[1], diff);
  const ev = { kind:"mission", t, m, r, lines:[], cash:0, levelUps:0 };
  if(r.ok){
    g.stats.jobsOk++;
    ev.cash = bigPay(g, m.stake, "race winnings"); g.stats.racesWon++;
    ev.lines.push({c:"good", m:`You smoke them off the line and collect ${fmt$(m.stake*2)} — doubling your stake.`});
    pushLog(g, `🏁 Won a street race: +${fmt$(m.stake)}`, "good");
    const w = bumpWanted(g, t.heat);
    if(w>0) ev.lines.push({c:"warn", m:`Wanted level +${w}.`});
    ev.levelUps = gainXP(g, 10+diff*2+(r.crit?15:0));
  } else {
    g.cash -= m.stake;
    ev.lines.push({c:"bad", m:`You eat the wall on turn three. The stake (${fmt$(m.stake)}) is gone.`});
    pushLog(g, `🏁 Lost a race: −${fmt$(m.stake)}`, "bad");
    bumpWanted(g, 1);
    gainXP(g, 3);
  }
  ev.police = !g.over && g.hp>0 && rnd(1,100) <= g.wanted*1.6*copPressure(g);
  return ev;
}

/* ── police ────────────────────────────────────────────────────────── */
export function copTargets(g){
  const w = Math.round(g.wanted*1.5);
  return { run:8+w, hide:7+w, talk:9+w, bribe:Math.round(g.wanted*1500*(1+(g.fame||0)/150)) };
}
export function copAction(g, a){
  const ev = { kind:"police", a, lines:[], arrested:false };
  if(a==="bribe"){
    const cost = copTargets(g).bribe;
    spend(g, cost);
    if(rnd(1,20) > 2){
      g.wanted = Math.max(0, g.wanted-2);
      ev.lines.push({c:"good", m:`The bills disappear into a uniform pocket. "Drive safe." Wanted −2.`});
    } else {
      ev.arrested = true;
      ev.lines.push({c:"bad", m:"Wrong cop. He takes the money and cuffs you."});
    }
    return ev;
  }
  const map = { run:["driving"], hide:["hiding"], talk:["acting"] };
  const sk = map[a][0];
  const r = check(g, sk, sk, copTargets(g)[a]);
  ev.r = r;
  if(r.ok){
    ev.lines.push({c:"good", m:"You slip the net. Heart pounding, but free."});
    if(r.crit){ g.wanted=Math.max(0,g.wanted-1); ev.lines.push({c:"good", m:"They lost you completely — wanted −1."}); }
  } else {
    if(a==="run"){ const dmg=injure(g, rnd(10,25)); ev.lines.push({c:"bad", m:`You clip a divider and spin out. −${dmg}% health.`}); }
    ev.arrested = true;
    ev.lines.push({c:"bad", m:"They've got you."});
  }
  return ev;
}
export function applyArrest(g){
  g.arrests++;
  g.lastArrestDay = g.day;
  if(g.arrests>=4 || (g.arrests>=3 && g.wanted>=5)){
    g.over = true; g.overReason = "prison";
    return { kind:"gameover", reason:"prison" };
  }
  const days = Math.max(1,g.wanted), fine = Math.min(funds(g), g.wanted*2000+500);
  spend(g, fine);
  // booking desk: everything on you goes into an evidence bag and stays there
  const tools = carriedList(g).map(id=>ITEMS.find(i=>i.id===id)).filter(Boolean);
  const lootN = (g.loot||[]).length, lootV = lootValue(g);
  g.eq = {melee:null,gun:null,vest:null,tools:[null,null,null],pack:[]}; g.loot = [];
  for(let i=0;i<days;i++) nightTick(g, true);
  g.day += days;
  processPending(g);
  g.wanted = 0; g.en = maxEnergy(g);
  g.disg = Math.max(20, g.disg-15); // mugshot updated
  genMissions(g);
  // anyone in the crew quietly talking to the police?
  for(const m of g.crew){
    if(m.trait==="snitch" && !m.revealed && rnd(1,100)<=35){
      m.revealed = true;
      g.wanted = Math.min(6, g.wanted+2);
      g.disg = Math.max(10, g.disg-10);
      pushLog(g, `🐀 ${m.name} talked to the detectives while you were inside. Wanted +2. You know what they are now.`, "bad");
      break;
    }
  }
  pushLog(g, `⛓️ Arrested! ${days} day(s) in lockup, ${fmt$(fine)} in fines. (Strike ${g.arrests}/4)`, "bad");
  if(tools.length) pushLog(g, `🧾 Confiscated as evidence: ${tools.map(t=>t.n).join(", ")}.`, "bad");
  if(lootN) pushLog(g, `🧾 Your backpack (${lootN} item${lootN>1?"s":""}, ${fmt$(lootV)}) is gone too.`, "bad");
  return { kind:"jail", days, fine, strikes:g.arrests, tools, lootN, lootV };
}

/* ── garage & cars ─────────────────────────────────────────────────── */
export function genQuirk(){ return rnd(1,100)<=20 ? pick(QUIRKS).id : null; }
export function noteCollection(g, carIdx){
  if(!g.collection) return;
  if(g.collection[carIdx]) return;
  g.collection[carIdx] = true;
  const n = g.collection.filter(Boolean).length;
  pushLog(g, `📒 ${CARS[carIdx].n} added to your collection (${n}/12).`, "good");
  g.collRewards = g.collRewards||{};
  if(n>=6 && !g.collRewards.six){ g.collRewards.six=true; addFame(g,10); pushLog(g, "📒 Six models collected — the scene starts to know your taste. +10 fame.", "good"); }
  if(n>=10 && !g.collRewards.ten){ g.collRewards.ten=true; addClean(g,25000); pushLog(g, "📒 Ten models! A collector pays $25,000 (clean) just to walk your garage.", "good"); }
  if(n>=12 && !g.collRewards.twelve){ g.collRewards.twelve=true; addFame(g,25); pushLog(g, "👑 THE FULL SET. Every garage from Miami to LA knows the name. +25 fame.", "good"); }
}
export function genCarInv(d){
  const inv = [];
  const n = d>=8 ? rnd(1,3) : d>=3 ? rnd(0,2) : rnd(0,1);
  const pool = CAR_EQUIP.filter(e=>!e.trace);
  for(let i=0;i<n;i++){ const e=pick(pool); if(!inv.includes(e.id)) inv.push(e.id); }
  if(d>=5 && Math.random()<0.5) inv.push("gps"); // nice cars get tracked
  return inv;
}
export function addStolenCar(g, carIdx, dmg){
  const c = {
    uid:g.nextUid++, car:carIdx, city:g.city, heat:rnd(2,4)+Math.floor(CARS[carIdx].d/5),
    cond: 100 - rnd(0,12) - (dmg?15:0),
    disguise: rnd(0,15), tune: Math.min(CARS[carIdx].tmax??100, rnd(0,35)),
    inv: genCarInv(CARS[carIdx].d), quirk: genQuirk(),
  };
  g.garage.push(c);
  noteCollection(g, carIdx);
  g.week && g.week.cars++;
  return c;
}
export function sellCar(g, uid){
  const i = g.garage.findIndex(c=>c.uid===uid);
  if(i<0) return null;
  const c = g.garage[i];
  if((c.city??0)!==g.city) return "away"; // the car is parked in another city
  if(isRecognizable(c)) return "recog"; // every cop in the state has this plate — respray first
  const f = fence(g);
  const p = fenceQuote(g, c);
  const left = fenceLeft(g);
  const paid = Math.min(p, left) + Math.round(Math.max(0, p-left)*0.35);
  g.fenceUsed = (g.fenceUsed||0) + p;
  addDirty(g, paid); g.garage.splice(i,1);
  if(g.ride===uid) g.ride = null;
  g.fenceRep[g.city] = (g.fenceRep[g.city]||0)+1;
  if(c.quirk==="famous"){ addFame(g,5); pushLog(g, "🎬 Word spreads that THE movie car just changed hands. +fame", "good"); }
  if(paid>25000) addFame(g, 4);
  if(paid>(g.week?.big||0)) g.week.big = paid;
  g.stats.carsSold++; g.stats.earned += paid;
  if(paid<p) pushLog(g, `💰 Sold ${CARS[c.car].n} for ${fmt$(paid)} — ${f.n}'s cash ran short today (full price was ${fmt$(p)})`, "warn");
  else pushLog(g, `💰 Sold ${CARS[c.car].n} to ${f.n} for ${fmt$(paid)}`, "good");
  const loudAt = f.loud ? 18000 : 25000;
  if(paid>loudAt && g.wanted<6){ g.wanted++; pushLog(g, "📢 A sale that big makes noise. Wanted +1.", "bad"); }
  gainXP(g, 5);
  questHook(g, "sell", {car:c.car});
  return paid;
}
export const repairCost = c => Math.max(3, Math.round(CARS[c.car].v*0.002));
export function repairCar(g, uid){
  const c = g.garage.find(x=>x.uid===uid); if(c && (c.city??0)!==g.city) return false; if(!c||c.cond>=100) return false;
  const cost = (100-c.cond)*repairCost(c);
  if(!spend(g, cost)) return false;
  c.cond = 100;
  pushLog(g, `🔧 Repaired the ${CARS[c.car].n} (${fmt$(cost)})`);
  return true;
}
export const resprayRate = c => Math.max(10, Math.round(CARS[c.car].v*0.0006));
export function resprayCar(g, uid){
  const c = g.garage.find(x=>x.uid===uid); if(c && (c.city??0)!==g.city) return false; if(!c||c.disguise>=100) return false;
  const cost = Math.round((100-c.disguise)*resprayRate(c));
  if(!spend(g, cost)) return false;
  c.disguise = 100;
  pushLog(g, `🎨 Resprayed the ${CARS[c.car].n} — new plates, new color (${fmt$(cost)})`);
  return true;
}
export const tuneMax = c => Math.min(100, (CARS[c.car].tmax ?? 100) + (c.quirk==="tuner"?20:0));
export function nextTuneStage(c){
  return TUNE_STAGES.find(s=>s.to > (c.tune||0) && s.to <= tuneMax(c)) || null;
}
export function tuneStageName(c){
  const done = [...TUNE_STAGES].reverse().find(s=>(c.tune||0) >= s.to);
  return done ? done.n : "Stock";
}
export function tuneCost(c){
  const s = nextTuneStage(c);
  if(!s) return 0;
  return Math.round(s.cost * (1 + CARS[c.car].d/15)); // premium metal, premium parts
}
export function tuneCar(g, uid){
  const c = g.garage.find(x=>x.uid===uid); if(c && (c.city??0)!==g.city) return false; if(!c) return false;
  const s = nextTuneStage(c);
  if(!s) return false;
  const cost = tuneCost(c);
  if(!spend(g, cost)) return false;
  c.tune = s.to;
  pushLog(g, `⚙️ ${s.n} on the ${CARS[c.car].n} — tune ${c.tune}/100 (${fmt$(cost)})`);
  return true;
}
export function stripCar(g, uid){
  const c = g.garage.find(x=>x.uid===uid); if(c && (c.city??0)!==g.city) return false; if(!c||!c.inv.length) return false;
  const keep = [];
  let took = 0;
  const hadGps = c.inv.includes("gps");
  for(const id of c.inv){
    const e = CAR_EQUIP.find(x=>x.id===id);
    if(!e || e.v<=0) continue; // trackers get crushed, not kept
    if(packSpace(g)>0){ g.loot.push({n:e.n, ic:e.ic, v:e.v}); took++; }
    else keep.push(id); // backpack full — leave it installed
  }
  c.inv = keep;
  if(took===0 && keep.length) pushLog(g, `🎒 Backpack full — nothing stripped from the ${CARS[c.car].n}.`, "warn");
  else pushLog(g, `🔩 Stripped ${took} item${took===1?"":"s"} from the ${CARS[c.car].n}${hadGps?" — GPS tracker ripped out and crushed":""}${keep.length?` (${keep.length} left installed, backpack full)`:""}`);
  return took>0 || hadGps;
}
export function chopValue(c, g){
  let rate = g && CITIES[g.city].perk==="chop" ? 0.45 : 0.35;
  if(g && ownsProp(g,"chopfr")) rate += 0.10;
  return Math.round(CARS[c.car].v*(0.4+0.6*(c.cond??100)/100)*rate + carEquipVal(c)*0.5);
}
export function chopCar(g, uid){
  const c = g.garage.find(x=>x.uid===uid);
  if(!c || (c.city??0)!==g.city) return false;
  const pay = chopValue(c, g);
  g.garage.splice(g.garage.indexOf(c),1);
  if(g.ride===uid) g.ride = null;
  addDirty(g, pay); g.stats.earned += pay;
  if(pay>20000) addFame(g, 2);
  pushLog(g, `🪓 Chopped the ${CARS[c.car].n} for parts — ${fmt$(pay)}, no questions, no paper trail.`, "good");
  gainXP(g, 4);
  return pay;
}
export function canShip(g){ return CITIES[g.city].perk==="docks" && g.day >= (g.shipDay||0); }
export function shipCar(g, uid){
  if(!canShip(g)) return false;
  const c = g.garage.find(x=>x.uid===uid);
  if(!c || (c.city??0)!==g.city) return false;
  const pay = Math.round(CARS[c.car].v*(0.4+0.6*(c.cond??100)/100)*0.85 + carEquipVal(c)*0.4);
  g.garage.splice(g.garage.indexOf(c),1);
  if(g.ride===uid) g.ride = null;
  g.pending = g.pending||[];
  g.pending.push({day:g.day+3, amt:pay, label:"overseas buyer"});
  g.shipDay = g.day+5;
  g.stats.carsSold++;
  pushLog(g, `🚢 The ${CARS[c.car].n} leaves on the night freighter — ${fmt$(pay)} wires in 3 days. Plates, heat, paperwork: the ocean doesn't care.`, "good");
  gainXP(g, 6);
  return pay;
}
export function setRide(g, uid){
  const cc = g.garage.find(x=>x.uid===uid);
  if(cc && (cc.city??0)!==g.city) return false;
  g.ride = (g.ride===uid) ? null : uid;
  const c = g.garage.find(x=>x.uid===uid);
  if(g.ride && c) pushLog(g, `🔑 The ${CARS[c.car].n} is your ride now.`);
  return true;
}

/* ── the busy street: cars sitting out there right now ─────────────── */
export function rollStreet(g){
  const n = rnd(3,5);
  const street = [];
  for(let i=0;i<n;i++){
    const idx = Math.min(9, Math.floor(Math.pow(Math.random(),1.7)*(6+g.city*1.5)));
    street.push({ id:g.nextUid++, car:idx, cond:rnd(45,100), hasGps:CARS[idx].d>=5 && Math.random()<0.5 });
  }
  g.street = street;
}
export function targetStreetCar(g, id){
  const s = (g.street||[]).find(x=>x.id===id);
  if(!s) return -1;
  g.street.splice(g.street.indexOf(s),1);
  g.missions.push({ t:"stealcar", car:s.car, x:rnd(15,85), y:rnd(15,85),
    dist:pick(CITIES[g.city].districts), done:false, street:true, streetCond:s.cond });
  return g.missions.length-1;
}

/* ── the market: different cities, different shelves ───────────────── */
const MARKET_BASICS = ["hammer","slimjim","knife","bat","disguise","scanner","picks"];
const MARKET_BIAS = { // what each city's back rooms are good for
  0:["wedge","pistol"],                 // Miami
  1:["buster","wedge","machete"],       // Atlanta — tool town
  2:["pistol","magnum","shotgun"],      // Vegas — Sammy knows a guy
  3:["jammer","plated","laptop","nitro"], // LA — the expensive toys
};
export function rollMarket(g){
  const ids = [...MARKET_BASICS];
  for(const it of ITEMS){
    if(ids.includes(it.id)) continue;
    const biased = (MARKET_BIAS[g.city]||[]).includes(it.id);
    if(rnd(1,100) <= (biased ? 85 : 45)) ids.push(it.id);
  }
  g.market = { day:g.day, city:g.city, ids };
}
export function inStock(g, id){ return !g.market || g.market.ids.includes(id); }

/* ── dealer ────────────────────────────────────────────────────────── */
export function rollDealer(g){
  const base = g.city; // better cities stock better metal
  const stock = [];
  for(let i=0;i<3;i++){
    const idx = Math.min(9, rnd(base, 4+base*2));
    stock.push({ car:idx, price:Math.round(CARS[idx].v*1.15), tune:Math.min(CARS[idx].tmax??100, rnd(20,60)) });
  }
  g.dealer = { day:g.day, city:g.city, stock };
}
export function buyDealerCar(g, i){
  const o = g.dealer?.stock[i];
  if(!o || g.cash<o.price) return false; // dealers take clean money only
  if(localCars(g).length >= garageCap(g)) return "full";
  g.cash -= o.price;
  g.garage.push({ uid:g.nextUid++, car:o.car, city:g.city, heat:0, cond:100, disguise:100, tune:o.tune, inv:[], clean:true, quirk:genQuirk() });
  noteCollection(g, o.car);
  g.dealer.stock.splice(i,1);
  pushLog(g, `🤝 Bought a clean ${CARS[o.car].n} from the dealer (${fmt$(o.price)})`, "good");
  return true;
}

/* ── crew & economy (unchanged behavior) ───────────────────────────── */
export function upgradeCrew(g, m){
  if(m.hp===undefined) m.hp = 100;
  if(m.xp===undefined) m.xp = 0;
  if(m.lvl===undefined) m.lvl = 1;
  if(m.role===undefined) m.role = "backup";
  if(m.sideJob===undefined) m.sideJob = false;
  if(m.heldDays===undefined) m.heldDays = 0;
  if(!m.eq) m.eq = {melee:null,gun:null,vest:null};
  m.out = m.heldDays>0 || m.hp<50 || (m.transit||0) > (g.day||0);
  return m;
}
export function crewGainXP(g, m, n){
  m.xp = (m.xp||0)+n;
  const need = 40*(m.lvl||1);
  if(m.xp>=need){
    m.xp -= need; m.lvl = (m.lvl||1)+1;
    const best = SKILLS.reduce((a,b)=>m.sk[a]>=m.sk[b]?a:b);
    if(m.sk[best]<8) m.sk[best]++;
    m.wage += 40;
    pushLog(g, `📈 ${m.name} is getting sharper — ${cap(best)} ${m.sk[best]} (wage up to ${fmt$(m.wage)}).`, "good");
  }
}
export function setCrewRole(g, i, role){
  const m = g.crew[i]; if(!m) return false;
  m.role = role;
  return true;
}
export function rollBarOffers(g){
  if(g.barOffersDay===g.day && g.barOffers.length) return;
  g.barOffers = []; g.barOffersDay = g.day;
  for(let i=0;i<3;i++){
    const sk={}; SKILLS.forEach(s=>sk[s]=rnd(1, Math.min(6, 2+g.lvl)));
    const best=Math.max(...Object.values(sk));
    const trait = rnd(1,100)<=18 ? "snitch" : pick(TRAITS.filter(t=>!t.hidden)).id;
    const greedy = trait==="greedy";
    if(greedy){ const bs=SKILLS.reduce((a,b)=>sk[a]>=sk[b]?a:b); sk[bs]=Math.min(8, sk[bs]+1); }
    g.barOffers.push({ name:pick(NAMES), face:pick(FACES), sk, trait,
      wage:Math.round((best*60+rnd(20,120))*(greedy?1.25:1)), hire:best*400+rnd(100,500) });
  }
}
export function hireCrew(g, i){
  const c = g.barOffers[i];
  if(!c || funds(g)<c.hire) return "cash";
  if(g.crew.length>=4) return "full";
  spend(g, c.hire);
  g.crew.push(upgradeCrew(g, {name:c.name, face:c.face, sk:c.sk, wage:c.wage, out:false, trait:c.trait||null}));
  g.barOffers.splice(i,1);
  pushLog(g, `🍺 ${c.name} joined your crew`, "good");
  return true;
}
export function fireCrew(g, i){
  pushLog(g, `👋 ${g.crew[i].name} left the crew`);
  g.crew.splice(i,1);
}
export function payDebt(g, n){
  n = Math.min(n, g.cash, g.debt);
  if(n<=0) return 0;
  g.cash -= n; g.debt -= n; g.stats.paid += n;
  pushLog(g, `🦈 Paid ${fmt$(n)}. Remaining: ${fmt$(g.debt)}`, g.debt<=0?"good":"");
  if(g.debt<=0){
    g.won = true;
    pushLog(g, "🏆 DEBT PAID. You're free.", "good");
    if(!g.finale.offered && !g.finale.legend){
      g.finale.offered = true;
      pushLog(g, '🤵 Prince calls: "Nobody just leaves, friend. But do one last job for me — the Concours, in Los Angeles — and the Syndicate forgets your name forever." (The Last Job unlocked)', "good");
    }
  }
  return n;
}
export function heal(g){
  const cost = (100-g.hp)*25;
  if(g.hp>=100 || funds(g)<cost || g.en<2) return false;
  spend(g, cost); g.hp = 100; g.en -= 2;
  pushLog(g, `🏥 Patched up at the clinic (${fmt$(cost)})`, "good");
  return true;
}
export const COFFEE_MAX = 3;
export function coffeeCost(g){
  const n = g.coffeeDay===g.day ? (g.coffeeN||0) : 0;
  return 150 * Math.pow(3, n);
}
export function drinkCoffee(g){
  const n = g.coffeeDay===g.day ? (g.coffeeN||0) : 0;
  if(n>=COFFEE_MAX) return "max";
  const cost = coffeeCost(g);
  if(funds(g)<cost) return "cash";
  if(g.en>=maxEnergy(g)) return "full";
  spend(g, cost);
  g.coffeeDay = g.day; g.coffeeN = n+1;
  g.en = Math.min(maxEnergy(g), g.en+2);
  pushLog(g, `☕ Gas-station espresso #${n+1}. Your hands shake in a useful way. +2⚡ (${fmt$(cost)})`);
  return true;
}
export function makeover(g){
  const cost = Math.round((100-g.disg)*40);
  if(g.disg>=100 || funds(g)<cost) return false;
  spend(g, cost); g.disg = 100;
  pushLog(g, `💇 New look, new papers. The cops' file photo is worthless now (${fmt$(cost)})`, "good");
  return true;
}
export function upgradeHideout(g){
  const next = HIDEOUTS[g.hideout+1];
  if(!next || funds(g)<next.cost) return false;
  spend(g, next.cost); g.hideout++;
  pushLog(g, `🏚️ Moved into the ${next.n}. ${next.cap} car slots.`, "good");
  return true;
}
export const trainCost = (g, s) => 400*g.skills[s]*g.skills[s];
export function trainSkill(g, s){
  if(g.trainedDay===g.day) return "done";
  if(g.skills[s]>=8) return "cap";
  const cost = trainCost(g, s);
  if(funds(g)<cost) return "cash";
  if(g.en<3) return "energy";
  spend(g, cost); g.en -= 3; g.trainedDay = g.day;
  g.skills[s]++;
  pushLog(g, `🎯 A day at the ${s==="shooting"?"shooting ground":s==="driving"?"track":"workshop"} — ${cap(s)} is now ${g.skills[s]}.`, "good");
  return true;
}
export function raiseSkill(g, s){
  if(g.skillPts<=0 || g.skills[s]>=8) return false;
  g.skills[s]++; g.skillPts--;
  pushLog(g, `⭐ ${cap(s)} raised to ${g.skills[s]}`, "good");
  return true;
}

/* ── property empire ───────────────────────────────────────────────── */
export function buyProperty(g, id){
  const p = PROPERTIES.find(x=>x.id===id);
  if(!p || ownsProp(g,id)) return false;
  if(p.city!==g.city) return "away";
  if(g.cash < p.cost) return "clean"; // real estate wants clean money
  g.cash -= p.cost;
  g.props.push(id);
  pushLog(g, `🏘️ Bought ${p.n} (${fmt$(p.cost)}, clean). ${p.blurb}`, "good");
  addFame(g, 3);
  return true;
}
export function lotBusy(g){ return (g.lotUntil||0) > g.day; }
export function sellRetail(g, uid){ // Sunset Used Cars: clean title prices, clean money, 3 days
  if(!ownsProp(g,"carlot") || g.city!==3 || lotBusy(g)) return false;
  const c = g.garage.find(x=>x.uid===uid);
  if(!c || (c.city??0)!==3 || c.heat>0 || c.cond<60) return false;
  const pay = Math.round(CARS[c.car].v * (0.4+0.6*c.cond/100) * 1.15 + carEquipVal(c)*0.5);
  g.garage.splice(g.garage.indexOf(c),1);
  if(g.ride===uid) g.ride = null;
  g.pending.push({day:g.day+3, amt:pay, label:"Sunset Used Cars", clean:true});
  g.lotUntil = g.day+3;
  g.stats.carsSold++;
  pushLog(g, `🚙 The ${CARS[c.car].n} goes on the Sunset lot — ${fmt$(pay)} retail, wired clean in 3 days.`, "good");
  return pay;
}
function processProperties(g){
  const out = [];
  for(const id of (g.props||[])){
    const p = PROPERTIES.find(x=>x.id===id);
    if(!p) continue;
    if((g.propsHit?.[id]||0) > g.day){ out.push({ic:p.ic, m:`${p.n} is closed for repairs (until day ${g.propsHit[id]}).`}); continue; }
    if(p.income>0){ addClean(g, p.income); }
    if(p.launder>0 && (g.dirty||0)>0){
      const moved = Math.min(g.dirty, p.launder);
      launder(g, moved, LAUNDER_BIZ_FEE);
      out.push({ic:p.ic, m:`${p.n} washed ${fmt$(moved)} through the books.`});
    }
  }
  return out;
}
// gangs hit unprotected businesses when they're angry with you
function gangHitsProperty(g){
  if(!(g.props||[]).length || gangHeat(g)<5 || Math.random()>0.25) return null;
  const local = g.props.filter(id=>PROPERTIES.find(p=>p.id===id)?.city===g.city && (g.propsHit?.[id]||0)<=g.day);
  if(!local.length) return null;
  const id = pick(local);
  const p = PROPERTIES.find(x=>x.id===id);
  g.propsHit = g.propsHit||{};
  g.propsHit[id] = g.day+3;
  pushLog(g, `🔥 The local crew put a brick and a bottle through ${p.n}. Closed for 3 days.`, "bad");
  return {ic:"🔥", m:`${p.n} got hit by the local crew — closed 3 days. Settle that gang heat.`};
}

/* ── the casino (Vegas only) ───────────────────────────────────────── */
export function canGamble(g){ return CITIES[g.city].perk==="casino" && g.gambledDay!==g.day; }
export function gamble(g, amt){
  if(!canGamble(g)) return null;
  amt = Math.round(amt);
  if(amt<100 || funds(g)<amt) return null;
  amt = Math.min(amt, funds(g));
  g.gambledDay = g.day;
  spend(g, amt); // chips bought with whatever's in your pockets
  const win = rnd(1,100) <= 47;
  if(win){ g.cash += amt*2; pushLog(g, `🎰 DOUBLE. +${fmt$(amt)} — and the cage pays in a cashier's check. Clean.`, "good"); }
  else { pushLog(g, `🎰 Nothing. −${fmt$(amt)}. The house sends its regards.`, "bad"); }
  return {win, amt};
}

/* ── quests ────────────────────────────────────────────────────────── */
export const QUEST_DEFS = [
  {id:"ninoCars",giver:"Nino the Dealer",     ic:"🤝", what:"Are you a specialist in stealing cars? Nino needs 4 fresh ones — any make, this week.", type:"steals", need:4, reward:12000},
  {id:"nino1",  giver:"Nino the Dealer",      ic:"🤝", what:"Fence 3 cheap cars (worth under $10K) — Nino's customers aren't picky.", type:"sellCheap", need:3, reward:9000},
  {id:"madamev",giver:"Madame V",             ic:"💋", what:"Win 3 street races for Madame V's book.", type:"races", need:3, reward:16000},
  {id:"nino2",  giver:"Nino the Dealer",      ic:"🤝", what:"Nino wants volume: fence 6 cars of any kind.", type:"sellAny", need:6, reward:24000},
  {id:"prince", giver:"Prince the Mafia Boss",ic:"🤵", what:"Prince wants a Mirage Hypercar for his collection. Park one in your local garage and his men will collect it.", type:"ownCar", car:9, reward:150000},
];
export function questActive(g, id){ return (g.quests||[]).find(q=>q.id===id); }
export function offerQuest(g){
  const done = g.questsDone||[];
  const open = QUEST_DEFS.filter(q=>!questActive(g,q.id) && !done.includes(q.id)
    && !(q.id==="prince" && g.lvl<6) && !(q.id==="nino2" && !done.includes("nino1")));
  if(!open.length) return null;
  const q = pick(open);
  g.quests = g.quests||[];
  g.quests.push({id:q.id, prog:0});
  g.lastQuestDay = g.day;
  pushLog(g, `📞 ${q.giver}: "${q.what}" (Quest added)`, "good");
  return q;
}
export function questHook(g, kind, payload){
  for(const q of (g.quests||[])){
    const def = QUEST_DEFS.find(d=>d.id===q.id);
    if(!def) continue;
    if(def.type==="sellCheap" && kind==="sell" && CARS[payload.car].v<10000) q.prog++;
    if(def.type==="sellAny"  && kind==="sell") q.prog++;
    if(def.type==="races"    && kind==="raceWin") q.prog++;
    if(def.type==="steals"   && kind==="steal") q.prog++;
    if(def.need && q.prog>=def.need) completeQuest(g, q);
  }
}
function completeQuest(g, q){
  const def = QUEST_DEFS.find(d=>d.id===q.id);
  g.quests = g.quests.filter(x=>x!==q);
  g.questsDone = g.questsDone||[];
  g.questsDone.push(q.id);
  bigPay(g, def.reward, `${def.giver}'s job`);
  pushLog(g, `🏅 Quest complete — ${def.giver} pays ${fmt$(def.reward)}.`, "good");
}
export function processQuests(g){
  const q = (g.quests||[]).find(x=>x.id==="prince");
  if(q){
    const i = localCars(g).find(c=>c.car===9);
    if(i){
      g.garage.splice(g.garage.indexOf(i),1);
      if(g.ride===i.uid) g.ride=null;
      pushLog(g, "🤵 Prince's men collect the Mirage at dawn. He doesn't say thank you. He pays.", "good");
      completeQuest(g, q);
    }
  }
}

/* ── crew car-running: send a driver, lose them for the trip ────────── */
export function transitDays(from, to){ return Math.max(1, Math.abs(to-from)); }
export function dispatchCar(g, uid, dest, crewIdx){
  const c = g.garage.find(x=>x.uid===uid);
  const m = g.crew[crewIdx];
  if(!c || (c.city??0)!==g.city) return "car";
  if(dest===c.city) return "dest";
  if(!m || m.out) return "crew";
  if(g.ride===uid) g.ride = null;
  const days = transitDays(c.city, dest);
  const fuel = 120*days;
  if(!spend(g, fuel)) return "cash";
  g.garage.splice(g.garage.indexOf(c),1);
  g.transits.push({ car:c, crewName:m.name, crewFace:m.face, dest, arriveDay:g.day+days, from:g.city });
  m.transit = g.day+days;
  m.out = true;
  pushLog(g, `🚗💨 ${m.name} is driving the ${CARS[c.car].n} to ${CITIES[dest].n} — arrives day ${g.day+days} (${fmt$(fuel)} fuel).`);
  return true;
}
export function processTransits(g, silent){
  const lines = [];
  for(const t of [...(g.transits||[])]){
    // a night on the road: the car cools, but hot metal risks a traffic stop
    t.car.heat = Math.max(0, (t.car.heat||0)-1);
    const gps = (t.car.inv||[]).includes("gps");
    const risk = (t.car.heat>0 ? t.car.heat*4 : 0) + (gps?15:0);
    if(risk>0 && rnd(1,100)<=risk){
      g.transits.splice(g.transits.indexOf(t),1);
      g.impound = g.impound||[];
      g.impound.push({...t.car, city:t.dest, seizedDay:g.day});
      const m = g.crew.find(x=>x.name===t.crewName);
      if(m){ m.transit=0; m.heldDays=2; m.out=true;
        if(m.trait==="snitch" && !m.revealed && rnd(1,100)<=50){
          m.revealed=true; g.wanted=Math.min(6,g.wanted+2); g.disg=Math.max(10,g.disg-10);
          if(!silent) pushLog(g, `🐀 …and in the interview room, ${m.name} sang. Wanted +2.`, "bad");
        }
      }
      if(!silent) pushLog(g, `🚨 ${t.crewName} got pulled over running the ${CARS[t.car.car].n} — car seized to the ${CITIES[t.dest].n} impound, driver held 2 days.`, "bad");
      lines.push({c:"bad", m:`${t.crewFace} ${t.crewName} got stopped — the ${CARS[t.car.car].n} is in the ${CITIES[t.dest].n} impound.`});
      continue;
    }
    if(g.day+1 > t.arriveDay || g.day >= t.arriveDay){
      g.transits.splice(g.transits.indexOf(t),1);
      t.car.city = t.dest;
      g.garage.push(t.car);
      const m = g.crew.find(x=>x.name===t.crewName);
      if(m){ m.transit = g.day+1; } // flies home overnight
      if(!silent) pushLog(g, `🏁 ${t.crewName} delivered the ${CARS[t.car.car].n} to ${CITIES[t.dest].n}. They'll be back tomorrow.`, "good");
      lines.push({c:"good", m:`${t.crewFace} ${t.crewName} delivered the ${CARS[t.car.car].n} to ${CITIES[t.dest].n}.`});
    }
  }
  return lines;
}

/* ── travel ────────────────────────────────────────────────────────── */
export function travelCosts(g, cityIdx){
  const dist = Math.abs(cityIdx - g.city) || 1;
  return { fly: FLY_BASE + FLY_PER*dist, drive: DRIVE_PER*dist };
}
export function travel(g, cityIdx, mode){
  if(cityIdx===g.city || g.over) return false;
  const costs = travelCosts(g, cityIdx);
  const cost = mode==="fly" ? costs.fly : costs.drive;
  const ride = rideCar(g);
  if(mode==="drive" && !ride) return "noride";
  if(funds(g) < cost) return "cash";
  spend(g, cost);
  if(mode==="drive" && ride) ride.city = cityIdx; // the ride comes with you — everything else stays parked
  const tick = nightTick(g, false);
  g.day++;
  processPending(g);
  g.wantedBy[g.city] = g.wanted;        // this town remembers you
  g.cityLeft[g.city] = g.day;
  g.city = cityIdx;
  const away = Math.max(0, g.day - (g.cityLeft[cityIdx]||0));
  g.wanted = Math.max(0, (g.wantedBy[cityIdx]||0) - Math.floor(away/2));
  g.wantedBy[cityIdx] = g.wanted;
  g.stats.cities = Math.max(g.stats.cities, cityIdx+1);
  g.disg = Math.min(100, g.disg + (mode==="fly"?20:10)); // fresh face in a new town
  g.en = maxEnergy(g);
  g.fenceUsed = 0; // new city, new fence
  g.barOffers = []; g.barOffersDay = 0;
  genMissions(g);
  rollDealer(g);
  rollStreet(g);
  rollMarket(g);
  pushLog(g, `${mode==="fly"?"✈️":"🚗"} ${mode==="fly"?"Flew":"Drove"} to ${CITIES[cityIdx].n} (${fmt$(cost)}). New town, cold trail.`, "good");
  return { ...tick, city:CITIES[cityIdx].n };
}

/* ── night cycle ───────────────────────────────────────────────────── */
export function nightTick(g, silent){
  // your businesses never sleep — they run whether you're in town, on a plane, or in a cell
  const propLines = processProperties(g);
  const transitLines = processTransits(g, silent);
  const d = DIFFS[g.diff];
  const interest = Math.round(g.debt*d.interest*(g.mutators?.speed?1.5:1));
  g.debt += interest;
  const costs = dailyCosts(g);
  const short = spendUpTo(g, costs);
  for(const c of g.garage) c.heat = Math.max(0, c.heat-1);
  if(g.gangBy) g.gangBy[g.city] = Math.max(0, (g.gangBy[g.city]||0)-1);
  for(const m of g.crew){
    upgradeCrew(g, m);
    m.hp = Math.min(100, m.hp+20);
    if(m.heldDays>0) m.heldDays--;
    m.out = m.heldDays>0 || m.hp<50 || (m.transit||0) > g.day;
  }
  let borrowed = 0;
  if(short>0){
    borrowed = short;
    g.debt += borrowed*2;
    if(!silent) pushLog(g, `🦈 Broke! The shark covers ${fmt$(borrowed)} of costs — and doubles it onto your debt.`, "bad");
  }
  // hot cars can get traced overnight — GPS trackers are radioactive
  let traced = null;
  if(!silent){
    for(const c of [...g.garage]){
      if(c.heat<=0 || (c.city??0)!==g.city) continue;
      const gps = c.inv.includes("gps") && !carried(g,"jammer");
      const p = (gps ? 18 : 3.5) * DIFFS[g.diff].copMult * (1 - c.disguise/130);
      if(rnd(1,1000) <= p*10){
        g.garage.splice(g.garage.indexOf(c),1);
        if(g.ride===c.uid) g.ride=null;
        g.wanted = Math.min(6, g.wanted+1);
        g.impound = g.impound||[];
        g.impound.push({...c, seizedDay:g.day});
        traced = CARS[c.car].n + (gps?" (GPS tracker)":"");
        pushLog(g, `🚔 Police traced the ${traced} and towed it to the impound. Wanted +1 — auctioned in 10 days unless you take it back.`, "bad");
        break;
      }
    }
  }
  return { interest, costs, borrowed, traced, propLines, transitLines };
}

function nightEvent(g){
  if(g.finale?.legend) { if(Math.random()>0.15) return null; } // legends get left alone (mostly)
  else if(Math.random()>((g.won)?0.32:0.22)) return null;
  const mult = cityMult(g);
  const roll = rnd(1,5);
  if(roll===1){ // syndicate tribute — and Prince squeezes harder once you're rich and free
    const squeeze = (g.won && !g.finale?.legend) ? 2.5 : 1;
    const amt = Math.round(Math.min(funds(g)*0.3, 8000*mult*squeeze));
    if(amt>200 && funds(g)>=amt){ spend(g, amt); pushLog(g, `🤵 Prince the Mafia Boss sends men for tribute: −${fmt$(amt)}.`, "bad"); return {ic:"🤵", m:`Prince's men collected ${fmt$(amt)} in tribute.`}; }
    g.debt += Math.round(2000*mult);
    pushLog(g, `🤵 Prince's men found empty pockets. The debt grows ${fmt$(2000*mult)}.`, "bad");
    return {ic:"🤵", m:`No cash for tribute — Prince added ${fmt$(2000*mult)} to your debt.`};
  }
  if(roll===2){ g.crackdown=true; pushLog(g, "🚨 Word is the PD starts a crackdown tomorrow. Lay low or move fast.", "bad"); return {ic:"🚨", m:"Police crackdown tomorrow — patrols everywhere (+50% police pressure)."}; }
  if(roll===3){
    const q = offerQuest(g);
    if(q) return {ic:q.ic, m:`${q.giver} called: "${q.what}"`};
    g.tipped=true; return {ic:"📞", m:"A fence owes you a favor — expect a fat special order tomorrow."};
  }
  if(roll===4 && g.crew.length){
    const poachable = g.crew.filter(m=>m.trait!=="loyal");
    if(poachable.length){
      const m = poachable[rnd(0,poachable.length-1)];
      g.crew.splice(g.crew.indexOf(m),1);
      pushLog(g, `🚪 ${m.name} got poached by a rival crew.`, "bad");
      return {ic:"🚪", m:`${m.name} left for a rival crew overnight.`};
    }
    return {ic:"🤝", m:"A rival crew came sniffing around your people. Nobody bit — loyalty pays."};
  }
  const find = Math.round(rnd(200,800)*mult);
  addDirty(g, find);
  pushLog(g, `🍀 One of your crew flipped a stolen watch: +${fmt$(find)}.`, "good");
  return {ic:"🍀", m:`Street luck: +${fmt$(find)}.`};
}

function runSideJobs(g){
  const out = [];
  for(const m of g.crew){
    if(!m.sideJob || m.out) continue;
    const best = Math.max(...Object.values(m.sk));
    const roll = rnd(1,100);
    if(roll<=8){ m.hp = Math.max(10, m.hp-rnd(20,35)); m.out = m.hp<50;
      out.push({c:"bad", m:`${m.face} ${m.name} came back from a side job bleeding.`});
    } else if(roll<=13){ m.heldDays = 2; m.out = true;
      out.push({c:"bad", m:`${m.face} ${m.name} got picked up on a side job — held for 2 days.`});
      if(m.trait==="snitch" && !m.revealed && rnd(1,100)<=50){
        m.revealed = true;
        g.wanted = Math.min(6, g.wanted+2); g.disg = Math.max(10, g.disg-10);
        out.push({c:"bad", m:`🐀 …and ${m.name} sang in the interview room. Wanted +2.`});
      }
    } else {
      const pay = Math.round(best*rnd(70,160)*cityMult(g));
      addDirty(g, pay); g.stats.earned += pay;
      crewGainXP(g, m, 10);
      out.push({c:"good", m:`${m.face} ${m.name} brought home ${fmt$(pay)} from a side job.`});
    }
  }
  for(const l of out) pushLog(g, l.m, l.c);
  return out;
}
export function endDay(g){
  if(g.over) return null;
  g.crackdown = false; // yesterday's crackdown expires
  const sideJobs = runSideJobs(g);
  const tick = nightTick(g, false);
  const propLines = [...(tick.propLines||[]), ...(tick.transitLines||[])];
  const gangHit = gangHitsProperty(g);
  const event = nightEvent(g);
  const crimes = g.missions.filter(m=>m.done).length;
  let laidLow = false;
  if(crimes===0 && g.wanted>0){ g.wanted=Math.max(0,g.wanted-3); laidLow=true; pushLog(g,"🌫️ You laid low. The heat fades."); }
  else if(g.wanted>0){ g.wanted--; }
  const healed = Math.min(5, 100-g.hp);
  g.hp += healed;
  g.fenceUsed = 0; // Manny restocks his cash box overnight
  g.disg = Math.min(100, g.disg+2); // memories fade a little
  g.day++; g.en = maxEnergy(g);
  const wired = processPending(g);
  if(g.arrests>0 && g.day-(g.lastArrestDay||0)>=20){
    g.arrests--; g.lastArrestDay = g.day;
    pushLog(g, "📂 Your case file gathers dust. One strike forgiven.", "good");
  }
  // impound auctions: 10 days and your car belongs to the state
  for(const c of [...(g.impound||[])]){
    if(g.day - c.seizedDay >= 10){
      g.impound.splice(g.impound.indexOf(c),1);
      pushLog(g, `🔨 The ${CARS[c.car].n} went under the auction hammer. Gone for good.`, "bad");
    }
  }
  genMissions(g);
  rollDealer(g);
  rollStreet(g);
  if(g.day % 3 === 1 || !g.market) rollMarket(g); // shelves turn over every few days
  g.wantedBy[g.city] = g.wanted;
  processQuests(g);
  // word arrives reliably: if you've got no open jobs, someone calls within 5 days
  if(!(g.quests||[]).length && g.day - (g.lastQuestDay||0) >= ((g.fame||0)>=25?4:5)) offerQuest(g);
  let retired = false;
  if(g.won && !g.retired && g.cash>=1000000 && g.hideout===HIDEOUTS.length-1){
    g.retired = true; retired = true;
    pushLog(g, "🌅 A million in cash, the marina at your back, nobody owed a cent. It's over. You made it.", "good");
  }
  pushLog(g, `☀️ Day ${g.day}. Fresh marks on the map.`);
  let paper = null;
  if(g.day % 7 === 0){
    const band = fameBand(g);
    paper = {
      name: PAPER_NAME,
      headline: pick(HEADLINES[band]),
      lines: [
        `Crime desk: an estimated ${fmt$(g.week.earned)} moved through the underworld this week.`,
        g.week.cars>0 ? `${g.week.cars} vehicle${g.week.cars>1?"s":""} reported stolen.` : "A quiet week for vehicle theft.",
        g.week.big>0 ? `Largest single transaction rumored at ${fmt$(g.week.big)}.` : null,
        g.week.races>0 ? `Street racing complaints filed: ${g.week.races}.` : null,
        `Police familiarity with your face: ${g.fame}/100 (${band}).`,
      ].filter(Boolean),
    };
    g.week = {earned:0, cars:0, races:0, big:0};
    addFame(g, -3); // old news
  }
  return { ...tick, crimes, laidLow, healed, event, wired, sideJobs, retired, propLines, gangHit, paper, gameover:checkOver(g) };
}
/* ── THE LAST JOB ──────────────────────────────────────────────────── */
export function caseVenue(g){
  if(g.finale.cased || funds(g)<50000) return false;
  spend(g, 50000);
  g.finale.cased = true;
  pushLog(g, "📐 A week of bribes and binoculars: you know the Concours floor plan better than its architect.", "good");
  return true;
}
export function finaleChecks(g){
  return [
    {label:"Debt paid — Prince's offer stands", ok:!!g.won},
    {label:"Be in Los Angeles", ok:g.city===3},
    {label:"Case the venue ($50,000)", ok:!!g.finale.cased},
    {label:"At least 2 healthy crew", ok:g.crew.filter(c=>!c.out).length>=2},
    {label:"Signal Jammer on you", ok:carried(g,"jammer")},
    {label:"A ride tuned to 60+", ok:!!rideCar(g) && rideCar(g).tune>=60},
    {label:"Full energy (start fresh)", ok:g.en>=maxEnergy(g)},
    {label:g.finale.cooldown>g.day?`Prince is furious — wait until day ${g.finale.cooldown}`:"Prince is willing", ok:g.finale.cooldown<=g.day},
  ];
}
export function finaleReady(g){ return finaleChecks(g).every(c=>c.ok); }

// fight options come from what you're actually holding
export function combatApproaches(g){
  if(g.mutators?.pacifist){
    return [
      {label:"Bare knuckles", ic:"👊", sk:"shooting", sk2:"shooting", diff:8, noise:3, dmg:[3,7]},
      {label:"Stare them down", ic:"🎭", sk:"acting", sk2:"acting", diff:12, noise:2, scare:true},
    ];
  }
  const gun = eqItem(g,"gun"), melee = eqItem(g,"melee");
  const list = [];
  if(gun) list.push({label:`Open fire — ${gun.n}`, ic:gun.ic, sk:"shooting", sk2:"shooting", diff:11, noise:9+(gun.loud||0), dmg:gun.dmg});
  if(melee) list.push({label:`Go to work — ${melee.n}`, ic:melee.ic, sk:"shooting", sk2:"acting", diff:9, noise:4, dmg:melee.dmg});
  list.push({label:"Bare knuckles", ic:"👊", sk:"shooting", sk2:"shooting", diff:9, noise:3, dmg:[2,5]});
  list.push({label:"Stare them down", ic:"🎭", sk:"acting", sk2:"acting", diff:13, noise:2, scare:true});
  return list;
}

// the gangs you stepped on come collecting — fired from End Day
export function maybeAmbush(g){
  const heat = gangHeat(g);
  if(!heat || g.enc || g.over) return false;
  if(rnd(1,100) > heat*7) return false;
  const n = Math.min(4, 1+Math.floor(heat/4));
  const name = n===1 ? `${pick(THUG.names)} from the ${CITIES[g.city].districts[0]} crew` : `${n} ${CITIES[g.city].districts[0]} crew soldiers`;
  const hp = THUG.hp[0]+rnd(0,THUG.hp[1]-THUG.hp[0]) + (n-1)*14 + g.lvl*2;
  g.enc = {
    mi:-1, tid:"ambush", car:undefined, bonus:undefined, dist:CITIES[g.city].districts[0],
    stepIdx:0, turn:0, carInv:null, pr:rnd(5,20),
    loot:[], bagCash:0, carDmg:false,
    foes:null, log:[
      {c:"bad", m:`[AMBUSH] Headlights swing in behind you. ${name} step${n===1?"s":""} out — you've been making enemies.`},
    ],
    over:false, outcome:null, paid:true, lookout:null, saveUsed:false,
    rival:null, pink:false, stake:0, legsYou:0, legsRival:0,
    ambush:true, enemySet:true,
    steps:[
      {name:"The ambush", desc:"No talking your way home tonight. Your crew steps up beside you.",
        combat:{n:name, face:"🩸", hp, max:hp, atk:[THUG.atk[0], THUG.atk[1]], count:n},
        approaches:combatApproaches(g)},
      {name:"Their pockets", desc:"They started it. Their wallets finish it.", getaway:true,
        cash:[300*n, 900*n], approaches:[{label:"Clean them out", ic:"👊", sk:"shooting", sk2:"acting", diff:7, noise:3}]},
    ],
  };
  pushLog(g, "🩸 The local crew jumped you on the way home.", "bad");
  return true;
}
export function checkOver(g){
  if(g.over) return g.overReason;
  if(g.hp<=0){ g.over=true; g.overReason="dead"; return "dead"; }
  if(g.debt > g.debtStart*3.5){ g.over=true; g.overReason="bay"; return "bay"; }
  return null;
}
