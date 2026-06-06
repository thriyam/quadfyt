import { useState, useEffect, useCallback } from "react";

// ─── CONFIG — fill in your NEW Firebase project URL ───────
const CONFIG = {
  GOOGLE_CLIENT_ID: "165852146657-pfba2b1dh9fh39p480igaj1q0ujobc5e.apps.googleusercontent.com",
  FIREBASE_URL: "YOUR_NEW_FIREBASE_URL",          // new QuadFyt Firebase DB
  SUGARFREE_FIREBASE: "https://sugarfree-3e6cf-default-rtdb.firebaseio.com", // old data source
};

// ─── ACCESS CONTROL ────────────────────────────────────────
// Add every member's Google email address here (lowercase).
// Anyone NOT on this list will be blocked after login — they
// will see the app but cannot read or write any data.
// To add someone: add their email to this array and redeploy.
const ALLOWED_EMAILS = [
  "thriyamindia@gmail.com",   // Thriyam (admin)
  // Add your squad members below:
  // "friend1@gmail.com",
  // "friend2@gmail.com",
];

function isAllowed(email) {
  return ALLOWED_EMAILS.map(e => e.toLowerCase()).includes((email || "").toLowerCase());
}

const IS_DEMO = (() => {
  try { return window.self !== window.top || CONFIG.FIREBASE_URL.includes("YOUR_NEW"); }
  catch { return true; }
})();

// ─── Challenges ────────────────────────────────────────────
const CHALLENGES = [
  {
    id: "sugar",
    emoji: "🍃",
    label: "Sugar Free",
    desc: "No added sugar all day",
    points: 25,
    color: "#10b981",
    bg: "#ecfdf5",
    failLabel: "Had Sugar",
    failEmoji: "🍭",
  },
  {
    id: "active",
    emoji: "⚡",
    label: "Active",
    desc: "10k steps OR a workout",
    points: 25,
    color: "#f59e0b",
    bg: "#fffbeb",
    sub: ["10,000 Steps 👟", "Workout 💪"],
  },
  {
    id: "clean",
    emoji: "🚫",
    label: "No Alcohol / Cigs",
    desc: "Stayed clean all day",
    points: 25,
    color: "#8b5cf6",
    bg: "#f5f3ff",
    failLabel: "Had Alcohol/Cigs",
    failEmoji: "🍺",
  },
  {
    id: "detox",
    emoji: "📵",
    label: "Digital Detox",
    desc: "1 hour phone-free",
    points: 25,
    color: "#3b82f6",
    bg: "#eff6ff",
  },
];

const BONUS_POINTS = 20; // for completing all 4

// ─── Tiers based on total all-time points ─────────────────
const TIERS = [
  { name:"Rookie",   min:0,    emoji:"🌱", color:"#6b7280", bg:"#f9fafb" },
  { name:"Bronze",   min:100,  emoji:"🥉", color:"#92400e", bg:"#fef3c7" },
  { name:"Silver",   min:300,  emoji:"🥈", color:"#1e3a5f", bg:"#dbeafe" },
  { name:"Gold",     min:600,  emoji:"🥇", color:"#78350f", bg:"#fef9c3" },
  { name:"Champion", min:1000, emoji:"🏆", color:"#065f46", bg:"#d1fae5" },
];
function getTier(pts) { return [...TIERS].reverse().find(t => pts >= t.min) || TIERS[0]; }

const AVATARS = ["🧑","👨","👩","🧔","👱","🧕","👴","👵","🧒","👦","👧"];

// ─── Dates ─────────────────────────────────────────────────
function toDateStr(d = new Date()) { return d.toISOString().split("T")[0]; }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().split("T")[0]; }
function emailKey(e) { return e.replace(/[.#$[\]]/g,"_"); }
function dayLabel(dateStr) {
  const today = toDateStr(), yesterday = daysAgo(1), twoDaysAgo = daysAgo(2);
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  if (dateStr === twoDaysAgo) return "2 days ago";
  return dateStr;
}

// ─── Firebase ──────────────────────────────────────────────
async function fbGet(url, path) {
  const res = await fetch(`${url}/${path}.json`);
  if (!res.ok) throw new Error("Read failed " + res.status);
  return res.json();
}
async function fbSet(path, data) {
  const res = await fetch(`${CONFIG.FIREBASE_URL}/${path}.json`, {
    method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Write failed " + res.status);
  return res.json();
}
async function fbPush(path, data) {
  const res = await fetch(`${CONFIG.FIREBASE_URL}/${path}.json`, {
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Push failed " + res.status);
  return res.json();
}

// ─── Demo data ─────────────────────────────────────────────
const DEMO_LOGS = [
  { email:"alex@demo.com", name:"Alex", date:daysAgo(2), challengeId:"sugar",  done:true,  points:25 },
  { email:"alex@demo.com", name:"Alex", date:daysAgo(2), challengeId:"active", done:true,  points:25, subType:"workout" },
  { email:"alex@demo.com", name:"Alex", date:daysAgo(2), challengeId:"clean",  done:true,  points:25 },
  { email:"alex@demo.com", name:"Alex", date:daysAgo(2), challengeId:"detox",  done:true,  points:25 },
  { email:"alex@demo.com", name:"Alex", date:daysAgo(1), challengeId:"sugar",  done:true,  points:25 },
  { email:"alex@demo.com", name:"Alex", date:daysAgo(1), challengeId:"active", done:true,  points:25, subType:"steps" },
  { email:"alex@demo.com", name:"Alex", date:daysAgo(1), challengeId:"clean",  done:true,  points:25 },
  { email:"sam@demo.com",  name:"Sam",  date:daysAgo(1), challengeId:"sugar",  done:true,  points:25 },
  { email:"sam@demo.com",  name:"Sam",  date:daysAgo(1), challengeId:"active", done:true,  points:25, subType:"steps" },
  { email:"mia@demo.com",  name:"Mia",  date:daysAgo(1), challengeId:"detox",  done:true,  points:25 },
];

// ─── Main App ──────────────────────────────────────────────
export default function App() {
  const [authState, setAuthState]     = useState(IS_DEMO ? "authed" : "idle");
  const [user, setUser]               = useState(IS_DEMO ? {name:"Alex",email:"alex@demo.com",picture:null,avatar:"🧑"} : null);
  const [logs, setLogs]               = useState(IS_DEMO ? DEMO_LOGS : []);
  const [myNudge, setMyNudge]         = useState(null); // nudge I just received (show banner)
  const [view, setView]               = useState("home");
  const [logDate, setLogDate]         = useState(toDateStr()); // which day are we logging for
  const [activeModal, setActiveModal] = useState(null); // "challenge_id" | "nudge" | "share" | "avatarPick"
  const [activeSubType, setActiveSubType] = useState(null);
  const [saving, setSaving]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [saveError, setSaveError]     = useState(null);
  const [gsiReady, setGsiReady]       = useState(false);
  const [celebChallenge, setCelebChallenge] = useState(null);
  const [showShare, setShowShare]           = useState(false);
  const [particles, setParticles]     = useState([]);

  useEffect(() => {
    if (IS_DEMO) return;
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.onload = () => setGsiReady(true);
    document.head.appendChild(s);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleLogin = useCallback(() => {
    if (!window.google) return;
    setAuthState("loading");
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
      callback: async (tr) => {
        if (tr.error) { setAuthState("error"); return; }
        try {
          const p = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers:{Authorization:`Bearer ${tr.access_token}`}
          }).then(r=>r.json());
          // load saved avatar preference
          let savedAvatar = "🧑";
          try {
            const pref = await fbGet(CONFIG.FIREBASE_URL, `prefs/${emailKey(p.email)}`);
            if (pref && pref.avatar) savedAvatar = pref.avatar;
          } catch {}
          const u = { name:p.name, email:p.email, picture:p.picture, avatar:savedAvatar };
          setUser(u);
          // Check whitelist before granting access
          if (!isAllowed(p.email)) {
            setAuthState("blocked");
            return;
          }
          setAuthState("authed");
          await loadAll(u);
        } catch { setAuthState("error"); }
      },
    });
    client.requestAccessToken();
  }, [gsiReady]);

  async function loadAll(u) {
    setLoading(true);
    try {
      // Load QuadFyt logs
      const rawLogs = await fbGet(CONFIG.FIREBASE_URL, "logs");
      const allLogs = rawLogs ? Object.values(rawLogs) : [];
      setLogs(allLogs);

      // Load nudges for this user
      const rawNudges = await fbGet(CONFIG.FIREBASE_URL, `nudges/${emailKey(u.email)}`);
      if (rawNudges) {
        const nudgeList = Object.entries(rawNudges).map(([k,v])=>({...v,key:k}));
        // Show most recent unread nudge
        const unread = nudgeList.filter(n=>!n.read);
        if (unread.length > 0) setMyNudge(unread[0]);
      }

      // Import from SugarFree if not done already
      try {
        const alreadyImported = await fbGet(CONFIG.FIREBASE_URL, `imports/${emailKey(u.email)}`);
        if (!alreadyImported) {
          await importFromSugarFree(u, allLogs);
        } else {
            }
      } catch {}

    } catch (e) { console.warn("Load failed:", e.message); }
    setLoading(false);
  }

  async function importFromSugarFree(u, existingLogs) {
    try {
      const rawOld = await fbGet(CONFIG.SUGARFREE_FIREBASE, "logs");
      if (!rawOld) { await fbSet(`imports/${emailKey(u.email)}`, {done:true, imported:0}); return; }
      const oldLogs = Object.values(rawOld).filter(l => l.email === u.email && !l.hadSugar);
      let imported = 0;
      for (const ol of oldLogs) {
        const key = emailKey(u.email) + "_" + ol.date + "_sugar";
        const alreadyExists = existingLogs.some(l => l.email===u.email && l.date===ol.date && l.challengeId==="sugar");
        if (!alreadyExists) {
          const newLog = { email:u.email, name:u.name, date:ol.date, challengeId:"sugar", done:true, points:25, imported:true };
          await fbSet(`logs/${key}`, newLog);
          setLogs(prev => [...prev, newLog]);
          imported++;
        }
      }
      await fbSet(`imports/${emailKey(u.email)}`, { done:true, imported, at:toDateStr() });
      if (imported > 0) setSaveError(`✅ Imported ${imported} sugar-free days from SugarFree!`);
    } catch (e) { console.warn("Import failed:", e.message); }
  }

  // ── Derived state ────────────────────────────────────────
  const today = toDateStr();
  const availableDates = [today, daysAgo(1), daysAgo(2)]; // backdating window

  function getLogsForDate(email, date) {
    return logs.filter(l => l.email===email && l.date===date);
  }
  function getChallengeLog(email, date, cId) {
    return logs.find(l => l.email===email && l.date===date && l.challengeId===cId);
  }

  const myLogs = logs.filter(l => l.email===user?.email);
  const totalPoints = myLogs.reduce((s,l)=>s+(l.points||0),0);
  const tier = getTier(totalPoints);

  // Compute streaks per challenge for current user
  function getChallengeStreak(cId) {
    const doneDates = myLogs.filter(l=>l.challengeId===cId&&l.done).map(l=>l.date);
    if (!doneDates.length) return 0;
    const sorted = [...new Set(doneDates)].sort().reverse();
    let streak=0, cursor=new Date(); cursor.setHours(0,0,0,0);
    for (const ds of sorted) {
      const d=new Date(ds+"T00:00:00"); d.setHours(0,0,0,0);
      const diff=Math.round((cursor-d)/86400000);
      if (diff===streak){streak++;cursor=d;} else if(diff>streak) break;
    }
    return streak;
  }

  // Squad: all unique users from logs
  const squad = Object.values(
    logs.reduce((acc,l)=>{
      if (!acc[l.email]) acc[l.email]={email:l.email,name:l.name,points:0,todayDone:0};
      acc[l.email].points += l.points||0;
      if (l.date===today&&l.done) acc[l.email].todayDone++;
      return acc;
    },{})
  ).sort((a,b)=>b.points-a.points);

  // How many challenges done today for logDate
  const myTodayLogs = getLogsForDate(user?.email, logDate);
  const myTodayDone = myTodayLogs.filter(l=>l.done).length;
  const allDoneToday = myTodayDone === CHALLENGES.length;

  async function logChallenge(challengeId, done, subType=null) {
    if (!user || saving) return;
    setSaving(true);
    const existing = getChallengeLog(user.email, logDate, challengeId);
    if (existing) { setSaving(false); return; } // already logged
    const ch = CHALLENGES.find(c=>c.id===challengeId);
    const earnedPoints = done ? ch.points : 0;

    // Check if completing all 4 today → bonus
    const doneAfter = myTodayLogs.filter(l=>l.done).length + (done ? 1 : 0);
    const bonusEarned = doneAfter === CHALLENGES.length ? BONUS_POINTS : 0;
    const totalEarned = earnedPoints + bonusEarned;

    const newLog = { email:user.email, name:user.name, date:logDate, challengeId, done, points:totalEarned, ...(subType&&{subType}) };
    setLogs(prev=>[...prev, newLog]);

    if (done) {
      setCelebChallenge({ ...ch, points:totalEarned, bonus:bonusEarned>0, streak: getChallengeStreak(challengeId)+1 });
      spawnParticles();
      setTimeout(()=>{
        setCelebChallenge(null);
        if (doneAfter === CHALLENGES.length) setTimeout(()=>setShowShare(true), 400);
      }, 3200);
    }

    if (!IS_DEMO) {
      try {
        const key = emailKey(user.email)+"_"+logDate+"_"+challengeId;
        await fbSet("logs/"+key, newLog);
      } catch(e) { setSaveError("Sync failed — data saved locally."); }
    }
    setActiveModal(null);
    setSaving(false);
  }

  async function sendNudge(targetEmail, targetName) {
    if (!user || IS_DEMO) return;
    try {
      await fbPush(`nudges/${emailKey(targetEmail)}`, {
        from: user.name,
        fromEmail: user.email,
        to: targetEmail,
        toName: targetName,
        at: new Date().toISOString(),
        read: false,
      });
      setActiveModal(null);
      setSaveError(`👊 Nudge sent to ${targetName}!`);
      setTimeout(()=>setSaveError(null),3000);
    } catch(e) { setSaveError("Nudge failed."); }
  }

  async function dismissNudge(nudge) {
    setMyNudge(null);
    if (!IS_DEMO && nudge?.key) {
      try { await fbSet(`nudges/${emailKey(user.email)}/${nudge.key}`, {...nudge, read:true}); } catch{}
    }
  }

  async function saveAvatar(av) {
    const u = {...user, avatar:av};
    setUser(u);
    setActiveModal(null);
    if (!IS_DEMO) {
      try { await fbSet(`prefs/${emailKey(user.email)}`, {avatar:av}); } catch{}
    }
  }

  function spawnParticles() {
    setParticles(Array.from({length:18},(_,i)=>({
      id:i, left:10+Math.random()*80, delay:Math.random()*0.5,
      size:7+Math.random()*8, dur:1.5+Math.random()*0.8,
      color:["#f59e0b","#10b981","#3b82f6","#ec4899","#8b5cf6"][i%5],
    })));
    setTimeout(()=>setParticles([]),4000);
  }

  if (authState === "blocked") return <BlockedScreen user={user} onLogout={() => { setUser(null); setAuthState("idle"); }}/>;
  if (authState !== "authed") return <LoginScreen onLogin={handleLogin} authState={authState} gsiReady={gsiReady}/>;

  const anyModal = !!activeModal || !!celebChallenge || !!myNudge || showShare;

  return (
    <div style={{...S.root, position:"relative", minHeight:"100vh"}}>
      <style>{CSS}</style>

      {/* Particles */}
      {particles.map(p=>(
        <div key={p.id} style={{position:"absolute",left:`${p.left}%`,top:"40%",
          width:p.size,height:p.size,borderRadius:"50%",background:p.color,
          pointerEvents:"none",zIndex:150,
          animation:`qf-float ${p.dur}s ${p.delay}s ease-out forwards`}}/>
      ))}

      {/* Nudge received banner */}
      {myNudge && (
        <div style={S.overlay} onClick={()=>dismissNudge(myNudge)}>
          <div style={S.modalBox}>
            <div style={{fontSize:52}}>👊</div>
            <div style={S.celebTitle}>You've been nudged!</div>
            <div style={S.celebMsg}><strong>{myNudge.from}</strong> is checking in on you.<br/>Time to get moving!</div>
            <button style={S.primaryBtn} onClick={()=>dismissNudge(myNudge)}>Let's go! 💪</button>
          </div>
        </div>
      )}

      {/* Challenge log modal */}
      {activeModal && CHALLENGES.find(c=>c.id===activeModal) && !celebChallenge && (()=>{
        const ch = CHALLENGES.find(c=>c.id===activeModal);
        const existing = getChallengeLog(user.email, logDate, activeModal);
        return (
          <div style={S.overlay} onClick={()=>setActiveModal(null)}>
            <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:44}}>{ch.emoji}</div>
              <div style={S.celebTitle}>{ch.label}</div>
              <div style={S.celebMsg}>{ch.desc}</div>
              <div style={{fontFamily:"DM Sans,sans-serif",fontSize:12,color:"#6ee7b7",marginBottom:16,background:"rgba(255,255,255,0.08)",padding:"6px 14px",borderRadius:20,display:"inline-block"}}>
                Logging for: {dayLabel(logDate)}
              </div>
              {existing ? (
                <div style={{background:"#d1fae5",color:"#065f46",borderRadius:12,padding:"12px 16px",fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700}}>
                  {existing.done ? "✅ Completed!" : "❌ Logged as skipped"}
                </div>
              ) : ch.id==="active" && !activeSubType ? (
                <div>
                  <div style={{fontFamily:"DM Sans,sans-serif",fontSize:13,color:"#aaa",marginBottom:12}}>Which did you do?</div>
                  <div style={{display:"flex",gap:10}}>
                    <button style={S.subBtn} onClick={()=>setActiveSubType("steps")}>👟 10k Steps</button>
                    <button style={S.subBtn} onClick={()=>setActiveSubType("workout")}>💪 Workout</button>
                  </div>
                  <button style={{...S.failBtn,marginTop:12}} onClick={()=>logChallenge(ch.id,false)}>❌ Didn't do either</button>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <button style={S.doneBtn} onClick={()=>logChallenge(ch.id,true,activeSubType)}>
                    ✅ Done! {ch.id==="active"&&activeSubType?`(${activeSubType})`:""}
                  </button>
                  {ch.failLabel && (
                    <>
                      <div style={{display:"flex",alignItems:"center",gap:8,margin:"2px 0"}}>
                        <div style={{flex:1,height:"1px",background:"#334155"}}/>
                        <span style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#475569"}}>or be honest</span>
                        <div style={{flex:1,height:"1px",background:"#334155"}}/>
                      </div>
                      <button style={S.failBtn} onClick={()=>logChallenge(ch.id,false)}>
                        {ch.failEmoji} I {ch.failLabel} today
                      </button>
                    </>
                  )}
                  <button style={S.cancelBtn} onClick={()=>{setActiveModal(null);setActiveSubType(null);}}>Cancel</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}



      {/* Celebration */}
      {celebChallenge && (
        <div style={S.overlay} onClick={()=>setCelebChallenge(null)}>
          <div style={S.modalBox}>
            <div style={{fontSize:52}}>{celebChallenge.emoji}</div>
            <div style={S.celebTitle}>{celebChallenge.label} — Done! 🎉</div>
            <div style={S.celebMsg}>
              {celebChallenge.bonus ? "🔥 All 4 complete! Bonus 20 pts!" : "Keep it up — you're on a roll."}
            </div>
            <div style={S.pointsPill}>+{celebChallenge.points} pts</div>
            {celebChallenge.streak>0 && <div style={S.streakPill}>🔥 {celebChallenge.streak} day streak</div>}
          </div>
        </div>
      )}

      {/* Avatar picker */}
      {activeModal==="avatarPick" && (
        <div style={S.overlay} onClick={()=>setActiveModal(null)}>
          <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
            <div style={S.celebTitle}>Pick your avatar</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:10,justifyContent:"center",marginTop:16}}>
              {AVATARS.map(av=>(
                <button key={av} onClick={()=>saveAvatar(av)}
                  style={{fontSize:32,background:user.avatar===av?"#d1fae5":"#1e293b",border:user.avatar===av?"2px solid #10b981":"2px solid #334155",borderRadius:12,padding:"8px 12px",cursor:"pointer"}}>
                  {av}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{...S.header,...(anyModal?{filter:"blur(2px)"}:{})}}>
        <div style={S.logo}>Quad<span style={S.accent}>Fyt</span></div>
        <div style={S.headerRight}>
          {loading && <span style={{fontSize:16,color:"#10b981",animation:"qf-spin 1s linear infinite",display:"inline-block"}}>⟳</span>}
          <div style={{...S.tierBadge,background:tier.bg,color:tier.color}}>{tier.emoji} {tier.name}</div>
          <div style={S.avatarBtn} onClick={()=>setActiveModal("avatarPick")}>
            {user.picture
              ? <img src={user.picture} style={{width:"100%",height:"100%",borderRadius:"50%",objectFit:"cover"}} alt="" referrerPolicy="no-referrer"/>
              : <span style={{fontSize:18}}>{user.avatar||"🧑"}</span>}
          </div>
        </div>
      </header>

      {/* Info banner */}
      {saveError && (
        <div style={{...S.infoBanner,...(saveError.startsWith("✅")?{background:"#d1fae5",color:"#065f46",borderColor:"#6ee7b7"}:{background:"#fef2f2",color:"#ef4444",borderColor:"#fca5a5"})}}>
          {saveError}
          <button onClick={()=>setSaveError(null)} style={{marginLeft:8,background:"none",border:"none",cursor:"pointer",fontWeight:700,color:"inherit"}}>✕</button>
        </div>
      )}
      {IS_DEMO && <div style={S.demoBanner}>Demo Mode — add your Firebase URL to go live</div>}

      <main style={{...S.main,...(anyModal?{filter:"blur(2px)"}:{})}}>

        {view==="home" && (
          <HomeView
            user={user} squad={squad} logs={logs} myLogs={myLogs}
            totalPoints={totalPoints} tier={tier}
            logDate={logDate} setLogDate={setLogDate}
            availableDates={availableDates}
            myTodayDone={myTodayDone} allDoneToday={allDoneToday}
            getChallengeLog={getChallengeLog}
            getChallengeStreak={getChallengeStreak}
            onLogChallenge={(cId)=>{setActiveSubType(null);setActiveModal(cId);}}
            onNudge={sendNudge}
            saving={saving}
          />
        )}

        {view==="leaderboard" && (
          <LeaderboardView squad={squad} me={user.email} logs={logs} onRefresh={()=>loadAll(user)} loading={loading}/>
        )}

        {view==="profile" && (
          <ProfileView user={user} myLogs={myLogs} totalPoints={totalPoints} tier={tier} getChallengeStreak={getChallengeStreak} onShareOpen={()=>setShowShare(true)} onLogout={()=>{setUser(null);setAuthState("idle");setLogs([]);}}/>
        )}

      </main>

      {/* Share Modal */}
      {showShare && (
        <ShareModal
          user={user}
          totalPoints={totalPoints}
          tier={tier}
          myLogs={myLogs}
          getChallengeStreak={getChallengeStreak}
          onClose={()=>setShowShare(false)}
        />
      )}

      <nav style={{...S.nav,...(anyModal?{filter:"blur(2px)"}:{})}}>
        {[["home","⚡","Today"],["leaderboard","🏆","Squad"],["profile","👤","Me"]].map(([v,icon,label])=>(
          <button key={v} style={{...S.navBtn,...(view===v?S.navActive:{})}} onClick={()=>setView(v)}>
            <span style={{fontSize:20}}>{icon}</span>
            <span style={{fontSize:9,fontFamily:"DM Sans,sans-serif",fontWeight:600}}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}


// ─── Blocked Screen ────────────────────────────────────────
function BlockedScreen({ user, onLogout }) {
  return (
    <div style={{ background:"#0f172a", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"DM Sans,sans-serif" }}>
      <style>{CSS}</style>
      <div style={{ background:"#1e293b", borderRadius:20, padding:"36px 28px", maxWidth:340, width:"100%", textAlign:"center", border:"1px solid #334155" }}>
        <div style={{ fontSize:52, marginBottom:12 }}>🔒</div>
        <div style={{ fontFamily:"Syne,sans-serif", fontSize:20, color:"#f1f5f9", fontWeight:800, marginBottom:8 }}>Access Restricted</div>
        <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:14, color:"#64748b", lineHeight:1.6, marginBottom:8 }}>
          <strong style={{ color:"#94a3b8" }}>{user?.email}</strong> is not on the QuadFyt squad list.
        </div>
        <div style={{ fontFamily:"DM Sans,sans-serif", fontSize:13, color:"#475569", lineHeight:1.6, marginBottom:24 }}>
          Ask Thriyam to add your email to the app and redeploy.
        </div>
        <button onClick={onLogout} style={{ width:"100%", background:"none", border:"1px solid #334155", borderRadius:11, padding:"12px", fontFamily:"DM Sans,sans-serif", fontSize:13, color:"#ef4444", cursor:"pointer" }}>
          Sign out
        </button>
      </div>
    </div>
  );
}

// ─── Login ─────────────────────────────────────────────────
function LoginScreen({onLogin, authState, gsiReady}) {
  return (
    <div style={S.loginRoot}>
      <style>{CSS}</style>
      <div style={S.loginCard}>
        <div style={{fontSize:56,marginBottom:6}}>⚡</div>
        <h1 style={S.loginTitle}>Quad<span style={S.accent}>Fyt</span></h1>
        <p style={S.loginSub}>4 daily challenges.<br/>One squad. No excuses.</p>
        <div style={S.loginFeatures}>
          {[["🍃","Sugar Free"],["⚡","Active (steps or workout)"],["🚫","No Alcohol / Cigarettes"],["📵","1hr Digital Detox"]].map(([e,t])=>(
            <div key={t} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",fontFamily:"DM Sans,sans-serif",fontSize:14,color:"#94a3b8"}}>
              <span style={{fontSize:18,width:24,textAlign:"center"}}>{e}</span><span>{t}</span>
            </div>
          ))}
        </div>
        <button style={{...S.googleBtn,opacity:(gsiReady&&authState!=="loading")?1:0.55}} onClick={onLogin} disabled={!gsiReady||authState==="loading"}>
          {authState==="loading"?<span style={S.spinner}/>:(
            <svg width="18" height="18" viewBox="0 0 48 48" style={{flexShrink:0}}>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
          )}
          {authState==="loading"?"Signing in…":"Continue with Google"}
        </button>
        {authState==="error"&&<p style={{color:"#ef4444",fontSize:13,marginTop:12,fontFamily:"DM Sans,sans-serif"}}>Sign-in failed. Check Client ID.</p>}
        <p style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#475569",marginTop:14,lineHeight:1.5}}>Your SugarFree data is automatically imported.</p>
      </div>
    </div>
  );
}

// ─── Home View ─────────────────────────────────────────────
function HomeView({user,squad,logs,myLogs,totalPoints,tier,logDate,setLogDate,availableDates,myTodayDone,allDoneToday,getChallengeLog,getChallengeStreak,onLogChallenge,onNudge,saving}) {
  const [nudgeTarget, setNudgeTarget] = useState(null);
  const today = toDateStr();

  return (
    <div style={{animation:"qf-up 0.3s ease"}}>

      {/* Nudge confirm */}
      {nudgeTarget && (
        <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:"#1e293b",borderRadius:20,padding:"28px 24px",textAlign:"center",maxWidth:280,width:"100%",border:"1px solid #334155"}}>
            <div style={{fontSize:40}}>👊</div>
            <div style={{fontFamily:"Syne,sans-serif",fontSize:17,color:"#f1f5f9",fontWeight:700,marginTop:10}}>Nudge {nudgeTarget.name}?</div>
            <div style={{fontFamily:"DM Sans,sans-serif",color:"#94a3b8",fontSize:13,marginTop:8,marginBottom:20}}>They'll see a notification when they next open QuadFyt.</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setNudgeTarget(null)} style={{flex:1,background:"#334155",color:"#94a3b8",border:"none",borderRadius:12,padding:"12px",fontFamily:"DM Sans,sans-serif",cursor:"pointer"}}>Cancel</button>
              <button onClick={()=>{onNudge(nudgeTarget.email,nudgeTarget.name);setNudgeTarget(null);}} style={{flex:1,background:"#f59e0b",color:"#fff",border:"none",borderRadius:12,padding:"12px",fontFamily:"Syne,sans-serif",fontWeight:700,cursor:"pointer"}}>Send 👊</button>
            </div>
          </div>
        </div>
      )}

      {/* Points + tier bar */}
      <div style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",borderRadius:18,padding:"20px",marginBottom:14,border:"1px solid #334155"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontFamily:"DM Sans,sans-serif",color:"#64748b",fontSize:11,letterSpacing:2,textTransform:"uppercase"}}>TOTAL POINTS</div>
            <div style={{fontFamily:"Syne,sans-serif",fontSize:40,color:"#f1f5f9",fontWeight:800,lineHeight:1}}>{totalPoints}</div>
            <div style={{fontFamily:"DM Sans,sans-serif",color:"#64748b",fontSize:12,marginTop:2}}>{tier.emoji} {tier.name}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily:"DM Sans,sans-serif",color:"#64748b",fontSize:11,letterSpacing:2,textTransform:"uppercase"}}>TODAY</div>
            <div style={{fontFamily:"Syne,sans-serif",fontSize:40,color:myTodayDone===4?"#10b981":"#f59e0b",fontWeight:800,lineHeight:1}}>{myTodayDone}<span style={{fontSize:20,color:"#334155"}}>/4</span></div>
            <div style={{fontFamily:"DM Sans,sans-serif",color:"#64748b",fontSize:12}}>{allDoneToday?"All done! 🔥":"challenges done"}</div>
          </div>
        </div>
        {allDoneToday && (
          <div style={{marginTop:12,background:"rgba(16,185,129,0.15)",border:"1px solid #10b981",borderRadius:10,padding:"8px 12px",fontFamily:"DM Sans,sans-serif",fontSize:12,color:"#10b981",textAlign:"center"}}>
            🏆 Perfect day! +20 bonus pts earned
          </div>
        )}
      </div>

      {/* Squad avatars */}
      <div style={{marginBottom:16}}>
        <div style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#64748b",letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>YOUR SQUAD</div>
        <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4}}>
          {squad.map(u=>{
            const isMe = u.email===user.email;
            const allDone = u.todayDone>=4;
            const needsNudge = !isMe && u.todayDone<4;
            return (
              <div key={u.email} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,flexShrink:0}}
                onClick={()=>needsNudge&&setNudgeTarget(u)}>
                <div style={{
                  width:52,height:52,borderRadius:"50%",
                  background:allDone?"#064e3b":"#1e293b",
                  border:`3px solid ${allDone?"#10b981":isMe?"#f59e0b":"#334155"}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:26,cursor:needsNudge?"pointer":"default",
                  boxShadow:allDone?"0 0 12px rgba(16,185,129,0.4)":"none",
                  position:"relative",overflow:"hidden",
                }}>
                  {isMe&&user.picture
                    ? <img src={user.picture} style={{width:"100%",height:"100%",objectFit:"cover"}} alt="" referrerPolicy="no-referrer"/>
                    : <span>{u.avatar||"🧑"}</span>}
                  {needsNudge && <div style={{position:"absolute",top:-2,right:-2,width:14,height:14,background:"#f59e0b",borderRadius:"50%",border:"2px solid #0f172a",fontSize:8,display:"flex",alignItems:"center",justifyContent:"center"}}>!</div>}
                </div>
                <div style={{fontFamily:"DM Sans,sans-serif",fontSize:10,color:isMe?"#f59e0b":"#94a3b8",fontWeight:isMe?700:400}}>{isMe?"You":u.name.split(" ")[0]}</div>
                <div style={{fontFamily:"DM Sans,sans-serif",fontSize:10,color:"#64748b"}}>🔥{u.todayDone}/4</div>
              </div>
            );
          })}
        </div>
        <div style={{fontFamily:"DM Sans,sans-serif",fontSize:10,color:"#475569",marginTop:6}}>Tap a squadmate to send a nudge 👊</div>
      </div>

      {/* Date selector for backdating */}
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {availableDates.map(d=>(
          <button key={d} onClick={()=>setLogDate(d)}
            style={{flex:1,background:logDate===d?"#10b981":"#1e293b",color:logDate===d?"#fff":"#64748b",
              border:`1px solid ${logDate===d?"#10b981":"#334155"}`,borderRadius:10,padding:"8px 4px",
              fontFamily:"DM Sans,sans-serif",fontSize:12,fontWeight:logDate===d?700:400,cursor:"pointer"}}>
            {dayLabel(d)}
          </button>
        ))}
      </div>

      {/* Challenge cards */}
      <div style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#64748b",letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>
        TODAY'S CHALLENGES <span style={{color:"#10b981",letterSpacing:0,fontWeight:700,fontSize:12}}>• {myTodayDone}/4 done</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {CHALLENGES.map(ch=>{
          const log = getChallengeLog(user.email, logDate, ch.id);
          const streak = getChallengeStreak(ch.id);
          const done = log?.done;
          const failed = log && !log.done;
          return (
            <button key={ch.id} onClick={()=>!log&&onLogChallenge(ch.id)} disabled={!!log||saving}
              style={{
                background:done?"rgba(16,185,129,0.1)":failed?"rgba(239,68,68,0.07)":"#1e293b",
                border:`1px solid ${done?"#10b981":failed?"#ef4444":"#334155"}`,
                borderRadius:16,padding:"16px",display:"flex",alignItems:"center",gap:14,
                cursor:log?"default":"pointer",textAlign:"left",width:"100%",
                opacity:log?0.9:1,
              }}>
              <div style={{fontSize:30,width:40,textAlign:"center"}}>{done?"✅":failed?"❌":ch.emoji}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"Syne,sans-serif",fontSize:14,color:done?"#10b981":failed?"#ef4444":"#f1f5f9",fontWeight:700}}>
                  {ch.label}
                  {log?.subType&&<span style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#64748b",fontWeight:400}}> · {log.subType}</span>}
                </div>
                <div style={{fontFamily:"DM Sans,sans-serif",fontSize:12,color:"#64748b",marginTop:2}}>{ch.desc}</div>
                {streak>0&&<div style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#f59e0b",marginTop:3}}>🔥 {streak} day streak</div>}
              </div>
              <div style={{textAlign:"right"}}>
                {!log&&<div style={{fontFamily:"Syne,sans-serif",fontSize:14,color:"#10b981",fontWeight:800}}>+{ch.points}</div>}
                {done&&<div style={{fontFamily:"Syne,sans-serif",fontSize:13,color:"#10b981",fontWeight:700}}>+{log.points}</div>}
                {!log&&<div style={{fontFamily:"DM Sans,sans-serif",fontSize:10,color:"#64748b"}}>pts</div>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Bonus indicator */}
      <div style={{background:"#1e293b",border:"1px solid #334155",borderRadius:14,padding:"12px 16px",marginTop:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontFamily:"Syne,sans-serif",fontSize:13,color:"#f1f5f9",fontWeight:700}}>🏆 Perfect Day Bonus</div>
          <div style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#64748b",marginTop:2}}>Complete all 4 challenges</div>
        </div>
        <div style={{fontFamily:"Syne,sans-serif",fontSize:16,color:"#f59e0b",fontWeight:800}}>+{20} pts</div>
      </div>
    </div>
  );
}

// ─── Leaderboard ───────────────────────────────────────────
function LeaderboardView({squad, me, logs, onRefresh, loading}) {
  const medals=["🥇","🥈","🥉"];
  return (
    <div style={{animation:"qf-up 0.3s ease"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
        <h2 style={{fontFamily:"Syne,sans-serif",fontSize:22,color:"#f1f5f9",fontWeight:800}}>Squad Leaderboard</h2>
        <button onClick={onRefresh} disabled={loading} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,opacity:loading?0.4:1,color:"#64748b"}}>⟳</button>
      </div>
      <p style={{fontFamily:"DM Sans,sans-serif",fontSize:12,color:"#64748b",marginBottom:16}}>Ranked by all-time points</p>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {squad.map((u,i)=>{
          const t=getTier(u.points);
          const isMe=u.email===me;
          const todayChallenges=CHALLENGES.map(ch=>({...ch,done:logs.some(l=>l.email===u.email&&l.date===toDateStr()&&l.challengeId===ch.id&&l.done)}));
          return (
            <div key={u.email} style={{background:isMe?"rgba(16,185,129,0.08)":"#1e293b",border:`1px solid ${isMe?"#10b981":"#334155"}`,borderRadius:16,padding:"14px 16px"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontFamily:"Syne,sans-serif",fontSize:18,minWidth:28}}>{medals[i]||`#${i+1}`}</span>
                <div style={{fontSize:24}}>{u.avatar||"🧑"}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"DM Sans,sans-serif",fontSize:14,color:"#f1f5f9",fontWeight:500}}>{u.name}{isMe?" (you)":""}</div>
                  <div style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 8px",borderRadius:20,fontSize:10,fontWeight:700,fontFamily:"Syne,sans-serif",background:t.bg,color:t.color,marginTop:3}}>
                    {t.emoji} {t.name}
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"Syne,sans-serif",fontSize:15,color:"#f59e0b",fontWeight:800}}>{u.points} pts</div>
                  <div style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#64748b"}}>{u.todayDone}/4 today</div>
                </div>
              </div>
              {/* Today's challenge dots */}
              <div style={{display:"flex",gap:6,marginTop:10}}>
                {todayChallenges.map(ch=>(
                  <div key={ch.id} title={ch.label} style={{flex:1,height:4,borderRadius:2,background:ch.done?"#10b981":"#334155"}}/>
                ))}
              </div>
            </div>
          );
        })}
        {squad.length===0&&<div style={{textAlign:"center",color:"#64748b",padding:40,fontFamily:"DM Sans,sans-serif"}}>No squad data yet — be the first!</div>}
      </div>
    </div>
  );
}

// ─── Profile ───────────────────────────────────────────────
function ProfileView({user, myLogs, totalPoints, tier, getChallengeStreak, onShareOpen, onLogout}) {
  const last14=Array.from({length:14},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(13-i));return toDateStr(d);});
  return (
    <div style={{animation:"qf-up 0.3s ease",paddingBottom:20}}>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
        <div style={{width:56,height:56,borderRadius:"50%",border:"3px solid #334155",background:"#1e293b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>
          {user.avatar||"🧑"}
        </div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"Syne,sans-serif",fontSize:17,color:"#f1f5f9",fontWeight:700}}>{user.name}</div>
          <div style={{fontFamily:"DM Sans,sans-serif",fontSize:12,color:"#64748b"}}>{user.email}</div>
          <div style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:20,fontSize:11,fontWeight:700,fontFamily:"Syne,sans-serif",background:tier.bg,color:tier.color,marginTop:5}}>
            {tier.emoji} {tier.name} · {totalPoints} pts
          </div>
        </div>
      </div>

      {/* Per-challenge streaks */}
      <div style={{background:"#1e293b",border:"1px solid #334155",borderRadius:16,padding:"16px",marginBottom:16}}>
        <div style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#64748b",letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>CHALLENGE STREAKS</div>
        {CHALLENGES.map(ch=>{
          const streak=getChallengeStreak(ch.id);
          return (
            <div key={ch.id} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid #0f172a"}}>
              <span style={{fontSize:22,width:32,textAlign:"center"}}>{ch.emoji}</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:"Syne,sans-serif",fontSize:13,color:"#f1f5f9",fontWeight:600}}>{ch.label}</div>
                <div style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#64748b"}}>{ch.desc}</div>
              </div>
              <div style={{fontFamily:"Syne,sans-serif",fontSize:14,color:"#f59e0b",fontWeight:800}}>
                {streak>0?`🔥 ${streak}d`:"—"}
              </div>
            </div>
          );
        })}
      </div>

      {/* 14-day heatmap per challenge */}
      <div style={{background:"#1e293b",border:"1px solid #334155",borderRadius:16,padding:"16px",marginBottom:16}}>
        <div style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#64748b",letterSpacing:2,textTransform:"uppercase",marginBottom:12}}>LAST 14 DAYS</div>
        {CHALLENGES.map(ch=>{
          const doneDates=myLogs.filter(l=>l.challengeId===ch.id&&l.done).map(l=>l.date);
          return (
            <div key={ch.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:14,width:20,textAlign:"center"}}>{ch.emoji}</span>
              <div style={{display:"flex",gap:3,flex:1}}>
                {last14.map(date=>{
                  const done=doneDates.includes(date);
                  const isToday=date===toDateStr();
                  return <div key={date} style={{flex:1,height:10,borderRadius:2,background:done?ch.color:"#334155",border:isToday?"1px solid #f59e0b":"none",opacity:done?1:0.5}}/>;
                })}
              </div>
            </div>
          );
        })}
        <div style={{display:"flex",gap:12,marginTop:8,fontSize:10,color:"#64748b",fontFamily:"DM Sans,sans-serif"}}>
          <span>← 14 days ago</span><span style={{marginLeft:"auto"}}>Today →</span>
        </div>
      </div>

      <button onClick={onShareOpen} style={{width:"100%",background:"linear-gradient(135deg,#1e293b,#0f172a)",border:"1px solid #334155",borderRadius:11,padding:"13px",fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700,color:"#10b981",cursor:"pointer",marginBottom:10}}>
        📲 Share My Progress
      </button>
      <button style={{width:"100%",background:"none",border:"1px solid #334155",borderRadius:11,padding:"12px",fontFamily:"DM Sans,sans-serif",fontSize:13,color:"#ef4444",cursor:"pointer"}} onClick={onLogout}>Sign out</button>
    </div>
  );
}


// ─── Share Modal ──────────────────────────────────────────
const MOTIVATIONAL = [
  "Discipline is choosing what you want most over what you want now.",
  "Small daily improvements lead to stunning long-term results.",
  "You don't have to be extreme. Just be consistent.",
  "The body achieves what the mind believes.",
  "Progress, not perfection.",
  "Your only competition is who you were yesterday.",
  "Every day is a second chance.",
  "Hard days build strong people.",
];

function ShareModal({ user, totalPoints, tier, myLogs, getChallengeStreak, onClose }) {
  const [copied, setCopied]     = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [platform, setPlatform] = useState(null); // "ig" | "wa" | "fb"

  const quote = MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)];
  const today = toDateStr();
  const todayDone = CHALLENGES.filter(ch =>
    myLogs.some(l => l.date === today && l.challengeId === ch.id && l.done)
  );
  const longestStreak = Math.max(0, ...CHALLENGES.map(ch => getChallengeStreak(ch.id)));

  // Build share text
  function shareText() {
    const doneEmojis = todayDone.map(c => c.emoji).join(" ");
    const lines = [
      `⚡ QuadFyt — Day Update`,
      ``,
      `${doneEmojis || "🏁"} Challenges done today: ${todayDone.length}/4`,
      todayDone.map(c => `  ${c.emoji} ${c.label}`).join("\n"),
      ``,
      `🔥 Best streak: ${longestStreak} days`,
      `⭐ Total points: ${totalPoints} — ${tier.emoji} ${tier.name}`,
      ``,
      `"${quote}"`,
      ``,
      `#QuadFyt #NoSugar #HealthyHabits #DailyWins`,
    ];
    return lines.join("\n");
  }

  // Draw canvas share card (1080×1080 for IG)
  function drawCard(canvas) {
    const ctx = canvas.getContext("2d");
    const W = 1080, H = 1080;
    canvas.width = W; canvas.height = H;

    // Dark background
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0f172a");
    bg.addColorStop(1, "#1e293b");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Accent top bar
    ctx.fillStyle = "#10b981";
    ctx.fillRect(0, 0, W, 8);

    // App name
    ctx.fillStyle = "#10b981";
    ctx.font = "bold 52px Arial";
    ctx.textAlign = "center";
    ctx.fillText("QuadFyt ⚡", W/2, 90);

    // Username
    ctx.fillStyle = "#64748b";
    ctx.font = "36px Arial";
    ctx.fillText(user.name, W/2, 145);

    // Stats row
    const stats = [
      { label: "Challenges", value: `${todayDone.length}/4` },
      { label: "Best Streak", value: `${longestStreak}d 🔥` },
      { label: "Points",     value: `${totalPoints} ⭐` },
    ];
    stats.forEach((s, i) => {
      const x = 180 + i * 360;
      // Card bg
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x-130, 190, 260, 160, 20);
      else ctx.rect(x-130, 190, 260, 160);
      ctx.fill();
      ctx.fillStyle = "#f1f5f9";
      ctx.font = "bold 60px Arial";
      ctx.textAlign = "center";
      ctx.fillText(s.value, x, 295);
      ctx.fillStyle = "#64748b";
      ctx.font = "28px Arial";
      ctx.fillText(s.label, x, 335);
    });

    // Tier badge
    ctx.fillStyle = "rgba(16,185,129,0.15)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(W/2-140, 390, 280, 70, 35);
    else ctx.rect(W/2-140, 390, 280, 70);
    ctx.fill();
    ctx.fillStyle = "#10b981";
    ctx.font = "bold 36px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${tier.emoji} ${tier.name} Tier`, W/2, 435);

    // Divider
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(80, 500); ctx.lineTo(W-80, 500);
    ctx.stroke();

    // Today's challenges
    ctx.fillStyle = "#64748b";
    ctx.font = "28px Arial";
    ctx.textAlign = "center";
    ctx.fillText("TODAY'S CHALLENGES", W/2, 555);

    CHALLENGES.forEach((ch, i) => {
      const done = todayDone.some(d => d.id === ch.id);
      const row = i;
      const y = 610 + row * 90;
      // Row bg
      ctx.fillStyle = done ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)";
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(80, y-50, W-160, 72, 14);
      else ctx.rect(80, y-50, W-160, 72);
      ctx.fill();
      // Emoji
      ctx.font = "38px Arial";
      ctx.textAlign = "left";
      ctx.fillText(done ? "✅" : "⬜", 115, y);
      // Label
      ctx.fillStyle = done ? "#10b981" : "#475569";
      ctx.font = done ? "bold 34px Arial" : "34px Arial";
      ctx.fillText(`${ch.emoji} ${ch.label}`, 185, y);
      // Points
      if (done) {
        ctx.fillStyle = "#10b981";
        ctx.font = "bold 30px Arial";
        ctx.textAlign = "right";
        ctx.fillText(`+${ch.points} pts`, W-115, y);
      }
    });

    // Quote
    ctx.fillStyle = "#475569";
    ctx.font = "italic 28px Arial";
    ctx.textAlign = "center";
    // Word-wrap the quote
    const words = quote.split(" ");
    let line = "", lines = [], maxW = W - 200;
    for (const w of words) {
      const test = line + (line ? " " : "") + w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line); line = w;
      } else line = test;
    }
    lines.push(line);
    lines.forEach((l, i) => ctx.fillText(`"${i===0?l:l}"`, W/2, 985 + i*38 - (lines.length-1)*19));

    // Hashtags
    ctx.fillStyle = "#334155";
    ctx.font = "24px Arial";
    ctx.fillText("#QuadFyt  #NoSugar  #HealthyHabits", W/2, 1050);

    setCardReady(true);
  }

  function downloadCard() {
    const canvas = document.getElementById("qf-share-canvas");
    drawCard(canvas);
    setTimeout(() => {
      const link = document.createElement("a");
      link.download = `quadfyt-${today}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    }, 100);
  }

  async function copyAndOpen(p) {
    const text = shareText();
    try { await navigator.clipboard.writeText(text); } catch {}
    setCopied(true);
    setPlatform(p);
    const urls = {
      wa: "https://wa.me/?text=" + encodeURIComponent(text),
      fb: "https://www.facebook.com/sharer/sharer.php",
      ig: null, // IG doesn't allow direct share via URL — must download image
    };
    if (urls[p]) window.open(urls[p], "_blank");
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <div style={{position:"absolute",inset:0,zIndex:200,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:"#1e293b",borderRadius:"22px 22px 0 0",padding:"28px 22px 36px",width:"100%",maxWidth:430,border:"1px solid #334155",animation:"qf-slide-up 0.3s ease"}} onClick={e=>e.stopPropagation()}>

        <canvas id="qf-share-canvas" style={{display:"none"}}/>

        {/* Handle */}
        <div style={{width:40,height:4,background:"#334155",borderRadius:2,margin:"0 auto 20px"}}/>

        <div style={{fontFamily:"Syne,sans-serif",fontSize:18,color:"#f1f5f9",fontWeight:800,marginBottom:4}}>Share Your Progress 📲</div>
        <div style={{fontFamily:"DM Sans,sans-serif",fontSize:13,color:"#64748b",marginBottom:20}}>Today: {todayDone.length}/4 done · {longestStreak}d streak · {totalPoints} pts</div>

        {/* Mini preview */}
        <div style={{background:"#0f172a",border:"1px solid #334155",borderRadius:16,padding:"16px",marginBottom:20}}>
          <div style={{fontFamily:"Syne,sans-serif",fontSize:13,color:"#10b981",fontWeight:700,marginBottom:10}}>⚡ QuadFyt — Your Stats</div>
          <div style={{display:"flex",gap:12,marginBottom:12}}>
            {[["🏁",`${todayDone.length}/4`,"Today"],["🔥",`${longestStreak}d`,"Streak"],["⭐",totalPoints,"Points"]].map(([e,v,l])=>(
              <div key={l} style={{flex:1,background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"10px 6px",textAlign:"center",border:"1px solid #334155"}}>
                <div style={{fontSize:16}}>{e}</div>
                <div style={{fontFamily:"Syne,sans-serif",fontSize:16,color:"#f1f5f9",fontWeight:800}}>{v}</div>
                <div style={{fontFamily:"DM Sans,sans-serif",fontSize:10,color:"#64748b"}}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:6}}>
            {CHALLENGES.map(ch=>{
              const done=todayDone.some(d=>d.id===ch.id);
              return (
                <div key={ch.id} style={{flex:1,background:done?"rgba(16,185,129,0.15)":"rgba(255,255,255,0.03)",border:`1px solid ${done?"#10b981":"#334155"}`,borderRadius:8,padding:"6px 4px",textAlign:"center"}}>
                  <div style={{fontSize:14}}>{done?"✅":ch.emoji}</div>
                  <div style={{fontFamily:"DM Sans,sans-serif",fontSize:9,color:done?"#10b981":"#475569",marginTop:2}}>{ch.label.split(" ")[0]}</div>
                </div>
              );
            })}
          </div>
          <div style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#475569",fontStyle:"italic",marginTop:12,lineHeight:1.5}}>"{quote}"</div>
        </div>

        {/* Download image button */}
        {/* Platform share buttons — most prominent */}
        <div style={{fontFamily:"DM Sans,sans-serif",fontSize:11,color:"#64748b",textAlign:"center",marginBottom:10}}>
          {copied ? "✅ Text copied! Paste it in your app." : "Choose where to share:"}
        </div>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <button onClick={()=>copyAndOpen("wa")} style={{flex:1,background:"#25d366",color:"#fff",border:"none",borderRadius:12,padding:"13px 6px",display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer"}}>
            <span style={{fontSize:24}}>💬</span>
            <span style={{fontFamily:"Syne,sans-serif",fontSize:12,fontWeight:700}}>WhatsApp</span>
            <span style={{fontFamily:"DM Sans,sans-serif",fontSize:9,opacity:0.85}}>Opens app</span>
          </button>
          <button onClick={()=>copyAndOpen("fb")} style={{flex:1,background:"#1877f2",color:"#fff",border:"none",borderRadius:12,padding:"13px 6px",display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer"}}>
            <span style={{fontSize:24}}>📘</span>
            <span style={{fontFamily:"Syne,sans-serif",fontSize:12,fontWeight:700}}>Facebook</span>
            <span style={{fontFamily:"DM Sans,sans-serif",fontSize:9,opacity:0.85}}>Opens app</span>
          </button>
          <button onClick={()=>copyAndOpen("ig")} style={{flex:1,background:"#833ab4",color:"#fff",border:"none",borderRadius:12,padding:"13px 6px",display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer"}}>
            <span style={{fontSize:24}}>📸</span>
            <span style={{fontFamily:"Syne,sans-serif",fontSize:12,fontWeight:700}}>Instagram</span>
            <span style={{fontFamily:"DM Sans,sans-serif",fontSize:9,opacity:0.85}}>Copy + image</span>
          </button>
        </div>

        {platform==="ig" && (
          <div style={{background:"rgba(131,58,180,0.1)",border:"1px solid #833ab4",borderRadius:10,padding:"10px 14px",fontFamily:"DM Sans,sans-serif",fontSize:12,color:"#c084fc",marginBottom:10,lineHeight:1.5}}>
            📸 <strong>Instagram:</strong> 1. Download image below → 2. Open IG → 3. New Story/Post → 4. Pick downloaded image → 5. Paste caption from clipboard
          </div>
        )}

        {/* Download image */}
        <button onClick={downloadCard} style={{width:"100%",background:"rgba(16,185,129,0.12)",color:"#10b981",border:"1px solid #10b981",borderRadius:12,padding:"12px",fontFamily:"Syne,sans-serif",fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:8}}>
          📥 Download 1080×1080 Image
        </button>

        <button onClick={()=>{const t=shareText();try{navigator.clipboard.writeText(t);}catch{}setCopied(true);setTimeout(()=>setCopied(false),3000);}}
          style={{width:"100%",background:"none",border:"1px solid #334155",borderRadius:12,padding:"11px",fontFamily:"DM Sans,sans-serif",fontSize:13,color:"#94a3b8",cursor:"pointer",marginBottom:4}}>
          {copied?"✅ Copied!":"📋 Copy text only"}
        </button>

        <button onClick={onClose} style={{width:"100%",background:"none",border:"none",padding:"10px",fontFamily:"DM Sans,sans-serif",fontSize:13,color:"#475569",cursor:"pointer"}}>
          Close
        </button>
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────
const S = {
  root:{background:"#0f172a",minHeight:"100vh",maxWidth:430,margin:"0 auto",fontFamily:"DM Sans,sans-serif"},
  loginRoot:{background:"linear-gradient(145deg,#0f172a,#1e293b)",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20},
  loginCard:{background:"#1e293b",borderRadius:22,padding:"34px 26px",maxWidth:360,width:"100%",textAlign:"center",boxShadow:"0 24px 64px rgba(0,0,0,0.5)",border:"1px solid #334155"},
  loginTitle:{fontFamily:"Syne,sans-serif",fontSize:34,color:"#f1f5f9",letterSpacing:-1,marginBottom:6},
  loginSub:{fontFamily:"DM Sans,sans-serif",color:"#64748b",fontSize:15,lineHeight:1.6,marginBottom:22},
  loginFeatures:{background:"#0f172a",borderRadius:13,padding:"13px 16px",marginBottom:22,textAlign:"left",border:"1px solid #334155"},
  googleBtn:{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:12,background:"#f1f5f9",border:"none",borderRadius:11,padding:"13px",fontFamily:"Syne,sans-serif",fontSize:15,fontWeight:700,cursor:"pointer",color:"#0f172a"},
  spinner:{width:17,height:17,border:"2px solid #334155",borderTop:"2px solid #f1f5f9",borderRadius:"50%",display:"inline-block",animation:"qf-spin 0.7s linear infinite"},
  header:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 18px",borderBottom:"1px solid #1e293b",background:"#0f172a",position:"sticky",top:0,zIndex:10},
  logo:{fontFamily:"Syne,sans-serif",fontSize:20,color:"#f1f5f9",letterSpacing:-1},
  accent:{color:"#10b981"},
  headerRight:{display:"flex",alignItems:"center",gap:8},
  tierBadge:{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:700,fontFamily:"Syne,sans-serif"},
  avatarBtn:{width:34,height:34,borderRadius:"50%",border:"2px solid #334155",background:"#1e293b",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"},
  infoBanner:{padding:"9px 16px",fontFamily:"DM Sans,sans-serif",fontSize:12,display:"flex",alignItems:"center",border:"1px solid",borderLeft:"none",borderRight:"none"},
  demoBanner:{background:"#1e293b",color:"#64748b",padding:"8px 16px",fontFamily:"DM Sans,sans-serif",fontSize:12,textAlign:"center",borderBottom:"1px solid #334155"},
  main:{padding:"18px 18px 88px"},
  nav:{position:"sticky",bottom:0,background:"#0f172a",borderTop:"1px solid #1e293b",display:"flex",zIndex:10},
  navBtn:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"9px 0",background:"none",border:"none",cursor:"pointer",gap:2,color:"#475569"},
  navActive:{color:"#10b981"},
  overlay:{position:"absolute",inset:0,zIndex:200,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",padding:22},
  modalBox:{background:"#1e293b",borderRadius:22,padding:"30px 24px",textAlign:"center",maxWidth:300,width:"100%",border:"1px solid #334155",animation:"qf-pop 0.3s ease"},
  celebTitle:{fontFamily:"Syne,sans-serif",fontSize:19,color:"#f1f5f9",fontWeight:800,marginTop:10},
  celebMsg:{fontFamily:"DM Sans,sans-serif",color:"#94a3b8",marginTop:8,fontSize:13,lineHeight:1.6},
  pointsPill:{marginTop:13,display:"inline-block",background:"rgba(16,185,129,0.15)",color:"#10b981",padding:"5px 16px",borderRadius:20,fontFamily:"Syne,sans-serif",fontSize:17,fontWeight:800,border:"1px solid #10b981"},
  streakPill:{marginTop:7,display:"inline-block",background:"rgba(245,158,11,0.1)",color:"#f59e0b",padding:"4px 13px",borderRadius:20,fontFamily:"DM Sans,sans-serif",fontSize:13,fontWeight:600},
  primaryBtn:{marginTop:16,width:"100%",background:"#10b981",color:"#fff",border:"none",borderRadius:11,padding:"12px",fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700,cursor:"pointer"},
  doneBtn:{width:"100%",background:"rgba(16,185,129,0.15)",color:"#10b981",border:"1px solid #10b981",borderRadius:12,padding:"13px",fontFamily:"Syne,sans-serif",fontSize:14,fontWeight:700,cursor:"pointer"},
  failBtn:{width:"100%",background:"rgba(239,68,68,0.08)",color:"#ef4444",border:"1px solid #ef4444",borderRadius:12,padding:"12px",fontFamily:"DM Sans,sans-serif",fontSize:13,cursor:"pointer"},
  cancelBtn:{width:"100%",background:"none",color:"#64748b",border:"1px solid #334155",borderRadius:12,padding:"12px",fontFamily:"DM Sans,sans-serif",fontSize:13,cursor:"pointer"},
  sharePlatformBtn:{color:"#fff",border:"none",borderRadius:12,padding:"12px 6px",display:"flex",flexDirection:"column",alignItems:"center",gap:4,cursor:"pointer"},
  subBtn:{flex:1,background:"#0f172a",color:"#f1f5f9",border:"1px solid #334155",borderRadius:12,padding:"12px 8px",fontFamily:"Syne,sans-serif",fontSize:13,fontWeight:700,cursor:"pointer"},
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0f172a}
  @keyframes qf-float{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-220px) scale(0.2);opacity:0}}
  @keyframes qf-pop{0%{transform:scale(0.85);opacity:0}70%{transform:scale(1.02)}100%{transform:scale(1);opacity:1}}
  @keyframes qf-up{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}
  @keyframes qf-spin{to{transform:rotate(360deg)}}
  @keyframes qf-slide-up{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
  button:active{transform:scale(0.97)}
  ::-webkit-scrollbar{display:none}
`;
