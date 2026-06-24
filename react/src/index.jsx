import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

/* Never show a silent blank page: catch crashes and offer a way out. */
class Boundary extends React.Component {
  constructor(p){ super(p); this.state = {err:null}; }
  static getDerivedStateFromError(err){ return {err}; }
  render(){
    if(!this.state.err) return this.props.children;
    const err = this.state.err;
    return (
      <div style={{padding:40, maxWidth:640, margin:"0 auto", fontFamily:"Tahoma, sans-serif", color:"#e8dcb8"}}>
        <h1 style={{fontSize:22, marginBottom:8}}>💥 The engine stalled</h1>
        <p style={{marginBottom:14, lineHeight:1.5}}>Something crashed while drawing the game. Your saves are safe. Try reloading first — if it keeps happening, reset below.</p>
        <pre style={{background:"#0008", padding:12, borderRadius:8, fontSize:11, whiteSpace:"pre-wrap", marginBottom:16}}>{String(err && (err.stack||err.message||err)).slice(0,800)}</pre>
        <button style={{padding:"10px 18px", marginRight:8, cursor:"pointer"}} onClick={()=>location.reload()}>🔄 Reload</button>
        <button style={{padding:"10px 18px", marginRight:8, cursor:"pointer"}} onClick={()=>{
          try{ localStorage.removeItem("carthief6_neon_0"); }catch(e){}
          location.reload();
        }}>🗑 Clear autosave &amp; reload (slots 1–3 kept)</button>
      </div>
    );
  }
}

try{
  createRoot(document.getElementById("root")).render(<Boundary><App/></Boundary>);
}catch(err){
  document.getElementById("root").innerHTML =
    `<div style="padding:40px;font-family:Tahoma;color:#e8dcb8">
       <h2>💥 Failed to start</h2>
       <pre style="white-space:pre-wrap;font-size:11px">${String(err && (err.stack||err.message||err)).replace(/</g,"&lt;").slice(0,800)}</pre>
       <button onclick="try{localStorage.removeItem('carthief6_neon_0')}catch(e){};location.reload()">Clear autosave &amp; reload</button>
     </div>`;
}

window.addEventListener("error", e=>{
  const root = document.getElementById("root");
  if(root && !root.hasChildNodes()){
    root.innerHTML =
      `<div style="padding:40px;font-family:Tahoma;color:#e8dcb8">
         <h2>💥 Crashed before the curtain went up</h2>
         <pre style="white-space:pre-wrap;font-size:11px">${String(e.message||"").replace(/</g,"&lt;")}</pre>
         <button onclick="try{localStorage.removeItem('carthief6_neon_0')}catch(e){};location.reload()">Clear autosave &amp; reload</button>
       </div>`;
  }
});
