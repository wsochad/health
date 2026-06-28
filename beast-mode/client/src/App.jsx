import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

// ─── CONFIG ──────────────────────────────────────────────────────
const GOAL_WEIGHT  = 95;
const START_WEIGHT = 105;

const EXERCISES = [
  { id: "pushups",  name: "Push-ups",      target: 50,  muscle: "Chest",     unit: "reps" },
  { id: "situps",   name: "Sit-ups",        target: 50,  muscle: "Core",      unit: "reps" },
  { id: "squats",   name: "Squats",         target: 100, muscle: "Legs",      unit: "reps" },
  { id: "rows",     name: "Table Rows",     target: 30,  muscle: "Back",      unit: "reps" },
  { id: "superman", name: "Superman",       target: 30,  muscle: "Back",      unit: "reps" },
  { id: "plank",    name: "Plank",          target: 90,  muscle: "Core",      unit: "sec"  },
  { id: "curls",    name: "Bicep Curls",    target: 40,  muscle: "Biceps",    unit: "reps" },
  { id: "tricep",   name: "Tricep Ext.",    target: 40,  muscle: "Triceps",   unit: "reps" },
  { id: "lateral",  name: "Lateral Raises", target: 60,  muscle: "Shoulders", unit: "reps" },
  { id: "press",    name: "Overhead Press", target: 60,  muscle: "Shoulders", unit: "reps" },
  { id: "loop",     name: "Palace Loop",    target: 1,   muscle: "Cardio",    unit: "done" },
];

const MC = {
  Chest: "#ff6b35", Core: "#ff9f1c", Legs: "#4a9eff",
  Back: "#a78bfa",  Biceps: "#f59e0b", Triceps: "#fb923c",
  Shoulders: "#34d399", Cardio: "#b5ff3c",
};

const LEVELS = [
  { name: "ROOKIE",   min: 0,     color: "#666" },
  { name: "WARRIOR",  min: 1000,  color: "#4a9eff" },
  { name: "BEAST",    min: 5000,  color: "#ff8c00" },
  { name: "SHREDDED", min: 15000, color: "#b5ff3c" },
  { name: "LEGEND",   min: 30000, color: "#ff2d78" },
];

// ─── API ─────────────────────────────────────────────────────────
const api = {
  async get(p)      { const r = await fetch(`/api${p}`);                                                                   if (!r.ok) throw new Error(await r.text()); return r.json(); },
  async post(p, b)  { const r = await fetch(`/api${p}`, { method:"POST",   headers:{"Content-Type":"application/json"}, body:JSON.stringify(b) }); if (!r.ok) throw new Error(await r.text()); return r.json(); },
  async put(p, b)   { const r = await fetch(`/api${p}`, { method:"PUT",    headers:{"Content-Type":"application/json"}, body:JSON.stringify(b) }); if (!r.ok) throw new Error(await r.text()); return r.json(); },
  async del(p)      { const r = await fetch(`/api${p}`, { method:"DELETE" });                                              if (!r.ok) throw new Error(await r.text()); return r.json(); },
};

// ─── HELPERS ─────────────────────────────────────────────────────
const getToday = () => new Date().toISOString().slice(0, 10);

function getLv(xp)    { let l = LEVELS[0]; for (const v of LEVELS) if (xp >= v.min) l = v; return l; }
function getNextLv(xp){ for (const l of LEVELS) if (xp < l.min) return l; return null; }

function calcDayXP(exObj = {}) {
  let xp = 0;
  Object.entries(exObj).forEach(([id, v]) => {
    const e = EXERCISES.find(x => x.id === id);
    if (!e) return;
    xp += e.unit === "done" ? (v.done ? 200 : 0) : Math.min(v.reps || 0, e.target);
  });
  const allDone = EXERCISES.every(e => {
    const v = exObj[e.id];
    if (!v) return false;
    return e.unit === "done" ? v.done : (v.reps || 0) >= e.target;
  });
  if (allDone) xp += 300;
  return xp;
}

function calcStreak(days) {
  let s = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if (days.includes(d.toISOString().slice(0, 10))) s++;
    else if (i > 0) break;
  }
  return s;
}

function fmtDate(str) {
  return new Date(str + "T00:00:00").toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" });
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────
export default function BeastMode() {
  const [tab, setTab]           = useState("today");
  const [dayData, setDayData]   = useState({ exercises: {} });
  const [weights, setWeights]   = useState([]);
  const [days, setDays]         = useState([]);
  const [totalXP, setTotalXP]   = useState(0);
  const [wInput, setWInput]     = useState("");
  const [reps, setReps]         = useState({});
  const [flash, setFlash]       = useState(null);
  const [ready, setReady]       = useState(false);
  const [modal, setModal]       = useState(null); // { ex } for edit/delete
  const [editVal, setEditVal]   = useState("");
  const [histEx, setHistEx]     = useState("pushups");
  const [histData, setHistData] = useState([]);

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const [day, ws, ds, xpRes] = await Promise.all([
          api.get(`/day/${getToday()}`),
          api.get("/weights"),
          api.get("/days"),
          api.get("/xp"),
        ]);
        setDayData(day || { exercises: {} });
        setWeights(ws || []);
        setDays(ds || []);
        setTotalXP(xpRes?.total_xp || 0);
      } catch (e) { console.error("Load error:", e); }
      setReady(true);
    })();
  }, []);

  // Load history chart when tab or exercise changes
  useEffect(() => {
    if (tab !== "history") return;
    api.get(`/history/${histEx}`).then(setHistData).catch(console.error);
  }, [histEx, tab]);

  const flash_ = (msg) => { setFlash(msg); setTimeout(() => setFlash(null), 1600); };

  // Log reps (accumulates within a day)
  const logEx = async (ex, val) => {
    const parsed = ex.unit === "done" ? 1 : parseInt(val);
    if (!parsed || parsed <= 0) return;

    const oldXP   = calcDayXP(dayData.exercises);
    const prev    = ex.unit === "done" ? 0 : (dayData.exercises[ex.id]?.reps || 0);
    const newReps = ex.unit === "done" ? 1 : prev + parsed;
    const newEx   = { ...dayData.exercises, [ex.id]: { reps: newReps, done: true, t: new Date().toISOString() } };
    const gained  = Math.max(0, calcDayXP(newEx) - oldXP);
    const newXP   = totalXP + gained;

    // Optimistic UI
    setDayData(d => ({ ...d, exercises: newEx }));
    setReps(r => ({ ...r, [ex.id]: "" }));
    if (gained > 0) { setTotalXP(newXP); flash_(`+${gained} XP`); }
    if (!days.includes(getToday())) setDays(d => [...d, getToday()]);

    // Persist
    try {
      await api.put(`/day/${getToday()}/exercise/${ex.id}`, { reps: newReps, done: true });
      if (gained > 0) await api.post("/xp", { total_xp: newXP });
    } catch (e) { console.error(e); }
  };

  // Edit reps to a specific value
  const editEx = async (ex, newReps) => {
    const parsed = parseInt(newReps);
    if (isNaN(parsed) || parsed < 0) return;
    const oldXP = calcDayXP(dayData.exercises);
    const newEx = { ...dayData.exercises, [ex.id]: { reps: parsed, done: parsed > 0, t: new Date().toISOString() } };
    const diff  = calcDayXP(newEx) - oldXP;
    const newXP = Math.max(0, totalXP + diff);

    setDayData(d => ({ ...d, exercises: newEx }));
    setTotalXP(newXP);
    setModal(null);

    try {
      await api.put(`/day/${getToday()}/exercise/${ex.id}`, { reps: parsed, done: parsed > 0 });
      await api.post("/xp", { total_xp: newXP });
    } catch (e) { console.error(e); }
  };

  // Delete exercise log for today
  const deleteEx = async (exId) => {
    const oldXP = calcDayXP(dayData.exercises);
    const newEx = { ...dayData.exercises };
    delete newEx[exId];
    const newXP = Math.max(0, totalXP - (oldXP - calcDayXP(newEx)));

    setDayData(d => ({ ...d, exercises: newEx }));
    setTotalXP(newXP);
    setModal(null);

    try {
      await api.del(`/day/${getToday()}/exercise/${exId}`);
      await api.post("/xp", { total_xp: newXP });
    } catch (e) { console.error(e); }
  };

  // Log weight
  const logWeight = async () => {
    const w = parseFloat(wInput);
    if (!w || w < 40 || w > 250) return;
    const entry = { date: getToday(), weight: w };
    setWeights(ws => [...ws.filter(x => x.date !== getToday()), entry].sort((a,b) => a.date.localeCompare(b.date)));
    setWInput("");
    try { await api.post("/weights", entry); } catch (e) { console.error(e); }
  };

  // Delete weight entry
  const deleteWeight = async (date) => {
    setWeights(ws => ws.filter(w => w.date !== date));
    try { await api.del(`/weights/${date}`); } catch (e) { console.error(e); }
  };

  if (!ready) return (
    <div style={{ background:"#080808", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <span style={{ fontFamily:"monospace", fontSize:18, letterSpacing:"0.2em", color:"#b5ff3c" }}>LOADING BEAST MODE...</span>
    </div>
  );

  // ── Derived values ────────────────────────────────────────────
  const streak   = calcStreak(days);
  const lv       = getLv(totalXP);
  const nxt      = getNextLv(totalXP);
  const lvPct    = nxt ? (totalXP - lv.min) / (nxt.min - lv.min) * 100 : 100;
  const latestW  = weights.length ? parseFloat(weights[weights.length-1].weight) : START_WEIGHT;
  const lost     = Math.max(0, START_WEIGHT - latestW);
  const wPct     = Math.min(lost / (START_WEIGHT - GOAL_WEIGHT) * 100, 100);
  const todayXP  = calcDayXP(dayData.exercises);
  const doneCount = EXERCISES.filter(e => {
    const v = dayData.exercises[e.id];
    if (!v) return false;
    return e.unit === "done" ? v.done : (v.reps||0) >= e.target;
  }).length;
  const allDone = doneCount === EXERCISES.length;

  // ── Inline styles ─────────────────────────────────────────────
  const S = {
    wrap:   { background:"#080808", minHeight:"100vh", fontFamily:"'DM Mono','IBM Plex Mono',monospace", color:"#e8e8e8", paddingBottom:60 },
    hdr:    { background:"#0d0d0d", borderBottom:"1px solid #1c1c1c", padding:"14px 16px 0" },
    hRow:   { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 },
    badge:  { fontSize:11, fontWeight:700, letterSpacing:"0.18em", color:lv.color, background:lv.color+"18", border:`1px solid ${lv.color}44`, padding:"4px 10px", borderRadius:3 },
    xpBar:  { height:3, background:"#1c1c1c", borderRadius:2, overflow:"hidden" },
    xpFill: { height:"100%", width:lvPct+"%", background:`linear-gradient(90deg,${lv.color}88,${lv.color})`, transition:"width .6s" },
    xpRow:  { display:"flex", justifyContent:"space-between", padding:"5px 0 12px", fontSize:10, color:"#444", letterSpacing:"0.06em" },
    tabs:   { display:"flex", background:"#0d0d0d", borderBottom:"1px solid #1a1a1a" },
    tab:  s => ({ flex:1, padding:"11px 0", fontSize:10, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", background:"none", border:"none", color:s?"#e8e8e8":"#3a3a3a", borderBottom:s?`2px solid ${lv.color}`:"2px solid transparent", cursor:"pointer", fontFamily:"inherit", transition:"color .15s" }),
    body:   { padding:"14px 14px 0" },
    stat3:  { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 },
    stat2:  { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 },
    sCard:  { background:"#0f0f0f", border:"1px solid #1c1c1c", borderRadius:6, padding:"10px 12px", textAlign:"center" },
    sVal:   { fontSize:24, fontWeight:700, display:"block", lineHeight:1.1 },
    sLbl:   { fontSize:9, color:"#3a3a3a", textTransform:"uppercase", letterSpacing:"0.12em", marginTop:3, display:"block" },
    label:  { fontSize:9, fontWeight:700, letterSpacing:"0.15em", textTransform:"uppercase", color:"#333", marginBottom:8, marginTop:14 },
    grid2:  { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 },
    exCard: d => ({ background:d?"#0a120a":"#0f0f0f", border:d?"1px solid #1e3a1e":"1px solid #1c1c1c", borderRadius:6, padding:"11px 12px", position:"relative" }),
    exName: { fontSize:13, fontWeight:700, color:"#e8e8e8", marginBottom:1, letterSpacing:"0.02em" },
    muscle: m => ({ fontSize:9, fontWeight:700, color:MC[m]||"#888", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:8 }),
    pWrap:  { height:3, background:"#1c1c1c", borderRadius:2, overflow:"hidden", marginBottom:6 },
    pFill:  (p,m) => ({ height:"100%", width:Math.min(p,100)+"%", background:MC[m]||"#b5ff3c", borderRadius:2, transition:"width .4s" }),
    iRow:   { display:"flex", gap:6, marginTop:6 },
    input:  { flex:1, minWidth:0, background:"#080808", border:"1px solid #222", borderRadius:3, color:"#e8e8e8", fontFamily:"inherit", fontSize:13, padding:"6px 8px", outline:"none" },
    logBtn: c => ({ background:c||"#b5ff3c", color:"#080808", border:"none", borderRadius:3, fontSize:10, fontWeight:800, padding:"6px 10px", cursor:"pointer", letterSpacing:"0.08em", whiteSpace:"nowrap", fontFamily:"inherit" }),
    editBtn:{ background:"none", border:"none", color:"#333", fontSize:10, cursor:"pointer", padding:"0 4px", fontFamily:"inherit", letterSpacing:"0.06em" },
    doneTag:{ position:"absolute", top:9, right:10, fontSize:10, color:"#4ade80", fontWeight:700, letterSpacing:"0.06em" },
    card:   { background:"#0f0f0f", border:"1px solid #1c1c1c", borderRadius:6, padding:14 },
    flash_: { position:"fixed", top:72, right:14, background:lv.color, color:"#080808", fontWeight:800, fontSize:15, padding:"8px 16px", borderRadius:6, zIndex:999, letterSpacing:"0.05em", fontFamily:"inherit", animation:"fio 1.6s forwards" },
    // Modal
    overlay:{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" },
    modal_: { background:"#111", border:"1px solid #2a2a2a", borderRadius:8, padding:24, width:300, maxWidth:"90vw" },
    mTitle: { fontSize:14, fontWeight:700, marginBottom:16, letterSpacing:"0.04em" },
    mBtn:   c => ({ flex:1, padding:"9px 0", border:"none", borderRadius:4, fontSize:11, fontWeight:800, letterSpacing:"0.08em", cursor:"pointer", fontFamily:"inherit", background:c, color:c==="#b5ff3c"?"#080808":"#e8e8e8" }),
  };

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={S.wrap}>
      {/* FLASH XP */}
      {flash && <div style={S.flash_}>{flash}</div>}

      {/* EDIT / DELETE MODAL */}
      {modal && (
        <div style={S.overlay} onClick={() => setModal(null)}>
          <div style={S.modal_} onClick={e => e.stopPropagation()}>
            <div style={S.mTitle}>{modal.ex.name} — today</div>
            <div style={{ fontSize:11, color:"#555", marginBottom:12 }}>
              Currently logged: <span style={{ color:"#e8e8e8", fontWeight:700 }}>{dayData.exercises[modal.ex.id]?.reps || 0} {modal.ex.unit}</span>
            </div>
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, color:"#444", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>Edit to exact value</div>
              <div style={{ display:"flex", gap:8 }}>
                <input
                  style={{ ...S.input, flex:1, padding:"8px 10px" }}
                  type="number" min="0"
                  placeholder="new value"
                  value={editVal}
                  onChange={e => setEditVal(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && editEx(modal.ex, editVal)}
                  autoFocus
                />
                <button style={S.mBtn("#b5ff3c")} onClick={() => editEx(modal.ex, editVal)}>SAVE</button>
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button style={S.mBtn("#1a1a1a")} onClick={() => setModal(null)}>CANCEL</button>
              <button style={S.mBtn("#3a1010")} onClick={() => deleteEx(modal.ex.id)}>DELETE LOG</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={S.hdr}>
        <div style={S.hRow}>
          <div>
            <div style={{ fontSize:9, color:"#333", letterSpacing:"0.18em", textTransform:"uppercase", marginBottom:3 }}>Beast Mode</div>
            <div style={{ fontSize:12, color:"#555" }}>
              {new Date().toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" })}
            </div>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:18, fontWeight:700, color:streak>0?"#ff8c00":"#444" }}>🔥 {streak}</div>
              <div style={{ fontSize:9, color:"#333", letterSpacing:"0.1em", textTransform:"uppercase" }}>streak</div>
            </div>
            <div style={S.badge}>{lv.name}</div>
          </div>
        </div>
        <div style={S.xpBar}><div style={S.xpFill} /></div>
        <div style={S.xpRow}>
          <span>{totalXP.toLocaleString()} XP</span>
          <span>{nxt ? `${(nxt.min-totalXP).toLocaleString()} to ${nxt.name}` : "MAX LEVEL"}</span>
        </div>
      </div>

      {/* TABS */}
      <div style={S.tabs}>
        {[["today","Today"],["weight","Weight"],["history","History"],["progress","Progress"]].map(([id,label]) => (
          <button key={id} style={S.tab(tab===id)} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {/* ══ TODAY ═══════════════════════════════════════════════ */}
      {tab === "today" && (
        <div style={S.body}>
          {allDone && (
            <div style={{ background:lv.color+"18", border:`1px solid ${lv.color}44`, borderRadius:6, padding:"12px 16px", marginBottom:14, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:14, fontWeight:700, color:lv.color, letterSpacing:"0.06em" }}>💀 ALL DONE. BEAST.</div>
              <div style={{ fontSize:11, color:lv.color }}>{todayXP} XP today</div>
            </div>
          )}

          <div style={S.stat3}>
            <div style={S.sCard}><span style={{...S.sVal,color:lv.color}}>{doneCount}/{EXERCISES.length}</span><span style={S.sLbl}>Done</span></div>
            <div style={S.sCard}><span style={{...S.sVal,color:"#ff8c00"}}>{todayXP}</span><span style={S.sLbl}>XP Today</span></div>
            <div style={S.sCard}><span style={S.sVal}>{streak}🔥</span><span style={S.sLbl}>Streak</span></div>
          </div>

          <div style={S.label}>Exercises — tap logged value to edit or delete</div>
          <div style={S.grid2}>
            {EXERCISES.filter(e => e.unit !== "done").map(ex => {
              const v    = dayData.exercises[ex.id];
              const logged = v?.reps || 0;
              const pct  = (logged / ex.target) * 100;
              const done = logged >= ex.target;
              return (
                <div key={ex.id} style={S.exCard(done)}>
                  {done && <span style={S.doneTag}>✓ DONE</span>}
                  <div style={S.exName}>{ex.name}</div>
                  <div style={S.muscle(ex.muscle)}>{ex.muscle}</div>
                  <div style={S.pWrap}><div style={S.pFill(pct,ex.muscle)} /></div>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:10, color:"#3a3a3a" }}>
                      {logged} <span style={{ color:"#555" }}>/ {ex.target} {ex.unit}</span>
                    </span>
                    {logged > 0 && (
                      <button style={S.editBtn} onClick={() => { setModal({ ex }); setEditVal(String(logged)); }}>
                        edit / del
                      </button>
                    )}
                  </div>
                  <div style={S.iRow}>
                    <input
                      style={S.input}
                      type="number" min="1"
                      placeholder={ex.unit==="sec"?"sec":"reps"}
                      value={reps[ex.id]||""}
                      onChange={e => setReps(r => ({...r,[ex.id]:e.target.value}))}
                      onKeyDown={e => e.key==="Enter" && logEx(ex, reps[ex.id])}
                    />
                    <button style={S.logBtn(done?MC[ex.muscle]:null)} onClick={() => logEx(ex, reps[ex.id])}>LOG</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Palace Loop */}
          {(() => {
            const le = EXERCISES.find(e => e.id==="loop");
            const done = dayData.exercises?.loop?.done;
            return (
              <div style={{...S.exCard(done), marginTop:8}}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={S.exName}>🌙 Palace Loop — 4.5km</div>
                    <div style={S.muscle("Cardio")}>Cardio · Every night · +200 XP</div>
                  </div>
                  {done
                    ? <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                        <span style={{ fontSize:12, color:"#4ade80", fontWeight:700 }}>✓ DONE +200XP</span>
                        <button style={S.editBtn} onClick={() => deleteEx("loop")}>undo</button>
                      </div>
                    : <button style={{...S.logBtn(),...{padding:"9px 18px",fontSize:11}}} onClick={() => logEx(le,1)}>MARK DONE</button>
                  }
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ══ WEIGHT ══════════════════════════════════════════════ */}
      {tab === "weight" && (
        <div style={S.body}>
          <div style={S.stat3}>
            <div style={S.sCard}><span style={S.sVal}>{latestW}kg</span><span style={S.sLbl}>Current</span></div>
            <div style={S.sCard}><span style={{...S.sVal,color:"#4ade80"}}>-{lost.toFixed(1)}kg</span><span style={S.sLbl}>Lost</span></div>
            <div style={S.sCard}><span style={{...S.sVal,color:"#4a9eff"}}>{Math.max(0,latestW-GOAL_WEIGHT).toFixed(1)}kg</span><span style={S.sLbl}>To Go</span></div>
          </div>

          <div style={{...S.card,marginBottom:14}}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontSize:11, color:"#555" }}>105kg → 95kg target</span>
              <span style={{ fontSize:12, fontWeight:700, color:lv.color }}>{wPct.toFixed(0)}%</span>
            </div>
            <div style={{ height:6, background:"#1a1a1a", borderRadius:3, overflow:"hidden" }}>
              <div style={{ height:"100%", width:wPct+"%", background:`linear-gradient(90deg,#4a9eff,${lv.color})`, borderRadius:3, transition:"width .6s" }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:10, color:"#333" }}>
              <span>Start: 105kg</span><span>Now: {latestW}kg</span><span>Goal: 95kg</span>
            </div>
          </div>

          <div style={S.label}>Log today's weight</div>
          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            <input
              style={{...S.input,flex:1,padding:"10px 12px",fontSize:15,borderRadius:5}}
              type="number" placeholder="e.g. 103.5" step="0.1"
              value={wInput}
              onChange={e => setWInput(e.target.value)}
              onKeyDown={e => e.key==="Enter" && logWeight()}
            />
            <button style={{...S.logBtn(),...{padding:"10px 20px",fontSize:11,borderRadius:5}}} onClick={logWeight}>LOG</button>
          </div>

          <div style={S.label}>Weight history</div>
          <div style={{...S.card,padding:"14px 4px 4px 0",marginBottom:14}}>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={weights} margin={{top:4,right:12,left:-18,bottom:0}}>
                <defs>
                  <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#4a9eff" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#4a9eff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{fill:"#333",fontSize:9,fontFamily:"inherit"}} tickLine={false} axisLine={false} tickFormatter={v=>v.slice(5)}/>
                <YAxis domain={[90,108]} tick={{fill:"#333",fontSize:9,fontFamily:"inherit"}} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={{background:"#111",border:"1px solid #222",borderRadius:6,fontSize:11,fontFamily:"inherit"}} labelStyle={{color:"#555"}} formatter={v=>[`${v}kg`,"Weight"]}/>
                <ReferenceLine y={95} stroke={lv.color} strokeDasharray="4 3" label={{value:"GOAL 95kg",fill:lv.color,fontSize:9,fontFamily:"inherit"}}/>
                <Area type="monotone" dataKey="weight" stroke="#4a9eff" strokeWidth={2} fill="url(#wg)" dot={{fill:"#4a9eff",r:3,strokeWidth:0}} activeDot={{r:5}}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {weights.length > 0 && (
            <>
              <div style={S.label}>Log — tap to delete</div>
              <div style={{...S.card,padding:0,overflow:"hidden"}}>
                {[...weights].reverse().slice(0,15).map((w, i, arr) => {
                  const prev = arr[i+1];
                  const diff = prev ? w.weight - prev.weight : 0;
                  return (
                    <div key={w.date} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 14px", borderBottom:i<arr.length-1?"1px solid #141414":"none" }}>
                      <span style={{ fontSize:11, color:"#444" }}>{fmtDate(w.date)}</span>
                      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                        {prev && <span style={{ fontSize:10, color:diff<0?"#4ade80":diff>0?"#f87171":"#444" }}>{diff<0?"↓":diff>0?"↑":"–"}{Math.abs(diff).toFixed(1)}kg</span>}
                        <span style={{ fontSize:13, fontWeight:700 }}>{w.weight}kg</span>
                        <button style={{...S.editBtn,color:"#3a1010",fontSize:12}} onClick={() => deleteWeight(w.date)}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ HISTORY ═════════════════════════════════════════════ */}
      {tab === "history" && (
        <div style={S.body}>
          <div style={S.label}>Choose exercise</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:16 }}>
            {EXERCISES.filter(e => e.unit !== "done").map(ex => (
              <button
                key={ex.id}
                onClick={() => setHistEx(ex.id)}
                style={{ padding:"5px 12px", borderRadius:3, border:`1px solid ${histEx===ex.id?MC[ex.muscle]:"#222"}`, background:histEx===ex.id?MC[ex.muscle]+"22":"transparent", color:histEx===ex.id?MC[ex.muscle]:"#555", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", letterSpacing:"0.06em" }}
              >
                {ex.name}
              </button>
            ))}
          </div>

          {histData.length === 0 ? (
            <div style={{ color:"#333", fontSize:12, padding:"32px 0", textAlign:"center" }}>No data yet for this exercise</div>
          ) : (
            <>
              <div style={S.label}>{EXERCISES.find(e=>e.id===histEx)?.name} — daily reps</div>
              <div style={{...S.card,padding:"14px 4px 4px 0",marginBottom:14}}>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={histData} margin={{top:4,right:12,left:-18,bottom:0}}>
                    <XAxis dataKey="date" tick={{fill:"#333",fontSize:9,fontFamily:"inherit"}} tickLine={false} axisLine={false} tickFormatter={v=>v.slice(5)}/>
                    <YAxis tick={{fill:"#333",fontSize:9,fontFamily:"inherit"}} tickLine={false} axisLine={false}/>
                    <Tooltip contentStyle={{background:"#111",border:"1px solid #222",borderRadius:6,fontSize:11,fontFamily:"inherit"}} labelStyle={{color:"#555"}} formatter={v=>[`${v} reps`]}/>
                    <ReferenceLine
                      y={EXERCISES.find(e=>e.id===histEx)?.target}
                      stroke={MC[EXERCISES.find(e=>e.id===histEx)?.muscle]||"#b5ff3c"}
                      strokeDasharray="4 3"
                      label={{value:"target",fill:MC[EXERCISES.find(e=>e.id===histEx)?.muscle]||"#b5ff3c",fontSize:9,fontFamily:"inherit"}}
                    />
                    <Bar dataKey="reps" fill={MC[EXERCISES.find(e=>e.id===histEx)?.muscle]||"#b5ff3c"} radius={[2,2,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={S.label}>Best / Average</div>
              <div style={S.stat3}>
                <div style={S.sCard}>
                  <span style={{...S.sVal,color:MC[EXERCISES.find(e=>e.id===histEx)?.muscle]}}>{Math.max(...histData.map(d=>d.reps))}</span>
                  <span style={S.sLbl}>Best Day</span>
                </div>
                <div style={S.sCard}>
                  <span style={S.sVal}>{Math.round(histData.reduce((s,d)=>s+d.reps,0)/histData.length)}</span>
                  <span style={S.sLbl}>Avg/Day</span>
                </div>
                <div style={S.sCard}>
                  <span style={S.sVal}>{histData.length}</span>
                  <span style={S.sLbl}>Days Logged</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ PROGRESS ════════════════════════════════════════════ */}
      {tab === "progress" && (
        <div style={S.body}>
          <div style={{ background:"#0f0f0f", border:`1px solid ${lv.color}33`, borderRadius:6, padding:16, marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
              <div>
                <div style={{ fontSize:9, color:"#333", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:5 }}>Current Level</div>
                <div style={{ fontSize:32, fontWeight:900, color:lv.color, letterSpacing:"0.05em", lineHeight:1 }}>{lv.name}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:26, fontWeight:800 }}>{totalXP.toLocaleString()}</div>
                <div style={{ fontSize:9, color:"#444", letterSpacing:"0.1em", textTransform:"uppercase" }}>Total XP</div>
              </div>
            </div>
            <div style={{ height:5, background:"#1c1c1c", borderRadius:3, overflow:"hidden" }}>
              <div style={{ height:"100%", width:lvPct+"%", background:`linear-gradient(90deg,${lv.color}88,${lv.color})`, borderRadius:3, transition:"width .6s" }}/>
            </div>
            {nxt && <div style={{ fontSize:10, color:"#444", marginTop:6 }}>{(nxt.min-totalXP).toLocaleString()} XP to unlock <span style={{color:nxt.color}}>{nxt.name}</span></div>}
          </div>

          <div style={S.stat2}>
            <div style={S.sCard}><span style={{...S.sVal,fontSize:28}}>{days.length}</span><span style={S.sLbl}>Days Trained</span></div>
            <div style={S.sCard}><span style={{...S.sVal,fontSize:28,color:streak>0?"#ff8c00":"#444"}}>{streak} 🔥</span><span style={S.sLbl}>Streak</span></div>
          </div>

          <div style={S.label}>Level Roadmap</div>
          <div style={S.card}>
            {LEVELS.map((l, i) => {
              const reached  = totalXP >= l.min;
              const isCurrent = getLv(totalXP).name === l.name;
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:i<LEVELS.length-1?"1px solid #141414":"none" }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:reached?l.color:"#222", flexShrink:0, boxShadow:isCurrent?`0 0 8px ${l.color}`:"none" }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:reached?l.color:"#333", letterSpacing:"0.06em" }}>{l.name}</div>
                    <div style={{ fontSize:10, color:"#333" }}>{l.min.toLocaleString()} XP · {Math.ceil(l.min/1050)} perfect days</div>
                  </div>
                  {isCurrent && <div style={{ fontSize:9, color:l.color, fontWeight:700, background:l.color+"18", border:`1px solid ${l.color}44`, padding:"2px 8px", borderRadius:3, letterSpacing:"0.1em" }}>YOU ARE HERE</div>}
                  {reached && !isCurrent && <div style={{ fontSize:12, color:"#4ade80" }}>✓</div>}
                </div>
              );
            })}
          </div>

          <div style={S.label}>Weight Goal</div>
          <div style={S.card}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
              <span style={{ fontSize:12, fontWeight:600 }}>105kg → 95kg</span>
              <span style={{ fontSize:13, color:lv.color, fontWeight:800 }}>{wPct.toFixed(0)}%</span>
            </div>
            <div style={{ height:8, background:"#1a1a1a", borderRadius:4, overflow:"hidden", marginBottom:8 }}>
              <div style={{ height:"100%", width:wPct+"%", background:`linear-gradient(90deg,#4a9eff,${lv.color})`, borderRadius:4, transition:"width .6s" }}/>
            </div>
            <div style={{ fontSize:11, color:"#444" }}>
              Current <span style={{color:"#e8e8e8"}}>{latestW}kg</span> · Lost <span style={{color:"#4ade80"}}>{lost.toFixed(1)}kg</span> · Remaining <span style={{color:"#e8e8e8"}}>{Math.max(0,latestW-GOAL_WEIGHT).toFixed(1)}kg</span>
            </div>
          </div>

          <div style={S.label}>Today's breakdown</div>
          <div style={S.card}>
            {EXERCISES.map((ex, i) => {
              const v    = dayData.exercises[ex.id];
              const done = v ? (ex.unit==="done"?v.done:(v.reps||0)>=ex.target) : false;
              const val  = ex.unit==="done"?(v?.done?"done":"—"):`${v?.reps||0} / ${ex.target}`;
              return (
                <div key={ex.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:i<EXERCISES.length-1?"1px solid #141414":"none" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:done?MC[ex.muscle]:"#222", flexShrink:0 }}/>
                    <span style={{ fontSize:12, color:done?"#e8e8e8":"#444" }}>{ex.name}</span>
                  </div>
                  <span style={{ fontSize:11, color:done?MC[ex.muscle]:"#333", fontWeight:done?700:400 }}>{val}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0; }
        input:focus { border-color: #b5ff3c !important; outline: none; }
        @keyframes fio {
          0%   { opacity:0; transform:translateY(-8px) scale(.95); }
          15%  { opacity:1; transform:translateY(0) scale(1); }
          75%  { opacity:1; }
          100% { opacity:0; }
        }
      `}</style>
    </div>
  );
}
