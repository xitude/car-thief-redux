// ── Car Thief 6 — turn-based crime scene engine ─────────────────────
// A scene is a chain of steps. Each step offers approaches (skill+tool
// gated, each with noise). Police readiness climbs every turn; at 100
// the law arrives. Flee anytime, keep what's in your backpack.
import { CARS, ITEMS, HIDEOUTS, CAR_LOOT, HOUSE_LOOT, DIFFS, CAR_EQUIP, THUG } from "./data.js";
import { rnd, pick, fmt$, tpl, check, skillOf, gainXP, injure, pushLog, bumpWantedPub, carried, genCarInv, cityMult, hasTowTruck, bigPay, localCars, crewBonus, rideCar, crewGainXP, questHook, combatApproaches, crewEqItem, packSpace, bumpGang, finaleReady, ENERGY_MAX, eqItem, spend, funds, addDirty, addFame, genQuirk, noteCollection, blockPct } from "./engine.js";

const addPr = (g, n) => { g.enc.pr += n * DIFFS[g.diff].copMult * (g.crackdown?1.3:1) * (g.enc.finale?1.25:1); };
const A = (label, ic, sk, diff, noise, extra={}) => ({label, ic, sk, sk2:extra.sk2||sk, diff, noise, ...extra});

/* ── individual combatants ────────────────────────────────────── */
const mkFoe = (n, face, hp, atk) => ({id:"f"+rnd(10000,99999)+"_"+rnd(100,999), n, face, hp, max:hp, atk});
const mkSquad = (spec) => {
  const c = spec.count||1;
  if(c===1) return [mkFoe(spec.n, spec.face, spec.hp, spec.atk)];
  const each = Math.max(6, Math.round(spec.hp/c));
  const pool = (spec.names||THUG.names).slice();
  return Array.from({length:c}, ()=>{
    const nm = pool.length ? pool.splice(rnd(0,pool.length-1),1)[0] : "Heavy";
    return mkFoe(nm, spec.face, each+rnd(-2,2), spec.atk);
  });
};
const alive = fs => (fs||[]).filter(f=>f.hp>0);
const pickFoe = (e, list) => {
  const L = alive(list);
  if(!L.length) return null;
  return L.find(f=>f.id===e.target) || L[rnd(0,L.length-1)];
};
export const setTarget = (g, id) => { if(g.enc && !g.enc.over) g.enc.target = g.enc.target===id ? null : id; };

/* ── scene scripts ─────────────────────────────────────────────── */
const trackerStep = cd => ({name:"The tracker", optional:true,
  desc:"A GPS tracker blinks under the dash. Leave it, and the cops can follow this car straight to your garage.",
  approaches:[
    A("Rip it out for good","🔩","electronics",9+cd,4,{removeGps:true}),
    A("Jam its signal","📡","none",0,1,{auto:true, jamGps:true, tool:"jammer"}),
  ]});
const payX = (g, lo, hi) => [Math.round(lo*cityMult(g)), Math.round(hi*cityMult(g))];
const VICTIMS = [
  {n:"house keeper", face:"🧹", mam:"ma'am"},
  {n:"pizza driver", face:"🍕", mam:"buddy"},
  {n:"real-estate agent", face:"💼", mam:"sir"},
  {n:"gym instructor", face:"💪", mam:"champ"},
  {n:"retired teacher", face:"👓", mam:"ma'am"},
  {n:"wedding DJ", face:"🎧", mam:"man"},
  {n:"night-shift nurse", face:"🩺", mam:"hon"},
];
const MARKS = ["a sunburned conventioneer","a golfer counting fifties","an influencer mid-selfie","a cruise tourist with a money belt","a salesman on his third mojito","a lost bachelor party"];
function carStealSteps(g, m, jack, carInv){
  const cd = Math.ceil(CARS[m.car].d/2);
  const car = CARS[m.car];
  const steps = [];
  if(jack){
    const vic = pick(VICTIMS);
    steps.push({name:"Stop the car", desc:`${vic.face} A ${vic.n} is getting into the ${car.n}. Approaching the vehicle…`, approaches:[
      A("Box it in with your ride","🏎️","driving",9+cd,6,{
        ok:[`You swing across the lane — the ${car.n} has nowhere to go.`,`A casual drift, a blocked lane. The ${vic.n} hits the brakes, confused.`],
        no:[`The ${vic.n} guns it around your bumper, horn blaring.`,`Mistimed — the ${car.n} squeals past you.`]}),
      A("Step out in front","🎭","acting",11+cd,4,{dmgFail:[3,8],
        ok:[`You wave like a lost tourist. The ${vic.n} slows right into your trap.`],
        no:[`The ${vic.n} doesn't slow down. At all.`]}),
    ]});
    const gun = eqItem(g,"gun"), melee = eqItem(g,"melee");
    steps.push({name:"The driver", desc:`${vic.face} The ${vic.n} grips the wheel, deciding whether to be a hero.`, approaches:[
      ...(gun ? [A(`${gun.n} in the window`, gun.ic, "shooting", 10+cd, 9+(gun.loud||0), {dmgFail:[4,10],
        say:`"Give me your keys and get out of the car!"`,
        ok:[`The ${vic.n} says: "I'm not arguing. See?" — and steps out, hands first.`,`The ${vic.n} goes pale, leaves it running, walks away backwards.`],
        no:[`The ${vic.n} screams and leans on the horn!`,`The ${vic.n} swings a thermos at your head!`]})] : []),
      ...(!gun && melee ? [A(`${melee.n} against the glass`, melee.ic, "shooting", 11+cd, 6, {sk2:"acting", dmgFail:[4,10],
        say:`"Keys. Out. Don't make this a thing."`,
        ok:[`The ${vic.n} stares at the ${melee.n} and decides the car isn't worth it.`],
        no:[`The ${vic.n} laughs — they've seen worse — and lays on the horn!`]})] : []),
      ...(!gun && !melee ? [A("Bluff a piece in your jacket","🧥","acting",13+cd,4,{dmgFail:[4,10],
        say:`"Hands where I can see them. Don't test the jacket."`,
        ok:[`The ${vic.n} buys it completely and slides out, palms up.`],
        no:[`The ${vic.n} calls it: "There's nothing in that jacket." Now it's a wrestling match.`]})] : []),
      A("Drag them out","🥊","shooting",12+cd,7,{sk2:"acting", dmgFail:[5,12],
        say:`"OUT. Now."`,
        ok:[`Door open, seatbelt off, ${vic.n} on the curb. Three seconds flat.`],
        no:[`The ${vic.n} clamps onto the wheel like a barnacle and starts kicking.`]}),
      A("Con the valet swap","🎭","acting",13+cd,3,{
        say:`"Could you please step out, ${vic.mam}? Valet will bring the courtesy car around."`,
        ok:[`The ${vic.n} got outside without questions.`,`The ${vic.n} even hands you a tip. You take it. Obviously.`],
        no:[`The ${vic.n} squints: "…what valet?" Time to improvise.`]}),
    ]});
  } else {
    steps.push({name:"The door", desc:`The ${car.n} sits in the dark. Locked, of course.`, approaches:[
      A("Pick the lock","🗝️","locksmith",8+cd,4,{tool:"picks"}),
      A("Slim-jim the door","📏","locksmith",9+cd,5,{tool:"slimjim"}),
      A("Pump-wedge it","🪛","locksmith",7+cd,3,{tool:"wedge"}),
      A("Grab the fob code","💻","electronics",9+cd,2,{tool:"laptop"}),
      A("Smash the window","🔨","shooting",4,carried(g,"hammer")?13:17,{dmgCar:true}),
      ...(hasTowTruck(g) && !CARS[m.car].tow
        ? [A("Hook it to the wrecker","🚚","driving",8+cd,12,{towJump:true})] : []),
    ]});
    if(CARS[m.car].d>=2) steps.push({name:"The alarm", desc:"A red LED blinks on the dash. One wrong move and it sings.", approaches:[
      A("Silence it","💻","electronics",9+cd,3),
      A("Cut the wires","🗝️","locksmith",10+cd,5),
      A("Let it scream","🙉","none",0,24,{auto:true}),
    ]});
    if(CARS[m.car].d>=8 || (CARS[m.car].d>=5 && Math.random()<0.5))
      steps.push({name:"Steering lock", desc:"A club across the wheel. Somebody loves this car.", approaches:[
        A("The Buster","🪚","locksmith",5,4,{tool:"buster"}),
        A("Hacksaw and patience","🗝️","locksmith",12+cd,6),
        A("Bypass the column","💻","electronics",11+cd,5),
      ]});
    if(carInv && carInv.includes("gps")) steps.push(trackerStep(cd));
    steps.push({name:"Ransack it", desc:"Glovebox, console, trunk — people leave their lives in cars.", optional:true, lootTable:CAR_LOOT, lootN:[1,3], approaches:[
      A("Go through it","🌫️","hiding",8,4),
    ]});
    steps.push({name:"Ignition", desc:"No keys. Never any keys.", approaches:[
      A("Hotwire it","💻","electronics",9+cd,4),
      A("Crack the column","🗝️","locksmith",10+cd,6),
    ]});
  }
  if(jack && carInv && carInv.includes("gps")) steps.push(trackerStep(cd));
  steps.push({name:"Getaway", desc:"Engine's alive. Now make it boring — nobody chases boring.", getaway:true, approaches:[
    A("Drive off smooth","🏎️","driving",7+cd,2),
    A("Floor it","🏎️","driving",5+cd,10),
  ]});
  return steps;
}

function burglarySteps(g, m, mansion){
  const t = tpl(m);
  if(!mansion) return [
    {name:"Case the house", desc:"Dark windows, no dog bowl, mail piling up. Promising.", approaches:[
      A("Watch and wait","🌫️","hiding",8,2),
    ]},
    {name:"Entry", desc:"Back door, side window — pick your poison.", approaches:[
      A("Pick the back door","🗝️","locksmith",11,3,{tool:"picks"}),
      A("Jimmy the window","🗝️","locksmith",10,6),
      A("Smash a pane","🔨","shooting",4,15),
    ]},
    {name:"Ransack the rooms", desc:"Bedroom first. It's always the bedroom.", lootTable:HOUSE_LOOT, lootN:[1,2], approaches:[
      A("Sweep the house","🌫️","hiding",9,4),
    ]},
    {name:"The safe", desc:"A floor safe behind the shoe rack. Tempting.", optional:true, cash:payX(g, t.pay[0]*0.8, t.pay[1]*0.9), approaches:[
      A("Crack it","🗝️","locksmith",14,5),
      A("Drill it","💻","electronics",13,9),
    ]},
    {name:"Slip away", desc:"Out the way you came. Calm. Invisible.", getaway:true, approaches:[
      A("Melt into the dark","🌫️","hiding",8,2),
    ]},
  ];
  return [
    {name:"The cameras", desc:"Gated estate. Cameras sweep the drive on a lazy loop.", approaches:[
      A("Loop the feed","💻","electronics",12,3,{tool:"laptop"}),
      A("Find the blind spot","🌫️","hiding",13,3),
    ]},
    {name:"The guards", desc:"Private security. Bored, armed, paid by the hour.", approaches:[
      A("Ghost past them","🌫️","hiding",13,4,{dmgFail:[5,12]}),
      A("Clipboard and confidence","🎭","acting",12,3),
    ]},
    {name:"The vault", desc:"Behind the bookcase, because rich people watch movies too.", cash:payX(g, t.pay[0], t.pay[1]), approaches:[
      A("Defeat the keypad","💻","electronics",14,4),
      A("Drill the hinges","🗝️","locksmith",15,8),
    ]},
    {name:"Ransack", desc:"Watches, art, the good whiskey.", optional:true, lootTable:HOUSE_LOOT, lootN:[2,3], approaches:[
      A("Fill the bag","🌫️","hiding",12,4),
    ]},
    {name:"Slip away", desc:"The long lawn never felt longer.", getaway:true, approaches:[
      A("Out through the hedges","🌫️","hiding",11,3),
      A("Stroll out the front","🎭","acting",13,2),
    ]},
  ];
}

function gangSteps(g, m){
  const t = tpl(m);
  return [
    {name:"Walk in", desc:"Their corner now, they say. Bad math.", approaches:[
      A("Roll up casual","🎭","acting",8,2),
    ]},
    {name:"The enforcer", desc:"Their biggest guy steps up, cracking his knuckles.", combat:{n:"Rival enforcer", face:"🦍", hp:22+g.lvl*2, max:22+g.lvl*2, atk:[4,12]}, approaches:combatApproaches(g)},
    {name:"Shake down the corner", desc:"Word travels fast. Wallets open faster.", cash:payX(g, t.pay[0], t.pay[1]), getaway:true, approaches:[
      A("Collect what's owed","👊","shooting",8,4,{sk2:"acting"}),
    ]},
  ];
}

function pickpocketSteps(g, m){
  const t = tpl(m);
  return [
    {name:"Pick a mark", desc:"Boardwalk crowd. Sunburn, sandals, money belts.", approaches:[
      A("Spot the fat wallet","🎭","acting",7,1),
    ]},
    {name:"The lift", desc:"Two fingers. One breath. Work the crowd as long as your nerve holds.", repeat:true, optional:true, cash:payX(g, t.pay[0], t.pay[1]*0.7), approaches:[
      A("Bump and lift","🌫️","hiding",9,2),
      A("Distraction routine","🎭","acting",10,3),
    ]},
    {name:"Slip away", desc:"Just another tourist heading for the bus.", getaway:true, approaches:[
      A("Into the crowd","🌫️","hiding",6,1),
    ]},
  ];
}

function carpartsSteps(g, m){
  const t = tpl(m);
  return [
    {name:"Pop the hood", desc:"An old sedan in a dark lot, nobody around.", approaches:[
      A("Force the latch","🗝️","locksmith",8,4),
    ]},
    {name:"Strip the bay", desc:"Battery, ECU, catalytic — the metal that pays.", cash:payX(g, t.pay[0], t.pay[1]), approaches:[
      A("Work fast","💻","electronics",9,5,{sk2:"locksmith"}),
    ]},
    {name:"Pull the rims", desc:"Jack it, spin the lugs, gone.", optional:true, cash:payX(g, t.pay[0]*0.8, t.pay[1]*0.6), approaches:[
      A("All four","🗝️","locksmith",10,8),
    ]},
    {name:"Roll out", desc:"Bag full of metal, head down.", getaway:true, approaches:[
      A("Walk, don't run","🌫️","hiding",7,2),
    ]},
  ];
}

function raceSteps(g, m){
  const rv = m.rival || {name:"Some kid", face:"🤡", car:2};
  const tier = Math.ceil(CARS[rv.car].d/3);
  const legDesc = [
    `Rolling start on the industrial straight. ${rv.face} ${rv.name}'s ${CARS[rv.car].n} sounds angry.`,
    "Second leg — the docks chicane. Late brakers win it. Or hit a container.",
    "Final leg, full send through the underpass. Winner takes it all.",
  ];
  return [0,1,2].map(i=>({
    name:`Leg ${i+1} of 3`, desc:legDesc[i], race:true,
    approaches:[
      A("Clean lines","🏎️","driving",8+tier,2),
      A("Send it","🔥","driving",11+tier,5,{dmgFail:[3,9], sendIt:true}),
      A("Nitro burst","⚡","driving",6+tier,4,{tool:"nitro"}),
    ],
  }));
}
function impoundSteps(g, m){
  const mine = (g.impound||[]).filter(c=>(c.city??0)===g.city).sort((a,b)=>CARS[b.car].v-CARS[a.car].v)[0];
  const carName = mine ? CARS[mine.car].n : "your car";
  return [
    {name:"The fence line", desc:`Chain-link, barbed wire, one sodium lamp. Somewhere in there sits your ${carName} with an evidence tag on the mirror.`, approaches:[
      A("Cut through the back fence","🗝️","locksmith",12,4),
      A("Slip in behind the tow truck","🌫️","hiding",12,3),
    ]},
    {name:"The yard patrol", desc:"One bored officer, one flashlight, eleven rows of seized cars.", approaches:[
      A("Shadow the rows","🌫️","hiding",13,4),
      A("Clipboard and hi-vis","🎭","acting",12,3),
    ]},
    {name:"The lot office", desc:"Your keys hang on board C, tagged and bagged. The camera hums.", approaches:[
      A("Loop the camera, lift the keys","💻","electronics",13,4),
      A("Pick the key cabinet","🗝️","locksmith",12,5),
    ]},
    {name:"Getaway", desc:"Engine on. The gate arm is down. It was never going to stop you.", getaway:true, approaches:[
      A("Roll out slow with the tow rotation","🏎️","driving",11,3),
      A("Through the gate arm","🏎️","driving",9,12,{dmgCar:true}),
    ]},
  ];
}
function casinoSteps(g, m){
  const t = tpl(m);
  const boss = { n:"Pit security", face:"🧊", hp:40+g.lvl*2, max:40+g.lvl*2, atk:[5,13], count:3, names:["Bruno","Off-duty cop Carl","Off-duty cop Mendez"] };
  return [
    {name:"The floor", desc:"Saturday night. Slots screaming, comp drinks flowing. You need to be furniture for twenty minutes.", approaches:[
      A("Play the whale","🎭","acting",13,2,{say:'"Double zeroes again? This table LOVES me."',
        ok:["You tip big, laugh loud, and become invisible the way only money is."],
        no:["The pit boss's eyes keep coming back to you. That's bad arithmetic."]}),
      A("Service corridor shuffle","🌫️","hiding",14,3),
    ]},
    {name:"The cage cameras", desc:"Forty-six cameras between you and the count room. One control loop runs them all.", approaches:[
      A("Loop the surveillance feed","💻","electronics",15,3,{tool:"laptop"}),
      A("Jam the relay","📡","electronics",13,4,{tool:"jammer"}),
      A("Time the blind spots","🌫️","hiding",16,4),
    ]},
    {name:"The count room door", desc:"Steel, mag-locked, and very confident about itself.", approaches:[
      A("Defeat the mag-lock","💻","electronics",16,5),
      A("Pick the service override","🗝️","locksmith",16,5),
    ]},
    {name:"Bruno", desc:"The door swings open onto three men who count money for the kind of people you don't borrow from.", combat:boss, approaches:combatApproaches(g)},
    {name:"The count", desc:"Bricks of it, banded and stacked. Saturday in Vegas, on a table.", cash:payX(g, t.pay[0], t.pay[1]), approaches:[
      A("Fill the bags","👜","hiding",12,4),
    ]},
    {name:"The chip vault", desc:"High-denomination chips — traceable, but the right fence loves them.", optional:true, cash:payX(g, 15000, 35000), approaches:[
      A("Sweep the racks","🗝️","locksmith",16,8),
    ]},
    {name:"Out through the floor", desc:"Walk. Smile. You're just another winner heading to the valet.", getaway:true, approaches:[
      A("Stroll out grinning","🎭","acting",14,3),
      A("Out through the kitchen","🌫️","hiding",13,6),
    ]},
  ];
}
export function buildSteps(g, m, carInv){
  const t = tpl(m);
  switch(t.id){
    case "stealcar": case "order": case "exotic": return carStealSteps(g, m, false, carInv);
    case "towtruck": return carStealSteps(g, m, false, carInv);
    case "carjack":  return carStealSteps(g, m, true, carInv);
    case "burglary": return burglarySteps(g, m, false);
    case "mansion":  return burglarySteps(g, m, true);
    case "gang":     return gangSteps(g, m);
    case "pickpocket": return pickpocketSteps(g, m);
    case "carparts": return carpartsSteps(g, m);
    case "race": return raceSteps(g, m);
    case "impound": return impoundSteps(g, m);
    case "casino": return casinoSteps(g, m);
    default: return null;
  }
}

/* ── scene lifecycle ───────────────────────────────────────────── */
export function startScene(g, i){
  const m = g.missions[i], t = tpl(m);
  if(g.over || m.done || g.en < t.en) return null;
  if(m.pink && !rideCar(g)) return null; // pink-slip race: you need a ride to wager
  if(tpl(m).race && m.stake && funds(g) < m.stake) return null;
  const rz = m.resume; // returning to a scene you walked away from earlier tonight
  const carInv = rz ? rz.carInv : (m.car!==undefined) ? genCarInv(CARS[m.car].d) : null;
  const steps = rz ? rz.steps : buildSteps(g, m, carInv);
  if(!steps) return null;
  g.en -= 1; // casing the place is cheap — committing to the job is not
  m.done = true;
  if(!rz) g.stats.jobs++;
  g.enc = {
    mi:i, tid:t.id, car:m.car, bonus:m.bonus, dist:m.dist,
    stepIdx: rz ? rz.stepIdx : 0, steps, turn:0,
    carInv, streetCond: m.streetCond,
    pr: rz ? Math.min(85, rz.pr + rnd(0,6))
           : Math.min(60, g.wanted*6 + rnd(0,8) + Math.round((100-g.disg)/6)),
    loot:[], bagCash:0, carDmg: rz ? rz.carDmg : false,
    foes: rz ? (rz.foes||null) : null,
    log: rz ? [{c:"dim", m:`[You slip back to the ${t.n} — everything is as you left it]`}]
            : [{c:"dim", m:`[You arrive: ${t.n} — ${m.dist}]`}],
    over:false, outcome:null, paid:false,
    lookout:null, saveUsed:false,
    rival:m.rival||null, pink:!!m.pink, stake:m.stake||0, legsYou:0, legsRival:0,
  };
  // crew roles: your best spare set of eyes watches the street
  const watcher = g.crew.filter(c=>!c.out && c.role==="lookout")[0]
    || g.crew.filter(c=>!c.out && (c.role==="backup"||!c.role)).sort((a,b)=>b.sk.hiding-a.sk.hiding)[0];
  if(watcher && watcher.sk.hiding>=3){
    let lb = (watcher.sk.hiding>=5?2:1) + (watcher.trait==="ghost"?1:0) - (watcher.trait==="hothead"?1:0);
    g.enc.lookout = { name:watcher.name, face:watcher.face, b:Math.max(0,lb) };
    g.enc.log.push({c:"dim", m:`${watcher.face} ${watcher.name} hangs back to watch the street.`});
  }
  if(rz) delete m.resume;
  const s0 = steps[g.enc.stepIdx];
  g.enc.log.push({c:"", m:s0.desc});
  return g.enc;
}

const lootRoll = (g, table, nRange) => {
  const n = rnd(nRange[0], nRange[1]);
  const out = [];
  for(let i=0;i<n;i++){ const L = pick(table); out.push({n:L.n, ic:L.ic, v:Math.round(rnd(L.v[0], L.v[1])*cityMult(g))}); }
  return out;
};

export function sceneOdds(g, a){
  const bonus = skillOf(g, a.sk) + Math.ceil(skillOf(g, a.sk2||a.sk)/2);
  const need = a.diff - bonus;
  return Math.max(.05, Math.min(.95, (21 - Math.max(2, Math.min(20, need)))/20));
}

function advance(g, ev){
  const e = g.enc;
  if(e.stepIdx===0 && e.carInv && e.carInv.length && (e.tid==="stealcar"||e.tid==="order"||e.tid==="exotic"||e.tid==="towtruck")){
    const names = e.carInv.map(id=>{const q=CAR_EQUIP.find(x=>x.id===id);return q?`${q.ic} ${q.n}`:id;});
    e.log.push({c:"loot", m:`You're in. Installed in the car: ${names.join(", ")}${e.carInv.includes("gps")?" — that tracker is trouble.":""}`});
  }
  e.stepIdx++;
  if(e.stepIdx >= e.steps.length){ completeScene(g, ev); return; }
  const s = e.steps[e.stepIdx];
  e.log.push({c:"dim", m:`— ${s.name} —`});
  e.log.push({c:"", m:s.desc});
  if(s.combat) e.foes = mkSquad(s.combat);
}

function commitEnergy(g){
  const e = g.enc;
  if(e.paid) return true;
  const rest = tpl({t:e.tid}).en - 1;
  if(g.en < rest) return false;
  if(e.stake){ if(!spend(g, e.stake)) return false; e.log.push({c:"warn", m:`💵 Stake down: ${fmt$(e.stake)}. Win or walk home.`}); }
  if(e.pink){ const r = rideCar(g); e.log.push({c:"warn", m:`🔑 Pink slips on the table — your ${CARS[r.car].n} against their ${CARS[e.rival.car].n}.`}); }
  g.en -= rest;
  e.paid = true;
  return true;
}
export function sceneAction(g, ai){
  const e = g.enc;
  if(!e || e.over) return null;
  if(e.enemySet){ delete e.enemySet; const s0=e.steps[e.stepIdx]; if(s0.combat && !(e.foes&&e.foes.length)) e.foes = mkSquad(s0.combat); }
  const underFire = !!e.standoff;
  const s = e.steps[e.stepIdx];
  const a = s.approaches[ai];
  if(!a) return null;
  if(a.tool && !carried(g,a.tool)) return {blocked:`You need a ${ITEMS.find(x=>x.id===a.tool).n} for this.`};
  if(!commitEnergy(g)) return {blocked:"Too tired to commit to this job — end the day."};
  if(s.repeat && (e.markN||1)>1){ // every extra mark costs fresh legs
    if(g.en<1) return {blocked:"Too tired for another mark — slip away while you still can."};
    g.en -= 1;
  }
  e.turn++;
  addPr(g, Math.max(0, rnd(1,3) - (e.lookout?.b||0))); // time pressure, eased by your lookout
  const ev = {lines:[], r:null};

  if(a.auto){
    addPr(g, a.noise);
    if(a.jamGps){
      e.gpsJammed = true;
      e.log.push({c:"good", m:`📡 The jammer drowns the tracker's signal. Safe — as long as you keep carrying it. Rip it out at the garage to be done with it.`});
    } else {
      e.log.push({c:"warn", m:`${a.ic} ${a.label}. The whole block hears it. (+${a.noise} police readiness)`});
    }
    advance(g, ev);
    return finishTurn(g, ev);
  }

  // wheelman makes driving moments easier
  let wb = 0;
  if(a.sk==="driving" && (s.getaway || s.race)){
    const wm = g.crew.find(c=>!c.out && c.role==="wheelman");
    if(wm){ wb = Math.ceil(wm.sk.driving/2); if(e.turn===1||!e.wmAnnounced){ e.wmAnnounced=true; e.log.push({c:"dim", m:`${wm.face} ${wm.name} rides shotgun, calling the lines.`}); } }
  }
  const r = check(g, a.sk, a.sk2||a.sk, a.diff - wb);
  ev.r = r;
  if(r.learn) e.log.push({c:"loot", m:`(Gained 1 of ${r.learn[0].toUpperCase()+r.learn.slice(1)})`});

  if(s.race){
    addPr(g, a.noise);
    if(r.ok){
      e.legsYou++;
      e.log.push({c:"good", m:`🏁 You take ${s.name.toLowerCase()}${r.crit?" by a street length":""}! (${e.legsYou}–${e.legsRival})`});
    } else {
      e.legsRival++;
      e.log.push({c:"bad", m:`${e.rival.face} ${e.rival.name} edges you on ${s.name.toLowerCase()}. (${e.legsYou}–${e.legsRival})`});
      if(a.dmgFail && r.fumble){ const d=injure(g, rnd(a.dmgFail[0], a.dmgFail[1])); e.log.push({c:"bad", m:`You kiss the wall — −${d}% health.`}); }
    }
    gainXP(g, 4);
    if(e.legsYou===2 || e.legsRival===2 || e.stepIdx===e.steps.length-1){
      finishRace(g, ev);
      return finishTurn(g, ev);
    }
    e.stepIdx++;
    e.log.push({c:"dim", m:`— ${e.steps[e.stepIdx].name} —`});
    e.log.push({c:"", m:e.steps[e.stepIdx].desc});
    return finishTurn(g, ev);
  }

  if(s.combat && alive(e.foes).length){
    if(r.ok){
      if(a.scare){
        const L = alive(e.foes);
        const tot = L.reduce((t,f)=>t+f.hp,0), totMax = e.foes.reduce((t,f)=>t+f.max,0);
        if(tot <= totMax*0.6){
          e.log.push({c:"good", m:`🎭 You don't blink. ${L.length>1?"They look at their boys on the ground and scatter.":`${L[0].n} decides this isn't worth dying for and bolts.`}`});
          for(const f of L){ f.hp = 0; f.fled = true; }
          addPr(g, a.noise);
          advance(g, ev);
        } else {
          e.log.push({c:"warn", m:`🎭 They hesitate… but they're not scared yet. Hurt them first.`});
          addPr(g, a.noise);
        }
      } else {
        const tgt = pickFoe(e, e.foes);
        const dmg = rnd(a.dmg[0], a.dmg[1]) + (r.crit?6:0);
        tgt.hp = Math.max(0, tgt.hp - dmg);
        addPr(g, a.noise);
        e.log.push({c:"good", m:`${a.ic} You hit ${tgt.n} for ${dmg}.${r.crit?" Critical!":""} (${tgt.hp}/${tgt.max})`});
        if(tgt.hp<=0){
          e.log.push({c:"good", m:`${tgt.face} ${tgt.n} goes down.`});
          if(!alive(e.foes).length){ e.log.push({c:"good", m:"The corner is quiet."}); advance(g, ev); }
        }
      }
    } else {
      const L = alive(e.foes);
      const atk = L[rnd(0, L.length-1)];
      const pack = Math.min(6, (L.length-1)*2);
      const hit = injure(g, rnd(atk.atk[0], atk.atk[1]) + pack + (r.fumble?4:0));
      addPr(g, a.noise + 3);
      e.log.push({c:"bad", m:`${atk.face} ${atk.n} catches you${L.length>1?" while the others box you in":""} — −${hit}% health.${r.fumble?" Fumble!":""} (You: ${g.hp}%)`});
    }
    // your best fighter wades in after you
    if(alive(e.foes).length && !a.scare){
      const f = g.crew.filter(c=>!c.out && c.role==="muscle")[0]
        || g.crew.filter(c=>!c.out && (c.role==="backup"||!c.role)).sort((x,y)=>y.sk.shooting-x.sk.shooting)[0];
      if(f && f.sk.shooting>=2){
        if(rnd(1,20)+f.sk.shooting >= a.diff){
          const w = crewEqItem(f,"gun") || crewEqItem(f,"melee");
          const cd2 = (w ? rnd(w.dmg[0], w.dmg[1]) : rnd(2, 3+f.sk.shooting)) + (f.trait==="hothead"?3:0);
          const L2 = alive(e.foes);
          const t2 = L2[rnd(0, L2.length-1)];
          t2.hp = Math.max(0, t2.hp - cd2);
          e.log.push({c:"good", m:`${f.face} ${f.name} ${crewEqItem(f,"gun")?"opens up with the "+crewEqItem(f,"gun").n:crewEqItem(f,"melee")?"swings the "+crewEqItem(f,"melee").n:"piles in"} — ${cd2} into ${t2.n}. (${t2.hp}/${t2.max})`});
          crewGainXP(g, f, 5);
          if(t2.hp<=0){
            e.log.push({c:"good", m:`${t2.face} ${t2.n} goes down.`});
            if(!alive(e.foes).length){ e.log.push({c:"good", m:"The corner is quiet."}); advance(g, ev); }
          }
        } else if(rnd(1,20)<=3){
          const cv = crewEqItem(f,"vest");
          let dmgC = rnd(20,40);
          if(cv) dmgC = Math.ceil(dmgC*(1-cv.block/100));
          f.hp = Math.max(10, (f.hp??100) - dmgC);
          if(f.hp<50) f.out = true;
          e.log.push({c:"bad", m:`${f.face} ${f.name} takes a bad one${f.out?" and staggers out of the fight":""}. (${f.hp}%)`});
        }
      }
    }
    return finishTurn(g, ev);
  }

  if(r.ok){
    addPr(g, a.noise);
    if(a.say) e.log.push({c:"", m:`You: ${a.say}`});
    if(a.dmgCar){ e.carDmg = true; e.log.push({c:"warn", m:`${a.ic} ${a.label} — glass everywhere. You're in, but the car loses value. (+${a.noise} readiness)`}); }
    else e.log.push({c:"good", m:`${a.ic} ${a.ok ? pick(a.ok) : `${a.label}… done.`}${r.crit?" Flawless — critical!":""} (Used ${a.sk[0].toUpperCase()+a.sk.slice(1)})${a.noise>=8?` (+${a.noise} readiness)`:""}`});
    if(r.crit) e.pr = Math.max(0, e.pr-4);
    gainXP(g, 3 + Math.ceil(a.diff/3));
    if(a.removeGps && e.carInv){
      e.carInv = e.carInv.filter(id=>id!=="gps");
      e.log.push({c:"good", m:"🔩 The tracker comes out in one piece — then goes under your heel. Nobody follows this car anywhere."});
    }
    if(a.towJump){
      e.log.push({c:"good", m:`🚚 Chains on, winch groaning — the whole car comes up on the flatbed. Locks, alarms, trackers: somebody else's problem now. You deal with it at the garage.`});
      completeScene(g, ev);
      return finishTurn(g, ev);
    }
    if(s.lootTable){
      const space = Math.max(0, packSpace(g) - e.loot.length);
      const found = lootRoll(g, s.lootTable, s.lootN).slice(0, space);
      for(const L of found){ e.loot.push(L); e.log.push({c:"loot", m:`${L.ic} You stuff the ${L.n} into your backpack (${fmt$(L.v)}).`}); }
      if(found.length===0) e.log.push({c:"warn", m:"🎒 Your backpack is full — you leave the rest behind."});
    }
    if(s.cash){
      const pay = rnd(s.cash[0], s.cash[1]) * (r.crit?1.4:1);
      e.bagCash += Math.round(pay);
      e.log.push({c:"loot", m:`💵 +${fmt$(pay)} in hand.`});
    }
    if(s.repeat){
      e.markN = (e.markN||1)+1;
      for(const ap of s.approaches){ ap.diff += 1; ap.noise += 1; } // the crowd starts noticing
      s.cash = s.cash.map(x=>Math.round(x*1.05));
      s.desc = `Mark #${e.markN} drifts past — sharper eyes everywhere. Every lift gets harder and louder.`;
      e.log.push({c:"dim", m:`Another mark wanders by — ${pick(MARKS)}… (mark #${e.markN} — harder and louder)`});
      return finishTurn(g, ev);
    }
    advance(g, ev);
  } else {
    const helper = crewBonus(g, a.sk).who;
    if(helper && !e.saveUsed && !r.fumble && rnd(1,100) <= helper.sk[a.sk]*7 + (helper.trait==="ghost"?10:0)){
      e.saveUsed = true;
      crewGainXP(g, helper, 8);
      e.log.push({c:"good", m:`${a.ic} ${a.label}… slips — but ${helper.face} ${helper.name} catches it before it goes loud. No harm done.`});
      return finishTurn(g, ev);
    }
    addPr(g, a.noise + rnd(2,6));
    if(a.say) e.log.push({c:"", m:`You: ${a.say}`});
    e.log.push({c:"bad", m:`${a.ic} ${a.no ? pick(a.no) : `${a.label}… ${r.fumble?"goes badly wrong.":"no luck."}`} (+noise)`});
    if(a.dmgFail && (r.fumble || Math.random()<0.5)){
      const d = injure(g, rnd(a.dmgFail[0], a.dmgFail[1]));
      e.log.push({c:"bad", m:`You take a hit — −${d}% health. (You: ${g.hp}%)`});
    }
    if(r.fumble) addPr(g, 8);
    if(s.repeat && rnd(1,100)<=50){
      e.log.push({c:"warn", m:"Heads turn — the crowd tightens up. That well is dry."});
      advance(g, ev);
    }
  }
  if(underFire && !e.over){
    copsTurn(g, e);
    if(g.hp<=0){ ev.dead = true; e.over = true; e.outcome = "dead"; }
  }
  return finishTurn(g, ev);
}

function finishRace(g, ev){
  const e = g.enc;
  e.over = true;
  ev.done = true;
  const won = e.legsYou > e.legsRival;
  if(won){
    e.outcome = "success";
    g.stats.racesWon++; g.stats.jobsOk++;
    g.week && g.week.races++;
    addFame(g, 2);
    questHook(g, "raceWin", {});
    bumpGang(g, 1);
    if(e.pink){
      const rc = { uid:g.nextUid++, car:e.rival.car, city:g.city, heat:0, cond:rnd(65,95), disguise:100, tune:Math.min(CARS[e.rival.car].tmax??100, rnd(20,70)), inv:[], clean:true, quirk:genQuirk() };
      g.garage.push(rc);
      noteCollection(g, e.rival.car);
      e.log.push({c:"good", m:`🏆 ${e.rival.name} throws you the keys and walks. The ${CARS[e.rival.car].n} is yours — slip and all.`});
      pushLog(g, `🏁 Won a pink-slip race — took ${e.rival.name}'s ${CARS[e.rival.car].n}`, "good");
    } else {
      const pay = e.stake*2;
      bigPay(g, pay, "race winnings");
      ev.cash = pay;
      e.log.push({c:"good", m:`🏆 You collect ${fmt$(pay)} at the line.`});
      pushLog(g, `🏁 Won a street race: +${fmt$(e.stake)}`, "good");
    }
    const wm = g.crew.find(c=>!c.out && c.role==="wheelman");
    if(wm) crewGainXP(g, wm, 12);
    ev.levelUps = gainXP(g, 22);
  } else {
    e.outcome = "raceLost";
    if(e.pink){
      const r = rideCar(g);
      if(r){
        g.garage.splice(g.garage.indexOf(r),1);
        g.ride = null;
        e.log.push({c:"bad", m:`💔 ${e.rival.name} pockets your slip. The ${CARS[r.car].n} follows them home.`});
        pushLog(g, `🏁 Lost your ride in a pink-slip race`, "bad");
      }
    } else {
      e.log.push({c:"bad", m:`The stake (${fmt$(e.stake)}) rides off in ${e.rival.name}'s pocket.`});
      pushLog(g, `🏁 Lost a race: −${fmt$(e.stake)}`, "bad");
    }
    gainXP(g, 5);
  }
  bumpWantedPub(g, 2);
}

/* ── THE LAST JOB: the Concours heist ───────────────────────────── */
export function startFinale(g){
  if(!finaleReady(g) || g.enc) return false;
  g.en = Math.max(0, g.en - 6); // the whole night, gone
  const chief = { n:"Bossard, head of security", face:"🧊", hp:55+g.lvl*2, max:55+g.lvl*2, atk:[6,15] };
  g.enc = {
    mi:-1, tid:"finale", finale:true, car:11, bonus:undefined, dist:"Concours Hall, Los Angeles",
    stepIdx:0, turn:0, carInv:[], pr:rnd(8,16),
    loot:[], bagCash:0, carDmg:false, foes:null, enemySet:true,
    over:false, outcome:null, paid:true, lookout:null, saveUsed:false,
    rival:null, pink:false, stake:0, legsYou:0, legsRival:0,
    log:[
      {c:"dim", m:"[THE LAST JOB] One night. One hall. Forty classics under glass, and the '67 Phantom in the middle like a crown."},
      {c:"", m:"Prince's voice on the phone: \"Bring me out the Phantom, keep whatever else you lift, and the Syndicate forgets your name. Don't call me again either way.\""},
    ],
    steps:[
      {name:"The service gate", desc:"A bored guard, a clipboard, a barrier arm. Your week of casing says his shift change is 90 seconds late.", approaches:[
        A("Caterer's pass and confidence","🎭","acting",14,3,{say:'"Refrigerated van, chef\'s table service — we\'re late, amigo."'}),
        A("Loop the badge reader","💻","electronics",14,4),
      ]},
      {name:"The guard rotation", desc:"Two-man patrols, eight-minute loops. Your lookout counts them off.", approaches:[
        A("Thread the gap","🌫️","hiding",15,4,{dmgFail:[5,12]}),
        A("Walk like staff","🎭","acting",14,3),
      ]},
      {name:"Bossard", desc:"The head of security is exactly where your notes said he wouldn't be. He doesn't reach for the radio. He reaches for you.",
        combat:chief, approaches:combatApproaches(g)},
      {name:"The vault floor", desc:"Beyond the velvet ropes: a steel shutter, museum-grade.", approaches:[
        A("Defeat the shutter locks","🗝️","locksmith",16,5),
        A("Spoof the floor sensors","💻","electronics",16,4),
      ]},
      {name:"The Phantom's cage", desc:"Glass case, pressure plate, its own alarm loop. Half a million dollars of 1967.", approaches:[
        A("Bridge the alarm loop","💻","electronics",16,4),
        A("Pick the case the old way","🗝️","locksmith",17,5),
      ]},
      {name:"The cash cage", desc:"Auction takings, still bundled. You came for the car — but it's RIGHT THERE.", optional:true, cash:[220000,380000], approaches:[
        A("Crack the cage","🗝️","locksmith",17,7),
      ]},
      {name:"Load-out", desc:"The Phantom rolls silent onto your transporter. Every second is a year.", approaches:[
        A("Ease it on, lash it down","🏎️","driving",13,5),
      ]},
      {name:"The convoy getaway", desc:"Out the service road, lights off, your wheelman whispering the route. The whole city is about to wake up.", getaway:true, approaches:[
        A("Ghost convoy through the hills","🏎️","driving",15,8),
        A("Split up and floor it","🏎️","driving",13,14),
      ]},
    ],
  };
  pushLog(g, "🏆 Tonight is the night. The Concours. No second chances.", "good");
  return true;
}

/* ── POLICE STANDOFF: the law arrives, the scene keeps going ──────── */
const WAVES = [
  {label:"Two patrol officers, weapons drawn", count:2, hp:11, atk:[4,9],  face:"👮", rank:"Ofc."},
  {label:"Backup — more units flood the block", count:3, hp:12, atk:[5,12], face:"👮", rank:"Ofc."},
  {label:"Tactical team deploying from a van", count:4, hp:13, atk:[7,15], face:"🛡️", rank:"SWAT"},
  {label:"The whole precinct, and a helicopter", count:5, hp:14, atk:[9,18], face:"🚁", rank:"Sgt."},
];
const COPN = ["Reyes","Hall","Okafor","Brandt","Sosa","Marsh","Kowalski","Pruitt","Diaz","Yun","Foster","Quinn","Vance","Cho","Whitaker","Munoz","Adler","Boone","Tran","Ellis"];
function spawnWave(g, w){
  const def = WAVES[Math.min(w-1, WAVES.length-1)];
  const used = new Set((g.enc?.standoff?.cops||[]).map(c=>c.n));
  const pool = COPN.filter(nm=>!used.has(def.rank+" "+nm));
  return Array.from({length:def.count}, ()=>{
    const nm = pool.length ? pool.splice(rnd(0,pool.length-1),1)[0] : "Unit "+rnd(10,99);
    const hp = def.hp + Math.ceil(g.lvl*2/def.count) + rnd(0,2);
    return {...mkFoe(def.rank+" "+nm, def.face, hp, def.atk), cop:true};
  });
}
export const nextWave = g => {
  const so = g.enc?.standoff;
  if(!so) return null;
  const def = WAVES[Math.min(so.wave, WAVES.length-1)];
  return {count:def.count, face:def.face, pct:Math.min(100, Math.round(so.sinceWave/3*100)), turns:Math.max(1, 3-so.sinceWave)};
};
function startStandoff(g){
  const e = g.enc;
  e.standoff = { wave:1, cops:spawnWave(g,1), sinceWave:0, cleared:0, label:WAVES[0].label };
  e.log.push({c:"bad", m:"🚔 [POLICE ON SCENE] " + e.standoff.label + ". Nobody's calling this off — least of all you."});
}
export function standoffActions(g){
  const e = g.enc;
  if(!e?.standoff) return [];
  const so = e.standoff;
  const acts = [];
  if(alive(so.cops).length){
    for(const a of combatApproaches(g)) if(!a.scare) acts.push({...a, kind:"fight"});
    acts.push({kind:"escape", label:"Break for it", ic:"🏃", sk:"driving",
      diff:12+so.wave*2, noise:0, blurb:"best of driving/hiding vs the cordon"});
  } else {
    acts.push({kind:"escape", label:"Slip away in the lull", ic:"🌫️", sk:"hiding", diff:0, noise:0, blurb:"the scene is clear — for a moment"});
  }
  acts.push({kind:"surrender", label:"Hands up", ic:"🙌", blurb:"take the arrest before someone dies"});
  return acts;
}
function copsTurn(g, e){
  const so = e.standoff;
  if(!so) return;
  so.sinceWave++;
  if(so.sinceWave>=3){
    so.wave++; so.sinceWave=0;
    const def = WAVES[Math.min(so.wave-1, WAVES.length-1)];
    so.label = def.label;
    so.cops.push(...spawnWave(g, so.wave));
    while(so.cops.length>12){ const i=so.cops.findIndex(c=>c.hp<=0); if(i<0) break; so.cops.splice(i,1); }
    g.wanted = Math.min(6, g.wanted+1);
    e.log.push({c:"bad", m:`🚨 More sirens. ${so.label}. (wave ${so.wave} — wanted +1)`});
    return;
  }
  if(!alive(so.cops).length) return;
  const f = g.crew.filter(c=>!c.out && c.role==="muscle")[0]
    || g.crew.filter(c=>!c.out).sort((x,y)=>y.sk.shooting-x.sk.shooting)[0];
  if(f && f.sk.shooting>=2 && rnd(1,20)+f.sk.shooting >= 11){
    const w = crewEqItem(f,"gun") || crewEqItem(f,"melee");
    const cd = (w ? rnd(w.dmg[0], w.dmg[1]) : rnd(2, 3+f.sk.shooting)) + (f.trait==="hothead"?3:0);
    const L = alive(so.cops);
    const t = L[rnd(0, L.length-1)];
    t.hp = Math.max(0, t.hp - cd);
    e.log.push({c:"good", m:`${f.face} ${f.name} ${w?"works the "+w.n:"throws hands"} — ${cd} into ${t.n}. (${t.hp}/${t.max})`});
    crewGainXP(g, f, 4);
    if(t.hp<=0){
      e.log.push({c:"good", m:`${t.face} ${t.n} drops behind a cruiser door.`});
      if(!alive(so.cops).length){ waveDown(g, e); return; }
    }
  }
  const shooters = alive(so.cops);
  if(!shooters.length) return;
  const sh = shooters[rnd(0, shooters.length-1)];
  if(rnd(1,100) <= 35 + so.wave*8){
    if(g.crew.some(c=>!c.out) && rnd(1,100)<=30){
      const victims = g.crew.filter(c=>!c.out);
      const v = victims[rnd(0,victims.length-1)];
      const cv = crewEqItem(v,"vest");
      let dmg = rnd(sh.atk[0], sh.atk[1]);
      if(cv) dmg = Math.max(1, Math.ceil(dmg*(1-cv.block/100)));
      v.hp = Math.max(5, (v.hp??100)-dmg);
      if(v.hp<50) v.out = true;
      e.log.push({c:"bad", m:`🚔 ${sh.n} opens up — ${v.face} ${v.name} takes ${dmg}${v.out?" and goes down behind cover":""}. (${v.hp}%)`});
    } else {
      const dmg = injure(g, rnd(sh.atk[0], sh.atk[1]));
      e.log.push({c:"bad", m:`🚔 Muzzle flash from ${sh.n} — you take ${dmg}. (You: ${g.hp}%)`});
    }
  } else {
    e.log.push({c:"dim", m:"🚔 Shots chew the brickwork over your head."});
  }
}
function waveDown(g, e){
  const so = e.standoff;
  so.cleared++;
  addFame(g, 3);
  g.wanted = Math.min(6, g.wanted+1);
  e.log.push({c:"good", m:`🚔 The line breaks — officers dragging each other behind cruisers. The scene is yours for a breath. (fame +3, wanted +1, next wave inbound)`});
}
function standoffFlee(g, ev){
  const e = g.enc;
  e.over = true; e.outcome = "fled";
  if(e.bagCash>0){ addDirty(g, e.bagCash); g.stats.earned += e.bagCash; }
  if(e.loot.length){ g.loot = g.loot||[]; g.loot.push(...e.loot); }
  pushLog(g, "🏃 You got out from under the guns — backpack and all.", "bad");
  ev.fled = true;
}
export function standoffAction(g, idx){
  const e = g.enc;
  if(!e?.standoff || e.over) return null;
  const so = e.standoff;
  const acts = standoffActions(g);
  const a = acts[idx];
  if(!a) return null;
  e.turn++;
  const ev = {lines:[]};
  if(a.kind==="surrender"){
    if(e.bagCash>0){ addDirty(g, e.bagCash); g.stats.earned += e.bagCash; }
    if(e.loot.length){ g.loot = g.loot||[]; g.loot.push(...e.loot); }
    e.over = true; e.outcome = "police";
    e.log.push({c:"bad", m:"🙌 You put your hands up. The cuffs are almost a relief."});
    ev.surrender = true;
    return ev;
  }
  if(a.kind==="escape"){
    if(!alive(so.cops).length){
      e.log.push({c:"good", m:"🌫️ You walk out through the gap before the next sirens crest the hill."});
      standoffFlee(g, ev);
      return ev;
    }
    const best = skillOf(g,"driving")>=skillOf(g,"hiding") ? "driving" : "hiding";
    const r = check(g, best, best, a.diff);
    ev.r = r;
    if(r.ok){
      e.log.push({c:"good", m:`🏃 You burst through the cordon — gone before they can turn the cruisers around.`});
      g.wanted = Math.min(6, g.wanted+1);
      standoffFlee(g, ev);
      return ev;
    }
    e.log.push({c:"bad", m:"🏃 Spotlight. Cut off. Back to cover."});
    copsTurn(g, e);
    if(g.hp<=0){ ev.dead = true; e.over = true; e.outcome="dead"; }
    return ev;
  }
  const r = check(g, a.sk, a.sk2||a.sk, (a.diff||11) + so.wave);
  ev.r = r;
  if(r.ok && alive(so.cops).length){
    const t = pickFoe(e, so.cops);
    const dmg = rnd(a.dmg[0], a.dmg[1]) + (r.crit?6:0);
    t.hp = Math.max(0, t.hp - dmg);
    e.log.push({c:"good", m:`${a.ic} You put ${dmg} into ${t.n}.${r.crit?" Critical!":""} (${t.hp}/${t.max})`});
    if(t.hp<=0){
      e.log.push({c:"good", m:`${t.face} ${t.n} drops behind a cruiser door.`});
      if(!alive(so.cops).length) waveDown(g, e);
    }
  } else if(!r.ok){
    e.log.push({c:"bad", m:`${a.ic} Your shot sparks off a cruiser door.`});
  }
  copsTurn(g, e);
  if(g.hp<=0){ ev.dead = true; e.over = true; e.outcome="dead"; }
  return ev;
}

export function sceneSkip(g){
  const e = g.enc;
  const s = e.steps[e.stepIdx];
  if(!s.optional) return null;
  if(!commitEnergy(g)) return {blocked:"Too tired to commit to this job — end the day."};
  e.log.push({c:"dim", m:`You leave it. (${s.name} skipped)`});
  const ev = {lines:[]};
  advance(g, ev);
  return finishTurn(g, ev, true);
}

function finishTurn(g, ev, skipped){
  const e = g.enc;
  if(g.hp<=0){
    e.over = true; e.outcome = "dead";
    ev.dead = true;
    return ev;
  }
  if(e.over){ return ev; } // completed inside advance()
  if(!e.standoff && (e.pr >= 100 || (e.pr >= 55 && rnd(1,100) <= (e.pr-50)/2.5))){
    startStandoff(g);
    ev.standoff = true;
    return ev;
  }
  return ev;
}

function completeScene(g, ev){
  const e = g.enc;
  e.over = true; e.outcome = "success";
  ev.done = true; ev.success = true;
  const t = tpl({t:e.tid}) || (e.tid==="finale" ? {ic:"🏆", n:"The Last Job", heat:3} : {ic:"🩸", n:"Gang ambush", heat:1});
  if(e.tid==="gang") bumpGang(g, 3);
  if(e.tid==="casino"){
    bumpGang(g, 5);
    addFame(g, 6);
    e.log.push({c:"warn", m:"🎰 You just robbed the people who own this town. The Strip's crews will remember — watch your back."});
  }
  if(e.ambush){
    g.gangBy[g.city] = 0;
    e.log.push({c:"good", m:"🩸 Message received. This crew won't come at you again for a while."});
  }
  let cash = e.bagCash;

  if(e.car!==undefined && (e.tid==="stealcar"||e.tid==="carjack"||e.tid==="exotic"||e.tid==="order"||e.tid==="towtruck")){
    const car = CARS[e.car];
    g.stats.carsStolen++;
    questHook(g, "steal", {});
    if(e.bonus){
      const pay = Math.round(car.v*e.bonus*(e.carDmg?0.85:1)*cityMult(g));
      cash += pay;
      e.log.push({c:"good", m:`📋 Delivered to the collector — ${fmt$(pay)}${e.carDmg?" (docked for the window)":""}.`});
      pushLog(g, `📋 Special order: ${car.n} delivered for ${fmt$(pay)}`, "good");
    } else if(localCars(g).length >= HIDEOUTS[g.hideout].cap){
      const quick = Math.round(car.v*0.4);
      cash += quick;
      e.log.push({c:"warn", m:`Garage full — you flip the ${car.n} to a street buyer for ${fmt$(quick)}.`});
      pushLog(g, `🚗 Stole a ${car.n}, flipped for ${fmt$(quick)} (garage full)`, "good");
    } else {
      g.garage.push({ uid:g.nextUid++, car:e.car, city:g.city, heat:rnd(2,4)+Math.floor(CARS[e.car].d/5),
        cond: (e.streetCond ?? (100-rnd(0,12))) - (e.carDmg?15:0),
        disguise: rnd(0,15), tune: Math.min(CARS[e.car].tmax??100, rnd(0,35)), inv: e.carInv||[], quirk: genQuirk() });
      noteCollection(g, e.car);
      g.week && g.week.cars++;
      e.log.push({c:"good", m:`🏁 The ${car.n} is in your garage${e.carDmg?" (window needs fixing)":""}${(e.carInv||[]).includes("gps")?" — strip that GPS tracker before the cops follow it home!":". Let it cool."}`});
      pushLog(g, `🚗 Stole a ${car.n} → garage`, "good");
    }
  } else {
    pushLog(g, `${t.ic} ${t.n}: +${fmt$(cash)}${e.loot.length?` and ${e.loot.length} item${e.loot.length>1?"s":""}`:""}`, "good");
  }

  if(e.tid==="impound"){
    const mine = (g.impound||[]).filter(c=>(c.city??0)===g.city).sort((a,b)=>CARS[b.car].v-CARS[a.car].v)[0];
    if(mine){
      g.impound.splice(g.impound.indexOf(mine),1);
      delete mine.seizedDay;
      mine.heat = 2; mine.disguise = 0; mine.cond = Math.max(20, (mine.cond||100) - (e.carDmg?15:5));
      g.garage.push(mine);
      e.log.push({c:"good", m:`🚗 The ${CARS[mine.car].n} comes home with an evidence tag still on the mirror. Respray it — every cop in town knows these plates now.`});
      pushLog(g, `🚔 Took your ${CARS[mine.car].n} back from the impound.`, "good");
    }
  }
  if(e.finale){
    g.garage.push({ uid:g.nextUid++, car:11, city:3, heat:6, cond:rnd(92,100), disguise:0, tune:20, inv:[] });
    noteCollection(g, 11);
    addFame(g, 30);
    g.finale.legend = true;
    e.log.push({c:"good", m:"👑 The '67 Concours Phantom is on your transporter. Prince's men take delivery photos at dawn — then delete your number."});
    e.log.push({c:"good", m:"[THE SYNDICATE FORGETS YOUR NAME]"});
    pushLog(g, "👑 THE LAST JOB IS DONE. You are a legend, and a free one.", "good");
    bumpWantedPub(g, 4);
  }
  if(cash>0){ ev.cash = bigPay(g, cash, t.n); }
  if(e.loot.length){ g.loot = g.loot||[]; g.loot.push(...e.loot); }
  g.stats.jobsOk++;
  if(e.standoff){
    addFame(g, 5);
    bumpWantedPub(g, 2);
    e.log.push({c:"good", m:"🔥 You finished the job UNDER FIRE and drove out through the smoke. They'll talk about this one. (fame +5)"});
  }
  if(e.car!==undefined && CARS[e.car].d>=8) addFame(g, 3);
  else if(e.tid==="mansion") addFame(g, 3);
  else addFame(g, 1);
  for(const m of g.crew) if(!m.out) crewGainXP(g, m, 5);
  g.disg = Math.max(10, g.disg - rnd(2,5) - ((g.fame||0)>=50?2:0));
  const w = bumpWantedPub(g, t.heat + (e.pr>=70?1:0));
  if(w>0) e.log.push({c:"warn", m:`⭐ Wanted level +${w}.`});
  const resp = 12 + e.steps.length*4;
  ev.levelUps = gainXP(g, resp);
  e.log.push({c:"good", m:`You've gained ${resp} of respect.`});
  e.log.push({c:"good", m:`[Scene complete] ${cash>0?`Take: ${fmt$(cash)}.`:""} ${e.loot.length?`Backpack: ${e.loot.length} item(s).`:""}`});
}

export function sceneFlee(g){
  const e = g.enc;
  if(!e || e.over) return null;
  if(e.standoff) return null; // under fire you escape through the standoff, not the back door
  e.over = true; e.outcome = "fled";
  const t = tpl({t:e.tid}) || (e.tid==="finale" ? {ic:"🏆", n:"The Last Job", heat:2} : {ic:"🩸", n:"ambush", heat:1});
  let cash = e.bagCash;
  if(cash>0){ addDirty(g, cash); g.stats.earned += cash; }
  if(e.loot.length){ g.loot = g.loot||[]; g.loot.push(...e.loot); }
  const w = bumpWantedPub(g, Math.round(e.pr/50));
  gainXP(g, 4);
  pushLog(g, `🏃 Fled the ${t.n}${cash||e.loot.length?` — kept ${fmt$(cash)}${e.loot.length?` + ${e.loot.length} item(s)`:""}`:""}.`, "bad");
  e.log.push({c:"warn", m:`[You abandon the scene${cash||e.loot.length?" — but the backpack comes with you":""}]`});
  if(e.finale){ g.finale.cooldown = g.day+10; pushLog(g, "🤵 Prince, quietly: \"Ten days. Then we talk about whether you still exist.\"", "bad"); }
  const chased = e.pr >= 70 && rnd(1,100) <= 35;
  if(chased){
    e.log.push({c:"bad", m:"🚔 Too slow — a cruiser picks you up two blocks out."});
  } else {
    // nobody saw you go — the scene keeps until morning
    const m = g.missions[e.mi];
    if(m){
      m.done = false;
      m.resume = { steps:e.steps, stepIdx:e.stepIdx, carInv:e.carInv, carDmg:e.carDmg,
                   pr:Math.floor(e.pr/2), foes:e.foes };
      e.log.push({c:"dim", m:"[Nobody clocked you. You could come back tonight — the scene will keep.]"});
    }
  }
  return {fled:true, w, chased};
}

// police arrived mid-scene: scene collapses, loot kept, target lost
export function scenePoliceAbort(g){
  const e = g.enc;
  if(!e) return;
  e.over = true; e.outcome = "police";
  if(e.finale){ g.finale.cooldown = g.day+10; pushLog(g, "🤵 Prince, quietly: \"Ten days. Then we talk.\"", "bad"); }
  if(e.bagCash>0){ addDirty(g, e.bagCash); g.stats.earned += e.bagCash; }
  if(e.loot.length){ g.loot = g.loot||[]; g.loot.push(...e.loot); }
  pushLog(g, `🚔 The law crashed your ${(tpl({t:e.tid})||{n:"night"}).n}.`, "bad");
}

export function closeScene(g){ g.enc = null; }
