// ── tiny synthesized SFX — no files, just WebAudio ──────────────────
let ctx = null;
let muted = false;
try{ muted = localStorage.getItem("ct6_mute")==="1"; }catch(e){}

export function isMuted(){ return muted; }
export function setMuted(m){
  muted = m;
  try{ localStorage.setItem("ct6_mute", m?"1":"0"); }catch(e){}
}

function ac(){
  if(!ctx){
    try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; }
  }
  if(ctx.state==="suspended") ctx.resume();
  return ctx;
}

function tone(freq, dur=0.08, {type="square", vol=0.035, when=0, slide=null}={}){
  if(muted) return;
  const c = ac(); if(!c) return;
  const t0 = c.currentTime + when;
  const o = c.createOscillator(), gn = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if(slide) o.frequency.exponentialRampToValueAtTime(slide, t0+dur);
  gn.gain.setValueAtTime(vol, t0);
  gn.gain.exponentialRampToValueAtTime(0.0008, t0+dur);
  o.connect(gn); gn.connect(c.destination);
  o.start(t0); o.stop(t0+dur+0.02);
}

export const SFX = {
  click(){ tone(900, 0.03, {type:"square", vol:0.02}); },
  roll(){ tone(220, 0.05); tone(330, 0.05, {when:0.05}); tone(440, 0.05, {when:0.1}); },
  good(){ tone(523, 0.07); tone(659, 0.07, {when:0.07}); tone(784, 0.12, {when:0.14}); },
  bad(){ tone(330, 0.1, {type:"sawtooth"}); tone(220, 0.16, {when:0.09, type:"sawtooth"}); },
  cash(){ tone(1318, 0.05, {type:"triangle", vol:0.05}); tone(1568, 0.09, {when:0.06, type:"triangle", vol:0.05}); },
  police(){ tone(660, 0.28, {type:"sawtooth", vol:0.03, slide:880}); tone(880, 0.28, {when:0.28, type:"sawtooth", vol:0.03, slide:660}); },
  level(){ [523,659,784,1046].forEach((f,i)=>tone(f, 0.09, {when:i*0.08, type:"triangle", vol:0.045})); },
  punch(){ tone(140, 0.07, {type:"sawtooth", vol:0.05, slide:60}); },
};
