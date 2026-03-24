"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import HCaptcha from "@hcaptcha/react-hcaptcha";

const ALLOWED_EMAIL_DOMAINS = new Set([
  // Google
  "gmail.com","googlemail.com",
  // Microsoft
  "outlook.com","hotmail.com","hotmail.fr","hotmail.ca","hotmail.co.uk",
  "live.com","live.fr","live.ca","live.co.uk","msn.com","windowslive.com",
  // Yahoo
  "yahoo.com","yahoo.fr","yahoo.ca","yahoo.co.uk","ymail.com",
  // Apple
  "icloud.com","me.com","mac.com",
  // Proton
  "proton.me","protonmail.com","pm.me",
  // Autres
  "aol.com","zoho.com","gmx.com","gmx.fr","gmx.net","mail.com",
  "tutanota.com","tuta.com","fastmail.com","hey.com","yandex.com",
  // FAI canadiens
  "bell.net","bellnet.ca","sympatico.ca","videotron.ca","videotron.net",
  "rogers.com","cogeco.ca","cogeco.net","shaw.ca","telus.net",
  "eastlink.ca","northwestel.net","sasktel.net","mts.net",
]);

function isEmailAllowed(email){
  const domain=(email.split("@")[1]||"").toLowerCase();
  if(!domain)return false;
  if(ALLOWED_EMAIL_DOMAINS.has(domain))return true;
  if(domain.endsWith(".qc.ca"))return true;
  if(domain.endsWith(".gc.ca"))return true;
  if(domain.endsWith(".edu"))return true;
  return false;
}

function sanitize(str){return(str||"").replace(/<[^>]*>/g,"").replace(/[<>`]/g,"").trim()}

const CEGEPS = ["Cégep de l'Abitibi-Témiscamingue","Cégep d'Ahuntsic","Collège d'Alma","Cégep André-Laurendeau","Cégep de Baie-Comeau","Cégep Beauce-Appalaches","Cégep de Bois-de-Boulogne","Champlain Regional College","Cégep de Chicoutimi","Collège Dawson","Cégep de Drummondville","Cégep Édouard-Montpetit","Cégep Garneau","Cégep de la Gaspésie et des Îles","Cégep Gérald-Godin","Cégep de Granby","Cégep Heritage","Cégep John Abbott","Cégep de Jonquière","Cégep de La Pocatière","Cégep de Lanaudière à Joliette","Cégep de Lanaudière à L'Assomption","Cégep de Lanaudière à Terrebonne","Cégep de Lévis","Cégep Limoilou","Cégep Lionel-Groulx","Cégep de Maisonneuve","Cégep Marie-Victorin","Cégep de Matane","Cégep Montmorency","Cégep de l'Outaouais","Cégep de Rimouski","Cégep de Rivière-du-Loup","Cégep de Rosemont","Cégep de Sainte-Foy","Cégep de Saint-Hyacinthe","Cégep de Saint-Jérôme","Cégep Saint-Jean-sur-Richelieu","Cégep de Saint-Laurent","Cégep de Sept-Îles","Cégep de Shawinigan","Cégep de Sherbrooke","Cégep de Sorel-Tracy","Cégep de St-Félicien","Cégep de Thetford","Cégep de Trois-Rivières","Cégep de Valleyfield","Cégep Vanier","Cégep de Victoriaville","Cégep du Vieux Montréal"].sort((a,b)=>a.localeCompare(b,"fr"));
const DEPTS = ["Sciences humaines","Sciences de la nature","Philosophie","Français","Mathématiques","Éducation physique","Anglais","Administration","Arts","Informatique","Soins infirmiers","Autre"];

function formatName(r){return r.trim().split(/\s+/).map(w=>{if(w.startsWith("d'")||w.startsWith("D'"))return w[0].toLowerCase()+"'"+w[2].toUpperCase()+w.slice(3).toLowerCase();if(["de","du","des","le","la","les"].includes(w.toLowerCase()))return w.toLowerCase();return w[0].toUpperCase()+w.slice(1).toLowerCase()}).join(" ").replace(/^(.)/,(_,c)=>c.toUpperCase())}
const norm=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

function calculateCoteR(courses){const v=courses.filter(c=>c.grade&&c.groupAvg&&c.groupStd);if(!v.length)return null;let t=0,n=0;for(const c of v){const g=parseFloat(c.grade),a=parseFloat(c.groupAvg),s=parseFloat(c.groupStd);if(isNaN(g)||isNaN(a)||isNaN(s)||s===0)continue;t+=((g-a)/s)*(1+(a-72)/100);n++}if(!n)return null;return Math.round((25+(t/n)*5)*10)/10}

// ============ COMPONENTS ============
function Logo({size="lg"}){const s=size==="lg"?{t:28,d:10}:{t:17,d:7};return<span style={{display:"inline-flex",alignItems:"center",gap:4,cursor:"pointer"}}><span style={{fontFamily:"'Space Mono',monospace",fontSize:s.t,fontWeight:700,letterSpacing:"-0.03em",color:"var(--color-text-primary)"}}>coteR</span><span style={{width:s.d,height:s.d,borderRadius:"50%",background:"#1D9E75",display:"inline-block"}}/></span>}
function VBadge({v,small}){const k=v==="keep";return<span style={{display:"inline-block",fontSize:small?10:12,fontWeight:500,padding:small?"2px 7px":"4px 11px",borderRadius:"var(--border-radius-md)",background:k?"var(--color-background-success)":"var(--color-background-danger)",color:k?"#1D9E75":"#E24B4A"}}>{k?"KEEP":"DROP"}</span>}
function RBar({value}){const c=value>=4?"#1D9E75":value>=3?"#EF9F27":"#E24B4A";return<div style={{height:5,background:"var(--color-background-secondary)",borderRadius:3,flex:1}}><div style={{height:"100%",width:`${(value/5)*100}%`,background:c,borderRadius:3}}/></div>}
const rc=v=>v>=4?"#1D9E75":v>=3?"#EF9F27":"#E24B4A";
const inp={width:"100%",padding:"10px 12px",fontSize:14,border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",background:"var(--color-background-primary)",color:"var(--color-text-primary)",boxSizing:"border-box"};
const lbl={fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:5};

// ============ NAV ============
function Nav({page,setPage,user,goToLogin,goToAccount}){
  return(
    <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"0.5px solid var(--color-border-tertiary)",marginBottom:20,gap:8,flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
        <span onClick={()=>setPage("profs")}><Logo size="sm"/></span>
        <div style={{display:"flex",gap:2}}>
          {[{id:"profs",l:"Profs"},{id:"calc",l:"Cote R"},{id:"submit",l:"Évaluer"}].map(t=>(
            <button key={t.id} onClick={()=>{if(t.id==="submit"&&!user){goToLogin();return}setPage(t.id)}} style={{background:page===t.id?"var(--color-background-secondary)":"transparent",border:"none",borderRadius:"var(--border-radius-md)",padding:"5px 10px",fontSize:13,cursor:"pointer",fontWeight:page===t.id?500:400,color:page===t.id?"var(--color-text-primary)":"var(--color-text-secondary)",whiteSpace:"nowrap"}}>{t.l}</button>
          ))}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        {user?<button onClick={goToAccount} style={{width:32,height:32,borderRadius:"50%",background:"var(--color-background-info)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:500,color:"var(--color-text-info)",border:page==="account"?"2px solid var(--color-border-info)":"2px solid transparent",cursor:"pointer",padding:0,flexShrink:0}}>{(user.name||user.email||"U").charAt(0).toUpperCase()}</button>
        :<button onClick={goToLogin} style={{background:"none",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"5px 12px",fontSize:12,cursor:"pointer",color:"var(--color-text-secondary)",whiteSpace:"nowrap"}}>Connexion</button>}
      </div>
    </nav>
  );
}

// ============ ACCOUNT PAGE ============
function AccountPage({user,onLogout,onBack}){
  return(
    <div style={{maxWidth:520,margin:"0 auto",padding:"24px 0"}}>
      <button onClick={onBack} style={{background:"none",border:"none",fontSize:13,color:"var(--color-text-secondary)",cursor:"pointer",padding:"0 0 16px"}}>&larr; Retour</button>
      <div style={{background:"var(--color-background-primary)",borderRadius:"var(--border-radius-lg)",border:"0.5px solid var(--color-border-tertiary)",padding:"28px 24px"}}>
        <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:24}}>
          <div style={{width:52,height:52,borderRadius:"50%",background:"var(--color-background-info)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,color:"var(--color-text-info)",flexShrink:0}}>{(user.name||user.email||"U").charAt(0).toUpperCase()}</div>
          <div style={{minWidth:0}}><p style={{fontSize:18,fontWeight:500,margin:"0 0 2px",color:"var(--color-text-primary)",overflow:"hidden",textOverflow:"ellipsis"}}>{user.name||"Utilisateur"}</p><p style={{fontSize:13,color:"var(--color-text-secondary)",margin:0,overflow:"hidden",textOverflow:"ellipsis"}}>{(e=>{const[l,d]=e.split("@");return l.slice(0,3)+"***@***."+(d?.split(".").pop()||"com")})(user.email||"")}</p></div>
        </div>
        <button onClick={onLogout} style={{width:"100%",background:"none",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"11px",fontSize:14,cursor:"pointer",color:"var(--color-text-danger)"}}>Se déconnecter</button>
      </div>
    </div>
  );
}

// ============ LANDING ============
function Landing({onStart}){
  return(
    <div style={{minHeight:"85vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"2rem 0.5rem"}}>
      <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"var(--color-background-success)",borderRadius:20,padding:"4px 14px",marginBottom:18,fontSize:12,color:"#1D9E75"}}><span style={{width:6,height:6,borderRadius:"50%",background:"#1D9E75",display:"inline-block"}}/>100% anonyme</div>
      <Logo size="lg"/>
      <p style={{fontSize:"min(36px, 8vw)",fontWeight:700,lineHeight:1.1,margin:"14px 0 8px",maxWidth:460,letterSpacing:"-0.03em",color:"var(--color-text-primary)",fontFamily:"'Space Mono',monospace"}}>Drop ou keep?</p>
      <p style={{fontSize:"min(17px, 4.5vw)",color:"var(--color-text-secondary)",margin:"0 0 6px"}}>Rate tes profs. Check les ratings. Sauve ta session.</p>
      <p style={{fontSize:14,color:"var(--color-text-tertiary)",maxWidth:370,lineHeight:1.55,margin:"0 0 28px",padding:"0 12px"}}>Ratings de profs, verdicts drop/keep, et calculateur de cote R — pour tous les cégeps du Québec.</p>
      <button onClick={onStart} style={{background:"#1D9E75",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",padding:"13px 34px",fontSize:15,fontWeight:500,cursor:"pointer"}}>Voir les profs &rarr;</button>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,maxWidth:480,width:"100%",marginTop:48,padding:"0 8px"}}>
        {[{n:"48 cégeps",d:"Tous les cégeps du QC"},{n:"Drop/Keep",d:"Verdict clair par prof"},{n:"Cote R",d:"Formule avec écart-type"}].map((f,i)=>(
          <div key={i} style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)",padding:"14px 12px"}}><p style={{fontSize:14,fontWeight:500,margin:"0 0 3px",color:"var(--color-text-primary)"}}>{f.n}</p><p style={{fontSize:12,color:"var(--color-text-secondary)",margin:0,lineHeight:1.4}}>{f.d}</p></div>
        ))}
      </div>
    </div>
  );
}

// ============ LOGIN PAGE ============
function LoginPage({onClose}){
  const[email,setEmail]=useState("");const[password,setPassword]=useState("");const[error,setError]=useState("");const[loading,setLoading]=useState(false);const[isSignUp,setIsSignUp]=useState(false);
  const[captchaToken,setCaptchaToken]=useState(null);
  const captchaRef=useRef(null);
  const sitekey=process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY;

  const reset=()=>{setCaptchaToken(null);captchaRef.current?.resetCaptcha()};
  const handleSubmit=async()=>{
    if(!email||!password){setError("Entre ton email et mot de passe.");return}
    if(password.length<6){setError("Mot de passe: 6 caracteres minimum.");return}
    if(isSignUp&&!isEmailAllowed(email)){setError("Ce domaine d'email n'est pas accepté. Utilise Gmail, Outlook, Yahoo, ou ton email scolaire (.qc.ca).");return}
    if(!captchaToken){setError("Complète le captcha avant de continuer.");return}
    setLoading(true);setError("");
    if(isSignUp){
      const{error:e}=await supabase.auth.signUp({email,password,options:{captchaToken}});
      if(e){setError(e.message);setLoading(false);reset();return}
    }else{
      const{error:e}=await supabase.auth.signInWithPassword({email,password,options:{captchaToken}});
      if(e){setError("Email ou mot de passe incorrect.");setLoading(false);reset();return}
    }
    setLoading(false);
  };
  return(
    <div style={{maxWidth:460,margin:"0 auto",padding:"40px 0"}}>
      <div style={{background:"var(--color-background-primary)",borderRadius:"var(--border-radius-lg)",padding:"28px 24px",border:"0.5px solid var(--color-border-tertiary)"}}>
        <div style={{textAlign:"center",marginBottom:24}}><Logo size="sm"/><h2 style={{fontSize:20,fontWeight:500,margin:"12px 0 4px",color:"var(--color-text-primary)"}}>{isSignUp?"Creer un compte":"Connexion"}</h2><p style={{fontSize:13,color:"var(--color-text-secondary)",margin:0}}>{isSignUp?"Gratuit, ca prend 10 secondes.":"Connecte-toi pour evaluer tes profs."}</p></div>
        {error&&<div style={{background:"var(--color-background-danger)",borderRadius:"var(--border-radius-md)",padding:"10px 14px",marginBottom:14}}><p style={{fontSize:13,color:"var(--color-text-danger)",margin:0}}>{error}</p></div>}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <input type="email" placeholder="ton@email.com" autoComplete="off" value={email} onChange={e=>setEmail(e.target.value)} style={{...inp}}/>
          <input type="password" placeholder="Mot de passe (6+ caracteres)" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleSubmit()}} style={{...inp}}/>
          {sitekey&&<div style={{display:"flex",justifyContent:"center",margin:"4px 0"}}><HCaptcha ref={captchaRef} sitekey={sitekey} onVerify={token=>setCaptchaToken(token)} onExpire={reset} theme="auto"/></div>}
          <button onClick={handleSubmit} disabled={loading} style={{width:"100%",background:loading?"#0F6E56":"#1D9E75",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",padding:"12px",fontSize:15,fontWeight:500,cursor:loading?"wait":"pointer"}}>{loading?"...":(isSignUp?"Creer mon compte":"Se connecter")}</button>
        </div>
        <p style={{fontSize:13,color:"var(--color-text-secondary)",textAlign:"center",margin:"16px 0 0"}}>{isSignUp?"Deja un compte?":"Pas de compte?"} <button onClick={()=>{setIsSignUp(!isSignUp);setError("");reset()}} style={{background:"none",border:"none",color:"#1D9E75",cursor:"pointer",fontWeight:500,fontSize:13,padding:0}}>{isSignUp?"Se connecter":"Creer un compte"}</button></p>
        <p style={{fontSize:11,color:"var(--color-text-tertiary)",textAlign:"center",margin:"12px 0 0"}}>Tes evaluations restent 100% anonymes.</p>
        <button onClick={onClose} style={{width:"100%",background:"none",border:"none",fontSize:13,color:"var(--color-text-tertiary)",cursor:"pointer",marginTop:12,padding:8}}>&larr; Retour</button>
      </div>
    </div>
  );
}

// ============ STRIPE PAGE (real checkout) ============
function StripePage({onClose,user,isPro,openLogin}){
  const[loading,setLoading]=useState(false);
  if(!user)return(<div style={{maxWidth:400,margin:"0 auto",textAlign:"center",padding:"60px 0"}}><div style={{background:"var(--color-background-primary)",borderRadius:"var(--border-radius-lg)",padding:"32px",border:"0.5px solid var(--color-border-tertiary)"}}><p style={{fontSize:15,fontWeight:500,color:"var(--color-text-primary)",margin:"0 0 12px"}}>Connecte-toi d'abord</p><p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 20px"}}>Tu dois avoir un compte pour t'abonner.</p><button onClick={openLogin} style={{background:"#1D9E75",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",padding:"11px 24px",fontSize:14,fontWeight:500,cursor:"pointer"}}>Se connecter</button></div></div>);
  if(isPro)return(<div style={{maxWidth:400,margin:"0 auto",textAlign:"center",padding:"60px 0"}}><div style={{background:"var(--color-background-primary)",borderRadius:"var(--border-radius-lg)",padding:"32px",border:"0.5px solid var(--color-border-tertiary)"}}><div style={{width:48,height:48,borderRadius:"50%",background:"var(--color-background-success)",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:14}}><span style={{fontSize:22,color:"#1D9E75"}}>&#10003;</span></div><h2 style={{fontSize:20,fontWeight:500,margin:"0 0 6px",color:"var(--color-text-primary)"}}>T'es déjà PRO!</h2><p style={{fontSize:14,color:"var(--color-text-secondary)",margin:"0 0 20px"}}>Tu as accès à tout.</p><button onClick={onClose} style={{background:"#1D9E75",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",padding:"11px 24px",fontSize:14,fontWeight:500,cursor:"pointer"}}>Retour &rarr;</button></div></div>);
  const handleCheckout=async()=>{
    setLoading(true);
    try{
      const res=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:user.email})});
      const data=await res.json();
      if(data.url)window.location.href=data.url;
      else{alert("Erreur: "+data.error);setLoading(false)}
    }catch(e){alert("Erreur de connexion");setLoading(false)}
  };
  return(
    <div style={{maxWidth:540,margin:"0 auto",padding:"24px 0"}}>
      <div style={{background:"var(--color-background-primary)",borderRadius:"var(--border-radius-lg)",overflow:"hidden",border:"0.5px solid var(--color-border-tertiary)"}}>
        <div style={{background:"var(--color-background-secondary)",padding:"20px 24px",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><Logo size="sm"/><span style={{fontSize:12,color:"var(--color-text-tertiary)"}}>Paiement sécurisé</span></div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",flexWrap:"wrap",gap:8}}><div><p style={{fontSize:16,fontWeight:500,margin:"0 0 2px",color:"var(--color-text-primary)"}}>CoteR PRO</p><p style={{fontSize:12,color:"var(--color-text-secondary)",margin:0}}>~4 mois, annule quand tu veux</p></div><p style={{fontSize:24,fontWeight:700,fontFamily:"'Space Mono',monospace",margin:0,color:"var(--color-text-primary)"}}>9,99$</p></div>
        </div>
        <div style={{padding:"16px 24px",borderBottom:"0.5px solid var(--color-border-tertiary)"}}>
          {["Verdicts drop/keep","Tous les avis détaillés","Tags + stats avancées","Cote R + simulations"].map((f,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:i<3?6:0}}><div style={{width:16,height:16,borderRadius:"50%",background:"var(--color-background-success)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:9,color:"#1D9E75",fontWeight:500}}>&#10003;</span></div><span style={{fontSize:13,color:"var(--color-text-primary)"}}>{f}</span></div>
          ))}
        </div>
        <div style={{padding:"20px 24px"}}>
          <button onClick={handleCheckout} disabled={loading} style={{width:"100%",background:loading?"#0F6E56":"#1D9E75",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",padding:"14px",fontSize:15,fontWeight:500,cursor:loading?"wait":"pointer",opacity:loading?0.8:1}}>{loading?"Redirection vers Stripe...":"Payer 9,99$ — Stripe Checkout"}</button>
          <p style={{fontSize:11,color:"var(--color-text-tertiary)",textAlign:"center",margin:"12px 0 0"}}>Tu seras redirigé vers Stripe pour payer de façon sécurisée.</p>
        </div>
        <button onClick={onClose} style={{width:"100%",background:"none",border:"none",borderTop:"0.5px solid var(--color-border-tertiary)",padding:"12px",fontSize:13,color:"var(--color-text-tertiary)",cursor:"pointer"}}>&larr; Retour</button>
      </div>
    </div>
  );
}

// ============ REVIEW CARD ============
function ReviewCard({r}){const c=rc(r.rating);return(
  <div style={{border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"12px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,flexWrap:"wrap",gap:6}}>
      <div style={{display:"flex",alignItems:"center",gap:7}}>
        <div style={{width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,fontFamily:"'Space Mono',monospace",background:r.rating>=4?"var(--color-background-success)":r.rating>=3?"var(--color-background-warning)":"var(--color-background-danger)",color:c,flexShrink:0}}>{r.rating}</div>
        <div><p style={{fontSize:12,fontWeight:500,margin:0,color:"var(--color-text-primary)"}}>{r.course}</p><p style={{fontSize:11,color:"var(--color-text-tertiary)",margin:0}}>{new Date(r.created_at).toLocaleDateString('fr-CA',{month:'short',year:'numeric'})}</p></div>
      </div>
      {r.grade&&<span style={{fontSize:11,padding:"2px 7px",borderRadius:"var(--border-radius-md)",background:"var(--color-background-secondary)",color:"var(--color-text-secondary)"}}>Note: {r.grade}</span>}
    </div>
    <p style={{fontSize:13,color:"var(--color-text-primary)",lineHeight:1.55,margin:0}}>{r.review_text}</p>
  </div>
)}

// ============ PROF DETAIL ============
function ProfDetail({prof,reviews,onBack,onEvaluate}){
  const rating=reviews.length?Math.round(reviews.reduce((s,r)=>s+r.rating,0)/reviews.length*10)/10:0;
  const diff=reviews.length?Math.round(reviews.reduce((s,r)=>s+r.difficulty,0)/reviews.length*10)/10:0;
  const keepPct=reviews.length?Math.round(100*reviews.filter(r=>r.verdict==="keep").length/reviews.length):0;
  const verdict=keepPct>=50?"keep":"drop";
  return(
    <div style={{maxWidth:720,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <button onClick={onBack} style={{background:"none",border:"none",fontSize:13,color:"var(--color-text-secondary)",cursor:"pointer",padding:0}}>&larr; Retour aux profs</button>
        <button onClick={()=>onEvaluate(prof)} style={{background:"#1D9E75",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",padding:"7px 16px",fontSize:13,fontWeight:500,cursor:"pointer"}}>Évaluer</button>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:18,gap:12}}>
        <div style={{minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3,flexWrap:"wrap"}}><h1 style={{fontSize:"min(21px, 5vw)",fontWeight:500,margin:0,color:"var(--color-text-primary)"}}>{prof.name}</h1>{reviews.length>0&&<VBadge v={verdict} small/>}</div>
          <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:0}}>{prof.dept} — {prof.cegep}</p>
          {prof.courses&&prof.courses.length>0&&<p style={{fontSize:12,color:"var(--color-text-tertiary)",margin:"3px 0 0"}}>{prof.courses.join(" · ")}</p>}
        </div>
        {reviews.length>0&&<div style={{textAlign:"center",flexShrink:0}}><p style={{fontSize:34,fontWeight:700,margin:0,fontFamily:"'Space Mono',monospace",color:rc(rating)}}>{rating}</p><p style={{fontSize:11,color:"var(--color-text-tertiary)",margin:0}}>/5</p></div>}
      </div>
      {reviews.length>0&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:7,marginBottom:18}}>
          {[{l:"Reprendrait",v:`${keepPct}%`,c:keepPct>=70?"#1D9E75":keepPct>=50?"#EF9F27":"#E24B4A"},{l:"Difficulté",v:`${diff}/5`,c:"var(--color-text-primary)"},{l:"Avis",v:reviews.length,c:"var(--color-text-primary)"}].map((s,i)=>(
            <div key={i} style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"10px 8px",textAlign:"center"}}><p style={{fontSize:11,color:"var(--color-text-secondary)",margin:"0 0 2px"}}>{s.l}</p><p style={{fontSize:16,fontWeight:700,margin:0,fontFamily:"'Space Mono',monospace",color:s.c}}>{s.v}</p></div>
          ))}
        </div>
        <h2 style={{fontSize:15,fontWeight:500,margin:"0 0 12px",color:"var(--color-text-primary)"}}>Avis ({reviews.length})</h2>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {reviews.map((r,i)=><ReviewCard key={i} r={r}/>)}
        </div>
      </>}
      {reviews.length===0&&<div style={{textAlign:"center",padding:"36px 16px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)"}}><p style={{fontSize:14,color:"var(--color-text-tertiary)",margin:0}}>Aucun avis encore pour ce prof.</p></div>}
    </div>
  );
}

// ============ PROFS PAGE (reads from Supabase) ============
function ProfsPage({profs,reviewsByProf,onEvaluate}){
  const[search,setSearch]=useState("");const[cegep,setCegep]=useState("Cégep de Granby");const[sel,setSel]=useState(null);const[sort,setSort]=useState("rating");
  if(sel){const revs=reviewsByProf[sel.id]||[];return<ProfDetail prof={sel} reviews={revs} onBack={()=>setSel(null)} onEvaluate={onEvaluate}/>}
  const q=norm(search.trim());
  const profsWithStats=profs.map(p=>{const revs=reviewsByProf[p.id]||[];const rating=revs.length?Math.round(revs.reduce((s,r)=>s+r.rating,0)/revs.length*10)/10:0;const diff=revs.length?Math.round(revs.reduce((s,r)=>s+r.difficulty,0)/revs.length*10)/10:0;const keepPct=revs.length?Math.round(100*revs.filter(r=>r.verdict==="keep").length/revs.length):0;return{...p,rating,difficulty:diff,totalReviews:revs.length,verdict:keepPct>=50?"keep":"drop",tags:[]}});
  let list=q.length>=1?profsWithStats.filter(p=>norm(p.name).includes(q)||p.courses?.some(c=>norm(c).includes(q))||norm(p.dept||"").includes(q)):profsWithStats.filter(p=>p.cegep===cegep);
  list.sort((a,b)=>sort==="rating"?b.rating-a.rating:a.difficulty-b.difficulty);
  return(
    <div style={{maxWidth:720,margin:"0 auto"}}>
      <h1 style={{fontSize:21,fontWeight:500,margin:"0 0 3px",color:"var(--color-text-primary)"}}>Rating des profs</h1>
      <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 14px"}}>Drop ou keep? Check avant de t'inscrire.</p>
      <input type="text" placeholder="Chercher un prof ou cours (tous cégeps)..." value={search} onChange={e=>setSearch(e.target.value)} style={{...inp,marginBottom:12}}/>
      {q.length<2&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,gap:8,flexWrap:"wrap"}}>
        <select value={cegep} onChange={e=>setCegep(e.target.value)} style={{...inp,width:"auto",flex:"1 1 180px",maxWidth:"100%",appearance:"auto",padding:"6px 8px",fontSize:12}}>{CEGEPS.map(c=><option key={c} value={c}>{c}</option>)}</select>
        <div style={{display:"flex",gap:3}}>{[{id:"rating",l:"Meilleur"},{id:"difficulty",l:"Facile"}].map(s=>(<button key={s.id} onClick={()=>setSort(s.id)} style={{background:sort===s.id?"var(--color-background-secondary)":"transparent",border:"0.5px solid "+(sort===s.id?"var(--color-border-secondary)":"transparent"),borderRadius:"var(--border-radius-md)",padding:"4px 9px",fontSize:11,cursor:"pointer",color:sort===s.id?"var(--color-text-primary)":"var(--color-text-secondary)"}}>{s.l}</button>))}</div>
      </div>}
      {q.length>=2&&<p style={{fontSize:12,color:"var(--color-text-tertiary)",margin:"0 0 12px"}}>{list.length} résultat{list.length!==1?"s":""}</p>}
      {list.length===0?<div style={{textAlign:"center",padding:"36px 16px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)"}}><p style={{fontSize:15,fontWeight:500,color:"var(--color-text-primary)",margin:"0 0 6px"}}>{q?"Aucun résultat":"Aucun prof ici encore"}</p><p style={{fontSize:13,color:"var(--color-text-secondary)",margin:0}}>Sois le premier — clique "Évaluer"!</p></div>
      :<div style={{display:"flex",flexDirection:"column",gap:9}}>{list.map(p=>(
        <div key={p.id} onClick={()=>setSel(p)} style={{border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"14px",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.borderColor="var(--color-border-secondary)"} onMouseLeave={e=>e.currentTarget.style.borderColor="var(--color-border-tertiary)"}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:8,gap:8}}>
            <div style={{minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2,flexWrap:"wrap"}}><p style={{fontSize:14,fontWeight:500,margin:0,color:"var(--color-text-primary)"}}>{p.name}</p>{p.totalReviews>0&&<VBadge v={p.verdict} small/>}</div><p style={{fontSize:11,color:"var(--color-text-secondary)",margin:0}}>{p.dept}{q.length>=2?` — ${p.cegep}`:""}</p></div>
            <div style={{display:"flex",alignItems:"start",gap:8,flexShrink:0}}>
              <button onClick={e=>{e.stopPropagation();onEvaluate(p)}} style={{background:"#1D9E75",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",padding:"6px 14px",fontSize:12,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap"}}>Évaluer</button>
              {p.totalReviews>0&&<div style={{textAlign:"right"}}><p style={{fontSize:22,fontWeight:700,margin:0,fontFamily:"'Space Mono',monospace",color:rc(p.rating)}}>{p.rating}</p><p style={{fontSize:10,color:"var(--color-text-tertiary)",margin:0}}>{p.totalReviews} avis</p></div>}
            </div>
          </div>
          {p.totalReviews>0&&<div style={{display:"flex",gap:14}}>
            <div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:10,color:"var(--color-text-secondary)"}}>Qualité</span><span style={{fontSize:10,fontWeight:500,color:"var(--color-text-primary)"}}>{p.rating}/5</span></div><RBar value={p.rating}/></div>
            <div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:10,color:"var(--color-text-secondary)"}}>Difficulté</span><span style={{fontSize:10,fontWeight:500,color:"var(--color-text-primary)"}}>{p.difficulty}/5</span></div><RBar value={p.difficulty}/></div>
          </div>}
        </div>
      ))}</div>}
    </div>
  );
}

// ============ SUBMIT PAGE (writes to Supabase) ============
function SubmitPage({user,profs,goToLogin,onSubmitted,prefill}){
  const[cegep,setCegep]=useState(prefill?.cegep||"Cégep de Granby");const[profName,setProfName]=useState(prefill?.name||"");const[dept,setDept]=useState(prefill?.dept||"");const[course,setCourse]=useState("");const[quality,setQuality]=useState("");const[diff,setDiff]=useState("");const[verdict,setVerdict]=useState("");const[review,setReview]=useState("");const[submitted,setSubmitted]=useState(false);const[showProfSug,setShowProfSug]=useState(false);const[showCourseSug,setShowCourseSug]=useState(false);const[customCourse,setCustomCourse]=useState(false);const[error,setError]=useState("");const[loading,setLoading]=useState(false);const[lastSubmitTime,setLastSubmitTime]=useState(0);const[submitCooldown,setSubmitCooldown]=useState(false);

  if(!user)return(<div style={{maxWidth:480,margin:"0 auto",textAlign:"center",padding:"60px 12px"}}><div style={{width:44,height:44,borderRadius:"50%",background:"var(--color-background-secondary)",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:14}}><span style={{fontSize:20,color:"var(--color-text-secondary)"}}>&#9998;</span></div><p style={{fontSize:16,fontWeight:500,color:"var(--color-text-primary)",margin:"0 0 8px"}}>Connecte-toi pour évaluer</p><p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 20px"}}>Tu dois avoir un compte pour soumettre une évaluation anonyme.</p><button onClick={goToLogin} style={{background:"#1D9E75",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",padding:"10px 24px",fontSize:14,fontWeight:500,cursor:"pointer"}}>Se connecter &rarr;</button></div>);
  if(submitted)return(<div style={{maxWidth:480,margin:"0 auto",textAlign:"center",padding:"60px 12px"}}><div style={{width:44,height:44,borderRadius:"50%",background:"var(--color-background-success)",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:14}}><span style={{color:"#1D9E75",fontSize:20}}>&#10003;</span></div><h2 style={{fontSize:19,fontWeight:500,margin:"0 0 6px",color:"var(--color-text-primary)"}}>Merci!</h2><p style={{fontSize:13,color:"var(--color-text-secondary)"}}>Ton évaluation a été soumise anonymement.</p><button onClick={()=>{setSubmitted(false);setProfName("");setCourse("");setQuality("");setDiff("");setVerdict("");setReview("");setDept("");setError("")}} style={{marginTop:16,background:"none",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-md)",padding:"8px 18px",fontSize:13,cursor:"pointer",color:"var(--color-text-primary)"}}>Évaluer un autre prof</button></div>);

  const pq=norm(profName.trim());
  const profSuggestions=pq.length>=1?profs.filter(p=>p.cegep===cegep&&norm(p.name).includes(pq)).slice(0,5):[];
  const allCourses=[...new Set(profs.filter(p=>p.cegep===cegep).flatMap(p=>p.courses||[]))].sort();
  const cq=course.trim().toLowerCase();
  const courseSuggestions=cq.length>=1?allCourses.filter(c=>c.toLowerCase().includes(cq)).slice(0,5):[];
  const selectProf=p=>{setProfName(p.name);setDept(p.dept||"");setCourse("");setCustomCourse(false);setShowProfSug(false)};
  const existingMatch=pq.length>=3?profs.find(p=>norm(p.name)===norm(formatName(profName))&&p.cegep===cegep):null;
  const profCourses=existingMatch?.courses||[];

  const handleSubmit=async()=>{
    // Rate limit frontend: 60s entre soumissions
    if(Date.now()-lastSubmitTime<60000&&lastSubmitTime>0){setError("Attends 1 minute avant de soumettre un autre avis.");return}
    const cleanName=sanitize(profName);const cleanCourse=sanitize(course);const cleanReview=sanitize(review);const cleanDept=sanitize(dept);
    if(!cleanName||!cleanCourse||!quality||!diff||!verdict||!cleanReview){setError("Remplis tous les champs.");return}
    if(cleanName.length<3||cleanName.length>100){setError("Nom du prof: entre 3 et 100 caractères.");return}
    if(cleanCourse.length<3||cleanCourse.length>100){setError("Cours: entre 3 et 100 caractères.");return}
    if(cleanReview.length<10||cleanReview.length>1000){setError("Avis: entre 10 et 1000 caractères.");return}
    const ratingNum=parseInt(quality);const diffNum=parseInt(diff);
    if(![1,2,3,4,5].includes(ratingNum)){setError("Qualité invalide.");return}
    if(![1,2,3,4,5].includes(diffNum)){setError("Difficulté invalide.");return}
    if(!["keep","drop"].includes(verdict)){setError("Verdict invalide.");return}
    if(!CEGEPS.includes(cegep)){setError("Cégep invalide.");return}
    const validDept=DEPTS.includes(cleanDept)?cleanDept:"Autre";
    setError("");setLoading(true);
    const formatted=formatName(cleanName);
    try{
      // Rate limit Supabase: max 5 par 24h
      const since=new Date(Date.now()-24*60*60*1000).toISOString();
      const{count:recentCount,error:rcErr}=await supabase.from('reviews').select('*',{count:'exact',head:true}).eq('user_id',user.id).gte('created_at',since);
      if(!rcErr&&recentCount>=5){setError("Limite atteinte : max 5 évaluations par 24h.");setLoading(false);return}

      let profId;
      const existing=profs.find(p=>p.name.toLowerCase()===formatted.toLowerCase()&&p.cegep===cegep);
      if(existing){profId=existing.id}else{
        const{data,error:e}=await supabase.from('profs').insert({name:formatted,cegep,dept:validDept,courses:[cleanCourse]}).select().single();
        if(e)throw e;profId=data.id;
      }

      // Duplicate check: 1 review per user per prof per course
      const{count:dupCount,error:dcErr}=await supabase.from('reviews').select('*',{count:'exact',head:true}).eq('user_id',user.id).eq('prof_id',profId).eq('course',cleanCourse);
      if(!dcErr&&dupCount>0){setError("Tu as déjà évalué ce prof pour ce cours.");setLoading(false);return}

      const{error:re}=await supabase.from('reviews').insert({prof_id:profId,user_id:user.id,course:cleanCourse,rating:ratingNum,difficulty:diffNum,verdict,review_text:cleanReview});
      if(re)throw re;
      if(existing&&!existing.courses?.includes(cleanCourse)){
        await supabase.from('profs').update({courses:[...(existing.courses||[]),cleanCourse]}).eq('id',profId);
      }
      setLastSubmitTime(Date.now());
      setSubmitCooldown(true);setTimeout(()=>setSubmitCooldown(false),5000);
      onSubmitted();setSubmitted(true);
    }catch(e){setError("Erreur: "+(e.message||"réessaie."));console.error(e)}
    setLoading(false);
  };

  return(
    <div style={{maxWidth:620,margin:"0 auto"}}>
      <h1 style={{fontSize:21,fontWeight:500,margin:"0 0 3px",color:"var(--color-text-primary)"}}>Évaluer un prof</h1>
      <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 20px"}}>100% anonyme. Aide les autres à faire le bon choix.</p>
      {error&&<div style={{background:"var(--color-background-danger)",borderRadius:"var(--border-radius-md)",padding:"10px 14px",marginBottom:14}}><p style={{fontSize:13,color:"var(--color-text-danger)",margin:0}}>{error}</p></div>}
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div><label style={lbl}>Cégep</label><select value={cegep} onChange={e=>setCegep(e.target.value)} style={{...inp,appearance:"auto"}}>{CEGEPS.map(c=><option key={c}>{c}</option>)}</select></div>
        <div style={{position:"relative"}}><label style={lbl}>Nom du prof</label>
          <input type="text" placeholder="Commence à écrire..." maxLength={100} value={profName} onChange={e=>{setProfName(e.target.value);setShowProfSug(true);setError("")}} onFocus={()=>setShowProfSug(true)} onBlur={()=>setTimeout(()=>setShowProfSug(false),200)} style={inp}/>
          {showProfSug&&profSuggestions.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-md)",marginTop:4,zIndex:50,overflow:"hidden"}}>{profSuggestions.map((p,i)=><button key={p.id} onMouseDown={()=>selectProf(p)} style={{width:"100%",textAlign:"left",background:"none",border:"none",padding:"10px 12px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:i<profSuggestions.length-1?"0.5px solid var(--color-border-tertiary)":"none"}}><div><p style={{fontSize:14,fontWeight:500,margin:0,color:"var(--color-text-primary)"}}>{p.name}</p><p style={{fontSize:11,color:"var(--color-text-secondary)",margin:"1px 0 0"}}>{p.dept}</p></div></button>)}</div>}
          {profName.trim().length>=3&&!existingMatch&&<p style={{fontSize:11,color:"var(--color-text-tertiary)",margin:"4px 0 0"}}>Sera enregistré: <strong style={{fontWeight:500,color:"var(--color-text-secondary)"}}>{formatName(profName)}</strong></p>}
          {existingMatch&&<div style={{marginTop:6,background:"var(--color-background-info)",borderRadius:"var(--border-radius-md)",padding:"8px 10px"}}><p style={{fontSize:12,color:"var(--color-text-info)",margin:0}}>Ce prof existe — ton avis sera ajouté à son profil.</p></div>}
        </div>
        <div><label style={lbl}>Département</label><select value={dept} onChange={e=>setDept(e.target.value)} style={{...inp,appearance:"auto"}}><option value="">Choisir...</option>{DEPTS.map(d=><option key={d}>{d}</option>)}</select></div>
        <div><label style={lbl}>Cours</label>
          {profCourses.length>0&&!customCourse?(
            <select value={course} onChange={e=>{if(e.target.value==="__custom__"){setCustomCourse(true);setCourse("")}else setCourse(e.target.value)}} style={{...inp,appearance:"auto"}}>
              <option value="">Choisir un cours...</option>
              {profCourses.map(c=><option key={c} value={c}>{c}</option>)}
              <option value="__custom__">+ Ajouter un autre cours...</option>
            </select>
          ):(
            <div style={{position:"relative"}}>
              {profCourses.length>0&&<button type="button" onClick={()=>{setCustomCourse(false);setCourse("")}} style={{background:"none",border:"none",fontSize:11,color:"#1D9E75",cursor:"pointer",padding:"0 0 5px",display:"block"}}>&larr; Choisir parmi les cours existants</button>}
              <input type="text" placeholder="ex: Méthodes quantitatives" maxLength={100} value={course} onChange={e=>{setCourse(e.target.value);setShowCourseSug(true)}} onFocus={()=>setShowCourseSug(true)} onBlur={()=>setTimeout(()=>setShowCourseSug(false),200)} style={inp}/>
              {showCourseSug&&courseSuggestions.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-md)",marginTop:4,zIndex:50,overflow:"hidden"}}>{courseSuggestions.map((c,i)=><button key={c} onMouseDown={()=>{setCourse(c);setShowCourseSug(false)}} style={{width:"100%",textAlign:"left",background:"none",border:"none",padding:"10px 12px",cursor:"pointer",fontSize:14,color:"var(--color-text-primary)",borderBottom:i<courseSuggestions.length-1?"0.5px solid var(--color-border-tertiary)":"none"}}>{c}</button>)}</div>}
            </div>
          )}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><label style={lbl}>Qualité</label><div style={{display:"flex",gap:4}}>{[1,2,3,4,5].map(n=><button key={n} onClick={()=>setQuality(String(n))} style={{flex:1,padding:"8px 0",fontSize:14,fontWeight:quality===String(n)?700:400,border:quality===String(n)?"2px solid #1D9E75":"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",background:quality===String(n)?"var(--color-background-success)":"var(--color-background-primary)",color:quality===String(n)?"#1D9E75":"var(--color-text-secondary)",fontFamily:"'Space Mono',monospace"}}>{n}</button>)}</div></div>
          <div><label style={lbl}>Difficulté</label><div style={{display:"flex",gap:4}}>{[1,2,3,4,5].map(n=><button key={n} onClick={()=>setDiff(String(n))} style={{flex:1,padding:"8px 0",fontSize:14,fontWeight:diff===String(n)?700:400,border:diff===String(n)?"2px solid #EF9F27":"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",background:diff===String(n)?"var(--color-background-warning)":"var(--color-background-primary)",color:diff===String(n)?"#BA7517":"var(--color-text-secondary)",fontFamily:"'Space Mono',monospace"}}>{n}</button>)}</div></div>
        </div>
        <div><label style={lbl}>Drop ou keep?</label><div style={{display:"flex",gap:8}}>
          <button onClick={()=>setVerdict("keep")} style={{flex:1,padding:"10px",fontSize:14,fontWeight:500,border:verdict==="keep"?"2px solid #1D9E75":"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",background:"var(--color-background-success)",color:"#1D9E75",cursor:"pointer"}}>KEEP</button>
          <button onClick={()=>setVerdict("drop")} style={{flex:1,padding:"10px",fontSize:14,fontWeight:500,border:verdict==="drop"?"2px solid #E24B4A":"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",background:"var(--color-background-danger)",color:"#E24B4A",cursor:"pointer"}}>DROP</button>
        </div></div>
        <div><label style={lbl}>Ton avis</label><textarea placeholder="Décris ton expérience — points forts, points faibles, ce qui aide à réussir." rows={4} maxLength={1000} value={review} onChange={e=>setReview(e.target.value.slice(0,1000))} style={{...inp,resize:"vertical",fontFamily:"inherit"}}/><p style={{fontSize:11,color:review.length>900?"#E24B4A":"var(--color-text-tertiary)",textAlign:"right",margin:"3px 0 0"}}>{review.length}/1000</p></div>
        <button onClick={handleSubmit} disabled={loading||submitCooldown} style={{width:"100%",background:(loading||submitCooldown)?"#0F6E56":"#1D9E75",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",padding:"13px",fontSize:15,fontWeight:500,cursor:(loading||submitCooldown)?"wait":"pointer",opacity:(loading||submitCooldown)?0.8:1}}>{loading?"Envoi...":"Soumettre anonymement"}</button>
      </div>
    </div>
  );
}

// ============ COTE R CALCULATOR ============
function CalcPage(){
  const[courses,setCourses]=useState([{name:"",grade:"",groupAvg:"",groupStd:""},{name:"",grade:"",groupAvg:"",groupStd:""},{name:"",grade:"",groupAvg:"",groupStd:""},{name:"",grade:"",groupAvg:"",groupStd:""},{name:"",grade:"",groupAvg:"",groupStd:""}]);
  const update=(i,f,v)=>{if(f!=="name"&&v!==""&&(isNaN(v)||parseFloat(v)<0))return;if((f==="grade"||f==="groupAvg")&&parseFloat(v)>100)return;if(f==="groupStd"&&parseFloat(v)>50)return;const c=[...courses];c[i]={...c[i],[f]:v};setCourses(c)};
  const coteR=calculateCoteR(courses);const filled=courses.filter(c=>c.grade&&c.groupAvg&&c.groupStd).length;
  return(
    <div style={{maxWidth:720,margin:"0 auto"}}>
      <h1 style={{fontSize:21,fontWeight:500,margin:"0 0 3px",color:"var(--color-text-primary)"}}>Calculateur de cote R</h1>
      <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 6px"}}>Entre ta note, la moyenne et l'écart-type du groupe.</p>
      <div style={{background:"var(--color-background-info)",borderRadius:"var(--border-radius-md)",padding:"10px 14px",marginBottom:20,display:"flex",alignItems:"start",gap:8}}><span style={{fontSize:14,marginTop:1}}>&#9432;</span><p style={{fontSize:12,color:"var(--color-text-info)",margin:0,lineHeight:1.5}}>Trouve ces infos sur <strong style={{fontWeight:500}}>Omnivox → Résultats</strong> ou <strong style={{fontWeight:500}}>Léa → Mon dossier</strong>.</p></div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.5fr) repeat(3,minmax(0,1fr)) 28px",gap:6,padding:"0 2px"}}><span style={{fontSize:11,color:"var(--color-text-secondary)",fontWeight:500}}>Cours</span><span style={{fontSize:11,color:"var(--color-text-secondary)",fontWeight:500,textAlign:"center"}}>Note %</span><span style={{fontSize:11,color:"var(--color-text-secondary)",fontWeight:500,textAlign:"center"}}>Moy.</span><span style={{fontSize:11,color:"var(--color-text-secondary)",fontWeight:500,textAlign:"center"}}>Éc.-type</span><span/></div>
        {courses.map((c,i)=>(<div key={i} style={{display:"grid",gridTemplateColumns:"minmax(0,1.5fr) repeat(3,minmax(0,1fr)) 28px",gap:6,alignItems:"center"}}>
          <input type="text" placeholder={`Cours ${i+1}`} value={c.name} onChange={e=>update(i,"name",e.target.value)} style={{padding:"8px 8px",fontSize:13,border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",background:"var(--color-background-primary)",color:"var(--color-text-primary)",boxSizing:"border-box",minWidth:0}}/>
          {["grade","groupAvg","groupStd"].map(f=><input key={f} type="text" inputMode="decimal" placeholder="—" value={c[f]} onChange={e=>update(i,f,e.target.value)} style={{padding:"8px 2px",fontSize:13,fontWeight:500,textAlign:"center",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",background:"var(--color-background-secondary)",color:"var(--color-text-primary)",boxSizing:"border-box",minWidth:0}}/>)}
          <button onClick={()=>{if(courses.length>1)setCourses(courses.filter((_,j)=>j!==i))}} style={{background:"none",border:"none",fontSize:16,color:"var(--color-text-tertiary)",cursor:"pointer",padding:0}}>&times;</button>
        </div>))}
      </div>
      <button onClick={()=>setCourses([...courses,{name:"",grade:"",groupAvg:"",groupStd:""}])} style={{background:"none",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"8px 16px",fontSize:13,cursor:"pointer",color:"var(--color-text-secondary)",marginBottom:20}}>+ Ajouter un cours</button>
      {coteR!==null?<div style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)",padding:"22px",textAlign:"center",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:3,background:coteR>=30?"#1D9E75":coteR>=25?"#EF9F27":"#E24B4A"}}/><p style={{fontSize:12,color:"var(--color-text-secondary)",margin:"0 0 3px"}}>Cote R estimée ({filled} cours)</p><p style={{fontSize:38,fontWeight:700,margin:"0 0 4px",fontFamily:"'Space Mono',monospace",color:coteR>=30?"#1D9E75":coteR>=25?"#EF9F27":"#E24B4A"}}>{coteR}</p><p style={{fontSize:12,color:"var(--color-text-tertiary)",margin:0}}>{coteR>=32?"Excellent":coteR>=27?"Solide":coteR>=24?"Correct":"À améliorer"}</p></div>
      :<div style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)",padding:"28px",textAlign:"center"}}><p style={{fontSize:13,color:"var(--color-text-tertiary)",margin:0}}>Remplis au moins un cours complet</p></div>}
    </div>
  );
}

// ============ MAIN APP ============
export default function App(){
  const[page,setPage]=useState(()=>{try{const s=localStorage.getItem("coter_page");return s&&s!=="login"?s:"landing"}catch{return"landing"}});const[prevPage,setPrevPage]=useState("profs");
  const[user,setUser]=useState(null);
  const[profs,setProfs]=useState([]);const[reviewsByProf,setReviewsByProf]=useState({});
  const[loading,setLoading]=useState(true);
  const[submitPrefill,setSubmitPrefill]=useState(null);
  const afterLoginPage=useRef("profs");

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(session)setUser({name:session.user.user_metadata?.full_name||session.user.email?.split("@")[0],email:session.user.email,id:session.user.id});
    });
    const{data:{subscription}}=supabase.auth.onAuthStateChange((ev,session)=>{
      if(session){
        setUser({name:session.user.user_metadata?.full_name||session.user.email?.split("@")[0],email:session.user.email,id:session.user.id});
        setPage(p=>{if(p==="login"){const dest=afterLoginPage.current;afterLoginPage.current="profs";return dest;}return p;});
      }else setUser(null);
    });
    return()=>subscription.unsubscribe();
  },[]);

  const loadData=async()=>{
    setLoading(true);
    const{data:profsData}=await supabase.from('profs').select('*').order('name');
    const{data:reviewsData}=await supabase.from('reviews').select('*').order('created_at',{ascending:false});
    if(profsData)setProfs(profsData);
    if(reviewsData){
      const grouped={};
      reviewsData.forEach(r=>{if(!grouped[r.prof_id])grouped[r.prof_id]=[];grouped[r.prof_id].push(r)});
      setReviewsByProf(grouped);
    }
    setLoading(false);
  };
  useEffect(()=>{loadData()},[]);

  const go=t=>{setPrevPage(page);setPage(t);try{if(t!=="login")localStorage.setItem("coter_page",t)}catch{}};
  const goToLogin=()=>go("login");const goToAccount=()=>go("account");
  const goToEvaluate=prof=>{setSubmitPrefill({name:prof.name,cegep:prof.cegep,dept:prof.dept||""});if(user){go("submit")}else{afterLoginPage.current="submit";go("login")}};
  const navTo=t=>{setPage(t);try{if(t!=="login")localStorage.setItem("coter_page",t)}catch{}};
  const handleLogout=async()=>{await supabase.auth.signOut();setUser(null);navTo("profs")};
  const wrap=ch=><div style={{maxWidth:900,margin:"0 auto",padding:"0 20px",fontFamily:"var(--font-sans)"}}>{ch}</div>;

  if(page==="landing")return wrap(<Landing onStart={()=>navTo("profs")}/>);

  return wrap(<>
    {!["login","account"].includes(page)&&<Nav page={page} setPage={navTo} user={user} goToLogin={goToLogin} goToAccount={goToAccount}/>}
    {loading&&page==="profs"&&<div style={{textAlign:"center",padding:"60px 0"}}><p style={{color:"var(--color-text-tertiary)"}}>Chargement...</p></div>}
    {!loading&&page==="profs"&&<ProfsPage profs={profs} reviewsByProf={reviewsByProf} onEvaluate={goToEvaluate}/>}
    {page==="calc"&&<CalcPage/>}
    {page==="submit"&&<SubmitPage user={user} profs={profs} goToLogin={goToLogin} onSubmitted={loadData} prefill={submitPrefill}/>}
    {page==="login"&&<LoginPage onClose={()=>setPage(prevPage)}/>}
    {page==="account"&&<AccountPage user={user} onLogout={handleLogout} onBack={()=>setPage(prevPage)}/>}
    <footer style={{marginTop:48,paddingTop:14,paddingBottom:24,borderTop:"0.5px solid var(--color-border-tertiary)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
      <Logo size="sm"/><p style={{fontSize:11,color:"var(--color-text-tertiary)",margin:0}}>Fait par des étudiants, pour les étudiants.</p>
    </footer>
  </>);
}
