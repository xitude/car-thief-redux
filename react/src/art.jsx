// ── SVG art: cars (side view) and character avatars ─────────────────
import React from "react";
import { CARS } from "./data.js";

/* ════════ CARS ════════
   viewBox 0 0 200 80 · front faces right · ground at y=66 */
const BODY = {
  hatch:  "M22,58 L22,46 Q24,40 34,38 L48,26 Q52,23 64,22 L98,22 Q108,23 112,27 L124,38 L164,42 Q176,44 178,50 L178,58 Z",
  sedan:  "M16,58 L16,48 Q18,42 30,40 L46,27 Q50,24 64,23 L104,23 Q116,24 122,28 L134,39 L168,42 Q182,44 184,52 L184,58 Z",
  pickup: "M16,58 L16,34 L20,32 L92,32 L96,38 L98,24 Q99,22 110,22 L132,23 Q140,24 144,29 L152,40 L176,43 Q184,45 185,52 L185,58 Z M20,36 L88,36 L88,40 L20,40 Z",
  coupe:  "M14,58 L14,49 Q16,43 30,41 L52,28 Q58,24 76,24 L108,25 Q120,26 128,31 L140,41 L172,44 Q184,46 186,53 L186,58 Z",
  luxury: "M10,58 L10,48 Q12,42 26,40 L42,28 Q47,25 62,24 L112,24 Q126,25 132,29 L144,40 L176,43 Q190,45 191,53 L191,58 Z",
  gt:     "M12,58 L12,50 Q13,44 28,42 L50,30 Q58,26 78,26 L112,27 Q124,28 132,33 L146,43 L176,46 Q188,48 189,54 L189,58 Z",
  sport:  "M10,58 L10,51 Q11,45 26,43 L52,32 Q62,28 84,28 L116,29 Q128,30 136,35 L150,45 L180,47 Q190,49 191,55 L191,58 Z",
  super:  "M8,58 L8,52 Q9,46 24,44 L54,33 Q66,29 90,29 L122,30 Q134,31 142,37 L156,46 L184,48 Q192,50 193,55 L193,58 Z",
  hyper:  "M8,58 L8,52 Q9,47 22,45 L52,34 Q66,30 92,30 L126,31 Q138,32 146,38 L160,47 L186,49 Q193,51 194,56 L194,58 Z",
  truck:  "M14,58 L14,30 L18,28 L66,28 L70,34 L74,20 Q75,18 86,18 L108,19 Q116,20 120,25 L128,38 L150,42 L150,58 Z M18,32 L62,32 L62,38 L18,38 Z",
};
const GLASS = {
  hatch:  "M52,27 L64,25 L94,25 L104,28 L106,36 L54,36 Z",
  sedan:  "M50,28 L64,26 L102,26 L116,29 L126,38 L52,38 Z",
  pickup: "M101,25 L108,24 L128,25 L138,30 L142,38 L102,38 Z",
  coupe:  "M56,29 L76,27 L106,28 L122,32 L132,40 L58,40 Z",
  luxury: "M46,29 L62,27 L110,27 L126,30 L138,40 L48,40 Z",
  gt:     "M54,31 L78,29 L110,30 L126,34 L140,42 L56,42 Z",
  sport:  "M56,33 L84,31 L114,32 L130,37 L146,44 L58,44 Z",
  super:  "M58,34 L90,32 L120,33 L136,38 L152,45 L60,45 Z",
  hyper:  "M56,35 L92,33 L124,34 L140,39 L156,46 L58,46 Z",
  truck:  "M77,22 L86,21 L106,22 L114,26 L118,36 L78,36 Z",
};
// extra flourishes per body
const EXTRA = {
  gt:    <rect x="20" y="48" width="150" height="3" fill="#ffffff44"/>,
  sport: <path d="M8,50 L24,46 L24,50 Z" fill="#00000055"/>,
  super: <rect x="6" y="44" width="20" height="3" rx="1.5" fill="#222"/>,
  hyper: <g><rect x="4" y="42" width="22" height="3" rx="1.5" fill="#222"/><rect x="22" y="52" width="160" height="2" fill="#ffffff33"/></g>,
  truck: <g><path d="M148,42 L182,18 L186,21 L154,46 Z" fill="#7a6a4a"/><circle cx="184" cy="20" r="3" fill="#444"/><path d="M184,20 L184,34" stroke="#444" strokeWidth="2"/><path d="M179,34 L189,34 L184,42 Z" fill="#666"/></g>,
};

export function CarArt({car, h=70, damaged=false}){
  const c = typeof car==="number" ? CARS[car] : car;
  const bt = c.bt||"sedan";
  return (
    <svg viewBox="0 0 200 80" style={{width:"100%", height:h, display:"block"}} xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="100" cy="68" rx="86" ry="5" fill="#00000022"/>
      <path d={BODY[bt]} fill={c.col} stroke="#00000055" strokeWidth="1.5"/>
      <path d={GLASS[bt]} fill={damaged?"#7a8aa044":"#bfd6e4"} stroke="#00000033" strokeWidth="1"/>
      {damaged && <path d="M70,28 L82,36 L74,33 L86,42" stroke="#fff" strokeWidth="1.4" fill="none"/>}
      {EXTRA[bt]||null}
      {/* wheels */}
      <circle cx={bt==="truck"?38:48} cy="60" r="10" fill="#1c1c20" stroke="#000" strokeWidth="1"/>
      <circle cx={bt==="truck"?38:48} cy="60" r="4.5" fill="#9a9aa4"/>
      <circle cx={bt==="truck"?118:152} cy="60" r="10" fill="#1c1c20" stroke="#000" strokeWidth="1"/>
      <circle cx={bt==="truck"?118:152} cy="60" r="4.5" fill="#9a9aa4"/>
      {/* lights */}
      <rect x={bt==="truck"?144:180} y="46" width="6" height="4" rx="1" fill="#ffd57a"/>
      <rect x={bt==="truck"?15:10} y="47" width="5" height="4" rx="1" fill="#d96a5a"/>
    </svg>
  );
}

/* ════════ AVATARS ════════ */
export const AV = {
  skins: ["#e8b88a","#d49a6a","#b97f55","#8a5a3a","#5f3d28"],
  hairCols: ["#1d1a16","#4a3220","#8a6230","#b8b8bc","#7a2020"],
  jackets: ["#2e3a4e","#5a2424","#2a4a2e","#3a3a3e","#6a4a1d","#4a2a5a"],
  hairs: ["buzz","part","curly","long","bald","spike"],
  accs: ["none","shades","cap","hoodie"],
};
// 28 fixed pictures, like the original's "Picture: N (out of 28)"
export function avatarPreset(i){
  i = ((i%28)+28)%28;
  return {
    skin: i % AV.skins.length,
    hair: (i*3+1) % AV.hairs.length,
    hc:   (i*2+i%3) % AV.hairCols.length,
    acc:  (i>=21) ? 3 : (i%7===3 ? 1 : i%7===5 ? 2 : 0),
    jc:   (i*5+2) % AV.jackets.length,
  };
}

export function Avatar({a, size=72}){
  a = a || avatarPreset(0);
  const skin = AV.skins[a.skin%AV.skins.length];
  const hc = AV.hairCols[a.hc%AV.hairCols.length];
  const jc = AV.jackets[a.jc%AV.jackets.length];
  const hair = AV.hairs[a.hair%AV.hairs.length];
  const acc = AV.accs[a.acc%AV.accs.length];
  const hoodie = acc==="hoodie";
  return (
    <svg viewBox="0 0 100 100" style={{width:size, height:size, display:"block"}} xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="48" fill="#cdbd92" stroke="#8a7850" strokeWidth="2"/>
      {/* shoulders / jacket */}
      <path d="M14,100 Q16,72 36,68 L64,68 Q84,72 86,100 Z" fill={jc}/>
      <path d="M44,68 L56,68 L54,84 L46,84 Z" fill="#d8d2c0"/>
      <path d="M36,68 L44,68 L42,88 L30,76 Z" fill={jc} stroke="#00000022"/>
      <path d="M64,68 L56,68 L58,88 L70,76 Z" fill={jc} stroke="#00000022"/>
      {/* neck + head */}
      <rect x="43" y="56" width="14" height="14" rx="4" fill={skin}/>
      <ellipse cx="50" cy="42" rx="17" ry="19" fill={skin}/>
      {/* ears */}
      <circle cx="33.5" cy="44" r="3.4" fill={skin}/>
      <circle cx="66.5" cy="44" r="3.4" fill={skin}/>
      {/* hair */}
      {hair==="buzz" && <path d="M33,38 Q34,22 50,21 Q66,22 67,38 Q60,30 50,29 Q40,30 33,38 Z" fill={hc}/>}
      {hair==="part" && <path d="M33,40 Q32,22 50,20 Q68,22 67,40 L64,32 Q56,26 44,28 Q36,30 35,36 Z" fill={hc}/>}
      {hair==="curly" && <g fill={hc}><circle cx="38" cy="28" r="7"/><circle cx="50" cy="24" r="8"/><circle cx="62" cy="28" r="7"/><circle cx="33" cy="36" r="5"/><circle cx="67" cy="36" r="5"/></g>}
      {hair==="long" && <path d="M31,58 Q29,24 50,20 Q71,24 69,58 L63,56 Q66,34 56,30 Q44,28 37,36 Q34,44 37,56 Z" fill={hc}/>}
      {hair==="spike" && <g fill={hc}><path d="M35,32 L38,20 L42,30 L47,18 L51,29 L56,19 L60,30 L65,22 L66,33 Q58,26 50,26 Q41,26 35,32 Z"/></g>}
      {/* face */}
      {acc==="shades"
        ? <g><rect x="37" y="38" width="11" height="7" rx="2.5" fill="#16161c"/><rect x="52" y="38" width="11" height="7" rx="2.5" fill="#16161c"/><rect x="47" y="40" width="6" height="2" fill="#16161c"/></g>
        : <g fill="#2a2018"><circle cx="43" cy="41" r="2.1"/><circle cx="57" cy="41" r="2.1"/></g>}
      <path d="M46,54 Q50,57 54,54" stroke="#7a4a30" strokeWidth="1.6" fill="none"/>
      <path d="M48,46 Q50,49 52,46" stroke="#00000033" strokeWidth="1.2" fill="none"/>
      {/* headwear */}
      {acc==="cap" && <g><path d="M33,34 Q34,20 50,19 Q66,20 67,34 L33,34 Z" fill="#8f1d1d"/><rect x="28" y="32" width="26" height="5" rx="2.5" fill="#701515"/></g>}
      {hoodie && <path d="M28,60 Q24,24 50,18 Q76,24 72,60 L66,58 Q70,30 50,26 Q30,30 34,58 Z" fill={jc} stroke="#00000033"/>}
    </svg>
  );
}
