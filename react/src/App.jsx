import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { SKILLS, SKILL_ICONS, CLASSES, DIFFS, CARS, ITEMS, HIDEOUTS, MISSIONS, CITIES, CAR_EQUIP, FENCES, itemStats, PROPERTIES, TRAITS, QUIRKS, MUTATORS, PRESTIGE_PERKS, LAUNDER_STREET_FEE } from "./data.js";
import * as E from "./engine.js";
import * as SC from "./encounters.js";
import { CarArt, Avatar, avatarPreset } from "./art.jsx";
import { SFX, isMuted, setMuted } from "./sounds.js";

const fmt$ = E.fmt$, cap = E.cap;
const SAVEKEY = "carthief6_neon_";

/* ── IndexedDB mirror so saves survive even if localStorage is purged ── */
const idb = {
  db: null,
  open(){ return new Promise(res=>{ try{
    const r = indexedDB.open("carthief6", 1);
    r.onupgradeneeded = ()=>r.result.createObjectStore("saves");
    r.onsuccess = ()=>res(r.result);
    r.onerror = ()=>res(null);
  }catch(e){ res(null); } }); },
  async set(k, v){ const db = this.db||(this.db=await this.open()); if(!db) return;
    try{ db.transaction("saves","readwrite").objectStore("saves").put(v, k); }catch(e){} },
  async get(k){ const db = this.db||(this.db=await this.open()); if(!db) return null;
    return new Promise(res=>{ try{
      const r = db.transaction("saves").objectStore("saves").get(k);
      r.onsuccess = ()=>res(r.result||null);
      r.onerror = ()=>res(null);
    }catch(e){ res(null); } }); },
};

/* ── hall of fame: records survive across runs ── */
function loadRecords(){ try{ return JSON.parse(localStorage.getItem("carthief6_records")||"[]"); }catch(e){ return []; } }
function addRecord(g, ending){
  try{
    const recs = loadRecords();
    recs.unshift({ name:g.name, diff:DIFFS[g.diff].name, day:g.day, ending, earned:g.stats.earned, cars:g.stats.carsStolen, at:Date.now() });
    localStorage.setItem("carthief6_records", JSON.stringify(recs.slice(0,40)));
  }catch(e){}
}

/* ───────────────────────── helpers ───────────────────────── */
const oddsColor = p => p>=.75 ? "var(--green)" : p>=.5 ? "var(--gold)" : p>=.3 ? "#a3601a" : "var(--red)";
// JSON clone keeps in-memory state identical to the save format — serialization bugs surface instantly
const clone = g => JSON.parse(JSON.stringify(g));

function missionReward(m){
  const t = E.tpl(m);
  if(!t) return "?";
  if(m.pink) return `🔑 their ${m.rival?CARS[m.rival.car].n:"car"}'s slip`;
  if(m.stake) return `+${fmt$(m.stake)} pot`;
  if(m.bonus) return `${fmt$(Math.round(CARS[m.car].v*m.bonus))} delivery`;
  if(m.car!==undefined) return `${CARS[m.car].n} (${fmt$(CARS[m.car].v)})`;
  if(!t.pay) return "varies";
  return `${fmt$(t.pay[0])}–${fmt$(t.pay[1])}`;
}

/* ───────────────────────── small components ───────────────────────── */
const Bar = ({cls, val, max, label}) => (
  <div className={`bar ${cls}`}>
    <span>{label}</span>
    <div className="tr"><div className="fl" style={{width:`${(val/max)*100}%`}}/></div>
    <b>{val}/{max}</b>
  </div>
);

const Stars = ({n}) => (
  <span className="stars">
    {Array.from({length:6},(_,i)=>
      <span key={i} className={i<n?"on":"off"}>★</span>)}
  </span>
);

const Odds = ({p}) => (
  <div className="odds">
    <div className="tr"><div className="fl" style={{width:`${p*100}%`, background:oddsColor(p)}}/></div>
    <b style={{color:oddsColor(p)}}>{Math.round(p*100)}%</b>
  </div>
);

const Roll = ({r}) => (
  <div className="roll">
    <div className={`die ${r.crit?"crit":r.fumble?"fumb":""}`}>{r.roll}</div>
    <div>
      d20 <b>{r.roll}</b> + skill <b>{r.bonus}</b> = <b>{r.total}</b> vs difficulty <b>{r.diff}</b>
      {r.crit && <b style={{color:"var(--green)"}}> — CRITICAL!</b>}
      {r.fumble && <b style={{color:"var(--red)"}}> — FUMBLE!</b>}
      {r.who && <div style={{fontSize:11}}>backed up by {r.who.face} {r.who.name}</div>}
    </div>
  </div>
);

const SkillRows = ({g, showBonus=true}) => SKILLS.map(s=>{
  const base = g.skills[s], eff = E.skillOf(g, s);
  return (
    <div className="skrow" key={s}>
      <span>{SKILL_ICONS[s]}</span>
      <span style={{fontSize:12.5, color:"var(--mut)"}}>{cap(s)}</span>
      <div className="tr"><div className="fl" style={{width:`${(base/8)*100}%`}}/></div>
      <b className="tnum">{base}{showBonus && eff>base && <span className="bn"> +{eff-base}</span>}</b>
    </div>
  );
});

/* ───────────────────────── map ───────────────────────── */
function CityTerrain({city}){
  if(city===0) return (<g>{/* Miami — the bay, the beach, the causeways */}
    <path d="M640,0 L640,340 L548,340 C566,270 556,210 566,150 C576,85 558,45 572,0 Z" fill="#a8c2d2"/>
    <path d="M640,0 L640,340 L596,340 C606,260 598,170 610,90 C616,48 608,22 614,0 Z" fill="#94b4c8"/>
    <rect x="585" y="30" width="9" height="280" rx="4" fill="#e8dcb0"/>
    <line x1="548" y1="100" x2="640" y2="92" stroke="#b09a5e" strokeWidth="5"/>
    <line x1="552" y1="230" x2="640" y2="238" stroke="#b09a5e" strokeWidth="5"/>
    <line x1="0" y1="96" x2="556" y2="88" stroke="#b09a5e" strokeWidth="7"/>
    <line x1="168" y1="0" x2="186" y2="340" stroke="#b09a5e" strokeWidth="7"/>
    <line x1="0" y1="252" x2="552" y2="262" stroke="#b09a5e" strokeWidth="6"/>
    <ellipse cx="92" cy="170" rx="36" ry="26" fill="#b9c98e"/>
    <ellipse cx="380" cy="280" rx="42" ry="26" fill="#b9c98e"/>
    <ellipse cx="282" cy="58" rx="30" ry="20" fill="#b9c98e"/>
  </g>);
  if(city===1) return (<g>{/* Atlanta — the Perimeter, the river, canopy everywhere */}
    <ellipse cx="320" cy="170" rx="238" ry="128" fill="none" stroke="#b09a5e" strokeWidth="8"/>
    <path d="M0,52 C110,86 200,34 300,64 C400,92 470,52 580,76 L640,70" fill="none" stroke="#a8c2d2" strokeWidth="6"/>
    <line x1="318" y1="0" x2="322" y2="340" stroke="#b09a5e" strokeWidth="7"/>
    <line x1="0" y1="176" x2="640" y2="164" stroke="#b09a5e" strokeWidth="7"/>
    <line x1="80" y1="0" x2="560" y2="340" stroke="#b09a5e" strokeWidth="5"/>
    {[[96,228,30],[470,84,26],[520,242,32],[208,64,22],[262,272,20],[560,160,18],[150,120,18]].map(([x,y,r],k)=>
      <ellipse key={k} cx={x} cy={y} rx={r} ry={r*0.7} fill="#a8c182"/>)}
  </g>);
  if(city===2) return (<g>{/* Vegas — dry ridges, the Strip as a glowing boulevard of blocks */}
    <path d="M0,26 Q40,8 80,24 Q120,40 160,20 Q200,4 240,22 L240,0 L0,0 Z" fill="#cdb98a"/>
    <path d="M400,24 Q450,6 500,22 Q550,38 600,16 L640,24 L640,0 L400,0 Z" fill="#cdb98a"/>
    <line x1="306" y1="40" x2="318" y2="340" stroke="#c8a013" strokeWidth="10" opacity=".5"/>
    <line x1="306" y1="40" x2="318" y2="340" stroke="#8a6d1a" strokeWidth="2.5" strokeDasharray="10 6"/>
    {[[286,70],[330,96],[284,128],[332,158],[286,190],[330,222],[288,254],[332,286]].map(([x,y],k)=>
      <rect key={k} x={x} y={y} width="22" height="16" rx="2.5" fill="#b89a4a" stroke="#8a6d1a" strokeWidth="1"/>)}
    <line x1="0" y1="218" x2="640" y2="206" stroke="#b09a5e" strokeWidth="7"/>
    <line x1="112" y1="0" x2="96" y2="340" stroke="#b09a5e" strokeWidth="6"/>
    <line x1="470" y1="0" x2="500" y2="340" stroke="#b09a5e" strokeWidth="6"/>
    <rect x="488" y="262" width="110" height="13" rx="3" fill="#c4b176"/>
    <rect x="530" y="246" width="11" height="44" rx="3" fill="#c4b176"/>
    <ellipse cx="120" cy="120" rx="26" ry="17" fill="#b9c98e" opacity=".7"/>
  </g>);
  return (<g>{/* LA — coastline, the hills, the freeway mesh */}
    <path d="M0,340 L640,340 L640,300 C500,288 360,306 220,294 C130,288 60,300 0,292 Z" fill="#a8c2d2"/>
    <path d="M0,340 L640,340 L640,322 C460,310 300,326 0,314 Z" fill="#94b4c8"/>
    <rect x="180" y="296" width="6" height="30" fill="#8a7850"/>
    <path d="M0,46 Q60,16 130,40 Q200,62 270,34 Q340,10 410,38 L410,52 Q340,30 272,52 Q200,76 128,56 Q62,38 0,62 Z" fill="#c2ae7c"/>
    <line x1="0" y1="118" x2="640" y2="104" stroke="#b09a5e" strokeWidth="8"/>
    <line x1="0" y1="226" x2="640" y2="240" stroke="#b09a5e" strokeWidth="7"/>
    <line x1="186" y1="0" x2="222" y2="340" stroke="#b09a5e" strokeWidth="7"/>
    <line x1="452" y1="0" x2="430" y2="340" stroke="#b09a5e" strokeWidth="6"/>
    <ellipse cx="300" cy="172" rx="32" ry="20" fill="#b9c98e"/>
    <ellipse cx="86" cy="178" rx="24" ry="16" fill="#b9c98e"/>
  </g>);
}
const LABEL_SPOTS = [[88,52],[470,40],[120,300],[420,140],[240,238],[560,300]];
function DistrictLabels({city}){
  return (<g>
    {CITIES[city].districts.map((d,k)=>{
      const [x,y] = LABEL_SPOTS[k%LABEL_SPOTS.length];
      return <text key={k} x={x} y={y} fill="#8a7850" fontSize="9" fontWeight="700" letterSpacing="1.5" opacity="0.8">{d.toUpperCase()}</text>;
    })}
  </g>);
}
const CITY_TINT = ["#e7d6a3", "#e0d6a0", "#eee0b0", "#e7d2a0"];
function NeonMap({g, onPin, hov}){
  const grid = useMemo(()=>{
    let s = [];
    for(let x=30;x<560;x+=44) s.push(<line key={"v"+x} x1={x} y1="0" x2={x} y2="340" stroke="#c9b276" strokeWidth="3"/>);
    for(let y=24;y<340;y+=40) s.push(<line key={"h"+y} x1="0" y1={y} x2="565" y2={y} stroke="#c9b276" strokeWidth="3"/>);
    return s;
  },[]);
  return (
    <div className="mapbox">
      <svg viewBox="0 0 640 340" xmlns="http://www.w3.org/2000/svg">
        <rect width="640" height="340" fill={CITY_TINT[g.city]||CITY_TINT[0]}/>
        {grid}
        <CityTerrain city={g.city}/>
        <DistrictLabels city={g.city}/>
        <text x="14" y="328" fill="#8a7850" fontSize="11" fontWeight="700" letterSpacing="3">{CITIES[g.city].n.toUpperCase()}</text>
      </svg>
      {g.missions.map((m,i)=>{
        const t = E.tpl(m);
        return (
          <div key={i}
            className={`pin ${m.done?"done":""} ${m.resume||hov===i?"hi":""}`}
            style={{left:`${m.x}%`, top:`${m.y}%`}}
            title={`${t.n} · ${m.dist}`}
            onClick={()=>!m.done && onPin(i)}>
            {t.ic}
          </div>
        );
      })}
    </div>
  );
}

/* ───────────────────────── modal frame ───────────────────────── */
function Modal({children, onClose}){
  return (
    <div className="ovl" onClick={e=>{ if(e.target.classList.contains("ovl") && onClose) onClose(); }}>
      <div className="modal">{children}</div>
    </div>
  );
}

/* ═════════════════════════ APP ═════════════════════════ */
export default function App(){
  const [g, setG] = useState(null);
  const [view, setView] = useState("streets");
  const [modal, setModal] = useState(null);     // {type, ...payload}
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const toast = useCallback((m, c="")=>{
    const id = ++toastId.current;
    setToasts(t=>[...t, {id, m, c}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)), 3200);
  },[]);

  const save = useCallback((slot, state)=>{
    try{ const s = JSON.stringify(state); localStorage.setItem(SAVEKEY+slot, s); idb.set(SAVEKEY+slot, s); }catch(e){}
  },[]);
  const slotInfo = slot => {
    try{
      const s = localStorage.getItem(SAVEKEY+slot);
      if(!s) return null;
      const x = JSON.parse(s);
      return `${x.name} · Day ${x.day} · ${fmt$(x.cash)} · debt ${fmt$(x.debt)}`;
    }catch(e){ return null; }
  };
  const load = slot => {
    try{
      const s = localStorage.getItem(SAVEKEY+slot);
      if(!s) return false;
      setG(E.migrate(JSON.parse(s))); setModal(null); setView("streets");
      toast("Game loaded","good");
      return true;
    }catch(e){ return false; }
  };

  // resume automatically: localStorage first, IndexedDB as backup
  const booted = useRef(false);
  useEffect(()=>{
    if(booted.current) return; booted.current = true;
    try{
      const s = localStorage.getItem(SAVEKEY+0);
      if(s){ setG(E.migrate(JSON.parse(s))); return; }
    }catch(e){}
    idb.get(SAVEKEY+0).then(s=>{
      if(s && !g){ try{ const x = E.migrate(JSON.parse(s)); setG(x); localStorage.setItem(SAVEKEY+0, s); }catch(e){} }
    });
    // eslint-disable-next-line
  },[]);

  // keyboard: 1-9 scene approaches · F flee · Enter leave finished scene · E end day · Esc close
  useEffect(()=>{
    const onKey = (ev)=>{
      if(ev.target.tagName==="INPUT" || ev.target.tagName==="SELECT" || !g) return;
      if(ev.key==="Escape" && modal){ setModal(null); return; }
      if(g.enc){
        const e2 = g.enc;
        if(e2.over){ if(ev.key==="Enter"){ sceneLeave(); } return; }
        const s = e2.steps[e2.stepIdx];
        const n = parseInt(ev.key);
        if(n>=1 && n<=(s?.approaches?.length||0)){
          const a2 = s.approaches[n-1];
          if(!(a2.tool && !E.carried(g, a2.tool))) sceneAct(n-1);
          return;
        }
        if(ev.key.toLowerCase()==="f"){ sceneFlee(); return; }
        if(ev.key.toLowerCase()==="s" && s?.optional){ sceneSkip(); return; }
        return;
      }
      if(!modal && ev.key.toLowerCase()==="e"){ doEndDay(); }
    };
    window.addEventListener("keydown", onKey);
    return ()=>window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line
  },[g, modal]);

  // autosave on every meaningful change + on window close
  useEffect(()=>{
    if(!g) return;
    const t = setTimeout(()=>save(0, g), 350);
    const onClose = ()=>{ try{ localStorage.setItem(SAVEKEY+0, JSON.stringify(g)); }catch(e){} };
    window.addEventListener("beforeunload", onClose);
    return ()=>{ clearTimeout(t); window.removeEventListener("beforeunload", onClose); };
  },[g, save]);

  /* ── flows ── */
  const doAttempt = (i)=>{
    if(!g || g.enc) return;
    const m = g.missions[i];
    const t = E.tpl(m);
    if(g.en < t.en){ toast("Not enough energy — end the day to recharge","bad"); return; }
    if(m.pink && !E.rideCar(g)){ toast("Pink-slip race — you need a ride here to wager","bad"); return; }
    if(t.race && m.stake && g.cash < m.stake){ toast(`You need ${fmt$(m.stake)} for the stake`,"bad"); return; }
    const next = clone(g);
    const enc = SC.startScene(next, i);
    if(!enc) return;
    setG(next);
  };

  /* ── crime scene flows ── */
  const sceneAct = (ai)=>{
    const next = clone(g);
    const ev = SC.sceneAction(next, ai);
    if(ev?.blocked){ toast(ev.blocked,"bad"); return; }
    setG(next);
    if(ev?.r){ SFX.roll(); if(ev.r.ok) SFX.good(); else SFX.bad(); }
    if(ev?.cash>0){ SFX.cash(); toast(`+${fmt$(ev.cash)}`,"good"); }
    if(ev?.levelUps>0){ SFX.level(); toast(`Level up! → ${next.lvl}`,"gold"); }
    if(ev?.standoff){ SFX.police(); toast("🚔 POLICE ON SCENE — fight, work, run, or fold","bad"); }
    if(ev?.dead){ SFX.bad(); SC.closeScene(next); setG(clone(next)); finishOverWith(next); return; }
    if(ev?.police){ SFX.police();
      SC.scenePoliceAbort(next); SC.closeScene(next);
      setG(clone(next));
      setModal({type:"police", atScene:true});
      return;
    }
  };
  const sceneSkip = ()=>{ const next=clone(g); const ev=SC.sceneSkip(next); if(ev?.blocked){ toast(ev.blocked,"bad"); return; } setG(next); };
  const sceneTarget = (id)=>{
    const next = clone(g);
    SC.setTarget(next, id);
    setG(next);
  };
  const standoffAct = (idx)=>{
    const next = clone(g);
    const ev = SC.standoffAction(next, idx);
    if(!ev) return;
    setG(next);
    if(ev.r){ SFX.roll(); if(ev.r.ok) SFX.good(); else SFX.bad(); }
    if(ev.dead){ SFX.bad(); SC.closeScene(next); setG(clone(next)); finishOverWith(next); return; }
    if(ev.surrender){
      const after = clone(next);
      SC.closeScene(after);
      setG(after);
      doArrest();
      return;
    }
  };
  const sceneFlee = ()=>{
    const next = clone(g);
    const ev = SC.sceneFlee(next);
    if(ev?.chased){
      SC.closeScene(next);
      setG(next);
      setModal({type:"police", atScene:true});
      return;
    }
    setG(next);
  };
  const sceneLeave = ()=>{
    const next = clone(g);
    SC.closeScene(next);
    if(next.finale?.legend && !next.finale.celebrated){
      next.finale.celebrated = true;
      if(!next.recorded?.legend){ next.recorded.legend=true; addRecord(next, "LEGEND 👑"); }
      setG(next);
      SFX.level();
      setModal({type:"legend"});
      return;
    }
    setG(next);
    if(next.hp<=0 || next.over) finishOverWith(next);
  };
  const finishOverWith = (state)=>{
    const next = clone(state);
    const reason = E.checkOver(next);
    setG(next);
    if(reason) setModal({type:"gameover", reason});
  };

  const afterMission = (ev)=>{
    if(g.hp<=0 || g.over){ finishOver(); return; }
    if(ev.police){ setModal({type:"police"}); return; }
    setModal(null);
  };

  const finishOver = ()=>{
    const next = clone(g);
    const reason = E.checkOver(next);
    setG(next);
    if(reason) setModal({type:"gameover", reason});
    else setModal(null);
  };

  const doCop = (a)=>{
    const next = clone(g);
    const ev = E.copAction(next, a);
    setG(next);
    setModal({type:"policeResult", ev});
  };

  const doArrest = ()=>{
    const next = clone(g);
    const ev = E.applyArrest(next);
    setG(next);
    save(0, next);
    if(ev.kind==="gameover") setModal({type:"gameover", reason:ev.reason});
    else setModal({type:"jail", ev});
  };

  const doEndDay = ()=>{
    {
      const next = clone(g);
      if(E.maybeAmbush(next)){ setG(next); return; } // settle this first — then end the day
    }
    const next = clone(g);
    const sum = E.endDay(next);
    setG(next);
    save(0, next);
    if(sum.gameover){ if(!next.recorded?.[sum.gameover]){ next.recorded[sum.gameover]=true; addRecord(next, sum.gameover); setG(clone(next)); } SFX.bad(); setModal({type:"gameover", reason:sum.gameover}); }
    else if(sum.retired){ if(!next.recorded?.retired){ next.recorded.retired=true; addRecord(next, "retired 🌅"); setG(clone(next)); } SFX.level(); setModal({type:"retired"}); }
    else setModal({type:"daySummary", sum, day:next.day});
  };

  const doPay = (n)=>{
    const next = clone(g);
    const wonBefore = g.won;
    E.payDebt(next, n);
    setG(next);
    if(next.won && !wonBefore){ if(!next.recorded?.won){ next.recorded.won=true; addRecord(next, "debt paid 🏆"); setG(clone(next)); } SFX.level(); save(0,next); setModal({type:"win"}); }
    else toast(`Paid ${fmt$(Math.min(n,g.cash,g.debt))} to the Syndicate`,"good");
  };

  const exportSave = ()=>{
    const blob = new Blob([JSON.stringify(g,null,1)],{type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `carthief6_${g.name}_day${g.day}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importSave = (file)=>{
    const rd = new FileReader();
    rd.onload = ()=>{
      try{
        const x = JSON.parse(rd.result);
        if(!x.skills || x.day===undefined) throw 0;
        setG(E.migrate(x)); setModal(null); toast("Save imported","good");
      }catch(e){ toast("Not a valid save file","bad"); }
    };
    rd.readAsText(file);
  };

  /* ── character creation ── */
  if(!g) return <Create onStart={(n,c,d,av,mu,pk)=>setG(E.newGame(n,c,d,av,mu,pk))} onLoad={load} slotInfo={slotInfo}/>;

  const missionsLeft = g.missions.filter(m=>!m.done).length;

  /* ═══════════ render ═══════════ */
  return (
    <div className="app">
      {/* ── sidebar ── */}
      <div className="sidebar">
        <div className="logo">
          <h1>CAR THEFT 7</h1>
          <span>Redux</span>
        </div>
        <div style={{display:"flex", alignItems:"center", gap:9, padding:"0 10px 10px"}}>
          <Avatar a={g.avatar} size={46}/>
          <div style={{lineHeight:1.25}}>
            <b style={{fontSize:13}}>{g.name}</b><br/>
            <span style={{fontSize:11, color:"var(--mut)"}}>Level {g.lvl} {CLASSES.find(c=>c.id===g.cls)?.name}</span>
          </div>
        </div>
        {[
          ["streets","🌆","Streets", missionsLeft||null, ""],
          ["garage","🚗","Garage", E.localCars(g).length||null, "cy"],
          ["crew","🍺","Crew", null, ""],
          ["hideout","🏚️","Hide-out", null, ""],
          ["market","🛠️","Market", null, ""],
          ["travel","✈️","Travel", null, ""],
          ["empire","🏘️","Empire", (g.props||[]).length||null, "cy"],
          ["shark","🦈","Loan Shark", null, ""],
          ["profile","🕶️","Profile", g.skillPts||null, ""],
          ...(g.won && g.finale?.offered && !g.finale?.legend ? [["lastjob","🏆","The Last Job", "!", ""]] : []),
        ].map(([id,ic,label,pip,pc])=>(
          <button key={id} className={`nav ${view===id?"on":""}`} onClick={()=>setView(id)}>
            <span className="ic">{ic}</span>{label}
            {pip ? <span className={`pip ${pc}`}>{pip}</span> : null}
          </button>
        ))}
        <button className="nav" onClick={()=>setModal({type:"menu"})}><span className="ic">⚙️</span>Menu</button>
      </div>

      {/* ── content ── */}
      <div className="content">
        <div className="hud">
          <div className="stat"><span className="lb">Day</span><span className="vl">{g.day}</span></div>
          <div className="stat"><span className="lb">City</span><span className="vl" style={{fontSize:13}}>{CITIES[g.city].n}</span></div>
          <div className="stat"><span className="lb">Clean</span><span className="vl green tnum">{fmt$(g.cash)}</span></div>
          {(g.dirty||0)>0 && <div className="stat"><span className="lb">Dirty 🩸</span><span className="vl tnum" style={{color:"#7a4a1d"}}>{fmt$(g.dirty)}</span></div>}
          {(g.fame||0)>0 && <div className="stat"><span className="lb">Fame</span><span className="vl gold tnum">{g.fame}</span></div>}
          <div className="stat"><span className="lb">Debt</span><span className="vl red tnum">{fmt$(g.debt)}</span></div>
          <div className="stat"><span className="lb">Net worth</span><span className="vl cyan tnum">{fmt$(E.netWorth(g))}</span></div>
          <div className="stat"><span className="lb">Wanted {g.crackdown?"🚨":""}</span><Stars n={g.wanted}/></div>
          {E.gangHeat(g)>0 && <div className="stat"><span className="lb">Gang heat</span><span className="vl red">{"🩸".repeat(Math.min(4,Math.ceil(E.gangHeat(g)/3)))} {E.gangHeat(g)}</span></div>}
          <div className="spacer"/>
          <div className="bars">
            <Bar cls="en" val={g.en} max={E.maxEnergy(g)} label="⚡"/>
            <Bar cls="hp" val={g.hp} max={100} label="❤️"/>
            <Bar cls="dg" val={g.disg} max={100} label="🎭"/>
          </div>
          <button className="endday" onClick={()=>{SFX.click(); doEndDay();}} disabled={g.over || !!g.enc} title="shortcut: E">🌙 End Day</button>
        </div>

        <div className="main">
          {view==="streets" && <Streets g={g} onPin={doAttempt} onStreet={id=>{
            if(g.enc) return;
            const t = E.tpl({t:"stealcar"});
            if(g.en < t.en){ toast("Not enough energy — end the day to recharge","bad"); return; }
            const next = clone(g);
            const mi = E.targetStreetCar(next, id);
            if(mi<0) return;
            if(!SC.startScene(next, mi)) return;
            setG(next);
          }}/>}
          {view==="garage"  && <Garage g={g} setG={setG} toast={toast}
            onSellLoot={()=>{ const next=clone(g); const v=E.sellLoot(next); setG(next); if(v>0) toast(`+${fmt$(v)}`,"good"); }}/>}
          {view==="empire"  && <Empire g={g} setG={setG} toast={toast}/>}
          {view==="travel"  && <Travel g={g} onGo={(c,mode)=>{
            const next = clone(g);
            const r = E.travel(next, c, mode);
            if(r==="noride"){ toast("You need a ride in the garage to drive out","bad"); return; }
            if(r==="cash"){ toast("Not enough cash for the trip","bad"); return; }
            setG(next); toast(`Welcome to ${CITIES[c].n}`,"good");
          }}/>}
          {view==="crew"    && <Crew g={g} setG={setG} toast={toast}/>}
          {view==="hideout" && <Hideout g={g} setG={setG} toast={toast}/>}
          {view==="market"  && <Market g={g} setG={setG} toast={toast}/>}
          {view==="shark"   && <Shark g={g} onPay={doPay} onWash={amt=>{
            const next = clone(g);
            const net = E.launder(next, amt);
            if(net<=0) return;
            setG(next); SFX.cash(); toast(`Washed → +${fmt$(net)} clean`,"good");
          }}/>}
          {view==="profile" && <Profile g={g} setG={setG}/>}
          {view==="lastjob" && <LastJob g={g} setG={setG} toast={toast}
            onStart={()=>{ const next=clone(g); if(SC.startFinale(next)){ setG(next); } }}/>}
        </div>
      </div>

      {/* ── street wire (right rail) ── */}
      <div className="wirecol">
        <div className="lt">📰 Street wire</div>
        {g.log.slice(0,40).map((l,i)=>(
          <div key={i} className={`logline ${l.c}`}><span className="d">D{l.day}</span>{l.m}</div>
        ))}
      </div>

      {/* ── crime scene ── */}
      {g.enc && <Scene g={g} onAct={sceneAct} onSkip={sceneSkip} onFlee={sceneFlee} onLeave={sceneLeave} onStandoff={standoffAct} onTarget={sceneTarget}/>}

      {/* ── toasts ── */}
      <div className="toasts">
        {toasts.map(t=><div key={t.id} className={`toast ${t.c}`}>{t.m}</div>)}
      </div>

      {/* ── modals ── */}
      {modal?.type==="missionResult" && (
        <Modal>
          <h3>{modal.ev.t.ic} {modal.ev.t.n}</h3>
          <Roll r={modal.ev.r}/>
          {modal.ev.cash>0 && <div className="bigcash">+{fmt$(modal.ev.cash)}</div>}
          {modal.ev.lines.map((l,i)=><div key={i} className={`mline ${l.c}`}>{l.m}</div>)}
          <div className="choices">
            <button className="btn pri wide" onClick={()=>afterMission(modal.ev)}>
              {modal.ev.police ? "…wait — sirens." : "Continue"}
            </button>
          </div>
        </Modal>
      )}

      {modal?.type==="police" && (
        <Modal>
          <h3>🚔 Police!</h3>
          <p className="sub">{modal.atScene
            ? "A cruiser slides across the alley mouth. The scene is blown — what's in the backpack stays with you, if you get away."
            : "Blue lights in the mirror. They know your face."}</p>
          {(()=>{ const t=E.copTargets(g); return (
            <div className="choices">
              <button className="btn wide" onClick={()=>doCop("run")}>🏎️ Floor it <span style={{color:"var(--mut)"}}>— driving vs {t.run}</span></button>
              <button className="btn wide" onClick={()=>doCop("hide")}>🌫️ Ditch &amp; hide <span style={{color:"var(--mut)"}}>— hiding vs {t.hide}</span></button>
              <button className="btn wide" onClick={()=>doCop("talk")}>🎭 Talk your way out <span style={{color:"var(--mut)"}}>— acting vs {t.talk}</span></button>
              <button className="btn hot wide" disabled={g.cash<t.bribe} onClick={()=>doCop("bribe")}>💵 Bribe — {fmt$(t.bribe)}</button>
            </div>
          );})()}
        </Modal>
      )}

      {modal?.type==="policeResult" && (
        <Modal>
          <h3>🚔 Police</h3>
          {modal.ev.r && <Roll r={modal.ev.r}/>}
          {modal.ev.lines.map((l,i)=><div key={i} className={`mline ${l.c}`}>{l.m}</div>)}
          <div className="choices">
            {modal.ev.arrested
              ? <button className="btn hot wide" onClick={doArrest}>⛓️ Hands behind your back</button>
              : <button className="btn pri wide" onClick={finishOver}>Drive away</button>}
          </div>
        </Modal>
      )}

      {modal?.type==="jail" && (
        <Modal>
          <h3>⛓️ County lockup</h3>
          <div className="mline bad">They hold you for {modal.ev.days} day{modal.ev.days>1?"s":""} and fine you {fmt$(modal.ev.fine)}.</div>
          {modal.ev.tools?.length>0 && (
            <div className="mline bad">🧾 The booking desk bags your gear as evidence: {modal.ev.tools.map(t=>`${t.ic} ${t.n}`).join(", ")}. You won't see it again.</div>
          )}
          {modal.ev.lootN>0 && <div className="mline bad">🧾 Your backpack — {modal.ev.lootN} item{modal.ev.lootN>1?"s":""} worth {fmt$(modal.ev.lootV)} — gone with it.</div>}
          <div className="mline warn">Strike {modal.ev.strikes} of 4. Strike four — or strike three with five stars and it's prison for good.</div>
          <div className="mline">The interest didn't take a day off. Your hide-out stash, at least, stays secret.</div>
          <div className="choices"><button className="btn pri wide" onClick={()=>setModal(null)}>Walk out</button></div>
        </Modal>
      )}

      {modal?.type==="daySummary" && (
        <Modal onClose={()=>setModal(null)}>
          <h3>🌙 Night {modal.day-1} → Day {modal.day}</h3>
          <div className="rowline"><span>Jobs pulled</span><b>{modal.sum.crimes}</b></div>
          <div className="rowline"><span>Upkeep &amp; wages</span><b style={{color:"var(--red)"}}>−{fmt$(modal.sum.costs)}</b></div>
          <div className="rowline"><span>Debt interest</span><b style={{color:"var(--red)"}}>+{fmt$(modal.sum.interest)}</b></div>
          {modal.sum.borrowed>0 && <div className="rowline"><span>Emergency loan (doubled!)</span><b style={{color:"var(--red)"}}>+{fmt$(modal.sum.borrowed*2)}</b></div>}
          {modal.sum.laidLow && <div className="rowline"><span>You laid low</span><b style={{color:"var(--green)"}}>wanted −2</b></div>}
          {modal.sum.healed>0 && <div className="rowline"><span>Rest</span><b style={{color:"var(--green)"}}>+{modal.sum.healed}% health</b></div>}
          {modal.sum.traced && <div className="rowline"><span>🚔 Police traced a hot car</span><b style={{color:"var(--red)"}}>{modal.sum.traced} towed</b></div>}
          {modal.sum.event && <div className="rowline"><span>{modal.sum.event.ic} Word on the street</span><b>{modal.sum.event.m}</b></div>}
          {(modal.sum.sideJobs||[]).map((l,i)=><div className="rowline" key={i}><span>🌙 Side job</span><b style={{color:l.c==="bad"?"var(--red)":"var(--green)"}}>{l.m}</b></div>)}
          {(modal.sum.propLines||[]).map((l,i)=><div className="rowline" key={"p"+i}><span>{l.ic} Business</span><b style={{color:"var(--green)"}}>{l.m}</b></div>)}
          {modal.sum.gangHit && <div className="rowline"><span>🔥 Trouble</span><b style={{color:"var(--red)"}}>{modal.sum.gangHit.m}</b></div>}
          {modal.sum.paper && (
            <div style={{background:"#f3ecd2", border:"1px solid var(--line2)", borderRadius:4, padding:"10px 12px", margin:"8px 0", fontFamily:"Georgia, 'Times New Roman', serif"}}>
              <div style={{textAlign:"center", letterSpacing:3, fontSize:10, borderBottom:"2px solid var(--txt)", paddingBottom:3, marginBottom:5}}>{modal.sum.paper.name}</div>
              <div style={{fontSize:16, fontWeight:800, textAlign:"center", marginBottom:6}}>{modal.sum.paper.headline}</div>
              {modal.sum.paper.lines.map((l,i)=><div key={i} style={{fontSize:11.5, marginBottom:2}}>• {l}</div>)}
            </div>
          )}
          <div className="rowline"><span>⚡ Energy</span><b style={{color:"var(--cyan)"}}>fully recharged</b></div>
          <div className="choices"><button className="btn pri wide" onClick={()=>setModal(null)}>☀️ Hit the streets</button></div>
        </Modal>
      )}

      {modal?.type==="win" && (
        <Modal>
          <h3>🏆 FREE &amp; CLEAR</h3>
          <p className="sub">You slide the last stack across the table. The shark counts it twice, then smiles for the first time ever. <b>"We're square."</b></p>
          <div className="rowline"><span>Days it took</span><b>{g.day}</b></div>
          <div className="rowline"><span>Cash in pocket</span><b style={{color:"var(--green)"}}>{fmt$(g.cash)}</b></div>
          <div className="rowline"><span>Total earned</span><b>{fmt$(g.stats.earned)}</b></div>
          <div className="rowline"><span>Cars stolen</span><b>{g.stats.carsStolen}</b></div>
          <div className="choices">
            <button className="btn pri wide" onClick={()=>setModal(null)}>Keep playing — retire rich (own the marina + bank $1M)</button>
            <button className="btn wide" onClick={()=>setG(null)}>New game</button>
          </div>
        </Modal>
      )}

      {modal?.type==="legend" && (
        <Modal>
          <h3>👑 LEGEND</h3>
          <p className="sub">Day {g.day}. The Phantom is gone before sunrise and so is your file. Prince keeps his word the only way he knows how: completely. No more tribute. No more Syndicate. Just a name people say quietly in garages from Miami to LA.</p>
          <div className="rowline"><span>Cars stolen</span><b>{g.stats.carsStolen}</b></div>
          <div className="rowline"><span>Total earned</span><b>{fmt$(g.stats.earned)}</b></div>
          <div className="rowline"><span>Days on the street</span><b>{g.day}</b></div>
          <p className="sub" style={{color:"var(--gold)", fontWeight:700}}>THE LEGEND ENDING. There is nothing above this.</p>
          <div className="choices">
            <button className="btn pri wide" onClick={()=>setModal(null)}>The streets are still out there</button>
            <button className="btn wide" onClick={()=>setG(null)}>New game</button>
          </div>
        </Modal>
      )}

      {modal?.type==="retired" && (
        <Modal>
          <h3>🌅 RETIRED</h3>
          <p className="sub">Day {g.day}. A million in cash. The marina at your back, every debt squared, every cop bored of your file. You pour something old and expensive and watch someone else's sirens cross the bay.</p>
          <div className="rowline"><span>Cars stolen</span><b>{g.stats.carsStolen}</b></div>
          <div className="rowline"><span>Total earned</span><b>{fmt$(g.stats.earned)}</b></div>
          <div className="rowline"><span>Cities worked</span><b>{g.stats.cities}</b></div>
          <p className="sub" style={{color:"var(--gold)", fontWeight:700}}>THE TRUE ENDING. You beat the whole game.</p>
          <div className="choices">
            <button className="btn pri wide" onClick={()=>setModal(null)}>One more night, for old times</button>
            <button className="btn wide" onClick={()=>setG(null)}>New game</button>
          </div>
        </Modal>
      )}

      {modal?.type==="gameover" && (
        <Modal>
          {modal.reason==="dead" && <>
            <h3>💀 DEAD</h3>
            <p className="sub">You bled out in a parking lot off Biscayne. Day {g.day}. The Syndicate writes off the debt — they're like that with the dead.</p>
          </>}
          {modal.reason==="prison" && <>
            <h3>⛓️ PRISON</h3>
            <p className="sub">Too many strikes. The judge doesn't even look up: fifteen years. You stashed {fmt$(g.cash)} you'll never spend.</p>
          </>}
          {modal.reason==="bay" && <>
            <h3>🌊 THE BAY</h3>
            <p className="sub">The debt tripled. The Syndicate's patience didn't. Two men in nice suits offer you a boat ride.</p>
          </>}
          <div className="choices">
            <button className="btn hot wide" onClick={()=>setG(null)}>Start over</button>
            <button className="btn wide" onClick={()=>setModal({type:"saveload", mode:"load"})}>Load a save</button>
          </div>
        </Modal>
      )}

      {modal?.type==="menu" && (
        <Modal onClose={()=>setModal(null)}>
          <h3>⚙️ Menu</h3>
          <div className="choices">
            {!g.mutators?.iron && <button className="btn wide" onClick={()=>setModal({type:"saveload", mode:"save"})}>💾 Save game</button>}
            {!g.mutators?.iron && <button className="btn wide" onClick={()=>setModal({type:"saveload", mode:"load"})}>📂 Load game</button>}
            {g.mutators?.iron && <div className="rowline"><span>🪨 Ironman — autosave only, no take-backs</span></div>}
            <button className="btn wide" onClick={exportSave}>⬇️ Export save to file</button>
            <label className="btn wide" style={{textAlign:"center", cursor:"pointer"}}>
              ⬆️ Import save from file
              <input type="file" accept=".json" style={{display:"none"}}
                onChange={e=>e.target.files[0] && importSave(e.target.files[0])}/>
            </label>
            <button className="btn wide" onClick={()=>{ setMuted(!isMuted()); setModal({type:"menu"}); }}>{isMuted() ? "🔇 Sound: off — turn on" : "🔊 Sound: on — turn off"}</button>
            <button className="btn wide" onClick={()=>setModal({type:"records"})}>🏅 Hall of fame</button>
            <button className="btn wide" onClick={()=>setModal({type:"howto"})}>❓ How to play</button>
            <button className="btn hot wide" onClick={()=>setModal({type:"confirmNew"})}>🔄 New game</button>
            <button className="btn wide" onClick={()=>setModal(null)}>Back</button>
          </div>
        </Modal>
      )}

      {modal?.type==="records" && (
        <Modal onClose={()=>setModal(null)}>
          <h3>🏅 Hall of fame</h3>
          {loadRecords().length===0 && <p className="sub">No endings on the books yet. Go make history.</p>}
          {loadRecords().slice(0,14).map((r,i)=>(
            <div className="rowline" key={i}>
              <span><b>{r.name}</b> · {r.diff}<br/><small style={{color:"var(--mut)"}}>{r.ending} on day {r.day} · {fmt$(r.earned)} earned · {r.cars} cars</small></span>
            </div>
          ))}
          <div className="choices"><button className="btn wide" onClick={()=>setModal(null)}>Back</button></div>
        </Modal>
      )}

      {modal?.type==="howto" && (
        <Modal onClose={()=>setModal(null)}>
          <h3>❓ How to play</h3>
          <div className="mline"><b>Goal:</b> pay off the Syndicate before nightly interest buries you. If the debt ever triples, you're done.</div>
          <div className="mline"><b>Energy</b> (⚡10/night) limits how many jobs you pull. Scouting a scene costs ⚡1 — you only commit the rest when you make your first move, so look around and walk away cheap. Every action is a d20 + skill roll at the % shown.</div>
          <div className="mline"><b>Stolen cars</b> land in the garage hot 🔥. Heat drops 1/night; cold cars sell for full price.</div>
          <div className="mline"><b>Wanted stars</b> bring police. Run, hide, talk or bribe. Arrest confiscates everything you carry. Four arrests = prison (three if you have 5★). Lay low a full day to drop 2 stars.</div>
          <div className="mline"><b>Crew</b> add half their best matching skill. <b>Gear</b> boosts skills permanently. The game autosaves every night.</div>
          <div className="choices"><button className="btn pri wide" onClick={()=>setModal(null)}>Got it</button></div>
        </Modal>
      )}

      {modal?.type==="confirmNew" && (
        <Modal onClose={()=>setModal(null)}>
          <h3>🔄 New game</h3>
          <p className="sub">Abandon this run? Autosave keeps last night, but unsaved progress is lost.</p>
          <div className="choices">
            <button className="btn hot wide" onClick={()=>{setG(null); setModal(null);}}>Yes, start over</button>
            <button className="btn wide" onClick={()=>setModal(null)}>Cancel</button>
          </div>
        </Modal>
      )}

      {modal?.type==="saveload" && (
        <Modal onClose={()=>setModal(null)}>
          <h3>{modal.mode==="save"?"💾 Save game":"📂 Load game"}</h3>
          {[[0,"Autosave"],[1,"Slot 1"],[2,"Slot 2"],[3,"Slot 3"]].map(([n,label])=>{
            if(modal.mode==="save" && n===0) return null;
            const info = slotInfo(n);
            return (
              <div className="rowline" key={n}>
                <span><b>{label}</b><br/><small style={{color:"var(--mut)"}}>{info||"— empty —"}</small></span>
                {modal.mode==="save"
                  ? <button className="btn sm" onClick={()=>{save(n,g); toast(`Saved to ${label}`,"good"); setModal(null);}}>Save</button>
                  : <button className="btn sm" disabled={!info} onClick={()=>load(n)}>Load</button>}
              </div>
            );
          })}
          <div className="choices"><button className="btn wide" onClick={()=>setModal(null)}>Back</button></div>
        </Modal>
      )}
    </div>
  );
}

/* ═════════════════════════ crime scene ═════════════════════════ */
function FoeCell({f, targeted, onClick}){
  const dead = f.hp<=0;
  return (
    <div className={`bcell ${dead?"down":""} ${targeted?"tgt":""}`} onClick={dead?undefined:onClick}
      title={dead?(f.fled?"Fled":"Down"):`${f.n} — click to target`}>
      <div className="bface">{f.face}</div>
      <div className="bname">{f.n}</div>
      <div className="bbar"><div className="bfl foe" style={{width:`${Math.max(0,f.hp/f.max)*100}%`}}/></div>
      <div className="bhp">{dead?(f.fled?"FLED":"DOWN"):`${f.hp}/${f.max}`}</div>
    </div>
  );
}
function BattleStrip({g, onTarget}){
  const e = g.enc;
  const foes = [...(e.foes||[]), ...(e.standoff?.cops||[])].slice(-12);
  if(!foes.length) return null;
  const inc = e.standoff ? SC.nextWave(g) : null;
  return (
    <div className="bstrip">
      <div className="brow">
        <div className="blab red">THEM{e.standoff?` · W${e.standoff.wave}`:""}</div>
        <div className="bgrid">
          {foes.map(f=><FoeCell key={f.id} f={f} targeted={e.target===f.id} onClick={()=>onTarget(f.id)}/>)}
          {inc && Array.from({length:inc.count}).map((_,i)=>(
            <div key={"inc"+i} className="bcell ghost" title={`Reinforcements arriving — ${inc.turns} turn${inc.turns!==1?"s":""}`}>
              <div className="bface">🚨</div>
              <div className="bname">backup</div>
              <div className="bbar"><div className="bfl inc" style={{width:`${inc.pct}%`}}/></div>
              <div className="bhp">{inc.turns} TURN{inc.turns!==1?"S":""}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="brow">
        <div className="blab green">YOURS</div>
        <div className="bgrid">
          <div className={`bcell you ${g.hp<=0?"down":""}`} title="You">
            <div className="bface"><Avatar a={g.avatar} size={18}/></div>
            <div className="bname">{g.name}</div>
            <div className="bbar"><div className="bfl crew" style={{width:`${g.hp}%`}}/></div>
            <div className="bhp">{g.hp}%</div>
          </div>
          {g.crew.map((m,i)=>(
            <div key={i} className={`bcell you ${m.out?"down":""}`} title={m.out?`${m.name} — down`:m.name}>
              <div className="bface">{m.face}</div>
              <div className="bname">{m.name}</div>
              <div className="bbar"><div className="bfl crew" style={{width:`${m.hp??100}%`}}/></div>
              <div className="bhp">{m.out?"DOWN":`${m.hp??100}%`}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function Scene({g, onAct, onSkip, onFlee, onLeave, onStandoff, onTarget}){
  const e = g.enc;
  const s = e.steps[e.stepIdx];
  const t = E.tpl({t:e.tid}) || {ic:"🩸", n:"Gang ambush", en:1};
  const logRef = useRef(null);
  useEffect(()=>{ if(logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; },[e.log.length]);
  const prColor = e.pr>=75 ? "var(--red)" : e.pr>=45 ? "var(--gold)" : "var(--green)";
  return (
    <div className="ovl">
      <div className="scene">
        <div className="scn-head">
          <span className="scn-title">{t.ic} {t.n} <span className="scn-dist">· {e.dist}</span></span>
          <span className="scn-turn">Turn {e.turn}</span>
        </div>
        <div className="scn-body">
          <div className="scn-log inset" ref={logRef}>
            {e.log.map((l,i)=><div key={i} className={`scnline ${l.c}`}>{l.m}</div>)}
          </div>
          <div className="scn-side">
            <div className="scn-panel">
              <div className="scn-lbl">Police readiness</div>
              <div className="bar" style={{minWidth:0}}>
                <div className="tr"><div className="fl" style={{width:`${Math.min(100,e.pr)}%`, background:prColor}}/></div>
                <b>{Math.min(100,Math.round(e.pr))}</b>
              </div>
              <div className="scn-lbl" style={{marginTop:8}}>Your health</div>
              <div className="bar hp" style={{minWidth:0}}>
                <div className="tr"><div className="fl" style={{width:`${g.hp}%`}}/></div>
                <b>{g.hp}%</b>
              </div>
            </div>
            {e.rival && (
              <div className="scn-panel scn-enemy">
                <div className="scn-lbl">{e.rival.face} {e.rival.name}</div>
                <CarArt car={e.rival.car} h={44}/>
                <div style={{fontSize:11.5}}>{CARS[e.rival.car].n}{e.pink && <span className="chip red" style={{marginLeft:5}}>pink slips</span>}</div>
                <div style={{fontSize:14, fontWeight:800, marginTop:4}}>Legs: {e.legsYou} – {e.legsRival}</div>
              </div>
            )}
            {g.crew.length>0 && (
              <div className="scn-panel">
                <div className="scn-lbl">Your crew tonight</div>
                {g.crew.map((m,i)=>(
                  <div key={i} style={{fontSize:11.5, color:m.out?"var(--red)":"inherit"}}>
                    {m.face} {m.name}{m.out ? " — 🚑 out" : e.lookout?.name===m.name ? " — 👁 lookout" : " — backup"}
                  </div>
                ))}
              </div>
            )}
            {e.car!==undefined && (
              <div className="scn-panel">
                <div className="scn-lbl">Your target</div>
                <CarArt car={e.car} h={48} damaged={e.carDmg}/>
                <div style={{fontSize:13}}><b>{CARS[e.car].n}</b></div>
                <div style={{fontSize:11.5, color:"var(--mut)"}}>{fmt$(CARS[e.car].v)}{e.carDmg?" · window smashed":""}{e.bonus?` · collector pays ${Math.round(e.bonus*100)}%`:""}</div>
                {e.carInv && e.stepIdx>0 && (
                  <div style={{marginTop:5}}>
                    <div className="scn-lbl">Installed in the car</div>
                    {e.carInv.length===0 && <div style={{fontSize:11.5, color:"var(--mut)"}}>stock interior</div>}
                    {e.carInv.map(id=>{ const q=CAR_EQUIP.find(x=>x.id===id); return (
                      <div key={id} style={{fontSize:11.5, color:q?.trace?"var(--red)":"inherit"}}>{q?.ic} {q?.n}{q?.trace?" ⚠":""}</div>
                    );})}
                  </div>
                )}
              </div>
            )}
            <div className="scn-panel">
              <div className="scn-lbl">Backpack {e.bagCash>0 && <span className="green">· {fmt$(e.bagCash)} cash</span>}</div>
              {e.loot.length===0 && e.bagCash===0
                ? <div style={{fontSize:11.5, color:"var(--mut)"}}>empty</div>
                : e.loot.map((L,i)=><div key={i} style={{fontSize:11.5}}>{L.ic} {L.n} <span style={{color:"var(--mut)"}}>({fmt$(L.v)})</span></div>)}
            </div>
          </div>
        </div>
        <BattleStrip g={g} onTarget={onTarget}/>
        <div className="scn-actions">
          {!e.over ? (<>
            <div className="scn-step">
              <b>{s.name}</b>{s.optional && <span className="chip" style={{marginLeft:6}}>optional</span>}
              {!e.paid && <span className="chip green" style={{marginLeft:6}}>👀 just casing it — leaving now costs only the ⚡1 you spent; your first move commits ⚡{t.en-1} more</span>}
            </div>
            <div className="scn-btns">
              {s.approaches.map((a,i)=>{
                const missing = a.tool && !E.carried(g, a.tool);
                const p = a.auto ? 1 : SC.sceneOdds(g, a);
                return (
                  <button key={i} className="btn scn-act" disabled={missing} onClick={()=>onAct(i)}
                    title={missing ? `Requires ${ITEMS.find(x=>x.id===a.tool).n}` : ""}>
                    <span className="scn-act-main">{a.ic} {a.label}</span>
                    <span className="scn-act-meta">
                      {a.auto ? <span style={{color:"var(--gold)"}}>always works</span>
                        : <span style={{color:oddsColor(p)}}>{Math.round(p*100)}%</span>}
                      <span> · noise {a.noise}</span>
                      {a.tool && <span className={missing?"red":""}> · {ITEMS.find(x=>x.id===a.tool).ic} {ITEMS.find(x=>x.id===a.tool).n}</span>}
                      {a.dmg && <span> · dmg {a.dmg[0]}–{a.dmg[1]}</span>}
                    </span>
                  </button>
                );
              })}
              {s.optional && <button className="btn scn-act" onClick={onSkip}><span className="scn-act-main">⏭️ Leave it</span><span className="scn-act-meta">skip this step</span></button>}
            </div>
            {e.standoff && (
              <div style={{marginTop:8, borderTop:"2px solid var(--red)", paddingTop:7}}>
                <div className="scn-step"><b style={{color:"var(--red)"}}>🚔 The standoff</b> <span style={{fontSize:10.5, color:"var(--mut)"}}>— or keep working the job above, under fire</span></div>
                <div className="scn-btns">
                  {SC.standoffActions(g).map((sa,i)=>(
                    <button key={i} className={`btn scn-act ${sa.kind==="surrender"?"":"hot"}`} onClick={()=>onStandoff(i)}>
                      <span className="scn-act-main">{sa.ic} {sa.label}</span>
                      <span className="scn-act-meta">{sa.dmg?`dmg ${sa.dmg[0]}–${sa.dmg[1]} · vs wave ${e.standoff.wave}`:sa.blurb||""}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!e.standoff && <button className="btn hot wide" style={{marginTop:8}} onClick={onFlee}>🏃 {e.ambush ? "Run for it" : <>Leave the crime scene <span style={{opacity:.85, fontWeight:400}}>— slip out unseen and you can return tonight</span></>}</button>}
          </>) : (
            <button className="btn pri wide" onClick={onLeave}>
              {e.outcome==="success" ? "✅ Walk away clean" : e.outcome==="fled" ? "Keep your head down" : e.outcome==="raceLost" ? "Eat it and drive home" : "Leave"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════ views ═════════════════════════ */

function Streets({g, onPin, onStreet}){
  const [hov, setHov] = useState(null);
  const jobs = g.missions.map((m,i)=>({m,i})).filter(x=>!x.m.done);
  return (
    <div className="cockpit">
      <div className="mapcol2">
        <div className="mapfit">
          <NeonMap g={g} onPin={onPin} hov={hov}/>
        </div>
        {(g.street||[]).length>0 && (
          <div className="busystrip">
            <span className="bs-label">🚦 BUSY STREET</span>
            {g.street.map(s=>{
              const car = CARS[s.car];
              return (
                <div key={s.id} className="bs-car" onClick={()=>onStreet(s.id)} title={`${car.n} · cond ${s.cond} · ⚡${E.tpl({t:"stealcar"}).en}${s.hasGps?" · maybe tracked":""}`}>
                  <CarArt car={s.car} h={24} damaged={s.cond<70}/>
                  <div className="bs-name">{car.n}</div>
                  <div className="bar" style={{minWidth:0}}>
                    <div className="tr"><div className="fl" style={{width:`${s.cond}%`, background:s.cond>70?"var(--green)":s.cond>45?"#c8a013":"var(--red)"}}/></div>
                  </div>
                </div>
              );
            })}
            <span className="bs-hint">click a car to take it · fresh rack at dawn</span>
          </div>
        )}
      </div>
      <div className="jobpanel">
        <div className="jp-head">
          <b>Tonight's marks</b>
          <span style={{color:"var(--mut)", fontSize:11}}>{jobs.length} on the board</span>
        </div>
        {(g.quests||[]).length>0 && (
          <div className="jp-quests">
            {(g.quests||[]).map(q=>{ const def=E.QUEST_DEFS.find(d=>d.id===q.id); if(!def) return null; return (
              <span key={q.id} className="chip gold">{def.ic} {def.giver}: {def.need?`${q.prog}/${def.need}`:"pending"}</span>
            );})}
          </div>
        )}
        <div className="jp-list">
          {jobs.map(({m,i})=>{
            const t = E.tpl(m);
            const p = E.successChance(g,m);
            const tired = g.en<t.en;
            return (
              <div key={i} className={`jobrow ${tired?"tired":""}`}
                onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(null)}
                onClick={()=>!tired && onPin(i)}>
                <span className="jr-ic">{t.ic}</span>
                <span className="jr-main">
                  <b>{t.n}</b>
                  <small>{m.dist}{m.rival?` · ${m.rival.face} ${m.rival.name}`:""}</small>
                </span>
                <span className="jr-reward">{missionReward(m)}{m.stake>0?` · stake ${fmt$(m.stake)}`:""}</span>
                <span className="jr-en">⚡{t.en}</span>
                <span className="jr-odds" style={{color:oddsColor(p)}}>
                  <i style={{width:`${p*100}%`, background:oddsColor(p)}}/>
                  {Math.round(p*100)}%
                </span>
                {m.resume && <span className="chip green">↩</span>}
              </div>
            );
          })}
          {jobs.length===0 && <div className="empty">The streets are tapped out. End the day.</div>}
        </div>
        <div className="jp-foot">click a job or its map pin to roll up · 🔥 heat varies by job · hover to find it on the map</div>
      </div>
    </div>
  );
}

function CarDetail({g, setG, toast, uid, onClose}){
  const c = g.garage.find(x=>x.uid===uid);
  if(!c) return <div className="empty">Pick a car from the rack.</div>;
  const car = CARS[c.car];
  const act = fn => { const next=clone(g); fn(next); setG(next); };
  const Bar2 = ({label, val, color}) => (
    <div style={{marginBottom:5}}>
      <div className="flexbet" style={{fontSize:11}}><span className="lbl" style={{margin:0}}>{label}</span><b>{val}</b></div>
      <div className="bar" style={{minWidth:0}}><div className="tr"><div className="fl" style={{width:`${val}%`, background:color}}/></div></div>
    </div>
  );
  return (
    <div className="card" style={{position:"sticky", top:0}}>
      <div className="flexbet">
        <b style={{fontSize:14}}>{car.n}</b>
        <span>
          {g.ride===c.uid && <span className="chip cyan">your ride</span>}
          {c.clean && <span className="chip green">clean title</span>}
        </span>
      </div>
      <CarArt car={c.car} h={80} damaged={c.cond<70}/>
      <p className="sub" style={{marginBottom:8}}>Value {fmt$(car.v)} · {FENCES[g.city].n} pays <b>{fmt$(E.fenceQuote(g,c))}</b>{c.heat>0?` · 🔥 ${c.heat} night${c.heat>1?"s":""}`:" · ❄ cold"}
        {c.quirk && (()=>{ const q=QUIRKS.find(x=>x.id===c.quirk); return <span className="chip gold" style={{marginLeft:6}}>{q.ic} {q.n} — {q.blurb}</span>; })()}</p>
      <Bar2 label="Condition" val={c.cond} color="var(--green)"/>
      <Bar2 label="Disguise" val={c.disguise} color="#1d8fa0"/>
      <Bar2 label={`Tuning — ${E.tuneStageName(c)} (max ${E.tuneMax(c)})`} val={c.tune} color="var(--gold)"/>
      <div className="meta" style={{marginTop:6}}>
        {c.inv.length===0 && <span className="chip">stock interior</span>}
        {c.inv.map(id=>{ const q=CAR_EQUIP.find(x=>x.id===id); return (
          <span key={id} className={`chip ${q?.trace?"red":"cyan"}`}>{q?.ic} {q?.n}{q?.trace && !E.carried(g,"jammer") ? " ⚠" : ""}</span>
        );})}
      </div>
      <div className="choices" style={{marginTop:4}}>
        {c.cond<100 && <button className="btn sm" onClick={()=>act(nx=>E.repairCar(nx, c.uid))} disabled={g.cash<(100-c.cond)*E.repairCost(c)}>🔧 Repair — {fmt$((100-c.cond)*E.repairCost(c))}</button>}
        {c.disguise<100 && <button className="btn sm" onClick={()=>act(nx=>E.resprayCar(nx, c.uid))} disabled={g.cash<Math.round((100-c.disguise)*E.resprayRate(c))}>🎨 Respray — {fmt$((100-c.disguise)*E.resprayRate(c))}{CARS[c.car].v>=30000 && c.disguise<50 ? " (needed to sell)" : ""}</button>}
        {E.nextTuneStage(c) ? (
          <button className="btn sm" onClick={()=>act(nx=>E.tuneCar(nx, c.uid))} disabled={g.cash<E.tuneCost(c)}
            title={E.nextTuneStage(c).blurb}>
            ⚙️ {E.nextTuneStage(c).n} — {fmt$(E.tuneCost(c))} <span style={{color:"var(--mut)"}}>(tune → {E.nextTuneStage(c).to})</span>
          </button>
        ) : (c.tune||0)>0 && (c.tune)>=E.tuneMax(c) && E.tuneMax(c)<100 ? (
          <button className="btn sm" disabled>⚙️ Chassis maxed out — it's still a {CARS[c.car].n}</button>
        ) : null}
        {c.inv.length>0 && <button className="btn sm" onClick={()=>act(nx=>E.stripCar(nx, c.uid))}>🔩 Strip equipment</button>}
        <button className="btn sm" onClick={()=>act(nx=>E.setRide(nx, c.uid))}>{g.ride===c.uid ? "🔑 Stop using as ride" : "🔑 Make it your ride"}</button>
        {g.crew.some(m=>!m.out) && (
          <div style={{display:"flex", gap:5, alignItems:"center", flexWrap:"wrap", fontSize:11}}>
            <span style={{color:"var(--mut)"}}>🚗💨 Send it with</span>
            <select id={"disp-crew-"+c.uid} style={{fontSize:11}}>
              {g.crew.map((m,i)=>!m.out && <option key={i} value={i}>{m.name} (drv {m.sk.driving})</option>)}
            </select>
            <span style={{color:"var(--mut)"}}>to</span>
            <select id={"disp-city-"+c.uid} style={{fontSize:11}}>
              {CITIES.map((ct,i)=>i!==g.city && <option key={i} value={i}>{ct.n} ({E.transitDays(g.city,i)}d · {fmt$(120*E.transitDays(g.city,i))})</option>)}
            </select>
            <button className="btn sm" onClick={()=>{
              const ci = +document.getElementById("disp-crew-"+c.uid).value;
              const dest = +document.getElementById("disp-city-"+c.uid).value;
              const next = clone(g);
              const r = E.dispatchCar(next, c.uid, dest, ci);
              if(r!==true){ toast(r==="cash"?"Can't cover the fuel":"Can't send that right now","bad"); return; }
              setG(next); onClose(); toast("On the road — check the day summary","good");
            }}>Go</button>
            {c.heat>0 && <span className="chip red" title="Hot cars risk a traffic stop every night of the trip — cool it first or accept the odds">🔥 risky while hot</span>}
          </div>
        )}
        {CITIES[g.city].perk==="docks" && (
          <button className="btn sm" disabled={!E.canShip(g)}
            onClick={()=>{ const next=clone(g); const p=E.shipCar(next, c.uid); setG(next); onClose(); if(p) toast(`Shipped — ${fmt$(p)} wires in 3 days`,"good"); }}>
            🚢 Ship overseas{!E.canShip(g) ? ` (freighter day ${g.shipDay})` : ""}
          </button>
        )}
        <button className="btn sm" onClick={()=>{ const next=clone(g); const p=E.chopCar(next, c.uid); setG(next); onClose(); if(p) toast(`+${fmt$(p)} in parts`,"good"); }}>🪓 Chop — {fmt$(E.chopValue(c, g))}</button>
        {E.isRecognizable(c)
          ? <button className="btn sm" disabled>🚫 Too recognizable — respray first</button>
          : <button className="btn hot sm" onClick={()=>{ const next=clone(g); const p=E.sellCar(next, c.uid); if(p==="recog"){ toast("Respray it first","bad"); return; } setG(next); onClose(); toast(`+${fmt$(p)}`,"good"); }}>
              💰 Sell — {fmt$(E.fenceQuote(g,c))}{E.fenceQuote(g,c)>E.fenceLeft(g) && " (partial)"}
            </button>}
      </div>
    </div>
  );
}

function Garage({g, setG, toast, onSellLoot}){
  const [sel, setSel] = useState(null);
  const cap = HIDEOUTS[g.hideout].cap;
  const loot = g.loot||[];
  const locals = E.localCars(g);
  const remote = g.garage.filter(c=>(c.city??0)!==g.city);
  const selUid = sel!=null && locals.some(c=>c.uid===sel) ? sel : (locals[0]?.uid ?? null);
  return (
    <div>
      <div className="h2">🚗 Garage — {CITIES[g.city].n} <span style={{color:"var(--mut)", fontSize:14}}>({locals.length}/{cap} slots)</span></div>
      <div className="sub">
        <b>{FENCES[g.city].face} {FENCES[g.city].n}</b> works this town. <i>{FENCES[g.city].blurb}</i>
        <span className="chip gold" style={{marginLeft:8}}>💵 cash today: {fmt$(E.fenceLeft(g))}</span>
        <span className="chip green" style={{marginLeft:4}}>🤝 {(g.fenceRep||[])[g.city]||0} deals{E.repTier(g)>0?` · trusted +${Math.round(E.repTier(g)*100)}% budget`:""}</span>
        <span className="chip cyan" style={{marginLeft:4}}>{CITIES[g.city].perkDesc}</span>
      </div>
      {loot.length>0 && (
        <div className="card" style={{marginBottom:12}}>
          <div className="flexbet">
            <div>
              <b>🎒 Backpack loot</b> <span className="chip">{loot.length} of {E.packSpace(g)+loot.length} pack slots used by loot</span>
              <div style={{fontSize:12, color:"var(--mut)", marginTop:4}}>
                {loot.map((L,i)=><span key={i} style={{marginRight:10}}>{L.ic} {L.n} ({fmt$(L.v)})</span>)}
              </div>
            </div>
            <button className="btn pri" onClick={onSellLoot}>Fence it all — {fmt$(E.lootValue(g))}</button>
          </div>
        </div>
      )}
      {locals.length===0 && <div className="empty">No cars in this city. Steal something beautiful, buy from the dealer — or drive one in.</div>}
      {locals.length>0 && (
        <div style={{display:"grid", gridTemplateColumns:"minmax(230px, 300px) 1fr", gap:12, alignItems:"start"}}>
          <div>
            {locals.map(c=>{
              const car = CARS[c.car];
              const hasGps = c.inv.includes("gps") && !E.carried(g,"jammer");
              return (
                <div key={c.uid} className="card click" onClick={()=>setSel(c.uid)}
                  style={{padding:8, marginBottom:7, borderColor:selUid===c.uid?"var(--navy)":undefined, borderStyle:selUid===c.uid?"solid":undefined}}>
                  <div style={{display:"flex", gap:8, alignItems:"center"}}>
                    <div style={{width:86, flex:"0 0 86px"}}><CarArt car={c.car} h={34} damaged={c.cond<70}/></div>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:12.5, fontWeight:700}}>{car.n} {g.ride===c.uid?"🔑":""}</div>
                      <div style={{fontSize:10.5, color:"var(--mut)"}}>
                        {fmt$(E.fenceQuote(g,c))} · {c.heat>0?`🔥${c.heat}`:"❄"}{hasGps?" · 📡!":""}{c.quirk?` · ${(QUIRKS.find(x=>x.id===c.quirk)||{}).ic}`:""} · cond {c.cond}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <CarDetail g={g} setG={setG} toast={toast} uid={selUid} onClose={()=>setSel(null)}/>
        </div>
      )}
      {(g.transits||[]).length>0 && (<>
        <div className="lbl" style={{marginTop:16}}>On the road</div>
        <div className="grid c3">
          {g.transits.map((t,i)=>(
            <div className="card" key={i} style={{opacity:.85}}>
              <CarArt car={t.car.car} h={40} damaged={t.car.cond<70}/>
              <div style={{fontSize:11.5, fontWeight:700}}>{CARS[t.car.car].n}</div>
              <div style={{fontSize:10.5, color:"var(--mut)"}}>{t.crewFace} {t.crewName} → {CITIES[t.dest].n} · arrives day {t.arriveDay}{t.car.heat>0?" · 🔥 risky":""}</div>
            </div>
          ))}
        </div>
      </>)}
      {remote.length>0 && (<>
        <div className="lbl" style={{marginTop:16}}>Parked in other cities</div>
        <div className="grid c3">
          {remote.map(c=>{
            const car = CARS[c.car];
            return (
              <div className="card" key={c.uid} style={{opacity:.7, padding:8}}>
                <CarArt car={c.car} h={36} damaged={c.cond<70}/>
                <div style={{fontSize:11.5, fontWeight:700}}>{car.n}</div>
                <div className="meta" style={{marginTop:4}}>
                  <span className="chip cyan">📍 {CITIES[c.city??0].n}</span>
                  {c.heat>0 ? <span className="chip red">🔥 {c.heat}</span> : <span className="chip green">❄</span>}
                </div>
              </div>
            );
          })}
        </div>
      </>)}
    </div>
  );
}

function Travel({g, onGo}){
  return (
    <div style={{maxWidth:640}}>
      <div className="h2">✈️ Travel</div>
      <div className="sub">Heat too much? Skip town — every city keeps its own wanted level, and it fades about a star per two days while you're away. Travel takes a night (interest still ticks). Crew travels with you; cars stay parked unless you drive one out.</div>
      {CITIES.map((c,i)=>{
        const here = i===g.city;
        const t = E.travelCosts(g, i);
        return (
          <div className="card" key={i} style={{marginBottom:10, opacity:here?0.65:1}}>
            <div className="flexbet">
              <div>
                <b>📍 {c.n}</b> {here && <span className="chip cyan">you are here</span>}
                <div style={{fontSize:11.5, color:"var(--mut)", marginTop:3}}>
                  Scores pay ×{c.mult} · fence: {FENCES[i].face} {FENCES[i].n} · wanted there: <Stars n={here ? g.wanted : Math.max(0,(g.wantedBy?.[i]||0)-Math.floor(Math.max(0,g.day-(g.cityLeft?.[i]||0))/2))}/>
                  <div style={{marginTop:2}}>{c.perkDesc}</div>
                </div>
              </div>
              {!here && (
                <div style={{display:"flex", gap:6}}>
                  <button className="btn" disabled={g.cash<t.drive || !E.rideCar(g)} title={!E.rideCar(g)?"You need a ride":""}
                    onClick={()=>onGo(i,"drive")}>🚗 Drive — {fmt$(t.drive)}</button>
                  <button className="btn pri" disabled={g.cash<t.fly} onClick={()=>onGo(i,"fly")}>✈️ Fly — {fmt$(t.fly)}</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Crew({g, setG, toast}){
  useEffect(()=>{
    if(g.barOffersDay!==g.day || !g.barOffers.length){
      const next = clone(g); E.rollBarOffers(next); setG(next);
    }
    // eslint-disable-next-line
  },[g.day]);
  const hire = i => {
    const next = clone(g);
    const r = E.hireCrew(next, i);
    if(r==="full"){ toast("Four is a crew. Five is a liability.","bad"); return; }
    if(r==="cash"){ toast("Not enough cash","bad"); return; }
    setG(next); toast("New crew member","good");
  };
  const fire = i => { const next=clone(g); E.fireCrew(next,i); setG(next); };
  return (
    <div>
      <div className="h2">🍺 Crew</div>
      <div className="sub">Crew add half their best matching skill to your jobs and take wages nightly. Max four. Everyone has a trait — and some people are quieter than they should be.</div>
      <div className="lbl">Your people ({g.crew.length}/4)</div>
      {g.crew.length===0 && <div className="empty">Working alone. The Flamingo's regulars are listed below.</div>}
      <div className="grid c2">
        {g.crew.map((m,i)=>(
          <div className="card" key={i}>
            <div className="ttl"><span className="ic">{m.face}</span>{m.name} <span className="chip cyan">lv {m.lvl||1}</span>
              {m.trait && (()=>{ const t=TRAITS.find(x=>x.id===m.trait); const shown = (m.trait==="snitch" && m.revealed) ? {n:"SNITCH", ic:"🐀", blurb:"They talked. You know what to do."} : t;
                return <span className={`chip ${m.revealed&&m.trait==="snitch"?"red":""}`} title={shown.blurb}>{shown.ic} {shown.n}</span>; })()}
              {m.out && <span className="chip red" style={{marginLeft:"auto"}}>{(m.transit||0)>g.day?"🚗💨 driving":m.heldDays>0?"⛓️ held":"🚑 recovering"}</span>}</div>
            <div className="bar hp" style={{minWidth:0, margin:"6px 0"}}>
              <div className="tr"><div className="fl" style={{width:`${m.hp??100}%`}}/></div><b>{m.hp??100}%</b>
            </div>
            <div style={{margin:"4px 0"}}>
              {SKILLS.map(s=>(
                <span key={s} className="chip" style={{marginRight:4, marginBottom:4, display:"inline-block"}}>
                  {SKILL_ICONS[s]} {m.sk[s]}
                </span>
              ))}
            </div>
            <div className="lbl" style={{margin:"6px 0 4px"}}>Their gear (issued from your stash)</div>
            <div style={{display:"flex", gap:5, marginBottom:4}}>
              {["melee","gun","vest"].map(slot=>{
                const it = E.crewEqItem(m, slot);
                const options = Object.keys(g.stash).map(id=>ITEMS.find(x=>x.id===id)).filter(x=>x&&x.slot===slot);
                return (
                  <div key={slot} style={{textAlign:"center"}}>
                    <div onClick={()=>{ if(it){ const nx=clone(g); E.takeCrew(nx,i,slot); setG(nx); } }}
                      title={it?`${it.n} — ${itemStats(it).join(" · ")} · click to take back`:`empty ${slot} slot`}
                      style={{width:44, height:44, border:"2px inset #f3ead0", background:it?"var(--card)":"#cbbb8e",
                              display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, cursor:it?"pointer":"default", borderRadius:4}}>
                      {it ? it.ic : <span style={{fontSize:8, color:"var(--mut2)"}}>{slot}</span>}
                    </div>
                    {options.length>0 && !it && (
                      <select style={{fontSize:9, width:48, marginTop:2}} value=""
                        onChange={ev=>{ if(!ev.target.value) return; const nx=clone(g); E.giveCrew(nx,i,ev.target.value); setG(nx); }}>
                        <option value="">give…</option>
                        {options.map(o=><option key={o.id} value={o.id}>{o.n}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="lbl" style={{margin:"6px 0 4px"}}>Role on jobs</div>
            <div style={{display:"flex", gap:4, flexWrap:"wrap"}}>
              {[["backup","🤝 Backup"],["lookout","👁 Lookout"],["wheelman","🏎️ Wheelman"],["muscle","🥊 Muscle"]].map(([rid,label])=>(
                <button key={rid} className={`btn sm ${m.role===rid?"pri":""}`}
                  onClick={()=>{ const nx=clone(g); E.setCrewRole(nx,i,rid); setG(nx); }}>{label}</button>
              ))}
            </div>
            <div className="flexbet" style={{marginTop:8}}>
              <label style={{fontSize:12, color:"var(--mut)", cursor:"pointer"}}>
                <input type="checkbox" checked={!!m.sideJob}
                  onChange={()=>{ const nx=clone(g); nx.crew[i].sideJob=!nx.crew[i].sideJob; setG(nx); }}/> overnight side jobs
              </label>
              <span style={{color:"var(--mut)", fontSize:12.5}}>{fmt$(m.wage)}/night</span>
              <button className="btn sm hot" onClick={()=>fire(i)}>Cut loose</button>
            </div>
          </div>
        ))}
      </div>
      <div className="lbl">At the Flamingo tonight</div>
      <div className="grid c2">
        {g.barOffers.map((c,i)=>(
          <div className="card" key={i}>
            <div className="ttl"><span className="ic">{c.face}</span>{c.name}
              {c.trait && (()=>{ const t=TRAITS.find(x=>x.id===c.trait); return <span className="chip" title={t.blurb}>{t.ic} {t.n}</span>; })()}</div>
            <div style={{margin:"8px 0"}}>
              {SKILLS.map(s=>(
                <span key={s} className="chip" style={{marginRight:4, marginBottom:4, display:"inline-block"}}>
                  {SKILL_ICONS[s]} {c.sk[s]}
                </span>
              ))}
            </div>
            <div className="flexbet">
              <span style={{color:"var(--mut)", fontSize:12.5}}>{fmt$(c.wage)}/night wage</span>
              <button className="btn pri sm" disabled={g.cash<c.hire} onClick={()=>hire(i)}>Hire — {fmt$(c.hire)}</button>
            </div>
          </div>
        ))}
        {g.barOffers.length===0 && <div className="empty">Nobody worth hiring tonight. Check back tomorrow.</div>}
      </div>
    </div>
  );
}

function Hideout({g, setG, toast}){
  const h = HIDEOUTS[g.hideout], next = HIDEOUTS[g.hideout+1];
  const clinicCost = (100-g.hp)*25;
  return (
    <div>
      <div className="h2">🏚️ {h.n}</div>
      <div className="sub">Your base. Cars cool here; upkeep is due nightly. Better beds, better rest: max energy 11 from the chop-shop tier, 12 at the marina.</div>
      <div className="statgrid" style={{maxWidth:520}}>
        <div className="card"><div className="lb">Car slots</div><div className="vl">{g.garage.length}/{h.cap}</div></div>
        <div className="card"><div className="lb">Nightly upkeep</div><div className="vl">{fmt$(h.costs)}</div></div>
      </div>
      <div className="divider"/>
      {next ? (
        <div className="card" style={{maxWidth:520}}>
          <div className="ttl"><span className="ic">⬆️</span>Upgrade: {next.n}</div>
          <div className="meta" style={{marginTop:8}}>
            <span className="chip cyan">{next.cap} car slots</span>
            <span className="chip">{fmt$(next.costs)}/night upkeep</span>
            <span className="chip gold">{fmt$(next.cost)}</span>
          </div>
          <button className="btn pri wide" disabled={g.cash<next.cost}
            onClick={()=>{ const nx=clone(g); if(E.upgradeHideout(nx)){ setG(nx); toast(`Moved into the ${next.n}`,"good"); } }}>
            {g.cash<next.cost ? `Need ${fmt$(next.cost)}` : `Buy — ${fmt$(next.cost)}`}
          </button>
        </div>
      ) : <div className="empty" style={{maxWidth:520}}>Fully upgraded. The marina at night is something else.</div>}
      <div className="divider"/>
      <div className="card" style={{maxWidth:520}}>
        <div className="ttl"><span className="ic">🏥</span>Back-alley clinic</div>
        <div className="ds">Health: <b style={{color:g.hp>60?"var(--green)":g.hp>30?"var(--gold)":"var(--red)"}}>{g.hp}%</b> — $25 per point, costs ⚡2.</div>
        <button className="btn wide" disabled={g.hp>=100 || g.cash<clinicCost || g.en<2}
          onClick={()=>{ const nx=clone(g); if(E.heal(nx)){ setG(nx); toast("Patched up","good"); } }}>
          {g.hp>=100 ? "In perfect shape" : `Patch up — ${fmt$(clinicCost)}`}
        </button>
      </div>
    </div>
  );
}

function Market({g, setG, toast}){
  const makeoverCost = Math.round((100-g.disg)*40);
  return (
    <div>
      <div className="h2">🛠️ Night Market</div>
      <div className="sub">"No questions asked, no refunds given." Equip purchases in Profile — or arm your crew from the stash in Crew.</div>

      <div className="lbl">Dealer's Store — clean cars, no heat, no questions</div>
      <div className="grid c3" style={{marginBottom:14}}>
        {(g.dealer?.stock||[]).map((o,i)=>{
          const car = CARS[o.car];
          return (
            <div className="card" key={i}>
              <CarArt car={o.car} h={56}/>
              <div className="ttl" style={{fontSize:13}}>{car.n}</div>
              <div className="meta" style={{marginTop:7}}>
                <span className="chip green">clean title</span>
                <span className="chip cyan">tune {o.tune}</span>
              </div>
              <button className="btn pri wide" disabled={g.cash<o.price}
                onClick={()=>{ const nx=clone(g); const r=E.buyDealerCar(nx,i);
                  if(r==="full"){ toast("Garage is full","bad"); return; }
                  if(r){ setG(nx); toast(`Bought the ${car.n}`,"good"); } }}>
                Buy — {fmt$(o.price)}
              </button>
            </div>
          );
        })}
        {(g.dealer?.stock||[]).length===0 && <div className="empty">Sold out. New stock tomorrow.</div>}
      </div>

      <div className="lbl">Services</div>
      <div className="grid c3" style={{marginBottom:14}}>
        <div className="card">
          <div className="ttl"><span className="ic">☕</span>Gas-station espresso</div>
          <div className="ds">+2⚡ on the spot. Three a day before your heart files a complaint — and each one costs triple.</div>
          <div className="meta">
            <span className="chip cyan">⚡ {g.en}/{E.maxEnergy(g)}</span>
            <span className="chip">{(g.coffeeDay===g.day?(g.coffeeN||0):0)}/3 today</span>
          </div>
          <button className="btn pri wide"
            disabled={(g.coffeeDay===g.day&&(g.coffeeN||0)>=3) || g.cash<E.coffeeCost(g) || g.en>=E.maxEnergy(g)}
            onClick={()=>{ const nx=clone(g); const r=E.drinkCoffee(nx); if(r===true){ setG(nx); SFX.cash(); toast("+2⚡","good"); } }}>
            {g.en>=E.maxEnergy(g) ? "Already wired" : (g.coffeeDay===g.day&&(g.coffeeN||0)>=3) ? "Heart says no" : `Double shot — ${fmt$(E.coffeeCost(g))}`}
          </button>
        </div>
        <div className="card">
          <div className="ttl"><span className="ic">💇</span>Makeover &amp; papers</div>
          <div className="ds">New haircut, new ID, new walk. Resets your Disguise to 100 — the police file photo goes stale.</div>
          <div className="meta"><span className="chip cyan">disguise {g.disg} → 100</span></div>
          <button className="btn pri wide" disabled={g.disg>=100 || g.cash<makeoverCost}
            onClick={()=>{ const nx=clone(g); if(E.makeover(nx)){ setG(nx); toast("Fresh face","good"); } }}>
            {g.disg>=100 ? "Nobody knows your face" : `Makeover — ${fmt$(makeoverCost)}`}
          </button>
        </div>
      </div>

      {CITIES[g.city].perk==="casino" && (
        <div className="grid c3" style={{marginBottom:14}}>
          <div className="card">
            <div className="ttl"><span className="ic">🎰</span>The Casino</div>
            <div className="ds">One wager a night. 47% to double it — the house always keeps its three points.</div>
            <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
              {[1000,5000,25000].map(amt=>(
                <button key={amt} className="btn sm" disabled={!E.canGamble(g)||g.cash<amt}
                  onClick={()=>{ const nx=clone(g); const r=E.gamble(nx,amt); setG(nx); if(r) toast(r.win?`🎰 DOUBLE! +${fmt$(amt)}`:`🎰 Gone. −${fmt$(amt)}`, r.win?"good":"bad"); }}>
                  {fmt$(amt)}
                </button>
              ))}
              <button className="btn sm hot" disabled={!E.canGamble(g)||g.cash<100}
                onClick={()=>{ const nx=clone(g); const r=E.gamble(nx, Math.floor(g.cash/2)); setG(nx); if(r) toast(r.win?`🎰 DOUBLE! +${fmt$(r.amt)}`:`🎰 Gone. −${fmt$(r.amt)}`, r.win?"good":"bad"); }}>
                Half your roll
              </button>
            </div>
            {!E.canGamble(g) && g.gambledDay===g.day && <div style={{fontSize:11, color:"var(--mut)", marginTop:6}}>The pit boss smiles: "Tomorrow, friend."</div>}
          </div>
        </div>
      )}
      <div className="lbl">Gear &amp; tools — weapons and vests can also be issued to crew. Shelves turn over every few days; some gear only shows up in certain cities.</div>
      <div className="grid c3">
        {ITEMS.filter(it=>E.inStock(g, it.id) && !(g.mutators?.pacifist && (it.slot==="gun"||it.slot==="melee"))).map(it=>{
          const onYou = E.carried(g, it.id);
          const stashed = g.stash[it.id]||0;
          return (
            <div className="card" key={it.id}>
              <div className="ttl"><span className="ic">{it.ic}</span>{it.n}</div>
              <div className="ds">{it.blurb}</div>
              <div style={{fontSize:11, color:"var(--mut)", marginBottom:8, lineHeight:1.5}}>
                {itemStats(it).map((s,k)=><div key={k}>{s}</div>)}
              </div>
              <div className="meta">
                <span className="chip gold">{fmt$(it.cost)}</span>
                {onYou && <span className="chip green">on you</span>}
                {stashed>0 && <span className="chip">stash ×{stashed}</span>}
              </div>
              <button className="btn pri wide" disabled={g.cash<it.cost}
                onClick={()=>{ const nx=clone(g); if(E.buyItem(nx,it.id)){ setG(nx); SFX.cash(); toast(`Bought ${it.n}`,"good"); } }}>
                Buy — {fmt$(it.cost)}
              </button>
            </div>
          );
        })}
      </div>
      {ITEMS.some(it=>!E.inStock(g,it.id)) && (
        <div className="empty" style={{marginTop:10}}>
          Not on the shelves here: {ITEMS.filter(it=>!E.inStock(g,it.id)).map(it=>`${it.ic} ${it.n}`).join(", ")} — try another city, or come back in a few days.
        </div>
      )}
    </div>
  );
}

function Shark({g, onPay, onWash}){
  const d = DIFFS[g.diff];
  const pct = Math.max(0, Math.min(100, 100 - (g.debt/g.debtStart)*100));
  const danger = (g.debt/(g.debtStart*3.5))*100;
  return (
    <div style={{maxWidth:560}}>
      <div className="h2">🦈 The Loan Shark</div>
      <div className="sub">"The Syndicate says hello. Interest is {(d.interest*100).toFixed(1)}% nightly. Clear it and you walk free — let it triple and you swim."</div>
      <div className="card">
        <div className="flexbet"><span style={{color:"var(--mut)"}}>Outstanding debt</span><b style={{fontSize:22, color:"var(--red)"}} className="tnum">{fmt$(g.debt)}</b></div>
        <div style={{margin:"10px 0 4px", fontSize:11, color:"var(--mut2)", textTransform:"uppercase", letterSpacing:1}}>Paid off</div>
        <div className="bar" style={{minWidth:0}}>
          <div className="tr"><div className="fl" style={{width:`${pct}%`, background:"linear-gradient(90deg,#15803d,var(--green))"}}/></div>
          <b>{Math.round(pct)}%</b>
        </div>
        <div style={{margin:"10px 0 4px", fontSize:11, color:"var(--mut2)", textTransform:"uppercase", letterSpacing:1}}>Danger line (debt ×3.5 = the bay)</div>
        <div className="bar" style={{minWidth:0}}>
          <div className="tr"><div className="fl" style={{width:`${danger}%`, background:"linear-gradient(90deg,#9f1239,var(--red))"}}/></div>
          <b>{Math.round(danger)}%</b>
        </div>
      </div>
      <div className="divider"/>
      {(g.dirty||0)>0 && (
        <div className="card" style={{marginBottom:12}}>
          <div className="ttl"><span className="ic">🧺</span>Manny's cousin (laundry)</div>
          <div className="ds">The Syndicate only takes <b>clean</b> money. The street wash takes {Math.round(LAUNDER_STREET_FEE*100)}% — your own businesses take 12%.</div>
          <div className="meta"><span className="chip" style={{color:"#7a4a1d"}}>🩸 dirty: {fmt$(g.dirty)}</span></div>
          <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
            {[5000,25000].map(amt=>(
              <button key={amt} className="btn sm" disabled={(g.dirty||0)<amt} onClick={()=>onWash(amt)}>
                Wash {fmt$(amt)}
              </button>
            ))}
            <button className="btn sm pri" disabled={(g.dirty||0)<100} onClick={()=>onWash(g.dirty)}>
              Wash it all — get {fmt$(Math.round((g.dirty||0)*(1-LAUNDER_STREET_FEE)))}
            </button>
          </div>
        </div>
      )}
      <div className="grid c2">
        {[1000,10000,100000].map(n=>(
          <button key={n} className="btn wide" disabled={g.cash<n||g.debt<=0} onClick={()=>onPay(n)}>Pay {fmt$(n)}</button>
        ))}
        <button className="btn hot wide" disabled={g.cash<1||g.debt<=0} onClick={()=>onPay(g.cash)}>
          Pay all clean cash — {fmt$(Math.min(g.cash,g.debt))}
        </button>
        <div className="empty" style={{gridColumn:"1 / -1", padding:8}}>The Syndicate takes <b>clean money only</b>. Dirty cash needs washing — street laundry above (18%), or your own businesses overnight (12%).</div>
      </div>
      <p className="sub" style={{marginTop:12}}>Lifetime paid: {fmt$(g.stats.paid)}</p>
    </div>
  );
}

function Profile({g, setG}){
  const raise = s => { const nx=clone(g); if(E.raiseSkill(nx,s)) setG(nx); };
  return (
    <div style={{maxWidth:640}}>
      <div style={{display:"flex", gap:14, alignItems:"center", marginBottom:6}}>
        <Avatar a={g.avatar} size={84}/>
        <div className="h2" style={{marginBottom:0}}>{g.name} <span style={{fontSize:13, color:"var(--mut)"}}>— level {g.lvl} {CLASSES.find(c=>c.id===g.cls)?.name}</span></div>
      </div>
      <div className="sub">XP {g.xp}/{g.xpNext} · {DIFFS[g.diff].name} difficulty · Strike {g.arrests}/4 · Disguise {g.disg}/100 · Skills also grow with successful use</div>
      <div className="card">
        <div className="flexbet" style={{marginBottom:6}}>
          <b>Skills</b>
          <span style={{fontSize:11, color:"var(--mut)"}}>🎯 = training ground (+1, ⚡3, {g.trainedDay===g.day?"already trained today":"once per day"})</span>
          {g.skillPts>0 && <span className="chip pink">{g.skillPts} point{g.skillPts>1?"s":""} to spend</span>}
        </div>
        {SKILLS.map(s=>{
          const base=g.skills[s], eff=E.skillOf(g,s);
          return (
            <div className="skrow" key={s} style={{gridTemplateColumns:"26px 90px 1fr 56px 34px 92px"}}>
              <span>{SKILL_ICONS[s]}</span>
              <span style={{fontSize:12.5, color:"var(--mut)"}}>{cap(s)}</span>
              <div className="tr"><div className="fl" style={{width:`${(base/8)*100}%`}}/></div>
              <b className="tnum">{base}{eff>base && <span className="bn"> +{eff-base}</span>}</b>
              <button className="btn sm" disabled={g.skillPts<=0||base>=8} onClick={()=>raise(s)}>+</button>
              <button className="btn sm" disabled={base>=8||g.trainedDay===g.day||g.cash<E.trainCost(g,s)||g.en<3}
                title="Training ground: +1 skill, ⚡3, once per day"
                onClick={()=>{ const nx=clone(g); const r=E.trainSkill(nx,s); if(r===true){ setG(nx); toast(`Trained ${cap(s)}`,"good"); } }}>
                🎯 {fmt$(E.trainCost(g,s))}
              </button>
            </div>
          );
        })}
      </div>
      <div className="divider"/>
      <div className="lbl">Equipment — gear only works from a slot; the backpack carries tools &amp; loot</div>
      <EquipGrid g={g} setG={setG}/>
      <div className="lbl">Hide-out stash — click to take with you</div>
      <div className="meta">
        {Object.keys(g.stash).length===0 && <span className="chip">nothing stashed</span>}
        {Object.entries(g.stash).map(([id,n])=>{ const it=ITEMS.find(i=>i.id===id); if(!it) return null; return (
          <span key={id} className="chip" style={{cursor:"pointer"}} title={itemStats(it).join(" · ")}
            onClick={()=>{ const nx=clone(g); if(!E.equipItem(nx,id)) return; setG(nx); }}>
            {it.ic} {it.n}{n>1?` ×${n}`:""} ⬆
          </span>
        );})}
      </div>
      <div className="lbl">Open jobs from people who know people</div>
      {(g.quests||[]).length===0 && <div className="empty" style={{padding:10}}>No standing requests. Word arrives by phone at night — stay reachable.</div>}
      {(g.quests||[]).map(q=>{
        const def = E.QUEST_DEFS.find(d=>d.id===q.id);
        if(!def) return null;
        return (
          <div className="rowline" key={q.id}>
            <span>{def.ic} <b>{def.giver}</b><br/><small style={{color:"var(--mut)"}}>{def.what}</small></span>
            <b>{def.need ? `${q.prog}/${def.need}` : "…"}</b>
          </div>
        );
      })}
      <div className="lbl">Career</div>
      <div className="statgrid">
        <div className="card"><div className="lb">Jobs pulled</div><div className="vl">{g.stats.jobs} <span style={{fontSize:12, color:"var(--mut)"}}>({g.stats.jobs?Math.round(g.stats.jobsOk/g.stats.jobs*100):0}% clean)</span></div></div>
        <div className="card"><div className="lb">Cars stolen</div><div className="vl">{g.stats.carsStolen}</div></div>
        <div className="card"><div className="lb">Total earned</div><div className="vl tnum">{fmt$(g.stats.earned)}</div></div>
        <div className="card"><div className="lb">Races won</div><div className="vl">{g.stats.racesWon}</div></div>
      </div>
    </div>
  );
}

function LastJob({g, setG, toast, onStart}){
  const checks = E.finaleChecks(g);
  const ready = checks.every(c=>c.ok);
  return (
    <div style={{maxWidth:660}}>
      <div className="h2">🏆 The Last Job</div>
      <div className="sub">Prince's offer: bring him the '67 Concours Phantom out of the exhibition hall in Los Angeles, and the Syndicate forgets your name — no more tribute, ever. One night. The hardest doors in the country. Whatever else you crack in there is yours.</div>
      <div className="card" style={{marginBottom:12}}>
        <CarArt car={11} h={86}/>
        <div className="flexbet">
          <b>'67 Concours Phantom</b>
          <span className="chip gold">{fmt$(500000)} · one of one</span>
        </div>
      </div>
      <div className="card">
        <b>Preparation</b>
        <div style={{marginTop:8}}>
          {checks.map((c,i)=>(
            <div key={i} className="rowline" style={{marginBottom:5}}>
              <span style={{color:c.ok?"var(--green)":"var(--mut)"}}>{c.ok?"✓":"✗"} {c.label}</span>
              {!c.ok && c.label.includes("Case the venue") && (
                <button className="btn sm" disabled={g.cash<50000}
                  onClick={()=>{ const nx=clone(g); if(E.caseVenue(nx)){ setG(nx); toast("Venue cased — you know every camera by name","good"); } }}>
                  Case it — {fmt$(50000)}
                </button>
              )}
            </div>
          ))}
        </div>
        <button className="btn hot wide" style={{marginTop:10, padding:"12px"}} disabled={!ready} onClick={onStart}>
          {ready ? "🌙 TONIGHT IS THE NIGHT — hit the Concours" : "Finish your preparation first"}
        </button>
        <div style={{fontSize:11, color:"var(--mut)", marginTop:8}}>
          This is the hardest scene in the game: eight stages, a security chief who fights back, and police pressure that climbs 25% faster. Blow it and Prince won't speak to you for ten days. Win, and you're done forever — the 👑 LEGEND ending.
        </div>
      </div>
    </div>
  );
}

function Empire({g, setG, toast}){
  const owned = g.props||[];
  return (
    <div style={{maxWidth:860}}>
      <div className="h2">🏘️ Empire</div>
      <div className="sub">Legit businesses take <b>clean money</b> to buy, pay clean income, and wash your dirty cash at 12% — far better than the street's 25%. Gangs hit unprotected businesses when their heat is high.</div>
      <div className="lbl">Your collection ({(g.collection||[]).filter(Boolean).length}/12 models owned all-time)</div>
      <div style={{display:"flex", gap:4, flexWrap:"wrap", marginBottom:14}}>
        {CARS.map((c,i)=>(
          <div key={i} title={c.n} style={{width:74, opacity:(g.collection||[])[i]?1:0.22, filter:(g.collection||[])[i]?"none":"grayscale(1)"}}>
            <CarArt car={i} h={28}/>
          </div>
        ))}
      </div>
      <div className="lbl">Properties — buy in their own city, with clean money</div>
      <div className="grid c2">
        {PROPERTIES.map(p=>{
          const has = owned.includes(p.id);
          const here = p.city===g.city;
          const hit = (g.propsHit?.[p.id]||0) > g.day;
          return (
            <div className="card" key={p.id} style={{opacity:here||has?1:0.6}}>
              <div className="ttl"><span className="ic">{p.ic}</span>{p.n}
                <span style={{marginLeft:"auto", fontSize:10, color:"var(--mut2)"}}>{CITIES[p.city].n}</span></div>
              <div className="ds">{p.blurb}</div>
              <div className="meta">
                {p.income>0 && <span className="chip green">+{fmt$(p.income)}/day clean</span>}
                {p.launder>0 && <span className="chip cyan">washes {fmt$(p.launder)}/day</span>}
                <span className="chip">{fmt$(p.upkeep)}/day upkeep</span>
                {hit && <span className="chip red">🔥 closed until day {g.propsHit[p.id]}</span>}
              </div>
              {has
                ? <button className="btn wide" disabled>✓ Yours</button>
                : <button className="btn pri wide" disabled={!here || g.cash<p.cost}
                    onClick={()=>{ const nx=clone(g); const r=E.buyProperty(nx, p.id);
                      if(r==="away"){ toast("You buy property in person — travel there","bad"); return; }
                      if(r==="clean"){ toast("Real estate wants CLEAN money — visit the laundry","bad"); return; }
                      if(r){ setG(nx); SFX.cash(); toast(`Bought ${p.n}`,"good"); } }}>
                    {here ? `Buy — ${fmt$(p.cost)} clean` : `In ${CITIES[p.city].n}`}
                  </button>}
            </div>
          );
        })}
      </div>
      {owned.includes("carlot") && (
        <div className="card" style={{marginTop:12}}>
          <div className="ttl"><span className="ic">🚙</span>Sunset Used Cars — retail desk</div>
          <div className="ds">{E.lotBusy(g) ? `The lot is mid-sale — free on day ${g.lotUntil}.` : g.city!==3 ? "Be in Los Angeles to consign a car." : "Consign a cold car (cond 60+): 115% retail, paid clean over 3 days."}</div>
          {g.city===3 && !E.lotBusy(g) && (
            <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
              {E.localCars(g).filter(c=>c.heat===0 && c.cond>=60).map(c=>(
                <button key={c.uid} className="btn sm" onClick={()=>{ const nx=clone(g); const p=E.sellRetail(nx, c.uid); if(p){ setG(nx); toast(`Consigned — ${fmt$(p)} clean in 3 days`,"good"); } }}>
                  {CARS[c.car].n}
                </button>
              ))}
              {E.localCars(g).filter(c=>c.heat===0 && c.cond>=60).length===0 && <span className="chip">no eligible cars here (cold + cond 60+)</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═════════ equipment slot grid (original-style) ═════════ */
function Slot({it, label, onClick, dim}){
  return (
    <div onClick={it&&onClick?onClick:undefined} title={it?`${it.n} — ${itemStats(it).join(" · ")}${onClick?" · click to stash":""}`:label}
      style={{width:54, height:54, border:"2px inset #f3ead0", background:it?"var(--card)":"#cbbb8e",
              display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
              cursor:it&&onClick?"pointer":"default", borderRadius:4, opacity:dim?0.6:1}}>
      {it ? <>
        <span style={{fontSize:20}}>{it.ic}</span>
        <span style={{fontSize:8, color:"var(--mut)", textAlign:"center", lineHeight:1}}>{it.n.split(" ")[0]}</span>
      </> : <span style={{fontSize:8.5, color:"var(--mut2)", textAlign:"center", padding:2}}>{label}</span>}
    </div>
  );
}
function EquipGrid({g, setG}){
  const off = id => { const nx=clone(g); if(E.unequipItem(nx,id)) setG(nx); };
  const it = id => id ? ITEMS.find(x=>x.id===id) : null;
  return (
    <div style={{display:"flex", gap:18, flexWrap:"wrap", alignItems:"flex-start"}}>
      <div>
        <div className="lbl" style={{marginTop:0}}>Combat</div>
        <div style={{display:"flex", gap:5}}>
          <Slot it={it(g.eq.melee)} label="Melee" onClick={()=>off(g.eq.melee)}/>
          <Slot it={it(g.eq.gun)} label="Gun" onClick={()=>off(g.eq.gun)}/>
          <Slot it={it(g.eq.vest)} label="Vest" onClick={()=>off(g.eq.vest)}/>
        </div>
        <div className="lbl">Quick tools (active bonuses)</div>
        <div style={{display:"flex", gap:5}}>
          <Slot it={it(g.eq.tools[0])} label="Tool 1" onClick={()=>off(g.eq.tools[0])}/>
          <Slot it={it(g.eq.tools[1])} label="Tool 2" onClick={()=>off(g.eq.tools[1])}/>
          <Slot it={it(g.eq.tools[2])} label="Tool 3" onClick={()=>off(g.eq.tools[2])}/>
        </div>
      </div>
      <div>
        <div className="lbl" style={{marginTop:0}}>Backpack ({g.eq.pack.length+(g.loot||[]).length}/9 — shared with loot)</div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(3, 54px)", gap:5}}>
          {Array.from({length:9},(_,k)=>{
            const packIt = it(g.eq.pack[k]);
            const lootIt = !packIt && (g.loot||[])[k - g.eq.pack.length];
            if(packIt) return <Slot key={k} it={packIt} onClick={()=>off(g.eq.pack[k])}/>;
            if(lootIt) return <Slot key={k} it={{ic:lootIt.ic, n:lootIt.n}} label="" dim/>;
            return <Slot key={k} label="—"/>;
          })}
        </div>
        <div style={{fontSize:10, color:"var(--mut2)", marginTop:4}}>Greyed = loot (sell at the fence). Click gear to stash it.</div>
      </div>
    </div>
  );
}

/* ═════════════════════════ character creation ═════════════════════════ */
function Create({onStart, onLoad, slotInfo}){
  const [name, setName] = useState("Snake");
  const [cls, setCls] = useState(0);
  const [diff, setDiff] = useState(1);
  const [pic, setPic] = useState(0);
  const [muts, setMuts] = useState({});
  const [perk, setPerk] = useState(null);
  const hasRecords = loadRecords().length>0;
  const hasSaves = [0,1,2,3].some(n=>slotInfo(n));
  const c = CLASSES[cls];
  const cyc = n => setPic(p=>((p+n)%28+28)%28);
  return (
    <div className="create">
      <div className="hero">
        <h1>CAR THEFT 7</h1>
        <p>REDUX · You owe the Syndicate a fortune. Pay it back — or end up in the bay.</p>
      </div>
      <div className="cgrid">
        <div className="card">
          <div className="lbl" style={{marginTop:0}}>Street name</div>
          <input className="inp" maxLength={16} value={name} onChange={e=>setName(e.target.value)}/>
          <div className="lbl">Picture: {pic+1} (out of 28)</div>
          <div style={{display:"flex", alignItems:"center", gap:10}}>
            <Avatar a={avatarPreset(pic)} size={92}/>
            <div style={{display:"flex", gap:5}}>
              <button className="btn sm" onClick={()=>cyc(-7)}>≪</button>
              <button className="btn sm" onClick={()=>cyc(-1)}>‹</button>
              <button className="btn sm" onClick={()=>cyc(1)}>›</button>
              <button className="btn sm" onClick={()=>cyc(7)}>≫</button>
            </div>
          </div>
          <div className="lbl">Difficulty</div>
          <div className="diffrow">
            {DIFFS.map((d,i)=>(
              <button key={i} className={`diffbtn ${i===diff?"sel":""}`} onClick={()=>setDiff(i)}>{d.name}</button>
            ))}
          </div>
          <p style={{color:"var(--mut)", fontSize:12.5}}>{DIFFS[diff].desc}</p>
          <div className="lbl">Run mutators (optional)</div>
          {MUTATORS.map(m=>(
            <label key={m.id} style={{display:"block", fontSize:12, marginBottom:4, cursor:"pointer"}} title={m.blurb}>
              <input type="checkbox" checked={!!muts[m.id]} onChange={()=>setMuts({...muts, [m.id]:!muts[m.id]})}/> {m.ic} <b>{m.n}</b> — <span style={{color:"var(--mut)"}}>{m.blurb}</span>
            </label>
          ))}
          {hasRecords && (<>
            <div className="lbl">Prestige perk (you've earned an ending)</div>
            {PRESTIGE_PERKS.map(p=>(
              <label key={p.id} style={{display:"block", fontSize:12, marginBottom:4, cursor:"pointer"}} title={p.blurb}>
                <input type="radio" name="perk" checked={perk===p.id} onChange={()=>setPerk(p.id)}/> {p.ic} <b>{p.n}</b> — <span style={{color:"var(--mut)"}}>{p.blurb}</span>
              </label>
            ))}
          </>)}
        </div>
        <div className="card">
          <div className="lbl" style={{marginTop:0}}>Background</div>
          {CLASSES.map((x,i)=>(
            <div key={x.id} className={`classcard ${i===cls?"sel":""}`} onClick={()=>setCls(i)}>
              <span className="face">{x.face}</span>
              <span><b>{x.name}</b><small>{x.desc}</small></span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="lbl" style={{marginTop:0}}>Starting skills</div>
          <SkillRows g={{skills:c.sk, eq:{melee:null,gun:null,vest:null,tools:[],pack:[]}, garage:[], ride:null}} showBonus={false}/>
          <p style={{color:"var(--mut)", fontSize:12, margin:"10px 0 14px"}}>
            Every job is a d20 + skill roll. The UI always shows your real odds.
          </p>
          <button className="endday" style={{width:"100%"}} onClick={()=>onStart(name.trim()||"Snake", c.id, diff, avatarPreset(pic), muts, perk)}>
            ▶ Hit the streets
          </button>
          {hasSaves && (
            <div style={{marginTop:12}}>
              <div className="lbl">Or continue</div>
              {[0,1,2,3].map(n=>{
                const info = slotInfo(n);
                if(!info) return null;
                return (
                  <div className="rowline" key={n}>
                    <small style={{color:"var(--mut)"}}>{n===0?"Autosave":"Slot "+n} — {info}</small>
                    <button className="btn sm" onClick={()=>onLoad(n)}>Load</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
