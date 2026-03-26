"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "./supabase";
import HCaptcha from "@hcaptcha/react-hcaptcha";

const ALLOWED_EMAIL_DOMAINS = new Set([
  // Google
  "gmail.com","googlemail.com",
  // Microsoft — Outlook
  "outlook.com","outlook.fr","outlook.ca","outlook.co.uk","outlook.de",
  "outlook.es","outlook.it","outlook.jp","outlook.com.br","outlook.com.ar",
  "outlook.com.au","outlook.at","outlook.be","outlook.cl","outlook.cz",
  "outlook.dk","outlook.fi","outlook.hu","outlook.ie","outlook.in",
  "outlook.kr","outlook.lv","outlook.my","outlook.nl","outlook.ph",
  "outlook.pt","outlook.sa","outlook.sg","outlook.sk","outlook.th","outlook.tr",
  // Microsoft — Hotmail
  "hotmail.com","hotmail.fr","hotmail.ca","hotmail.co.uk","hotmail.de",
  "hotmail.es","hotmail.it","hotmail.com.br","hotmail.com.ar","hotmail.co.jp",
  "hotmail.nl","hotmail.be","hotmail.ch","hotmail.dk","hotmail.fi",
  "hotmail.gr","hotmail.hu","hotmail.ie","hotmail.in","hotmail.lv",
  "hotmail.lt","hotmail.no","hotmail.pt","hotmail.ro","hotmail.rs",
  "hotmail.ru","hotmail.se","hotmail.sg","hotmail.sk","hotmail.hr",
  // Microsoft — Live
  "live.com","live.fr","live.ca","live.co.uk","live.de","live.es",
  "live.it","live.com.br","live.com.ar","live.nl","live.be","live.ch",
  "live.dk","live.fi","live.no","live.se","live.at","live.com.au",
  "live.com.mx","live.com.pt","live.com.sg","live.co.jp","live.ru",
  "live.ie","live.in","live.jp","live.cl","live.ph",
  // Microsoft — autres
  "msn.com","windowslive.com","passport.com",
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

function isValidEmailFormat(email){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)}
function isEmailAllowed(email){
  if(!isValidEmailFormat(email))return false;
  const domain=(email.split("@")[1]||"").toLowerCase();
  if(!domain)return false;
  if(ALLOWED_EMAIL_DOMAINS.has(domain))return true;
  if(domain.endsWith(".qc.ca"))return true;
  if(domain.endsWith(".gc.ca"))return true;
  if(domain.endsWith(".edu"))return true;
  return false;
}

function sanitize(str){return(str||"").replace(/<[^>]*>/g,"").replace(/[<>`]/g,"").trim()}

const CEGEPS = ["Cégep de l'Abitibi-Témiscamingue","Cégep d'Ahuntsic","Collège d'Alma","Cégep André-Laurendeau","Cégep de Baie-Comeau","Cégep Beauce-Appalaches","Cégep de Bois-de-Boulogne","Champlain Regional College","Cégep de Chicoutimi","Collège Dawson","Cégep de Drummondville","Cégep Édouard-Montpetit","Cégep Garneau","Cégep de la Gaspésie et des Îles","Cégep Gérald-Godin","Cégep de Granby","Cégep Heritage","Cégep John Abbott","Cégep de Jonquière","Cégep de La Pocatière","Cégep de Lanaudière à Joliette","Cégep de Lanaudière à L'Assomption","Cégep de Lanaudière à Terrebonne","Cégep de Lévis","Cégep Limoilou","Cégep Lionel-Groulx","Cégep de Maisonneuve","Cégep Marie-Victorin","Cégep de Matane","Cégep Montmorency","Cégep de l'Outaouais","Cégep de Rimouski","Cégep de Rivière-du-Loup","Cégep de Rosemont","Cégep de Sainte-Foy","Cégep de Saint-Hyacinthe","Cégep de Saint-Jérôme","Cégep Saint-Jean-sur-Richelieu","Cégep de Saint-Laurent","Cégep de Sept-Îles","Cégep de Shawinigan","Cégep de Sherbrooke","Cégep de Sorel-Tracy","Cégep de St-Félicien","Cégep de Thetford","Cégep de Trois-Rivières","Cégep de Valleyfield","Cégep Vanier","Cégep de Victoriaville","Cégep du Vieux Montréal",
  // Privés subventionnés et autres établissements collégiaux
  "Campus Notre-Dame-de-Foy","Collège André-Grasset","Collège Bart","Collège Décarie","Collège Ellis","Collège Français","Collège Jean-de-Brébeuf","Collège Jean-Eudes","Collège Laflèche","Collège LaSalle","Collège Marianopolis","Collège Mérici","Collège O'Sullivan de Montréal","Collège O'Sullivan de Québec","Collège Stanislas","Collège TAV","Collège Universel","Collégial international Sainte-Anne","École de musique Vincent-d'Indy","École nationale de cirque","Institut Kiuna","Institut Teccart","Séminaire de Sherbrooke",
].sort((a,b)=>a.localeCompare(b,"fr"));
const DEPTS = ["Sciences humaines","Sciences de la nature","Philosophie","Français","Mathématiques","Éducation physique","Anglais","Administration","Arts","Informatique","Soins infirmiers","Autre"];

function formatName(r){return r.trim().split(/\s+/).map(w=>{if(w.startsWith("d'")||w.startsWith("D'"))return w[0].toLowerCase()+"'"+w[2].toUpperCase()+w.slice(3).toLowerCase();if(["de","du","des","le","la","les"].includes(w.toLowerCase()))return w.toLowerCase();return w[0].toUpperCase()+w.slice(1).toLowerCase()}).join(" ").replace(/^(.)/,(_,c)=>c.toUpperCase())}
const norm=s=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

function calculateCoteR(courses){const v=courses.filter(c=>c.grade&&c.groupAvg&&c.groupStd);if(!v.length)return null;let t=0,n=0;for(const c of v){const g=parseFloat(c.grade),a=parseFloat(c.groupAvg),s=parseFloat(c.groupStd);if(isNaN(g)||isNaN(a)||isNaN(s)||s===0)continue;t+=((g-a)/s)*(1+(a-72)/100);n++}if(!n)return null;return Math.round((25+(t/n)*5)*10)/10}

// ============ COMPONENTS ============
function Logo({size="lg"}){const s=size==="lg"?{t:28,d:10}:{t:17,d:7};return<span style={{display:"inline-flex",alignItems:"center",gap:4,cursor:"pointer"}}><span style={{fontFamily:"'Space Mono',monospace",fontSize:s.t,fontWeight:700,letterSpacing:"-0.03em",color:"var(--color-text-primary)"}}>coteR</span><span style={{width:s.d,height:s.d,borderRadius:"50%",background:"#1D9E75",display:"inline-block"}}/></span>}
function VBadge({v,small}){const k=v==="keep";return<span style={{display:"inline-block",fontSize:small?10:12,fontWeight:500,padding:small?"2px 7px":"4px 11px",borderRadius:"var(--border-radius-md)",background:k?"var(--color-background-success)":"var(--color-background-danger)",color:k?"#1D9E75":"#E24B4A"}}>{k?"KEEP":"DROP"}</span>}
function RBar({value,invert}){const c=invert?(value<=2?"#1D9E75":value<=3?"#EF9F27":"#E24B4A"):(value>=4?"#1D9E75":value>=3?"#EF9F27":"#E24B4A");return<div style={{height:5,background:"var(--color-background-secondary)",borderRadius:3,flex:1}}><div style={{height:"100%",width:`${(value/5)*100}%`,background:c,borderRadius:3}}/></div>}
const rc=v=>v>=4?"#1D9E75":v>=3?"#EF9F27":"#E24B4A";
const inp={width:"100%",padding:"10px 12px",fontSize:14,border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",background:"var(--color-background-primary)",color:"var(--color-text-primary)",boxSizing:"border-box"};
const lbl={fontSize:12,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:5};

// ============ CEGEP PICKER ============
function CegepPicker({value,onChange,style}){
  const[open,setOpen]=useState(false);
  const q=norm(value||"");
  const suggestions=q.length>=1?CEGEPS.filter(c=>norm(c).includes(q)).slice(0,9):[];
  return(
    <div style={{position:"relative",...(style||{})}}>
      <input type="text" autoComplete="off" placeholder="Chercher un cégep..." value={value||""}
        onChange={e=>{onChange(e.target.value);setOpen(true)}}
        onFocus={()=>setOpen(true)}
        onBlur={()=>setTimeout(()=>setOpen(false),200)}
        style={inp}/>
      {open&&suggestions.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-md)",marginTop:4,zIndex:50,maxHeight:220,overflowY:"auto",boxShadow:"0 4px 14px rgba(0,0,0,0.1)"}}>
        {suggestions.map((c,i)=><button key={c} onMouseDown={()=>{onChange(c);setOpen(false)}} style={{width:"100%",textAlign:"left",background:"none",border:"none",padding:"9px 12px",cursor:"pointer",fontSize:13,color:"var(--color-text-primary)",borderBottom:i<suggestions.length-1?"0.5px solid var(--color-border-tertiary)":"none",display:"block"}}>{c}</button>)}
      </div>}
    </div>
  );
}

// ============ SKELETON ============
function Skeleton(){
  return(
    <div style={{display:"flex",flexDirection:"column",gap:9}}>
      {[1,2,3,4].map(i=>(
        <div key={i} className="skeleton" style={{height:88,borderRadius:"var(--border-radius-lg)",opacity:1-i*0.15}}/>
      ))}
    </div>
  );
}

// ============ MOBILE NAV ============
function MobileNav({page,setPage,user,goToLogin,goToAccount}){
  const items=[
    {id:"profs",icon:"⊞",l:"Profs"},
    {id:"calc",icon:"∑",l:"Cote R"},
    {id:"confessions",icon:"♡",l:"Confessions"},
    {id:"submit",icon:"✏",l:"Évaluer"},
    {id:user?"account":"login",icon:user?"◎":"→",l:user?"Compte":"Connexion"},
  ];
  return(
    <div className="mobile-nav" style={{position:"fixed",bottom:0,left:0,right:0,background:"var(--color-background-primary)",borderTop:"0.5px solid var(--color-border-tertiary)",zIndex:100,justifyContent:"stretch",alignItems:"stretch",boxShadow:"0 -4px 16px rgba(0,0,0,0.07)"}}>
      {items.map(t=>{
        const active=page===t.id||(t.id===user?.id&&page==="account");
        return(
          <button key={t.id} onClick={()=>{if(t.id==="submit"&&!user){goToLogin();return}if(t.id==="login")goToLogin();else if(t.id==="account")goToAccount();else setPage(t.id)}}
            style={{flex:1,border:"none",background:"none",padding:"10px 4px 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer",color:active?"#1D9E75":"var(--color-text-tertiary)",borderTop:`2px solid ${active?"#1D9E75":"transparent"}`,fontSize:10,fontWeight:active?600:400}}>
            <span style={{fontSize:18,lineHeight:1}}>{t.icon}</span>
            {t.l}
          </button>
        );
      })}
    </div>
  );
}

// ============ NAV ============
function Nav({page,setPage,user,goToLogin,goToAccount,onlineCount}){
  return(
    <nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"0.5px solid var(--color-border-tertiary)",marginBottom:20,gap:10}}>
      <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1}}>
        <span onClick={()=>setPage("landing")} style={{flexShrink:0,cursor:"pointer"}}><Logo size="sm"/></span>
        <div className="nav-links" style={{display:"flex",gap:2,minWidth:0}}>
          {[{id:"profs",l:"Profs"},{id:"calc",l:"Cote R"},{id:"confessions",l:"Confessions"},{id:"submit",l:"Évaluer"}].map(t=>(
            <button key={t.id} onClick={()=>{if(t.id==="submit"&&!user){goToLogin();return}setPage(t.id)}} style={{background:page===t.id?"var(--color-background-secondary)":"transparent",border:"none",borderRadius:"var(--border-radius-md)",padding:"6px 10px",fontSize:13,cursor:"pointer",fontWeight:page===t.id?600:400,color:page===t.id?"var(--color-text-primary)":"var(--color-text-secondary)",whiteSpace:"nowrap"}}>{t.l}</button>
          ))}
        </div>
        {onlineCount>0&&<div style={{display:"flex",alignItems:"center",gap:5,padding:"3px 9px",borderRadius:20,background:"var(--color-background-success)",flexShrink:0}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"#1D9E75",display:"inline-block",animation:"pulse 2s infinite"}}/>
          <span style={{fontSize:11,color:"#1D9E75",fontWeight:500,whiteSpace:"nowrap"}}>{onlineCount} en ligne</span>
        </div>}
      </div>
      <div className="nav-auth" style={{flexShrink:0}}>
        {user
          ?<button onClick={goToAccount} style={{width:34,height:34,borderRadius:"50%",background:"var(--color-background-info)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:600,color:"var(--color-text-info)",border:page==="account"?"2px solid #1D9E75":"2px solid transparent",cursor:"pointer",padding:0}}>{(user.name||user.email||"U").charAt(0).toUpperCase()}</button>
          :<button onClick={goToLogin} style={{background:"#1D9E75",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",padding:"7px 16px",fontSize:13,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap"}}>Connexion</button>}
      </div>
    </nav>
  );
}

// ============ WELCOME PAGE ============
function WelcomePage({onDone}){
  useEffect(()=>{const t=setTimeout(onDone,3500);return()=>clearTimeout(t)},[]);
  return(
    <div style={{position:"fixed",inset:0,background:"var(--color-background-primary)",zIndex:1000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{textAlign:"center",maxWidth:360}}>
        <div style={{width:72,height:72,borderRadius:"50%",background:"var(--color-background-success)",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:20}}>
          <span style={{fontSize:32,color:"#1D9E75"}}>✓</span>
        </div>
        <h2 style={{fontSize:24,fontWeight:700,margin:"0 0 8px",color:"var(--color-text-primary)",fontFamily:"'Space Mono',monospace"}}>Compte vérifié!</h2>
        <p style={{fontSize:15,color:"var(--color-text-secondary)",margin:"0 0 28px",lineHeight:1.5}}>Bienvenue sur coteR. Tu es maintenant connecté.</p>
        <div style={{display:"flex",gap:6,justifyContent:"center"}}>
          {[0,1,2].map(i=><span key={i} style={{width:8,height:8,borderRadius:"50%",background:i===0?"#1D9E75":"var(--color-background-secondary)",display:"inline-block"}}/>)}
        </div>
        <p style={{fontSize:12,color:"var(--color-text-tertiary)",marginTop:16}}>Redirection automatique...</p>
      </div>
    </div>
  );
}

// ============ ACCOUNT PAGE ============
function AccountPage({user,onLogout,onBack,onUpdateCegep}){
  const[cegepEdit,setCegepEdit]=useState(user.cegep||"");
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  const handleSaveCegep=async()=>{
    setSaving(true);setSaved(false);
    await onUpdateCegep(cegepEdit);
    setSaving(false);setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };
  return(
    <div style={{maxWidth:520,margin:"0 auto",padding:"24px 0"}}>
      <button onClick={onBack} style={{background:"none",border:"none",fontSize:13,color:"var(--color-text-secondary)",cursor:"pointer",padding:"0 0 16px"}}>&larr; Retour</button>
      <div style={{background:"var(--color-background-primary)",borderRadius:"var(--border-radius-lg)",border:"0.5px solid var(--color-border-tertiary)",padding:"28px 24px",display:"flex",flexDirection:"column",gap:20}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{width:52,height:52,borderRadius:"50%",background:"var(--color-background-info)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,color:"var(--color-text-info)",flexShrink:0}}>{(user.name||user.email||"U").charAt(0).toUpperCase()}</div>
          <div style={{minWidth:0}}><p style={{fontSize:18,fontWeight:500,margin:"0 0 2px",color:"var(--color-text-primary)",overflow:"hidden",textOverflow:"ellipsis"}}>{user.name||"Utilisateur"}</p><p style={{fontSize:13,color:"var(--color-text-secondary)",margin:0,overflow:"hidden",textOverflow:"ellipsis"}}>{(e=>{const[l,d]=e.split("@");return l.slice(0,3)+"***@***."+(d?.split(".").pop()||"com")})(user.email||"")}</p></div>
        </div>
        <div style={{borderTop:"0.5px solid var(--color-border-tertiary)",paddingTop:20}}>
          <label style={lbl}>Mon cégep</label>
          <CegepPicker value={cegepEdit} onChange={setCegepEdit}/>
          <button onClick={handleSaveCegep} disabled={saving} style={{marginTop:10,width:"100%",background:saved?"var(--color-background-success)":saving?"#0F6E56":"#1D9E75",color:saved?"#1D9E75":"#fff",border:saved?"1px solid #1D9E75":"none",borderRadius:"var(--border-radius-md)",padding:"10px",fontSize:13,fontWeight:500,cursor:"pointer"}}>{saving?"Enregistrement...":saved?"✓ Enregistré":"Enregistrer mon cégep"}</button>
        </div>
        <button onClick={onLogout} style={{width:"100%",background:"none",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"11px",fontSize:14,cursor:"pointer",color:"var(--color-text-danger)"}}>Se déconnecter</button>
      </div>
    </div>
  );
}

// ============ LANDING ============
function Landing({onStart,onLogin,onAccount,user,totalUsers,totalReviews}){
  return(
    <div className="page-enter">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 0",borderBottom:"0.5px solid var(--color-border-tertiary)",marginBottom:0}}>
        <Logo size="sm"/>
        {user
          ?<button onClick={onAccount} style={{width:34,height:34,borderRadius:"50%",background:"var(--color-background-info)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:600,color:"var(--color-text-info)",border:"2px solid transparent",cursor:"pointer",padding:0}}>{(user.name||user.email||"U").charAt(0).toUpperCase()}</button>
          :<button onClick={onLogin} style={{background:"none",border:"0.5px solid var(--color-border-secondary)",borderRadius:"var(--border-radius-md)",padding:"7px 16px",fontSize:13,cursor:"pointer",color:"var(--color-text-secondary)"}}>Connexion</button>}
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",padding:"3rem 0.5rem 1.5rem"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"var(--color-background-success)",borderRadius:20,padding:"4px 14px",marginBottom:18,fontSize:12,color:"#1D9E75",fontWeight:500}}><span style={{width:6,height:6,borderRadius:"50%",background:"#1D9E75",display:"inline-block"}}/>100% anonyme · 100% gratuit</div>
        <Logo size="lg"/>
        <p style={{fontSize:"min(34px,8vw)",fontWeight:700,lineHeight:1.1,margin:"14px 0 10px",maxWidth:460,letterSpacing:"-0.03em",color:"var(--color-text-primary)",fontFamily:"'Space Mono',monospace"}}>Drop ou keep?</p>
        <p style={{fontSize:"min(16px,4.2vw)",color:"var(--color-text-secondary)",margin:"0 0 6px",maxWidth:400}}>Lis les avis sur tes profs avant de choisir tes cours — ou partage ton expérience pour aider les autres.</p>
        <p style={{fontSize:13,color:"var(--color-text-tertiary)",maxWidth:340,lineHeight:1.55,margin:"0 0 28px",padding:"0 12px"}}>Pour tous les cégeps du Québec. <strong style={{fontWeight:500,color:"var(--color-text-secondary)"}}>Drop</strong> = tu ne reprendrais pas ce prof. <strong style={{fontWeight:500,color:"var(--color-text-secondary)"}}>Keep</strong> = tu le recommandes.</p>
        <button onClick={onStart} style={{background:"#1D9E75",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",padding:"13px 34px",fontSize:15,fontWeight:600,cursor:"pointer",boxShadow:"0 4px 14px rgba(29,158,117,0.3)"}}>Voir les profs →</button>
        {!user&&<button onClick={onLogin} style={{marginTop:10,background:"none",border:"none",fontSize:13,color:"var(--color-text-tertiary)",cursor:"pointer",textDecoration:"underline"}}>J'ai déjà un compte</button>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,maxWidth:440,width:"100%",marginTop:44,padding:"0 8px"}}>
          {[
            {n:totalUsers?`${totalUsers}`:"→",d:totalUsers?"étudiants inscrits":"Rejoins la communauté"},
            {n:totalReviews?`${totalReviews}`:"Drop/Keep",d:totalReviews?"avis soumis anonymement":"Verdict clair par prof"},
            {n:"73",d:"cégeps couverts au QC"},
          ].map((f,i)=>(
            <div key={i} style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)",padding:"16px 12px"}}><p style={{fontSize:22,fontWeight:700,margin:"0 0 3px",color:"var(--color-text-primary)",fontFamily:"'Space Mono',monospace"}}>{f.n}</p><p style={{fontSize:11,color:"var(--color-text-secondary)",margin:0,lineHeight:1.4}}>{f.d}</p></div>
          ))}
        </div>
      </div>
      <div style={{maxWidth:560,margin:"0 auto",padding:"32px 8px 48px"}}>
        <p style={{fontSize:13,fontWeight:600,color:"var(--color-text-tertiary)",textAlign:"center",margin:"0 0 20px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Comment ça marche</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
          {[
            {step:"1",title:"Cherche ton cégep",desc:"Tape le nom de ton établissement ou d'un prof directement."},
            {step:"2",title:"Lis les avis",desc:"Vois la note, le verdict drop/keep et les commentaires d'autres étudiants."},
            {step:"3",title:"Partage ton expérience",desc:"Crée un compte gratuit et évalue tes profs anonymement."},
          ].map((s,i)=>(
            <div key={i} style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)",padding:"16px 14px"}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:"#1D9E75",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:10}}>
                <span style={{fontSize:12,fontWeight:700,color:"#fff",fontFamily:"'Space Mono',monospace"}}>{s.step}</span>
              </div>
              <p style={{fontSize:13,fontWeight:600,margin:"0 0 4px",color:"var(--color-text-primary)"}}>{s.title}</p>
              <p style={{fontSize:12,color:"var(--color-text-secondary)",margin:0,lineHeight:1.5}}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ LOGIN PAGE ============
function LoginPage({onClose,onVerified}){
  const[mode,setMode]=useState("login"); // "login" | "signup" | "verify"
  const[email,setEmail]=useState("");
  const[password,setPassword]=useState("");
  const[signupCegep,setSignupCegep]=useState("");
  const[otp,setOtp]=useState(["","","","","",""]);
  const[error,setError]=useState("");
  const[loading,setLoading]=useState(false);
  const[resendCooldown,setResendCooldown]=useState(0);
  const[captchaToken,setCaptchaToken]=useState(null);
  const captchaRef=useRef(null);
  const otpRefs=[useRef(),useRef(),useRef(),useRef(),useRef(),useRef()];
  const sitekey=process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY;

  useEffect(()=>{
    if(resendCooldown<=0)return;
    const t=setTimeout(()=>setResendCooldown(r=>r-1),1000);
    return()=>clearTimeout(t);
  },[resendCooldown]);

  const resetCaptcha=()=>{setCaptchaToken(null);captchaRef.current?.resetCaptcha()};

  const handleAuth=async()=>{
    if(!email||!password){setError("Entre ton email et mot de passe.");return}
    if(password.length<6){setError("Mot de passe: 6 caractères minimum.");return}
    if(mode==="signup"&&!isValidEmailFormat(email)){setError("Adresse email invalide.");return}
    if(mode==="signup"&&!isEmailAllowed(email)){setError("Domaine non accepté. Utilise Gmail, Outlook, Yahoo, ou ton email scolaire (.qc.ca).");return}
    if(sitekey&&!captchaToken){setError("Complète le captcha avant de continuer.");return}
    setLoading(true);setError("");
    if(mode==="signup"){
      const opts=sitekey&&captchaToken?{options:{captchaToken}}:{};
      const{data:signUpData,error:e}=await supabase.auth.signUp({email,password,...opts});
      if(e){
        if(e.message?.toLowerCase().includes('rate limit')||e.status===429)
          setError("Trop de tentatives d'inscription en peu de temps. Réessaie dans quelques minutes.");
        else setError(e.message);
        setLoading(false);resetCaptcha();return
      }
      const u=signUpData?.user;
      const emailExists=(u?.identities?.length===0)||(u?.email_confirmed_at!=null);
      if(emailExists){setError("Un compte existe déjà avec cet email. Connecte-toi.");setLoading(false);resetCaptcha();return}
      setMode("verify");setResendCooldown(60);
    }else{
      const opts=sitekey&&captchaToken?{options:{captchaToken}}:{};
      const{error:e}=await supabase.auth.signInWithPassword({email,password,...opts});
      if(e){setError("Email ou mot de passe incorrect.");setLoading(false);resetCaptcha();return}
    }
    setLoading(false);
  };

  const handleOtpChange=(i,val)=>{
    if(!/^\d*$/.test(val))return;
    const next=[...otp];next[i]=val.slice(-1);setOtp(next);
    if(val&&i<5)otpRefs[i+1].current?.focus();
  };
  const handleOtpKey=(i,e)=>{
    if(e.key==="Backspace"&&!otp[i]&&i>0)otpRefs[i-1].current?.focus();
    if(e.key==="Enter")handleVerify();
  };
  const handleOtpPaste=(e)=>{
    const digits=e.clipboardData.getData("text").replace(/\D/g,"").slice(0,6);
    if(digits.length===6){e.preventDefault();setOtp(digits.split(""));otpRefs[5].current?.focus();}
  };

  const handleVerify=async()=>{
    const token=otp.join("");
    if(token.length<6){setError("Entre les 6 chiffres du code.");return}
    setLoading(true);setError("");
    const{error:e}=await supabase.auth.verifyOtp({email,token,type:"signup"});
    if(e){setError("Code invalide ou expiré. Réessaie.");setLoading(false);return}
    if(signupCegep&&CEGEPS.includes(signupCegep)){
      await supabase.auth.updateUser({data:{cegep:signupCegep}});
    }
    setLoading(false);
    onVerified();
  };

  const handleResend=async()=>{
    if(resendCooldown>0)return;
    setError("");
    await supabase.auth.resend({type:"signup",email});
    setResendCooldown(60);
  };

  const card={background:"var(--color-background-primary)",borderRadius:"var(--border-radius-lg)",padding:"32px 28px",border:"0.5px solid var(--color-border-tertiary)",maxWidth:420,margin:"0 auto",width:"100%"};

  if(mode==="verify")return(
    <div style={{maxWidth:460,margin:"0 auto",padding:"40px 16px"}}>
      <div style={card}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:56,height:56,borderRadius:"50%",background:"var(--color-background-success)",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16,fontSize:24}}>✉️</div>
          <h2 style={{fontSize:20,fontWeight:600,margin:"0 0 6px",color:"var(--color-text-primary)"}}>Vérifie ton email</h2>
          <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:0,lineHeight:1.5}}>On a envoyé un code à<br/><strong style={{color:"var(--color-text-primary)"}}>{email}</strong></p>
        </div>
        {error&&<div style={{background:"var(--color-background-danger)",borderRadius:"var(--border-radius-md)",padding:"10px 14px",marginBottom:16}}><p style={{fontSize:13,color:"var(--color-text-danger)",margin:0}}>{error}</p></div>}
        <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:20}}>
          {otp.map((d,i)=>(
            <input key={i} ref={otpRefs[i]} type="text" inputMode="numeric" maxLength={1} value={d}
              onChange={e=>handleOtpChange(i,e.target.value)}
              onKeyDown={e=>handleOtpKey(i,e)}
              onPaste={handleOtpPaste}
              style={{width:44,height:52,textAlign:"center",fontSize:22,fontWeight:700,fontFamily:"'Space Mono',monospace",border:d?"1.5px solid #1D9E75":"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",background:"var(--color-background-primary)",color:"var(--color-text-primary)",outline:"none"}}/>
          ))}
        </div>
        <button onClick={handleVerify} disabled={loading||otp.join("").length<6} style={{width:"100%",background:otp.join("").length<6?"var(--color-background-secondary)":"#1D9E75",color:otp.join("").length<6?"var(--color-text-tertiary)":"#fff",border:"none",borderRadius:"var(--border-radius-md)",padding:"13px",fontSize:15,fontWeight:500,cursor:otp.join("").length<6?"default":"pointer",transition:"all 0.15s"}}>{loading?"Vérification...":"Confirmer le code"}</button>
        <p style={{fontSize:12,color:"var(--color-text-secondary)",textAlign:"center",margin:"16px 0 0"}}>
          Pas reçu? <button onClick={handleResend} disabled={resendCooldown>0} style={{background:"none",border:"none",color:resendCooldown>0?"var(--color-text-tertiary)":"#1D9E75",cursor:resendCooldown>0?"default":"pointer",fontSize:12,fontWeight:500,padding:0}}>{resendCooldown>0?`Renvoyer (${resendCooldown}s)`:"Renvoyer le code"}</button>
        </p>
        <p style={{fontSize:11,color:"var(--color-text-tertiary)",textAlign:"center",margin:"8px 0 0"}}>Ou clique sur le lien directement dans l'email.</p>
      </div>
    </div>
  );

  return(
    <div style={{maxWidth:460,margin:"0 auto",padding:"40px 16px"}}>
      <div style={card}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <Logo size="sm"/>
          <h2 style={{fontSize:20,fontWeight:600,margin:"12px 0 4px",color:"var(--color-text-primary)"}}>{mode==="signup"?"Créer un compte":"Connexion"}</h2>
          <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:0}}>{mode==="signup"?"Gratuit — 10 secondes.":"Content de te revoir."}</p>
        </div>
        {error&&<div style={{background:"var(--color-background-danger)",borderRadius:"var(--border-radius-md)",padding:"10px 14px",marginBottom:14}}><p style={{fontSize:13,color:"var(--color-text-danger)",margin:0}}>{error}</p></div>}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <input type="email" placeholder="ton@email.com" autoComplete="off" value={email} onChange={e=>setEmail(e.target.value)} style={{...inp}}/>
          <input type="password" placeholder="Mot de passe (6+ caractères)" autoComplete="off" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleAuth()}} style={{...inp}}/>
          {mode==="signup"&&<div><label style={{...lbl,marginTop:4}}>Ton cégep <span style={{fontWeight:400,color:"var(--color-text-tertiary)"}}>(optionnel)</span></label><CegepPicker value={signupCegep} onChange={setSignupCegep}/></div>}
          {sitekey&&<div style={{display:"flex",justifyContent:"center",margin:"4px 0"}}><HCaptcha ref={captchaRef} sitekey={sitekey} onVerify={t=>setCaptchaToken(t)} onExpire={resetCaptcha} theme="auto"/></div>}
          <button onClick={handleAuth} disabled={loading} style={{width:"100%",background:loading?"#0F6E56":"#1D9E75",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",padding:"13px",fontSize:15,fontWeight:500,cursor:loading?"wait":"pointer",marginTop:2}}>{loading?"...":(mode==="signup"?"Créer mon compte":"Se connecter")}</button>
        </div>
        <p style={{fontSize:13,color:"var(--color-text-secondary)",textAlign:"center",margin:"18px 0 0"}}>{mode==="signup"?"Déjà un compte?":"Pas de compte?"} <button onClick={()=>{setMode(mode==="signup"?"login":"signup");setError("");resetCaptcha()}} style={{background:"none",border:"none",color:"#1D9E75",cursor:"pointer",fontWeight:500,fontSize:13,padding:0}}>{mode==="signup"?"Se connecter":"Créer un compte"}</button></p>
        <p style={{fontSize:11,color:"var(--color-text-tertiary)",textAlign:"center",margin:"10px 0 0"}}>Tes évaluations restent 100% anonymes.</p>
        <button onClick={onClose} style={{width:"100%",background:"none",border:"none",fontSize:13,color:"var(--color-text-tertiary)",cursor:"pointer",marginTop:14,padding:8}}>&larr; Retour</button>
      </div>
    </div>
  );
}

// ============ REVIEW CARD ============
function ReviewCard({r,likes,userLiked,onLike}){
  const c=rc(r.rating);
  const diffColor=r.difficulty<=2?"#1D9E75":r.difficulty<=3?"#EF9F27":"#E24B4A";
  const diffBg=r.difficulty<=2?"var(--color-background-success)":r.difficulty<=3?"var(--color-background-warning)":"var(--color-background-danger)";
  return(
    <div style={{border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"12px 14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:8,gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
          <div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,fontFamily:"'Space Mono',monospace",background:r.rating>=4?"var(--color-background-success)":r.rating>=3?"var(--color-background-warning)":"var(--color-background-danger)",color:c,flexShrink:0}}>{r.rating}</div>
          <div style={{minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
              <p style={{fontSize:12,fontWeight:600,margin:0,color:"var(--color-text-primary)"}}>{r.course}</p>
              {r.verdict&&<VBadge v={r.verdict} small/>}
            </div>
            <p style={{fontSize:11,color:"var(--color-text-tertiary)",margin:"1px 0 0"}}>{new Date(r.created_at).toLocaleDateString('fr-CA',{month:'short',year:'numeric'})}</p>
          </div>
        </div>
        <div style={{display:"flex",gap:5,flexShrink:0,alignItems:"center"}}>
          {r.difficulty&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:"var(--border-radius-md)",background:diffBg,color:diffColor,fontWeight:500,whiteSpace:"nowrap"}}>Diff. {r.difficulty}/5</span>}
          {r.grade&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:"var(--border-radius-md)",background:"var(--color-background-secondary)",color:"var(--color-text-secondary)",whiteSpace:"nowrap"}}>{r.grade}%</span>}
        </div>
      </div>
      <p style={{fontSize:13,color:"var(--color-text-primary)",lineHeight:1.6,margin:"0 0 10px"}}>{r.review_text}</p>
      <div style={{display:"flex",justifyContent:"flex-end"}}>
        <button onClick={()=>onLike&&onLike(r.id)} style={{background:userLiked?"var(--color-background-success)":"none",border:"0.5px solid "+(userLiked?"#1D9E75":"var(--color-border-tertiary)"),borderRadius:"var(--border-radius-md)",padding:"4px 10px",fontSize:11,cursor:"pointer",color:userLiked?"#1D9E75":"var(--color-text-tertiary)",display:"flex",alignItems:"center",gap:4}}>
          <span style={{fontSize:13}}>{userLiked?"♥":"♡"}</span>{likes||0}
        </button>
      </div>
    </div>
  );
}

// ============ PROF DETAIL ============
function ProfDetail({prof,reviews,onBack,onEvaluate,likesByReview,userLikes,onLike}){
  const[sortR,setSortR]=useState("recent");
  const rating=reviews.length?Math.round(reviews.reduce((s,r)=>s+r.rating,0)/reviews.length*10)/10:0;
  const diff=reviews.length?Math.round(reviews.reduce((s,r)=>s+r.difficulty,0)/reviews.length*10)/10:0;
  const keepPct=reviews.length?Math.round(100*reviews.filter(r=>r.verdict==="keep").length/reviews.length):0;
  const verdict=keepPct>=50?"keep":"drop";
  const diffColor=diff<=2?"#1D9E75":diff<=3?"#EF9F27":"#E24B4A";
  const sorted=[...reviews].sort((a,b)=>sortR==="helpful"?((likesByReview?.[b.id]||0)-(likesByReview?.[a.id]||0)):new Date(b.created_at)-new Date(a.created_at));
  return(
    <div style={{maxWidth:720,margin:"0 auto"}} className="page-enter">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <button onClick={onBack} style={{background:"none",border:"none",fontSize:13,color:"var(--color-text-secondary)",cursor:"pointer",padding:"4px 0",display:"flex",alignItems:"center",gap:4}}><span>←</span> Retour</button>
        <button onClick={()=>onEvaluate(prof)} style={{background:"#1D9E75",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",padding:"7px 16px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Évaluer ce prof</button>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:18,gap:12}}>
        <div style={{minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}><h1 style={{fontSize:"min(22px,5.5vw)",fontWeight:700,margin:0,color:"var(--color-text-primary)"}}>{prof.name}</h1>{reviews.length>0&&<VBadge v={verdict}/>}</div>
          <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 2px"}}>{prof.dept} — {prof.cegep}</p>
          {prof.courses&&prof.courses.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:5}}>{prof.courses.map(c=><span key={c} style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:"var(--color-background-secondary)",color:"var(--color-text-secondary)"}}>{c}</span>)}</div>}
        </div>
        {reviews.length>0&&<div style={{textAlign:"center",flexShrink:0,background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)",padding:"10px 16px"}}><p style={{fontSize:32,fontWeight:700,margin:0,fontFamily:"'Space Mono',monospace",color:rc(rating),lineHeight:1}}>{rating}</p><p style={{fontSize:10,color:"var(--color-text-tertiary)",margin:"2px 0 0"}}>/5 · {reviews.length} avis</p></div>}
      </div>
      {reviews.length>0&&<>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:20}}>
          {[
            {l:"Reprendrait",v:`${keepPct}%`,c:keepPct>=70?"#1D9E75":keepPct>=50?"#EF9F27":"#E24B4A"},
            {l:"Difficulté moy.",v:`${diff}/5`,c:diffColor},
            {l:"Avis soumis",v:reviews.length,c:"var(--color-text-primary)"},
          ].map((s,i)=>(
            <div key={i} style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"12px 8px",textAlign:"center"}}><p style={{fontSize:11,color:"var(--color-text-secondary)",margin:"0 0 3px"}}>{s.l}</p><p style={{fontSize:18,fontWeight:700,margin:0,fontFamily:"'Space Mono',monospace",color:s.c}}>{s.v}</p></div>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <h2 style={{fontSize:15,fontWeight:600,margin:0,color:"var(--color-text-primary)"}}>Avis ({reviews.length})</h2>
          <div style={{display:"flex",gap:3}}>
            {[{id:"recent",l:"Récents"},{id:"helpful",l:"Utiles"}].map(s=>(
              <button key={s.id} onClick={()=>setSortR(s.id)} style={{background:sortR===s.id?"var(--color-background-secondary)":"transparent",border:"0.5px solid "+(sortR===s.id?"var(--color-border-secondary)":"transparent"),borderRadius:"var(--border-radius-md)",padding:"4px 10px",fontSize:11,cursor:"pointer",color:sortR===s.id?"var(--color-text-primary)":"var(--color-text-tertiary)",fontWeight:sortR===s.id?500:400}}>{s.l}</button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {sorted.map((r)=><ReviewCard key={r.id} r={r} likes={likesByReview?.[r.id]||0} userLiked={userLikes?.has(r.id)||false} onLike={onLike}/>)}
        </div>
      </>}
      {reviews.length===0&&<div style={{textAlign:"center",padding:"40px 16px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)"}}><p style={{fontSize:14,color:"var(--color-text-secondary)",margin:"0 0 12px"}}>Aucun avis encore pour ce prof.</p><button onClick={()=>onEvaluate(prof)} style={{background:"#1D9E75",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",padding:"8px 20px",fontSize:13,fontWeight:500,cursor:"pointer"}}>Être le premier à évaluer</button></div>}
    </div>
  );
}

// ============ RANKING PAGE ============
function RankingPage({profs,reviewsByProf,onEvaluate,likesByReview,userLikes,onLike}){
  const[sel,setSel]=useState(null);
  const MIN=2;
  const stats=profs.map(p=>{
    const revs=reviewsByProf[p.id]||[];
    if(revs.length<MIN)return null;
    const rating=Math.round(revs.reduce((s,r)=>s+r.rating,0)/revs.length*10)/10;
    const diff=Math.round(revs.reduce((s,r)=>s+r.difficulty,0)/revs.length*10)/10;
    const keepPct=Math.round(100*revs.filter(r=>r.verdict==="keep").length/revs.length);
    return{...p,rating,difficulty:diff,totalReviews:revs.length,keepPct,verdict:keepPct>=50?"keep":"drop"};
  }).filter(Boolean);

  if(sel){const revs=reviewsByProf[sel.id]||[];return<ProfDetail prof={sel} reviews={revs} onBack={()=>setSel(null)} onEvaluate={onEvaluate} likesByReview={likesByReview} userLikes={userLikes} onLike={onLike}/>}

  const best=[...stats].sort((a,b)=>b.rating-a.rating).slice(0,5);
  const worst=[...stats].sort((a,b)=>a.rating-b.rating).slice(0,5);

  const RankCard=({rank,p,valueLabel,valueColor})=>(
    <div onClick={()=>setSel(p)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",cursor:"pointer",transition:"border-color 0.15s,box-shadow 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--color-border-secondary)";e.currentTarget.style.boxShadow="var(--shadow-sm)"}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--color-border-tertiary)";e.currentTarget.style.boxShadow="none"}}>
      <span style={{fontSize:15,fontFamily:"'Space Mono',monospace",fontWeight:700,color:"var(--color-text-tertiary)",minWidth:22,textAlign:"center"}}>#{rank}</span>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2,flexWrap:"wrap"}}>
          <p style={{fontSize:14,fontWeight:600,margin:0,color:"var(--color-text-primary)"}}>{p.name}</p>
          <VBadge v={p.verdict} small/>
        </div>
        <p style={{fontSize:11,color:"var(--color-text-secondary)",margin:0}}>{p.dept} — {p.cegep}</p>
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        <p style={{fontSize:22,fontWeight:700,margin:0,fontFamily:"'Space Mono',monospace",color:valueColor,lineHeight:1}}>{valueLabel}</p>
        <p style={{fontSize:10,color:"var(--color-text-tertiary)",margin:"2px 0 0"}}>{p.totalReviews} avis</p>
      </div>
    </div>
  );

  if(!stats.length)return(
    <div className="page-enter" style={{maxWidth:720,margin:"0 auto"}}>
      <h1 style={{fontSize:22,fontWeight:700,margin:"0 0 3px",color:"var(--color-text-primary)"}}>Classement</h1>
      <div style={{textAlign:"center",padding:"48px 16px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)",marginTop:20}}>
        <p style={{fontSize:14,color:"var(--color-text-tertiary)",margin:0}}>Pas encore assez d'avis pour établir un classement.</p>
      </div>
    </div>
  );

  return(
    <div className="page-enter" style={{maxWidth:720,margin:"0 auto"}}>
      <h1 style={{fontSize:22,fontWeight:700,margin:"0 0 3px",color:"var(--color-text-primary)"}}>Classement</h1>
      <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 28px"}}>Tous les cégeps confondus — minimum {MIN} avis.</p>
      <div style={{marginBottom:32}}>
        <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 12px",color:"var(--color-text-primary)",display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>🏆</span>Meilleurs profs</h2>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {best.map((p,i)=><RankCard key={p.id} rank={i+1} p={p} valueLabel={p.rating} valueColor={rc(p.rating)}/>)}
        </div>
      </div>
      <div style={{marginBottom:32}}>
        <h2 style={{fontSize:16,fontWeight:600,margin:"0 0 12px",color:"var(--color-text-primary)",display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>⚠️</span>Profs à éviter</h2>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {worst.map((p,i)=><RankCard key={p.id} rank={i+1} p={p} valueLabel={p.rating} valueColor={rc(p.rating)}/>)}
        </div>
      </div>
    </div>
  );
}

const POPULAR_CEGEPS=["Cégep de Granby","Cégep Montmorency","Cégep du Vieux Montréal","Cégep de Sherbrooke","Cégep de Trois-Rivières","Cégep Limoilou","Collège Dawson","Cégep Édouard-Montpetit"];

// ============ PROFS PAGE (reads from Supabase) ============
function ProfsPage({profs,reviewsByProf,onEvaluate,likesByReview,userLikes,onLike}){
  const[search,setSearch]=useState("");const[cegep,setCegep]=useState("");const[sel,setSel]=useState(null);const[sort,setSort]=useState("rating");
  if(sel){const revs=reviewsByProf[sel.id]||[];return<ProfDetail prof={sel} reviews={revs} onBack={()=>setSel(null)} onEvaluate={onEvaluate} likesByReview={likesByReview} userLikes={userLikes} onLike={onLike}/>}
  const q=norm(search.trim());
  const cq=norm(cegep.trim());
  const profsWithStats=profs.map(p=>{const revs=reviewsByProf[p.id]||[];const rating=revs.length?Math.round(revs.reduce((s,r)=>s+r.rating,0)/revs.length*10)/10:0;const diff=revs.length?Math.round(revs.reduce((s,r)=>s+r.difficulty,0)/revs.length*10)/10:0;const keepPct=revs.length?Math.round(100*revs.filter(r=>r.verdict==="keep").length/revs.length):0;return{...p,rating,difficulty:diff,totalReviews:revs.length,verdict:keepPct>=50?"keep":"drop",tags:[]}});
  const profsWithReviews=profsWithStats.filter(p=>p.totalReviews>0);
  let list=q.length>=1?profsWithReviews.filter(p=>norm(p.name).includes(q)||p.courses?.some(c=>norm(c).includes(q))||norm(p.dept||"").includes(q)):cq.length>=1?profsWithReviews.filter(p=>norm(p.cegep).includes(cq)):[];
  list.sort((a,b)=>sort==="rating"?b.rating-a.rating:a.difficulty-b.difficulty);
  const showCegepCol=q.length>=1||(cq.length>=1&&CEGEPS.filter(c=>norm(c).includes(cq)).length>1);
  const hasFilter=q.length>=1||cq.length>=1;
  return(
    <div style={{maxWidth:720,margin:"0 auto"}} className="page-enter">
      <h1 style={{fontSize:22,fontWeight:700,margin:"0 0 3px",color:"var(--color-text-primary)"}}>Profs évalués</h1>
      <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 14px"}}>Cherche ton cégep ou un prof pour voir les avis d'autres étudiants.</p>
      <input type="text" placeholder="Chercher un prof par nom, cours ou département..." value={search} onChange={e=>setSearch(e.target.value)} style={{...inp,marginBottom:8}}/>
      {q.length<1&&<div style={{marginBottom:12}}>
        <CegepPicker value={cegep} onChange={setCegep}/>
        {!cq&&<div style={{marginTop:10,display:"flex",flexWrap:"wrap",gap:6}}>
          {POPULAR_CEGEPS.map(c=><button key={c} onClick={()=>setCegep(c)} style={{fontSize:11,padding:"4px 10px",borderRadius:20,border:"0.5px solid var(--color-border-secondary)",background:"var(--color-background-secondary)",color:"var(--color-text-secondary)",cursor:"pointer",whiteSpace:"nowrap"}}>{c.replace("Cégep de ","").replace("Cégep ","").replace("Collège ","")}</button>)}
        </div>}
      </div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        {hasFilter?<p style={{fontSize:12,color:"var(--color-text-tertiary)",margin:0}}>{list.length} résultat{list.length!==1?"s":""}</p>:<span/>}
        <div style={{display:"flex",gap:3}}>{[{id:"rating",l:"Meilleur"},{id:"difficulty",l:"Facile"}].map(s=>(<button key={s.id} onClick={()=>setSort(s.id)} style={{background:sort===s.id?"var(--color-background-secondary)":"transparent",border:"0.5px solid "+(sort===s.id?"var(--color-border-secondary)":"transparent"),borderRadius:"var(--border-radius-md)",padding:"4px 10px",fontSize:11,cursor:"pointer",color:sort===s.id?"var(--color-text-primary)":"var(--color-text-secondary)",fontWeight:sort===s.id?500:400}}>{s.l}</button>))}</div>
      </div>
      {list.length===0
        ?<div style={{textAlign:"center",padding:"40px 16px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)"}}>
          <p style={{fontSize:15,fontWeight:600,color:"var(--color-text-primary)",margin:"0 0 6px"}}>{hasFilter?"Aucun résultat trouvé":"Par où commencer?"}</p>
          <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:0,lineHeight:1.6}}>{hasFilter?"Ce prof n'a pas encore été évalué sur coteR.":"Tape le nom de ton cégep dans le champ ci-dessus (ex: «\u00a0Montmorency\u00a0») ou cherche directement un prof par son nom."}</p>
          {hasFilter&&<button onClick={()=>onEvaluate({name:search.trim(),cegep:(!q&&CEGEPS.includes(cegep))?cegep:"",dept:""})} style={{marginTop:14,background:"#1D9E75",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",padding:"8px 20px",fontSize:13,fontWeight:500,cursor:"pointer"}}>Être le premier à l'évaluer →</button>}
        </div>
        :<div style={{display:"flex",flexDirection:"column",gap:8}}>{list.map(p=>(
          <div key={p.id} onClick={()=>setSel(p)} style={{border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"14px 16px",cursor:"pointer",transition:"border-color 0.15s, box-shadow 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--color-border-secondary)";e.currentTarget.style.boxShadow="var(--shadow-sm)"}} onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--color-border-tertiary)";e.currentTarget.style.boxShadow="none"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",marginBottom:p.totalReviews>0?10:0,gap:8}}>
              <div style={{minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3,flexWrap:"wrap"}}>
                  <p style={{fontSize:14,fontWeight:600,margin:0,color:"var(--color-text-primary)"}}>{p.name}</p>
                  {p.totalReviews>0&&<VBadge v={p.verdict} small/>}
                </div>
                <p style={{fontSize:11,color:"var(--color-text-secondary)",margin:0}}>{p.dept}{showCegepCol?` — ${p.cegep}`:""}</p>
              </div>
              {p.totalReviews>0&&<div style={{textAlign:"right",flexShrink:0}}>
                <p style={{fontSize:24,fontWeight:700,margin:0,fontFamily:"'Space Mono',monospace",color:rc(p.rating),lineHeight:1}}>{p.rating}</p>
                <p style={{fontSize:10,color:"var(--color-text-tertiary)",margin:"2px 0 0"}}>{p.totalReviews} avis · voir →</p>
              </div>}
            </div>
            {p.totalReviews>0&&<div style={{display:"flex",gap:14}}>
              <div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:10,color:"var(--color-text-secondary)"}}>Qualité</span><span style={{fontSize:10,fontWeight:500,color:"var(--color-text-primary)"}}>{p.rating}/5</span></div><RBar value={p.rating}/></div>
              <div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:10,color:"var(--color-text-secondary)"}}>Difficulté</span><span style={{fontSize:10,fontWeight:500,color:"var(--color-text-primary)"}}>{p.difficulty}/5</span></div><RBar value={p.difficulty} invert/></div>
            </div>}
          </div>
        ))}</div>
      }
      {q.length>=1&&list.length>0&&<div style={{textAlign:"center",marginTop:16,padding:"12px 16px",borderTop:"0.5px solid var(--color-border-tertiary)"}}>
        <p style={{fontSize:12,color:"var(--color-text-tertiary)",margin:"0 0 6px"}}>Ton prof n'est pas dans la liste? Il n'a pas encore été évalué.</p>
        <button onClick={()=>onEvaluate({name:search.trim(),cegep:"",dept:""})} style={{background:"none",border:"0.5px solid #1D9E75",borderRadius:"var(--border-radius-md)",padding:"5px 14px",fontSize:12,color:"#1D9E75",cursor:"pointer",fontWeight:500}}>Évaluer "{search.trim()}"</button>
      </div>}
    </div>
  );
}

// ============ SUBMIT PAGE (writes to Supabase) ============
function SubmitPage({user,profs,goToLogin,onSubmitted,prefill}){
  const[cegep,setCegep]=useState(prefill?.cegep||user?.cegep||"");const[profName,setProfName]=useState(prefill?.name||"");const[dept,setDept]=useState(prefill?.dept||"");const[course,setCourse]=useState("");const[quality,setQuality]=useState("");const[diff,setDiff]=useState("");const[verdict,setVerdict]=useState("");const[review,setReview]=useState("");const[submitted,setSubmitted]=useState(false);const[showProfSug,setShowProfSug]=useState(false);const[showCourseSug,setShowCourseSug]=useState(false);const[customCourse,setCustomCourse]=useState(false);const[error,setError]=useState("");const[loading,setLoading]=useState(false);const[lastSubmitTime,setLastSubmitTime]=useState(0);const[submitCooldown,setSubmitCooldown]=useState(false);

  if(!user)return(<div style={{maxWidth:480,margin:"0 auto",textAlign:"center",padding:"60px 12px"}}><div style={{width:44,height:44,borderRadius:"50%",background:"var(--color-background-secondary)",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:14}}><span style={{fontSize:20,color:"var(--color-text-secondary)"}}>&#9998;</span></div><p style={{fontSize:16,fontWeight:500,color:"var(--color-text-primary)",margin:"0 0 8px"}}>Connecte-toi pour évaluer</p><p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 20px"}}>Tu dois avoir un compte pour soumettre une évaluation anonyme.</p><button onClick={goToLogin} style={{background:"#1D9E75",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",padding:"10px 24px",fontSize:14,fontWeight:500,cursor:"pointer"}}>Se connecter &rarr;</button></div>);
  if(submitted)return(
    <div style={{maxWidth:480,margin:"0 auto",textAlign:"center",padding:"60px 12px"}} className="page-enter">
      <div style={{width:52,height:52,borderRadius:"50%",background:"var(--color-background-success)",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16}}><span style={{color:"#1D9E75",fontSize:24}}>✓</span></div>
      <h2 style={{fontSize:20,fontWeight:700,margin:"0 0 6px",color:"var(--color-text-primary)"}}>Merci!</h2>
      <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 24px"}}>Ton évaluation a été soumise anonymement.</p>
      <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
        <button onClick={()=>{setSubmitted(false);setProfName("");setCourse("");setQuality("");setDiff("");setVerdict("");setReview("");setDept("");setError("")}} style={{background:"var(--color-background-secondary)",border:"none",borderRadius:"var(--border-radius-md)",padding:"9px 20px",fontSize:13,cursor:"pointer",color:"var(--color-text-primary)",fontWeight:500}}>Évaluer un autre prof</button>
      </div>
    </div>
  );

  const exactCegep=CEGEPS.find(c=>c===cegep)||null;
  const pq=norm(profName.trim());
  const profSuggestions=pq.length>=1&&exactCegep?profs.filter(p=>p.cegep===exactCegep&&norm(p.name).includes(pq)).slice(0,5):[];
  const allCourses=exactCegep?[...new Set(profs.filter(p=>p.cegep===exactCegep).flatMap(p=>p.courses||[]))].sort():[];
  const cq=course.trim().toLowerCase();
  const courseSuggestions=cq.length>=1?allCourses.filter(c=>c.toLowerCase().includes(cq)).slice(0,5):[];
  const selectProf=p=>{setProfName(p.name);setDept(p.dept||"");setCourse("");setCustomCourse(false);setShowProfSug(false)};
  const existingMatch=pq.length>=3&&exactCegep?profs.find(p=>norm(p.name)===norm(formatName(profName))&&p.cegep===exactCegep):null;
  const profCourses=existingMatch?.courses||[];

  const handleSubmit=async()=>{
    // Rate limit frontend: 60s entre soumissions
    if(Date.now()-lastSubmitTime<15000&&lastSubmitTime>0){setError("Attends 15 secondes avant de soumettre un autre avis.");return}
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
      // Rate limit par user: max 10 évaluations par 24h
      const since=new Date(Date.now()-24*60*60*1000).toISOString();
      const{count:recentCount,error:rcErr}=await supabase.from('reviews').select('*',{count:'exact',head:true}).eq('user_id',user.id).gte('created_at',since);
      if(!rcErr&&recentCount>=10){setError("Limite atteinte : max 10 évaluations par 24h.");setLoading(false);return}

      let profId;
      const existing=profs.find(p=>p.name.toLowerCase()===formatted.toLowerCase()&&p.cegep===exactCegep);
      if(!existing){
        // Limite par user: max 5 nouveaux profs par 24h
        const{data:userProfs,error:upErr}=await supabase.from('reviews').select('prof_id').eq('user_id',user.id).gte('created_at',since);
        if(!upErr&&userProfs){
          const recentProfIds=new Set(userProfs.map(r=>r.prof_id));
          const newProfsToday=[...recentProfIds].filter(id=>!profs.find(p=>p.id===id));
          if(newProfsToday.length>=5){setError("Limite atteinte : max 5 nouveaux profs ajoutés par 24h.");setLoading(false);return}
        }
      }
      if(existing){profId=existing.id}else{
        const{data,error:e}=await supabase.from('profs').insert({name:formatted,cegep:exactCegep,dept:validDept,courses:[cleanCourse]}).select().single();
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
    <div style={{maxWidth:620,margin:"0 auto"}} className="page-enter">
      <h1 style={{fontSize:22,fontWeight:700,margin:"0 0 3px",color:"var(--color-text-primary)"}}>Évalue ton prof</h1>
      <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 16px"}}>Ton avis est <strong style={{fontWeight:500}}>100% anonyme</strong> — aucune info personnelle n'est partagée.</p>
      <div style={{background:"var(--color-background-info)",borderRadius:"var(--border-radius-md)",padding:"10px 14px",marginBottom:18,display:"flex",alignItems:"start",gap:8}}>
        <span style={{fontSize:14,marginTop:1,flexShrink:0}}>ℹ</span>
        <p style={{fontSize:12,color:"var(--color-text-info)",margin:0,lineHeight:1.55}}><strong style={{fontWeight:500}}>Drop ou Keep?</strong> C'est simple — est-ce que tu reprendrais ce prof si tu avais le choix? <strong style={{fontWeight:500}}>Keep</strong> = oui, tu le recommandes. <strong style={{fontWeight:500}}>Drop</strong> = tu éviterais de le reprendre.</p>
      </div>
      {error&&<div style={{background:"var(--color-background-danger)",borderRadius:"var(--border-radius-md)",padding:"10px 14px",marginBottom:14}}><p style={{fontSize:13,color:"var(--color-text-danger)",margin:0}}>{error}</p></div>}
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div><label style={lbl}>Cégep</label><CegepPicker value={cegep} onChange={setCegep}/></div>
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
          <div>
            <label style={lbl}>Qualité du prof <span style={{fontWeight:400,color:"var(--color-text-tertiary)"}}>(pédagogie, clarté, disponibilité)</span></label>
            <div style={{display:"flex",gap:4}}>{[1,2,3,4,5].map(n=>{const sel=quality===String(n);return<button key={n} onClick={()=>setQuality(String(n))} style={{flex:1,padding:"9px 0",fontSize:14,fontWeight:sel?700:400,border:sel?"2px solid #1D9E75":"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",background:sel?"var(--color-background-success)":"var(--color-background-primary)",color:sel?"#1D9E75":"var(--color-text-secondary)",fontFamily:"'Space Mono',monospace"}}>{n}</button>})}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}><span style={{fontSize:10,color:"var(--color-text-tertiary)"}}>1 = Très mauvais</span><span style={{fontSize:10,color:"var(--color-text-tertiary)"}}>5 = Excellent</span></div>
          </div>
          <div>
            <label style={lbl}>Difficulté du cours <span style={{fontWeight:400,color:"var(--color-text-tertiary)"}}>(charge de travail, examens)</span></label>
            <div style={{display:"flex",gap:4}}>{[1,2,3,4,5].map(n=>{const sel=diff===String(n);const dc=n<=2?"#1D9E75":n<=3?"#EF9F27":"#E24B4A";const dbg=n<=2?"var(--color-background-success)":n<=3?"var(--color-background-warning)":"var(--color-background-danger)";return<button key={n} onClick={()=>setDiff(String(n))} style={{flex:1,padding:"9px 0",fontSize:14,fontWeight:sel?700:400,border:sel?`2px solid ${dc}`:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",cursor:"pointer",background:sel?dbg:"var(--color-background-primary)",color:sel?dc:"var(--color-text-secondary)",fontFamily:"'Space Mono',monospace"}}>{n}</button>})}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}><span style={{fontSize:10,color:"var(--color-text-tertiary)"}}>1 = Très facile</span><span style={{fontSize:10,color:"var(--color-text-tertiary)"}}>5 = Très difficile</span></div>
          </div>
        </div>
        <div><label style={lbl}>Ton verdict — tu reprendrais ce prof?</label><div style={{display:"flex",gap:8}}>
          <button onClick={()=>setVerdict("keep")} style={{flex:1,padding:"11px",fontSize:14,fontWeight:600,border:verdict==="keep"?"2px solid #1D9E75":"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",background:verdict==="keep"?"var(--color-background-success)":"var(--color-background-primary)",color:verdict==="keep"?"#1D9E75":"var(--color-text-secondary)",cursor:"pointer"}}>✓ KEEP — je le recommande</button>
          <button onClick={()=>setVerdict("drop")} style={{flex:1,padding:"11px",fontSize:14,fontWeight:600,border:verdict==="drop"?"2px solid #E24B4A":"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",background:verdict==="drop"?"var(--color-background-danger)":"var(--color-background-primary)",color:verdict==="drop"?"#E24B4A":"var(--color-text-secondary)",cursor:"pointer"}}>✕ DROP — je l'éviterais</button>
        </div></div>
        <div><label style={lbl}>Ton avis <span style={{fontWeight:400,color:"var(--color-text-tertiary)"}}>(ce qui t'a le plus aidé ou dérangé)</span></label><textarea placeholder="Ex: Explique bien mais les examens sont difficiles. Présentation obligatoire en classe. Je recommande de lire le manuel avant les cours..." rows={4} maxLength={1000} value={review} onChange={e=>setReview(e.target.value.slice(0,1000))} style={{...inp,resize:"vertical",fontFamily:"inherit",lineHeight:1.55}}/><p style={{fontSize:11,color:review.length>900?"#E24B4A":review.length>0?"var(--color-text-secondary)":"var(--color-text-tertiary)",textAlign:"right",margin:"4px 0 0"}}>{review.length}/1000</p></div>
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
    <div style={{maxWidth:720,margin:"0 auto"}} className="page-enter">
      <h1 style={{fontSize:22,fontWeight:700,margin:"0 0 3px",color:"var(--color-text-primary)"}}>Calculateur de cote R</h1>
      <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 6px"}}>La cote R est la note utilisée pour les admissions universitaires au Québec. Entre tes résultats pour l'estimer.</p>
      <div style={{background:"var(--color-background-info)",borderRadius:"var(--border-radius-md)",padding:"10px 14px",marginBottom:20,display:"flex",alignItems:"start",gap:8}}><span style={{fontSize:14,marginTop:1}}>&#9432;</span><p style={{fontSize:12,color:"var(--color-text-info)",margin:0,lineHeight:1.5}}>Trouve ces infos sur <strong style={{fontWeight:500}}>Omnivox → Résultats</strong> ou <strong style={{fontWeight:500}}>Léa → Mon dossier</strong>.</p></div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.5fr) repeat(3,minmax(0,1fr)) 28px",gap:6,padding:"0 2px"}}><span style={{fontSize:11,color:"var(--color-text-secondary)",fontWeight:500}}>Cours</span><span style={{fontSize:11,color:"var(--color-text-secondary)",fontWeight:500,textAlign:"center"}}>Note %</span><span style={{fontSize:11,color:"var(--color-text-secondary)",fontWeight:500,textAlign:"center"}}>Moy.</span><span style={{fontSize:11,color:"var(--color-text-secondary)",fontWeight:500,textAlign:"center"}}>Éc.-type</span><span/></div>
        {courses.map((c,i)=>(<div key={i} style={{display:"grid",gridTemplateColumns:"minmax(0,1.5fr) repeat(3,minmax(0,1fr)) 28px",gap:6,alignItems:"center"}}>
          <input type="text" placeholder={`Cours ${i+1}`} value={c.name} onChange={e=>update(i,"name",e.target.value)} style={{padding:"8px 8px",fontSize:13,border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",background:"var(--color-background-primary)",color:"var(--color-text-primary)",boxSizing:"border-box",minWidth:0}}/>
          {["grade","groupAvg","groupStd"].map(f=><input key={f} type="text" inputMode="decimal" placeholder="—" value={c[f]} onChange={e=>update(i,f,e.target.value)} style={{padding:"8px 2px",fontSize:13,fontWeight:500,textAlign:"center",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",background:"var(--color-background-secondary)",color:"var(--color-text-primary)",boxSizing:"border-box",minWidth:0}}/>)}
          <button onClick={()=>{if(courses.length>1)setCourses(courses.filter((_,j)=>j!==i))}} style={{background:"none",border:"none",fontSize:16,color:courses.length>1?"var(--color-text-tertiary)":"transparent",cursor:courses.length>1?"pointer":"default",padding:0,pointerEvents:courses.length>1?"auto":"none"}}>&times;</button>
        </div>))}
      </div>
      <button onClick={()=>setCourses([...courses,{name:"",grade:"",groupAvg:"",groupStd:""}])} style={{background:"none",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:"8px 16px",fontSize:13,cursor:"pointer",color:"var(--color-text-secondary)",marginBottom:20}}>+ Ajouter un cours</button>
      {coteR!==null?<div style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)",padding:"22px",textAlign:"center",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:3,background:coteR>=30?"#1D9E75":coteR>=25?"#EF9F27":"#E24B4A"}}/><p style={{fontSize:12,color:"var(--color-text-secondary)",margin:"0 0 3px"}}>Cote R estimée ({filled} cours)</p><p style={{fontSize:38,fontWeight:700,margin:"0 0 4px",fontFamily:"'Space Mono',monospace",color:coteR>=30?"#1D9E75":coteR>=25?"#EF9F27":"#E24B4A"}}>{coteR}</p><p style={{fontSize:12,color:"var(--color-text-tertiary)",margin:0}}>{coteR>=32?"Excellent":coteR>=27?"Solide":coteR>=24?"Correct":"À améliorer"}</p></div>
      :<div style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)",padding:"28px",textAlign:"center"}}><p style={{fontSize:13,color:"var(--color-text-tertiary)",margin:0}}>Remplis au moins un cours complet</p></div>}
    </div>
  );
}

// ============ CONFESSIONS PAGE ============
function timeAgo(dateStr){
  const s=Math.floor((Date.now()-new Date(dateStr))/1000);
  if(s<60)return"à l'instant";
  if(s<3600)return`il y a ${Math.floor(s/60)} min`;
  if(s<86400)return`il y a ${Math.floor(s/3600)}h`;
  if(s<604800)return`il y a ${Math.floor(s/86400)} jour${Math.floor(s/86400)>1?"s":""}`;
  return`il y a ${Math.floor(s/604800)} semaine${Math.floor(s/604800)>1?"s":""}`;
}

function ConfessionsPage({user,goToLogin}){
  const[cegep,setCegep]=useState(user?.cegep||"__all__");
  const[content,setContent]=useState("");
  const[confessions,setConfessions]=useState([]);
  const[loadingFeed,setLoadingFeed]=useState(false);
  const[posting,setPosting]=useState(false);
  const[error,setError]=useState("");
  const[feedError,setFeedError]=useState("");
  const[page,setPage]=useState(0);
  const[hasMore,setHasMore]=useState(false);
  const[refreshKey,setRefreshKey]=useState(0);
  useEffect(()=>{if(user?.cegep&&cegep==="__all__")setCegep(user.cegep)},[user?.cegep]);
  const PAGE_SIZE=20;

  // localStorage key for liked confession ids
  const likedKey="coter_confession_likes";
  const getLiked=()=>{try{return new Set(JSON.parse(localStorage.getItem(likedKey)||"[]"))}catch{return new Set()}};
  const[liked,setLiked]=useState(getLiked);

  const fetchConfessions=async(cg,pg,append=false)=>{
    setLoadingFeed(true);setFeedError("");
    let q=supabase.from('confessions').select('id,cegep,content,likes,created_at').order('created_at',{ascending:false});
    if(cg!=="__all__")q=q.eq('cegep',cg);
    const{data,error:fetchErr}=await q.range(pg*PAGE_SIZE,(pg+1)*PAGE_SIZE);
    console.log("confessions fetch:",{cg,pg,dataLen:data?.length,error:fetchErr});
    if(fetchErr){console.error("confessions fetch error:",fetchErr);setFeedError(fetchErr.message||"Erreur lors du chargement.");}
    if(data){
      const more=data.length===PAGE_SIZE+1;
      const rows=more?data.slice(0,-1):data;
      setHasMore(more);
      setConfessions(prev=>append?[...prev,...rows]:rows);
    }
    setLoadingFeed(false);
  };

  useEffect(()=>{setPage(0);setConfessions([]);fetchConfessions(cegep,0)},[cegep,refreshKey]);

  const handlePost=async()=>{
    if(!user){goToLogin();return}
    const clean=sanitize(content);
    if(!clean||clean.length<2){setError("Écris quelque chose avant de poster.");return}
    if(clean.length>500){setError("Maximum 500 caractères.");return}
    if(!CEGEPS.includes(cegep)){setError("Sélectionne un cégep valide.");return}
    setPosting(true);setError("");
    const{error:e}=await supabase.from('confessions').insert({cegep,content:clean,user_id:user.id});
    if(e){
      console.error("Confession insert error:",e);
      setError(e.message?.includes("Limite")?e.message:e.message||"Erreur lors de la publication. Réessaie.");
    }else{
      setContent("");
      setRefreshKey(k=>k+1);
    }
    setPosting(false);
  };

  const handleLike=async(confession)=>{
    if(liked.has(confession.id))return;
    const newLiked=new Set(liked);newLiked.add(confession.id);
    setLiked(newLiked);
    try{localStorage.setItem(likedKey,JSON.stringify([...newLiked]))}catch{}
    setConfessions(prev=>prev.map(c=>c.id===confession.id?{...c,likes:c.likes+1}:c));
    await supabase.from('confessions').update({likes:confession.likes+1}).eq('id',confession.id);
  };

  const loadMore=()=>{const next=page+1;setPage(next);fetchConfessions(cegep,next,true)};

  return(
    <div style={{maxWidth:620,margin:"0 auto"}} className="page-enter">
      <h1 style={{fontSize:22,fontWeight:700,margin:"0 0 3px",color:"var(--color-text-primary)"}}>Confessions</h1>
      <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 18px"}}>Ce que les étudiants pensent vraiment — 100% anonyme.</p>

      {/* Sélecteur de cégep */}
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
          <button onClick={()=>setCegep("__all__")} style={{fontSize:12,padding:"5px 12px",borderRadius:20,border:cegep==="__all__"?"1.5px solid #1D9E75":"0.5px solid var(--color-border-secondary)",background:cegep==="__all__"?"var(--color-background-success)":"var(--color-background-secondary)",color:cegep==="__all__"?"#1D9E75":"var(--color-text-secondary)",cursor:"pointer",fontWeight:cegep==="__all__"?600:400}}>Tous les cégeps</button>
          {user?.cegep&&<button onClick={()=>setCegep(user.cegep)} style={{fontSize:12,padding:"5px 12px",borderRadius:20,border:cegep===user.cegep?"1.5px solid #1D9E75":"0.5px solid var(--color-border-secondary)",background:cegep===user.cegep?"var(--color-background-success)":"var(--color-background-secondary)",color:cegep===user.cegep?"#1D9E75":"var(--color-text-secondary)",cursor:"pointer",fontWeight:cegep===user.cegep?600:400}}>Mon cégep</button>}
        </div>
        {cegep!=="__all__"&&<CegepPicker value={cegep} onChange={v=>setCegep(v)}/>}
      </div>

      {/* Zone de post — cachée en mode "tous les cégeps" */}
      {cegep==="__all__"&&<div style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)",padding:"12px 16px",marginBottom:20}}><p style={{fontSize:13,color:"var(--color-text-secondary)",margin:0}}>Sélectionne un cégep spécifique pour poster une confession.</p></div>}
      <div style={{display:cegep==="__all__"?"none":"block",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)",padding:"16px",marginBottom:20,position:"relative"}}>
        {!user&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.03)",backdropFilter:"blur(2px)",borderRadius:"var(--border-radius-lg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:2,gap:10}}>
          <p style={{fontSize:14,fontWeight:500,color:"var(--color-text-primary)",margin:0}}>Connecte-toi pour poster</p>
          <button onClick={goToLogin} style={{background:"#1D9E75",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",padding:"8px 20px",fontSize:13,fontWeight:500,cursor:"pointer"}}>Se connecter →</button>
        </div>}
        <textarea
          disabled={!user}
          placeholder="Écris ta confession anonymement..."
          rows={3}
          maxLength={500}
          value={content}
          onChange={e=>setContent(e.target.value.slice(0,500))}
          style={{...inp,resize:"none",fontFamily:"inherit",lineHeight:1.55,background:"var(--color-background-primary)",opacity:user?1:0.4}}
        />
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
          <span style={{fontSize:11,color:content.length>450?"#E24B4A":"var(--color-text-tertiary)"}}>{content.length}/500</span>
          <button onClick={handlePost} disabled={posting||!user} style={{background:"#1D9E75",color:"#fff",border:"none",borderRadius:"var(--border-radius-md)",padding:"8px 18px",fontSize:13,fontWeight:500,cursor:"pointer",opacity:posting?0.7:1}}>{posting?"Envoi...":"Poster anonymement"}</button>
        </div>
        {error&&<p style={{fontSize:12,color:"var(--color-text-danger)",margin:"8px 0 0"}}>{error}</p>}
      </div>

      {/* Feed */}
      {feedError&&<p style={{fontSize:12,color:"var(--color-text-danger)",marginBottom:12}}>{feedError}</p>}
      {loadingFeed&&confessions.length===0
        ?<div style={{display:"flex",flexDirection:"column",gap:9}}>{[1,2,3].map(i=><div key={i} className="skeleton" style={{height:80,borderRadius:"var(--border-radius-lg)",opacity:1-i*0.2}}/>)}</div>
        :confessions.length===0
          ?<div style={{textAlign:"center",padding:"40px 16px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-lg)"}}>
            <p style={{fontSize:15,fontWeight:600,color:"var(--color-text-primary)",margin:"0 0 4px"}}>Aucune confession encore.</p>
            <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:0}}>Sois le premier à partager quelque chose!</p>
          </div>
          :<div style={{display:"flex",flexDirection:"column",gap:8}}>
            {confessions.map(c=>(
              <div key={c.id} style={{border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"14px 16px"}}>
                {cegep==="__all__"&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:"var(--color-background-secondary)",color:"var(--color-text-secondary)",display:"inline-block",marginBottom:8}}>{c.cegep}</span>}
                <p style={{fontSize:14,color:"var(--color-text-primary)",lineHeight:1.6,margin:"0 0 10px"}}>{c.content}</p>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:11,color:"var(--color-text-tertiary)"}}>{timeAgo(c.created_at)}</span>
                  <button onClick={()=>handleLike(c)} style={{background:liked.has(c.id)?"var(--color-background-success)":"none",border:"0.5px solid "+(liked.has(c.id)?"#1D9E75":"var(--color-border-tertiary)"),borderRadius:"var(--border-radius-md)",padding:"4px 10px",fontSize:11,cursor:liked.has(c.id)?"default":"pointer",color:liked.has(c.id)?"#1D9E75":"var(--color-text-tertiary)",display:"flex",alignItems:"center",gap:4}}>
                    <span style={{fontSize:13}}>{liked.has(c.id)?"♥":"♡"}</span>{c.likes||0}
                  </button>
                </div>
              </div>
            ))}
            {hasMore&&<button onClick={loadMore} disabled={loadingFeed} style={{width:"100%",background:"none",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"11px",fontSize:13,cursor:"pointer",color:"var(--color-text-secondary)",marginTop:4}}>{loadingFeed?"Chargement...":"Voir plus"}</button>}
          </div>
      }
    </div>
  );
}

// ============ MAIN APP ============
const PAGE_HASH={landing:"",profs:"profs",classement:"classement",calc:"calc",confessions:"confessions",submit:"evaluer",login:"connexion",account:"compte"};
const HASH_PAGE=Object.fromEntries(Object.entries(PAGE_HASH).map(([k,v])=>[v,k]));
function syncHash(t){try{const h=PAGE_HASH[t]??'';window.history.pushState({page:t},'',h?'#'+h:window.location.pathname+window.location.search)}catch{}}

export default function App(){
  const[page,setPage]=useState(()=>{try{const hash=window.location.hash.replace('#','');if(hash&&!hash.includes('=')&&HASH_PAGE[hash])return HASH_PAGE[hash];const s=localStorage.getItem("coter_page");return s&&s!=="login"?s:"landing"}catch{return"landing"}});const[prevPage,setPrevPage]=useState("profs");
  const[user,setUser]=useState(null);
  const[onlineCount,setOnlineCount]=useState(0);
  const[profs,setProfs]=useState([]);const[reviewsByProf,setReviewsByProf]=useState({});const[allLikes,setAllLikes]=useState([]);const[totalUsers,setTotalUsers]=useState(0);
  const[loading,setLoading]=useState(true);
  const[submitPrefill,setSubmitPrefill]=useState(null);
  const[showWelcome,setShowWelcome]=useState(false);
  const afterLoginPage=useRef("profs");

  const triggerWelcome=()=>{setShowWelcome(true);setPage("profs");try{localStorage.setItem("coter_page","profs")}catch{}};

  useEffect(()=>{
    // Detect email confirmation via link (Supabase redirects with #type=signup)
    if(typeof window!=="undefined"&&window.location.hash.includes("type=signup")){
      window.history.replaceState({},"",window.location.pathname);
      // Let onAuthStateChange handle the session, welcome shown after SIGNED_IN
    }
    supabase.auth.getSession().then(({data:{session}})=>{
      if(session)setUser({name:session.user.user_metadata?.full_name||session.user.email?.split("@")[0],email:session.user.email,id:session.user.id,cegep:session.user.user_metadata?.cegep||""});
    });
    const{data:{subscription}}=supabase.auth.onAuthStateChange((ev,session)=>{
      if(session){
        setUser({name:session.user.user_metadata?.full_name||session.user.email?.split("@")[0],email:session.user.email,id:session.user.id,cegep:session.user.user_metadata?.cegep||""});
        if(ev==="SIGNED_IN"&&(window.location.hash.includes("type=signup")||window.location.hash.includes("access_token"))){
          window.history.replaceState({},"",window.location.pathname);
          triggerWelcome();
        }else{
          setPage(p=>{if(p==="login"){const dest=afterLoginPage.current;afterLoginPage.current="profs";return dest;}return p;});
        }
      }else setUser(null);
    });
    return()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    const id=Math.random().toString(36).slice(2);
    const ch=supabase.channel('room:online',{config:{presence:{key:id}}});
    ch.on('presence',{event:'sync'},()=>setOnlineCount(Object.keys(ch.presenceState()).length))
      .subscribe(async s=>{if(s==='SUBSCRIBED')await ch.track({t:Date.now()})});
    return()=>{supabase.removeChannel(ch)};
  },[]);

  const loadData=async()=>{
    setLoading(true);
    const[{data:profsData},{data:reviewsData},{data:likesData}]=await Promise.all([
      supabase.from('profs').select('*').order('name'),
      supabase.from('reviews').select('*').order('created_at',{ascending:false}),
      supabase.from('review_likes').select('review_id,user_id'),
    ]);
    if(profsData)setProfs(profsData);
    if(reviewsData){
      const grouped={};
      reviewsData.forEach(r=>{if(!grouped[r.prof_id])grouped[r.prof_id]=[];grouped[r.prof_id].push(r)});
      setReviewsByProf(grouped);
    }
    if(likesData)setAllLikes(likesData);
    supabase.rpc('get_registered_users_count').then(({data})=>{if(data!=null)setTotalUsers(data)});
    setLoading(false);
  };
  useEffect(()=>{loadData()},[]);

  const likesByReview=useMemo(()=>{const m={};allLikes.forEach(l=>{m[l.review_id]=(m[l.review_id]||0)+1});return m},[allLikes]);
  const userLikes=useMemo(()=>new Set(user?allLikes.filter(l=>l.user_id===user.id).map(l=>l.review_id):[]),[allLikes,user]);

  useEffect(()=>{
    const onPop=()=>{const hash=window.location.hash.replace('#','');if(hash.includes('='))return;const p=HASH_PAGE[hash]!=null?HASH_PAGE[hash]:'profs';setPage(prev=>{setPrevPage(prev);return p});try{if(p!=="login")localStorage.setItem("coter_page",p)}catch{}};
    window.addEventListener('popstate',onPop);
    return()=>window.removeEventListener('popstate',onPop);
  },[]);

  const go=t=>{setPrevPage(page);setPage(t);syncHash(t);try{if(t!=="login")localStorage.setItem("coter_page",t)}catch{}};
  const goToLogin=()=>go("login");const goToAccount=()=>go("account");

  const toggleLike=async(reviewId)=>{
    if(!user){goToLogin();return;}
    const alreadyLiked=allLikes.some(l=>l.review_id===reviewId&&l.user_id===user.id);
    if(alreadyLiked){
      setAllLikes(prev=>prev.filter(l=>!(l.review_id===reviewId&&l.user_id===user.id)));
      await supabase.from('review_likes').delete().eq('review_id',reviewId).eq('user_id',user.id);
    }else{
      setAllLikes(prev=>[...prev,{review_id:reviewId,user_id:user.id}]);
      await supabase.from('review_likes').insert({review_id:reviewId,user_id:user.id});
    }
  };
  const goToEvaluate=prof=>{setSubmitPrefill({name:prof.name,cegep:prof.cegep,dept:prof.dept||""});if(user){go("submit")}else{afterLoginPage.current="submit";go("login")}};
  const navTo=t=>{setPrevPage(p=>p===t?p:page);setPage(t);syncHash(t);try{if(t!=="login")localStorage.setItem("coter_page",t)}catch{}};
  const updateUserCegep=async(cegep)=>{await supabase.auth.updateUser({data:{cegep}});setUser(u=>u?{...u,cegep}:u)};
  const handleLogout=async()=>{await supabase.auth.signOut();setUser(null);navTo("profs")};
  const wrap=ch=><div style={{maxWidth:900,margin:"0 auto",padding:"0 20px",fontFamily:"var(--font-sans)"}}>{ch}</div>;

  const totalReviews=Object.values(reviewsByProf).reduce((s,arr)=>s+arr.length,0);

  if(page==="landing")return wrap(<Landing onStart={()=>navTo("profs")} onLogin={goToLogin} onAccount={goToAccount} user={user} totalUsers={totalUsers} totalReviews={totalReviews}/>);

  return wrap(<>
    {!["login","account"].includes(page)&&<Nav page={page} setPage={navTo} user={user} goToLogin={goToLogin} goToAccount={goToAccount} onlineCount={onlineCount}/>}
    {loading&&page==="profs"&&<Skeleton/>}
    {!loading&&page==="profs"&&<ProfsPage profs={profs} reviewsByProf={reviewsByProf} onEvaluate={goToEvaluate} likesByReview={likesByReview} userLikes={userLikes} onLike={toggleLike}/>}
    {page==="classement"&&<RankingPage profs={profs} reviewsByProf={reviewsByProf} onEvaluate={goToEvaluate} likesByReview={likesByReview} userLikes={userLikes} onLike={toggleLike}/>}
    {page==="calc"&&<CalcPage/>}
    {page==="confessions"&&<ConfessionsPage user={user} goToLogin={goToLogin}/>}
    {page==="submit"&&<SubmitPage user={user} profs={profs} goToLogin={goToLogin} onSubmitted={loadData} prefill={submitPrefill}/>}
    {page==="login"&&<div className="page-enter"><LoginPage onClose={()=>setPage(prevPage)} onVerified={triggerWelcome}/></div>}
    {showWelcome&&<WelcomePage onDone={()=>setShowWelcome(false)}/>}
    {page==="account"&&<div className="page-enter"><AccountPage user={user} onLogout={handleLogout} onBack={()=>setPage(prevPage)} onUpdateCegep={updateUserCegep}/></div>}
    <footer style={{marginTop:48,paddingTop:14,paddingBottom:24,borderTop:"0.5px solid var(--color-border-tertiary)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
      <Logo size="sm"/><p style={{fontSize:11,color:"var(--color-text-tertiary)",margin:0}}>Fait par des étudiants, pour les étudiants.</p>
    </footer>
    <MobileNav page={page} setPage={navTo} user={user} goToLogin={goToLogin} goToAccount={goToAccount}/>
  </>);
}
