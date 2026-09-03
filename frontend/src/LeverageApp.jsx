import React, { useState, useRef, useEffect } from "react";

// ---- Leverage brand tokens ----
const COLORS = {
  bg: "#1C1B19",
  panel: "#242220",
  panelRaised: "#2B2926",
  hairline: "#3A3733",
  text: "#EDE8DD",
  textMuted: "#9C9486",
  textFaint: "#6E675C",
  strategic: "#C9A227",
  people: "#5E8B6E",
  operations: "#4E7A94",
  admin: "#9C7B4F",
  reactive: "#B24A3D",
  done: "#6E8B6E",
};

const TYPES = ["Strategic", "People", "Operations", "Admin", "Reactive"];
const TYPE_COLOR = { Strategic: COLORS.strategic, People: COLORS.people, Operations: COLORS.operations, Admin: COLORS.admin, Reactive: COLORS.reactive };
const IDEAL = { Strategic: [30, 35], People: [20, 25], Operations: [20, 25], Admin: [5, 10], Reactive: [10, 15] };

const levelHeadingStyle = { fontFamily: "'Fraunces', serif", fontSize: 20, marginBottom: 20, color: COLORS.text };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function parseYMD(str) {
  if (!str) return null;
  const parts = str.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return { y: parts[0], m: parts[1] - 1, d: parts[2] };
}

function computeByType(list) {
  const total = list.reduce((s, e) => s + Number(e.hours || 0), 0);
  const byType = TYPES.map((t) => {
    const hrs = list.filter((e) => e.type === t).reduce((s, e) => s + Number(e.hours || 0), 0);
    const pct = total > 0 ? (hrs / total) * 100 : 0;
    const [lo, hi] = IDEAL[t];
    const status = total === 0 ? null : pct < lo ? "under" : pct > hi ? "over" : "in";
    return { type: t, hrs, pct, lo, hi, status };
  });
  return { total, byType };
}

// A custom-built calendar popover, used everywhere a date needs picking.
// Native <input type="date"> pickers vary too much across browsers and
// deployment environments to be reliable — this renders identically
// everywhere since it's plain React/CSS, not an OS/browser widget.
function DateField({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const parsed = value ? parseYMD(value) : null;
  const today = new Date();
  const [view, setView] = useState(parsed ? { y: parsed.y, m: parsed.m } : { y: today.getFullYear(), m: today.getMonth() });
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function pick(day) {
    onChange(`${view.y}-${String(view.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={inputStyle({ fontSize: 12, padding: "4px 8px", cursor: "pointer", textAlign: "left", minWidth: 108 })}>
        {value || "Select date"}
      </button>
      {open && (
        <div style={{ position: "absolute", zIndex: 30, top: "110%", left: 0, background: COLORS.panel, border: `1px solid ${COLORS.hairline}`, borderRadius: 4, padding: 10, width: 210, boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <button type="button" onClick={() => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))} style={{ background: "none", border: "none", color: COLORS.text, cursor: "pointer", fontSize: 13 }}>‹</button>
            <span style={{ fontSize: 12, color: COLORS.textMuted }}>{MONTH_NAMES[view.m]} {view.y}</span>
            <button type="button" onClick={() => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))} style={{ background: "none", border: "none", color: COLORS.text, cursor: "pointer", fontSize: 13 }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {WEEKDAYS.map((w) => <div key={w} style={{ fontSize: 9, color: COLORS.textFaint, textAlign: "center" }}>{w[0]}</div>)}
            {cells.map((day, idx) => {
              const isSel = parsed && parsed.y === view.y && parsed.m === view.m && parsed.d === day;
              return (
                <div key={idx} onClick={() => day && pick(day)} style={{
                  fontSize: 11, textAlign: "center", padding: "4px 0", borderRadius: 3, cursor: day ? "pointer" : "default",
                  background: isSel ? COLORS.strategic : "transparent", color: isSel ? "#1C1B19" : day ? COLORS.text : "transparent",
                }}>{day || "-"}</div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Shared vagueness heuristic ----
const VAGUE_WORDS = new Set(["meeting", "meetings", "work", "stuff", "tasks", "task", "emails", "email", "calls", "call", "admin", "misc", "other", "things", "various", "planning", "catch up", "catch-up", "check in", "check-in"]);

function vagueFlagForText(text) {
  const name = (text || "").trim();
  const lower = name.toLowerCase();
  const words = lower.replace(/[^\w\s-]/g, "").split(/\s+/).filter(Boolean);
  if (name.length < 3) return "Too short to mean anything later.";
  if (words.length <= 1) return 'Single-word label — "who," "what decision," or "what\'s next" is missing.';
  if (words.length <= 3 && words.some((w) => VAGUE_WORDS.has(w))) return 'Generic label with no elaboration — "who," "what decision," or "what\'s next" is missing.';
  return null;
}

function flagsFor(entry, allEntries) {
  const flags = [];
  const vague = vagueFlagForText(entry.activity);
  if (vague) flags.push(vague);
  const hrs = Number(entry.hours);
  if (hrs > 12) flags.push("Over 12 hours for a single entry — likely several activities merged into one.");
  if (allEntries) {
    const dupe = allEntries.find((e) => e.id !== entry.id && e.activity.trim().toLowerCase() === entry.activity.trim().toLowerCase() && entry.activity.trim().length > 0);
    if (dupe) flags.push("Same label used twice — either a duplicate entry or two different things need separate names.");
  }
  return flags;
}

function inputErrorFor(hoursRaw) {
  const hrs = Number(hoursRaw);
  if (hoursRaw === "" || isNaN(hrs)) return "Enter a number for hours.";
  if (hrs <= 0) return "Hours must be greater than zero.";
  if (hrs > 24) return "A single entry can't exceed 24 hours in a day.";
  return null;
}

// ---- Planning & Monitoring: guided sort ----
const AVOIDANCE_WORDS = ["call", "email", "follow up", "followup", "schedule", "finish", "complete", "submit", "respond", "pay", "renew", "fix", "book", "confirm", "send", "review", "decide", "apply", "plan", "arrange"];

function deriveBucket(item) {
  if (item.actionable === false) return item.nonActionableType || null;
  if (item.actionable === true) {
    if (item.doableNow === true) return "Do It Now";
    if (item.doableNow === false) {
      if (item.multiStep === true) return "Project";
      if (item.multiStep === false) {
        if (item.hasDate === true) return "Calendar";
        if (item.hasDate === false) {
          if (item.delegate === true) return "Waiting On";
          if (item.delegate === false) return "Next Action";
        }
      }
    }
  }
  return null;
}

function nextQuestion(item) {
  if (item.actionable === null) return "actionable";
  if (item.actionable === false) return item.nonActionableType === null ? "nonActionableType" : null;
  if (item.doableNow === null) return "doableNow";
  if (item.doableNow === true) return null;
  if (item.multiStep === null) return "multiStep";
  if (item.multiStep === true) return null;
  if (item.hasDate === null) return "hasDate";
  if (item.hasDate === true) return null;
  if (item.delegate === null) return "delegate";
  return null;
}

function homeTab(item) {
  const bucket = deriveBucket(item);
  if (item.parentId) {
    if (bucket === "Calendar" || bucket === "Next Action") return "calendar";
    if (bucket === "Waiting On") return "waitingOn";
    return "projectPlanning";
  }
  if (bucket === "Project") return "projectPlanning";
  if (bucket === "Calendar" || bucket === "Next Action") return "calendar";
  if (bucket === "Waiting On") return "waitingOn";
  return "overview";
}

function sortFlagsFor(item) {
  const flags = [];
  const lower = (item.text || "").toLowerCase();
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  const bucket = deriveBucket(item);

  if (bucket && ["Reference", "Trash", "Bucket List"].includes(bucket)) {
    const hit = AVOIDANCE_WORDS.find((w) => lower.includes(w));
    if (hit) flags.push(`Filed as ${bucket}, but the wording ("${hit}") sounds like it still needs action. Sure this isn't actionable?`);
  }
  if (bucket === "Do It Now" && wordCount > 8) {
    flags.push("That's a lot packed into one item to genuinely take under two minutes — sure it's not bigger than it sounds?");
  }
  if (bucket === "Waiting On" && !item.waitingOnWhom) {
    flags.push("No one named on this Waiting On item — without an owner, it won't get chased.");
  }
  if (bucket === "Waiting On" && !item.checkDate) {
    flags.push("No follow-up date set — it won't show up on the calendar as a reminder to chase this.");
  }
  if (bucket === "Calendar" && (!item.scheduledDate || !item.scheduledTime)) {
    flags.push("This is meant to be time-bound but has no date/time yet — it isn't actually on the calendar until it does.");
  }
  if (bucket === "Next Action" && !item.deadline) {
    flags.push("No deadline set on this Next Action — without one, it's a hope, not a plan.");
  }
  return flags;
}

const PROMPTS = {
  Professional: ["Any unfinished professional projects?", "Outstanding commitments to colleagues, superiors, or customers?", "Reports, proposals, or reviews you owe someone?", "Emails or calls you need to initiate or respond to?"],
  Personal: ["Unfinished personal projects?", "Commitments made to a spouse, children, or friends?", "Travel, special occasions, or events to plan?", "Vehicle, home maintenance, or personal care you keep deferring?"],
};

function freshItem(text, category, parentId, type, hours) {
  return {
    id: uid(), text: text.trim(), category, parentId: parentId || null,
    type: type || null, hours: hours || "",
    actionable: null, doableNow: null, multiStep: null, hasDate: null, delegate: null,
    nonActionableType: null, waitingOnWhom: "", checkDate: "", scheduledDate: "", scheduledTime: "", deadline: "",
    raci: null,
  };
}

// ---- Level 3: Strategic Time Management ----
const TASK_QUESTIONS = [
  { key: "attention", text: "Did this require MY attention?" },
  { key: "strategic", text: "Did this move strategic priorities?" },
  { key: "orgSuffer", text: "Would the organization suffer if ignored?" },
  { key: "delegated", text: "Could this have been delegated?" },
  { key: "urgency", text: "Was this driven by urgency instead of importance?" },
  { key: "interrupt", text: "Did this interrupt more important work?" },
];

function freshTask(activity, duration) {
  return { id: uid(), activity: activity || "", duration: duration || "", attention: null, strategic: null, orgSuffer: null, delegated: null, urgency: null, interrupt: null };
}
function nextTaskQuestion(task) {
  const q = TASK_QUESTIONS.find((q) => task[q.key] === null);
  return q ? q.key : null;
}
function leverageScore(t) {
  const vals = ["attention", "strategic", "orgSuffer"].map((k) => t[k]);
  return vals.every((v) => v !== null) ? vals.reduce((a, b) => a + b, 0) : null;
}
function leakScore(t) {
  const vals = ["delegated", "urgency", "interrupt"].map((k) => t[k]);
  return vals.every((v) => v !== null) ? vals.reduce((a, b) => a + b, 0) : null;
}
const QUADRANT_INFO = {
  "Strategic attention": { color: COLORS.strategic, desc: "High leverage, low leak", meaning: "This is where your best strategic work lives — protect this time." },
  "Important but poorly structured": { color: COLORS.admin, desc: "High leverage, high leak", meaning: "Valuable work that keeps getting interrupted or handled reactively. Needs better structure, not less attention." },
  "Executive attention trap": { color: COLORS.reactive, desc: "Low leverage, high leak", meaning: "Costing you focus without paying off strategically — a prime candidate to delegate or cut." },
  "Minor / maintenance": { color: COLORS.textFaint, desc: "Low leverage, low leak", meaning: "Necessary upkeep, but shouldn't be where most of your time goes." },
};
function quadrantFor(lev, leak) {
  if (lev === null || leak === null) return null;
  const highLev = lev >= 9, highLeak = leak >= 9;
  if (highLev && !highLeak) return "Strategic attention";
  if (highLev && highLeak) return "Important but poorly structured";
  if (!highLev && highLeak) return "Executive attention trap";
  return "Minor / maintenance";
}

const RACI_LABELS = { R: "Responsible", A: "Accountable", C: "Consulted", I: "Informed" };
const RACI_LEVEL_SCORE = { "VERY LOW": 1, LOW: 2, "LOW-MODERATE": 2.5, MODERATE: 3, HIGH: 4, "VERY HIGH": 5 };

// Sourced directly from the uploaded Attentional Identities deck.
const IDENTITIES = [
  {
    key: "opportunist", name: "Opportunist", color: COLORS.reactive,
    quote: "Attention moves toward immediate advantage and control.",
    attentionStyle: ["Urgent opportunities", "Immediate outcomes", "Influence", "Fast movement", "Controlling critical situations"],
    strength: ["Decisive under pressure", "Rapid action", "Opportunity recognition"],
    blindSpot: "Long-term strategic investments may lose attention when urgency appears.",
    raci: { R: "VERY HIGH", A: "VERY HIGH", C: "LOW", I: "VERY LOW" },
    delegationPattern: "Delegates tactically, but often keeps final control close.",
    developmentMove: "Build trust-based ownership systems instead of relying on direct control.",
  },
  {
    key: "diplomat", name: "Diplomat", color: COLORS.people,
    quote: "Attention moves toward harmony, belonging, and relational stability.",
    attentionStyle: ["Emotional atmosphere", "Alignment", "Collaboration", "Inclusion", "Maintaining stability"],
    strength: ["Trust building", "Emotional awareness", "Team cohesion"],
    blindSpot: "Strategic conversations involving tension or disruption may lose attention.",
    raci: { R: "HIGH", A: "LOW-MODERATE", C: "VERY HIGH", I: "MODERATE" },
    delegationPattern: "May hesitate assigning hard accountability if it creates discomfort.",
    developmentMove: "Practice creating clarity and accountability without interpreting tension as relational threat.",
  },
  {
    key: "expert", name: "Expert", color: COLORS.operations,
    quote: "Attention moves toward correctness, expertise, and precision.",
    attentionStyle: ["Accuracy", "Quality", "Technical depth", "Logic", "Reducing uncertainty"],
    strength: ["Rigor", "Technical mastery", "Analytical depth"],
    blindSpot: "Strategic movement may slow because attention stays trapped in execution.",
    raci: { R: "VERY HIGH", A: "HIGH", C: "MODERATE", I: "VERY LOW" },
    delegationPattern: 'Delegation feels risky: "If I do it myself, I know it will be done correctly." Experts often unconsciously connect expertise with ownership.',
    developmentMove: 'Separate personal expertise from organizational scalability. "My value is not only in doing the work. My value is in creating systems where quality scales through others."',
  },
  {
    key: "achiever", name: "Achiever", color: COLORS.admin,
    quote: "Attention moves toward goals, execution, and measurable progress.",
    attentionStyle: ["Outcomes", "Execution", "Momentum", "Deadlines", "Measurable progress"],
    strength: ["Execution", "Accountability", "Driving results"],
    blindSpot: "Reflection and long-term strategic thinking may receive less attention than execution.",
    raci: { R: "MODERATE", A: "VERY HIGH", C: "MODERATE", I: "LOW" },
    delegationPattern: 'Delegates more comfortably than Experts, because outcomes matter more than personal technical control: "How do we move faster and deliver results?"',
    developmentMove: 'Move beyond execution optimization toward systems reflection, capability building, and strategic space creation. "Not everything valuable produces immediate measurable output."',
  },
  {
    key: "strategist", name: "Strategist", color: COLORS.strategic,
    quote: "Attention moves toward systems, transformation, and long-term leverage.",
    attentionStyle: ["Systems thinking", "Long-term leverage", "Organizational patterns", "Transformation", "Future impact"],
    strength: ["Integration", "Long-term thinking", "Transformational leadership"],
    blindSpot: "May spend extensive time in strategic reflection before operational movement.",
    raci: null,
    raciNote: "Balances all four roles strategically — Responsible, Accountable, Consulted, and Informed.",
    delegationPattern: "Delegation becomes attentional architecture: not everything deserves executive attention, and ownership design shapes organizational behavior.",
    developmentMove: "Balance strategic reflection with execution rhythm and organizational grounding.",
  },
];

export default function LeverageApp() {
  const [entries, setEntries] = useState([]);
  const [mindSweepItems, setMindSweepItems] = useState([]);
  const [topTasks, setTopTasks] = useState([freshTask()]);
  const [identityChoice, setIdentityChoice] = useState(null);
  const [situations, setSituations] = useState([freshSituation(), freshSituation(), freshSituation(), freshSituation(), freshSituation()]);
  const [motivationReflections, setMotivationReflections] = useState({ Autonomy: "", Competence: "", Relatedness: "" });
  const [fixCommitments, setFixCommitments] = useState(new Set());
  const [activeTab, setActiveTab] = useState("level2");

  const { total: totalHours, byType } = computeByType(entries);
  const { total: planningTotalHours, byType: planningByType } = computeByType(mindSweepItems.filter((i) => i.type && i.hours));

  // ---- Time Assessment handlers ----
  const [form, setForm] = useState({ activity: "", hours: "", type: "Strategic" });
  const [formError, setFormError] = useState(null);

  function addEntry() {
    if (!form.activity.trim()) return;
    const err = inputErrorFor(form.hours);
    if (err) { setFormError(err); return; }
    setFormError(null);
    const newEntry = { id: uid(), activity: form.activity.trim(), hours: Number(form.hours), type: form.type };
    setEntries((prev) => [...prev, newEntry]);
    setForm({ activity: "", hours: "", type: form.type });
  }
  function removeEntry(id) { setEntries((prev) => prev.filter((e) => e.id !== id)); }

  // ---- Planning & Monitoring handlers ----
  const [sweepCategory, setSweepCategory] = useState("Professional");
  const [sweepText, setSweepText] = useState("");
  const [sweepType, setSweepType] = useState("Strategic");
  const [sweepHours, setSweepHours] = useState("");

  function captureItem() {
    if (!sweepText.trim()) return;
    setMindSweepItems((prev) => [...prev, freshItem(sweepText, sweepCategory, null, sweepType, sweepHours)]);
    setSweepText("");
    setSweepHours("");
  }
  function addSubTask(parentId, text, category) {
    if (!text.trim()) return;
    setMindSweepItems((prev) => [...prev, freshItem(text, category, parentId)]);
  }
  function removeItemCascade(id) {
    setMindSweepItems((prev) => {
      const toRemove = new Set([id]);
      let grew = true;
      while (grew) {
        grew = false;
        prev.forEach((i) => { if (i.parentId && toRemove.has(i.parentId) && !toRemove.has(i.id)) { toRemove.add(i.id); grew = true; } });
      }
      return prev.filter((i) => !toRemove.has(i.id));
    });
  }
  function answerItem(id, patch) {
    setMindSweepItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  function updateField(id, patch) {
    setMindSweepItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  function resetItem(id) {
    answerItem(id, { actionable: null, doableNow: null, multiStep: null, hasDate: null, delegate: null, nonActionableType: null });
  }

  // ---- Level 3 handlers ----
  function updateTask(id, patch) {
    setTopTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function addTask() {
    setTopTasks((prev) => [...prev, freshTask()]);
  }
  function removeTask(id) {
    setTopTasks((prev) => prev.filter((t) => t.id !== id));
  }
  function autoFillTasks() {
    const candidates = mindSweepItems.filter((i) => !i.parentId && !["Reference", "Trash", "Bucket List", "Do It Now"].includes(deriveBucket(i)));
    const top5 = candidates.slice(0, 5);
    if (!top5.length) return;
    setTopTasks(top5.map((i) => freshTask(i.text, i.hours ? `${i.hours}h` : "")));
  }

  // ---- Level 4 handlers ----
  function updateSituation(id, patch) {
    setSituations((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function updateMotivationReflection(rootCause, value) {
    setMotivationReflections((prev) => ({ ...prev, [rootCause]: value }));
  }
  function toggleFix(key) {
    setFixCommitments((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const TABS = [
    { key: "aboutMe", label: "About Me" },
    { key: "level2", label: "Level 2" },
    { key: "level3", label: "Level 3" },
    { key: "level4", label: "Level 4" },
  ];

  return (
    <div style={{ minHeight: "100%", background: COLORS.bg, color: COLORS.text, fontFamily: "'IBM Plex Sans', -apple-system, sans-serif" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,600&display=swap" />
      <div style={{ padding: "20px 28px 0", borderBottom: `1px solid ${COLORS.hairline}` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, letterSpacing: "0.02em" }}>Leverage</span>
          <span style={{ color: COLORS.textMuted, fontSize: 14, fontStyle: "italic" }}>Leveling up from average to leverage.</span>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ background: "none", border: "none", borderBottom: activeTab === t.key ? `2px solid ${COLORS.strategic}` : "2px solid transparent", color: activeTab === t.key ? COLORS.text : COLORS.textMuted, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 28px 60px" }}>
        {activeTab === "level2" && (
          <Level2 entries={entries} form={form} setForm={setForm} formError={formError} setFormError={setFormError} addEntry={addEntry} removeEntry={removeEntry}
            byType={byType} totalHours={totalHours}
            items={mindSweepItems} sweepCategory={sweepCategory} setSweepCategory={setSweepCategory} sweepText={sweepText} setSweepText={setSweepText}
            sweepType={sweepType} setSweepType={setSweepType} sweepHours={sweepHours} setSweepHours={setSweepHours}
            captureItem={captureItem} addSubTask={addSubTask} removeItem={removeItemCascade} answerItem={answerItem} updateField={updateField} resetItem={resetItem} />
        )}
        {activeTab === "level3" && (
          <Level3 topTasks={topTasks} updateTask={updateTask} addTask={addTask} removeTask={removeTask} autoFillTasks={autoFillTasks}
            mindSweepItems={mindSweepItems} updateField={updateField} identityChoice={identityChoice} setIdentityChoice={setIdentityChoice} />
        )}
        {activeTab === "level4" && (
          <Level4 situations={situations} updateSituation={updateSituation} motivationReflections={motivationReflections} updateMotivationReflection={updateMotivationReflection} fixCommitments={fixCommitments} toggleFix={toggleFix} />
        )}
        {activeTab === "aboutMe" && (
          <AboutMe planningByType={planningByType} planningTotalHours={planningTotalHours} mindSweepItems={mindSweepItems} topTasks={topTasks} identityChoice={identityChoice} situations={situations} />
        )}
      </div>
    </div>
  );
}

// ================= Shared: Attention Map view =================
function AttentionMapView({ byType, totalHours }) {
  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", width: "100%", height: 28, borderRadius: 3, overflow: "hidden", background: COLORS.panelRaised }}>
          {totalHours === 0 ? <div style={{ flex: 1 }} /> : byType.filter((t) => t.hrs > 0).map((t) => (
            <div key={t.type} style={{ width: `${t.pct}%`, background: TYPE_COLOR[t.type] }} title={`${t.type}: ${t.pct.toFixed(1)}%`} />
          ))}
        </div>
        <div style={{ fontSize: 12, color: COLORS.textFaint, marginTop: 6 }}>{totalHours.toFixed(1)} hours logged</div>
      </div>
      <div>
        {byType.map((t) => (
          <div key={t.type} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "4px 0" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: TYPE_COLOR[t.type], flexShrink: 0 }} />
            <span style={{ width: 90, color: COLORS.textMuted }}>{t.type}</span>
            <span style={{ width: 60 }}>{t.pct.toFixed(1)}%</span>
            <span style={{ color: COLORS.textFaint }}>ideal {t.lo}-{t.hi}%</span>
            {t.status && t.status !== "in" && <span style={{ marginLeft: "auto", color: t.type === "Reactive" || t.type === "Admin" ? COLORS.reactive : COLORS.strategic, fontSize: 12 }}>{t.status === "over" ? "above range" : "below range"}</span>}
          </div>
        ))}
      </div>
    </>
  );
}

// ================= Level 2 wrapper =================
function Level2(props) {
  const [subTab, setSubTab] = useState("timeAssessment");
  return (
    <>
      <h2 style={levelHeadingStyle}>Structured Productivity</h2>
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${COLORS.hairline}`, paddingBottom: 4 }}>
        {[{ key: "timeAssessment", label: "Time Assessment" }, { key: "planningMonitoring", label: "Planning and Monitoring" }].map((t) => (
          <button key={t.key} onClick={() => setSubTab(t.key)} style={{ background: "none", border: "none", borderBottom: subTab === t.key ? `2px solid ${COLORS.strategic}` : "2px solid transparent", color: subTab === t.key ? COLORS.text : COLORS.textMuted, padding: "6px 10px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {t.label}
          </button>
        ))}
      </div>
      {subTab === "timeAssessment" && (
        <TimeAssessment entries={props.entries} form={props.form} setForm={props.setForm} formError={props.formError} setFormError={props.setFormError} addEntry={props.addEntry} removeEntry={props.removeEntry} byType={props.byType} totalHours={props.totalHours} />
      )}
      {subTab === "planningMonitoring" && (
        <PlanningMonitoring items={props.items} sweepCategory={props.sweepCategory} setSweepCategory={props.setSweepCategory} sweepText={props.sweepText} setSweepText={props.setSweepText}
          sweepType={props.sweepType} setSweepType={props.setSweepType} sweepHours={props.sweepHours} setSweepHours={props.setSweepHours}
          captureItem={props.captureItem} addSubTask={props.addSubTask} removeItem={props.removeItem} answerItem={props.answerItem} updateField={props.updateField} resetItem={props.resetItem} />
      )}
    </>
  );
}

// ================= Time Assessment =================
function TimeAssessment({ entries, form, setForm, formError, setFormError, addEntry, removeEntry, byType, totalHours }) {
  return (
    <>
      <SectionLabel>Section 1 · Activity Log</SectionLabel>
      <div style={{ display: "flex", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <input placeholder="Activity" value={form.activity} onChange={(e) => setForm((f) => ({ ...f, activity: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addEntry()} style={inputStyle({ flex: "2 1 160px" })} />
        <input placeholder="Hours" type="number" min="0.25" max="24" step="0.25" value={form.hours} onChange={(e) => { setForm((f) => ({ ...f, hours: e.target.value })); setFormError(null); }} onKeyDown={(e) => e.key === "Enter" && addEntry()} style={inputStyle({ flex: "0 1 80px" })} />
        <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} style={inputStyle({ flex: "1 1 130px" })}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={addEntry} style={btnStyle(COLORS.strategic)}>Add</button>
      </div>
      {formError && <div style={{ color: COLORS.reactive, fontSize: 12, marginBottom: 12 }}>{formError}</div>}
      <div style={{ marginBottom: formError ? 12 : 28 }} />
      <div style={{ marginBottom: 28 }}>
        {entries.length === 0 && <div style={{ color: COLORS.textFaint, fontSize: 14, padding: "8px 0" }}>No activities logged yet.</div>}
        {entries.map((e) => {
          const flags = flagsFor(e, entries);
          return (
            <div key={e.id} style={{ padding: "8px 0", borderBottom: `1px solid ${COLORS.hairline}`, fontSize: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: TYPE_COLOR[e.type], flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{e.activity}</span>
                <span style={{ color: COLORS.textMuted, width: 50, textAlign: "right" }}>{e.hours}h</span>
                <span style={{ color: COLORS.textMuted, width: 90 }}>{e.type}</span>
                {flags.length > 0 && <span title={flags.join(" ")} style={{ color: COLORS.reactive, fontSize: 12, border: `1px solid ${COLORS.reactive}`, borderRadius: 2, padding: "1px 5px", cursor: "help" }}>flagged</span>}
                <button onClick={() => removeEntry(e.id)} style={{ background: "none", border: "none", color: COLORS.textFaint, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 4 }}>×</button>
              </div>
              {flags.length > 0 && <div style={{ color: COLORS.textFaint, fontSize: 12, marginTop: 3, paddingLeft: 18 }}>{flags[0]}</div>}
            </div>
          );
        })}
      </div>
      <SectionLabel>Section 2 · Attention Map</SectionLabel>
      <div style={{ marginBottom: 28 }}>
        <AttentionMapView byType={byType} totalHours={totalHours} />
      </div>
    </>
  );
}

// ================= Planning and Monitoring =================
const QUESTIONS = {
  actionable: { text: "Is this actionable?", options: [{ label: "Yes", patch: { actionable: true } }, { label: "No", patch: { actionable: false } }] },
  nonActionableType: { text: "What kind of item is it?", options: [{ label: "Reference (info, no action)", patch: { nonActionableType: "Reference" } }, { label: "Bucket List (someday)", patch: { nonActionableType: "Bucket List" } }, { label: "Trash (not needed)", patch: { nonActionableType: "Trash" } }] },
  doableNow: { text: "Can you do this in under 2 minutes?", options: [{ label: "Yes — do it now", patch: { doableNow: true } }, { label: "No", patch: { doableNow: false } }] },
  multiStep: { text: "Single step, or does it need multiple steps?", options: [{ label: "Multiple steps", patch: { multiStep: true } }, { label: "Single step", patch: { multiStep: false } }] },
  hasDate: { text: "Does it need to happen on a specific date/time?", options: [{ label: "Yes", patch: { hasDate: true } }, { label: "No", patch: { hasDate: false } }] },
  delegate: { text: "Are you doing this, or is someone else responsible?", options: [{ label: "Someone else", patch: { delegate: true } }, { label: "I am", patch: { delegate: false } }] },
};

const BUCKET_COLOR = { "Do It Now": COLORS.done, Project: COLORS.strategic, Calendar: COLORS.operations, "Waiting On": COLORS.admin, "Next Action": COLORS.people, "Bucket List": COLORS.textFaint, Reference: COLORS.textFaint, Trash: COLORS.reactive };

function ItemRow({ item, items, depth, addSubTask, removeItem, answerItem, updateField, resetItem, showBreadcrumb }) {
  const vague = vagueFlagForText(item.text);
  const bucket = deriveBucket(item);
  const q = nextQuestion(item);
  const flags = bucket ? sortFlagsFor(item) : [];
  const children = items.filter((i) => i.parentId === item.id);
  const [subText, setSubText] = useState("");
  const parent = showBreadcrumb && item.parentId ? items.find((p) => p.id === item.parentId) : null;

  return (
    <div style={{ marginLeft: depth * 20 }}>
      <div style={{ padding: "12px 0", borderBottom: `1px solid ${COLORS.hairline}` }}>
        {parent && <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 4 }}>sub-task of project: {parent.text}</div>}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
          {depth > 0 && <span style={{ color: COLORS.textFaint, fontSize: 12 }}>↳</span>}
          <span style={{ flex: 1, fontSize: 14, textDecoration: bucket === "Do It Now" ? "line-through" : "none", color: bucket === "Do It Now" ? COLORS.textFaint : COLORS.text }}>{item.text}</span>
          {item.type && <span style={{ width: 8, height: 8, borderRadius: "50%", background: TYPE_COLOR[item.type], flexShrink: 0 }} title={item.type} />}
          {item.hours && <span style={{ fontSize: 11, color: COLORS.textMuted }}>{item.hours}h</span>}
          <span style={{ color: COLORS.textFaint, fontSize: 11, width: 66 }}>{item.category}</span>
          {vague && <span title={vague} style={{ color: COLORS.reactive, fontSize: 12, border: `1px solid ${COLORS.reactive}`, borderRadius: 2, padding: "1px 5px", cursor: "help" }}>vague</span>}
          <button onClick={() => removeItem(item.id)} style={{ background: "none", border: "none", color: COLORS.textFaint, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        {q && (
          <div style={{ paddingLeft: 2 }}>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>{QUESTIONS[q].text}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {QUESTIONS[q].options.map((opt) => (
                <button key={opt.label} onClick={() => answerItem(item.id, opt.patch)} style={{ ...btnStyle(COLORS.panelRaised), color: COLORS.text, border: `1px solid ${COLORS.hairline}`, fontSize: 12, padding: "5px 10px" }}>{opt.label}</button>
              ))}
            </div>
          </div>
        )}

        {bucket && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 2, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: BUCKET_COLOR[bucket], border: `1px solid ${BUCKET_COLOR[bucket]}`, borderRadius: 2, padding: "2px 8px" }}>{bucket}</span>

            {bucket === "Waiting On" && (
              <>
                <input placeholder="Waiting on whom" value={item.waitingOnWhom} onChange={(e) => updateField(item.id, { waitingOnWhom: e.target.value })} style={inputStyle({ fontSize: 12, padding: "4px 8px", width: 120 })} />
                <span style={{ fontSize: 11, color: COLORS.textFaint }}>Follow up by</span>
                <DateField value={item.checkDate} onChange={(v) => updateField(item.id, { checkDate: v })} />
              </>
            )}

            {bucket === "Calendar" && (
              <>
                <DateField value={item.scheduledDate} onChange={(v) => updateField(item.id, { scheduledDate: v })} />
                <input type="time" value={item.scheduledTime} onChange={(e) => updateField(item.id, { scheduledTime: e.target.value })} style={inputStyle({ fontSize: 12, padding: "4px 8px" })} />
              </>
            )}

            {bucket === "Next Action" && (
              <>
                <span style={{ fontSize: 11, color: COLORS.textFaint }}>Deadline</span>
                <DateField value={item.deadline} onChange={(v) => updateField(item.id, { deadline: v })} />
              </>
            )}

            <button onClick={() => resetItem(item.id)} style={{ background: "none", border: "none", color: COLORS.textFaint, cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>redo</button>
          </div>
        )}

        {flags.length > 0 && <div style={{ color: COLORS.reactive, fontSize: 12, marginTop: 6, paddingLeft: 2 }}>{flags[0]}</div>}

        {bucket === "Project" && (
          <div style={{ marginTop: 10, paddingLeft: 2, display: "flex", gap: 6 }}>
            <input placeholder="Break into a single-step sub-task…" value={subText} onChange={(e) => setSubText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && subText.trim()) { addSubTask(item.id, subText, item.category); setSubText(""); } }}
              style={inputStyle({ fontSize: 12, padding: "5px 8px", flex: 1 })} />
            <button onClick={() => { if (subText.trim()) { addSubTask(item.id, subText, item.category); setSubText(""); } }} style={{ ...btnStyle(COLORS.strategic), fontSize: 12, padding: "5px 10px" }}>Add sub-task</button>
          </div>
        )}
      </div>

      {children.map((c) => (
        <ItemRow key={c.id} item={c} items={items} depth={depth + 1} addSubTask={addSubTask} removeItem={removeItem} answerItem={answerItem} updateField={updateField} resetItem={resetItem} showBreadcrumb={false} />
      ))}
    </div>
  );
}

const SUB_TABS = [
  { key: "overview", label: "Overview" },
  { key: "projectPlanning", label: "Project Planning" },
  { key: "calendar", label: "Calendar" },
  { key: "waitingOn", label: "Waiting On" },
];

function PlanningMonitoring({ items, sweepCategory, setSweepCategory, sweepText, setSweepText, sweepType, setSweepType, sweepHours, setSweepHours, captureItem, addSubTask, removeItem, answerItem, updateField, resetItem }) {
  const [subTab, setSubTab] = useState("overview");

  const overviewItems = items.filter((i) => homeTab(i) === "overview");
  const projectPool = items.filter((i) => homeTab(i) === "projectPlanning");
  const projectTopLevel = projectPool.filter((i) => !i.parentId || homeTab(items.find((p) => p.id === i.parentId) || {}) !== "projectPlanning");
  const calendarItems = items.filter((i) => homeTab(i) === "calendar");
  const waitingOnItems = items.filter((i) => homeTab(i) === "waitingOn");

  return (
    <>
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${COLORS.hairline}`, paddingBottom: 4 }}>
        {SUB_TABS.map((t) => (
          <button key={t.key} onClick={() => setSubTab(t.key)} style={{ background: "none", border: "none", borderBottom: subTab === t.key ? `2px solid ${COLORS.strategic}` : "2px solid transparent", color: subTab === t.key ? COLORS.text : COLORS.textMuted, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "overview" && (
        <>
          <SectionLabel>Mind-Sweep · Capture</SectionLabel>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {["Professional", "Personal"].map((c) => (
              <button key={c} onClick={() => setSweepCategory(c)} style={{ ...btnStyle(sweepCategory === c ? COLORS.strategic : COLORS.panelRaised), color: sweepCategory === c ? "#1C1B19" : COLORS.textMuted, border: sweepCategory === c ? "none" : `1px solid ${COLORS.hairline}` }}>{c}</button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textFaint, marginBottom: 10, lineHeight: 1.6 }}>
            {PROMPTS[sweepCategory].map((p, i) => <div key={i}>· {p}</div>)}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <input placeholder="What's on your mind…" value={sweepText} onChange={(e) => setSweepText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && captureItem()} style={inputStyle({ flex: "2 1 200px" })} />
            <select value={sweepType} onChange={(e) => setSweepType(e.target.value)} style={inputStyle({ flex: "1 1 120px" })}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Hours (optional)" type="number" min="0" step="0.25" value={sweepHours} onChange={(e) => setSweepHours(e.target.value)} style={inputStyle({ flex: "0 1 110px" })} />
            <button onClick={captureItem} style={btnStyle(COLORS.strategic)}>Capture</button>
          </div>
          <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 24 }}>Type and hours are what feed the About Me diagnostic and Level 3's auto-fill — both optional, but leaving them blank means this item won't count toward either.</div>

          <SectionLabel>Guided Sort</SectionLabel>
          {overviewItems.length === 0 && <div style={{ color: COLORS.textFaint, fontSize: 14, padding: "8px 0" }}>Nothing captured yet, or everything captured has moved to its own tab.</div>}
          <div style={{ marginBottom: 20 }}>
            {overviewItems.map((item) => (
              <ItemRow key={item.id} item={item} items={items} depth={0} addSubTask={addSubTask} removeItem={removeItem} answerItem={answerItem} updateField={updateField} resetItem={resetItem} showBreadcrumb={false} />
            ))}
          </div>
        </>
      )}

      {subTab === "projectPlanning" && (
        <>
          <SectionLabel>Project Planning</SectionLabel>
          {projectTopLevel.length === 0 && <div style={{ color: COLORS.textFaint, fontSize: 14, padding: "8px 0" }}>No projects yet — items resolved as "Project" in the Overview sort will appear here to be broken into single steps.</div>}
          {projectTopLevel.map((item) => (
            <ItemRow key={item.id} item={item} items={projectPool} depth={0} addSubTask={addSubTask} removeItem={removeItem} answerItem={answerItem} updateField={updateField} resetItem={resetItem} showBreadcrumb={false} />
          ))}
        </>
      )}

      {subTab === "calendar" && (
        <CalendarTab calendarItems={calendarItems} items={items} updateField={updateField} />
      )}

      {subTab === "waitingOn" && (
        <>
          <SectionLabel>Waiting On</SectionLabel>
          {waitingOnItems.length === 0 ? (
            <div style={{ color: COLORS.textFaint, fontSize: 14, padding: "8px 0" }}>Nothing delegated yet — items sorted as "Waiting On" land here.</div>
          ) : (
            waitingOnItems.map((i) => {
              const parent = i.parentId ? items.find((p) => p.id === i.parentId) : null;
              const flags = sortFlagsFor(i);
              return (
                <div key={i.id} style={{ padding: "8px 0", borderBottom: `1px solid ${COLORS.hairline}` }}>
                  {parent && <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 2 }}>sub-task of project: {parent.text}</div>}
                  <div style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ flex: 1 }}>{i.text}</span>
                    <input placeholder="Waiting on whom" value={i.waitingOnWhom} onChange={(e) => updateField(i.id, { waitingOnWhom: e.target.value })} style={inputStyle({ fontSize: 12, padding: "4px 8px", width: 130 })} />
                    <span style={{ fontSize: 11, color: COLORS.textFaint }}>Follow up by</span>
                    <DateField value={i.checkDate} onChange={(v) => updateField(i.id, { checkDate: v })} />
                  </div>
                  {flags.length > 0 && <div style={{ color: COLORS.reactive, fontSize: 12, marginTop: 4 }}>{flags[0]}</div>}
                </div>
              );
            })
          )}
        </>
      )}
    </>
  );
}

function itemDate(item) {
  const bucket = deriveBucket(item);
  if (bucket === "Calendar") return parseYMD(item.scheduledDate);
  if (bucket === "Next Action") return parseYMD(item.deadline);
  if (bucket === "Waiting On") return parseYMD(item.checkDate);
  return null;
}
function itemDateStr(item) {
  const dt = itemDate(item);
  return dt ? `${dt.y}-${String(dt.m + 1).padStart(2, "0")}-${String(dt.d).padStart(2, "0")}` : null;
}

function CalendarTab({ calendarItems, items, updateField }) {
  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [highlightId, setHighlightId] = useState(null);

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const needsDate = calendarItems.filter((i) => {
    const b = deriveBucket(i);
    return b === "Calendar" ? (!i.scheduledDate || !i.scheduledTime) : !i.deadline;
  });
  const dated = calendarItems.filter((i) => !needsDate.includes(i)).sort((a, b) => (itemDateStr(a) || "").localeCompare(itemDateStr(b) || ""));

  const grid_items = items.filter((i) => ["Calendar", "Next Action", "Waiting On"].includes(deriveBucket(i)));
  const itemsByDay = {};
  grid_items.forEach((item) => {
    const dt = itemDate(item);
    if (dt && dt.y === view.y && dt.m === view.m) {
      itemsByDay[dt.d] = itemsByDay[dt.d] || [];
      itemsByDay[dt.d].push(item);
    }
  });

  return (
    <>
      <SectionLabel>Needs a date</SectionLabel>
      {needsDate.length === 0 ? (
        <div style={{ color: COLORS.textFaint, fontSize: 14, padding: "8px 0", marginBottom: 24 }}>Everything here has a date.</div>
      ) : (
        <div style={{ marginBottom: 28 }}>
          {needsDate.map((i) => {
            const bucket = deriveBucket(i);
            const parent = i.parentId ? items.find((p) => p.id === i.parentId) : null;
            return (
              <div key={i.id} style={{ padding: "8px 0", borderBottom: `1px solid ${COLORS.hairline}` }}>
                {parent && <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 2 }}>sub-task of project: {parent.text}</div>}
                <div style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ flex: 1 }}>{i.text}</span>
                  <span style={{ color: BUCKET_COLOR[bucket], fontSize: 11 }}>{bucket}</span>
                  {bucket === "Calendar" ? (
                    <>
                      <DateField value={i.scheduledDate} onChange={(v) => updateField(i.id, { scheduledDate: v })} />
                      <input type="time" value={i.scheduledTime} onChange={(e) => updateField(i.id, { scheduledTime: e.target.value })} style={inputStyle({ fontSize: 12, padding: "4px 8px" })} />
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 11, color: COLORS.textFaint }}>Deadline</span>
                      <DateField value={i.deadline} onChange={(v) => updateField(i.id, { deadline: v })} />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SectionLabel>All Scheduled</SectionLabel>
      {dated.length === 0 ? (
        <div style={{ color: COLORS.textFaint, fontSize: 14, padding: "8px 0", marginBottom: 24 }}>Nothing scheduled yet.</div>
      ) : (
        <div style={{ marginBottom: 28 }}>
          {dated.map((i) => {
            const bucket = deriveBucket(i);
            return (
              <div key={i.id} style={{ padding: "8px 0", borderBottom: `1px solid ${COLORS.hairline}` }}>
                <div style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ flex: 1 }}>{i.text}</span>
                  <span style={{ color: BUCKET_COLOR[bucket], fontSize: 11 }}>{bucket}</span>
                  {bucket === "Calendar" ? (
                    <>
                      <DateField value={i.scheduledDate} onChange={(v) => updateField(i.id, { scheduledDate: v })} />
                      <input type="time" value={i.scheduledTime} onChange={(e) => updateField(i.id, { scheduledTime: e.target.value })} style={inputStyle({ fontSize: 12, padding: "4px 8px" })} />
                    </>
                  ) : bucket === "Next Action" ? (
                    <>
                      <span style={{ fontSize: 11, color: COLORS.textFaint }}>Deadline</span>
                      <DateField value={i.deadline} onChange={(v) => updateField(i.id, { deadline: v })} />
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 11, color: COLORS.textFaint }}>Follow up by</span>
                      <DateField value={i.checkDate} onChange={(v) => updateField(i.id, { checkDate: v })} />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SectionLabel>Calendar</SectionLabel>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={() => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))} style={{ ...btnStyle(COLORS.panelRaised), color: COLORS.text, border: `1px solid ${COLORS.hairline}`, padding: "4px 10px" }}>‹</button>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 15 }}>{MONTH_NAMES[view.m]} {view.y}</span>
        <button onClick={() => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))} style={{ ...btnStyle(COLORS.panelRaised), color: COLORS.text, border: `1px solid ${COLORS.hairline}`, padding: "4px 10px" }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: COLORS.hairline, border: `1px solid ${COLORS.hairline}` }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ background: COLORS.panelRaised, color: COLORS.textFaint, fontSize: 11, textAlign: "center", padding: "6px 2px" }}>{w}</div>
        ))}
        {cells.map((day, idx) => (
          <div key={idx} style={{ background: COLORS.bg, minHeight: 72, padding: "4px 5px", opacity: day ? 1 : 0.3 }}>
            {day && (
              <>
                <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 3 }}>{day}</div>
                {(itemsByDay[day] || []).map((it) => {
                  const b = deriveBucket(it);
                  return (
                    <div key={it.id} onClick={() => setHighlightId(it.id)} title={it.text} style={{
                      cursor: "pointer", fontSize: 10, color: BUCKET_COLOR[b], borderLeft: `2px solid ${BUCKET_COLOR[b]}`,
                      paddingLeft: 4, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      background: highlightId === it.id ? COLORS.panelRaised : "transparent",
                    }}>
                      {b === "Calendar" ? it.scheduledTime : b === "Waiting On" ? "follow up" : "due"} {it.text}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ================= Level 3: Strategic Time Management =================
function ThreeLayersDiagram() {
  const layers = [
    { label: "Strategy", size: 220, color: COLORS.strategic },
    { label: "Attention", size: 155, color: COLORS.operations },
    { label: "Identity", size: 90, color: COLORS.admin },
  ];
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 240, marginBottom: 8, position: "relative" }}>
      {layers.map((l, i) => (
        <div key={l.label} style={{
          position: "absolute", width: l.size, height: l.size, borderRadius: "50%", background: l.color,
          display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 14,
          color: "#FFFFFF", fontSize: i === 0 ? 13 : 12, fontWeight: 600,
        }}>
          {l.label}
        </div>
      ))}
    </div>
  );
}

function TaskCard({ task, index, updateTask, removeTask }) {
  const lev = leverageScore(task), leak = leakScore(task);
  const q = quadrantFor(lev, leak);
  const nq = nextTaskQuestion(task);
  const question = nq ? TASK_QUESTIONS.find((x) => x.key === nq) : null;

  return (
    <div style={{ padding: "14px 0", borderBottom: `1px solid ${COLORS.hairline}` }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ color: COLORS.textFaint, fontSize: 12, alignSelf: "center" }}>#{index + 1}</span>
        <input placeholder="Activity" value={task.activity} onChange={(e) => updateTask(task.id, { activity: e.target.value })} style={inputStyle({ flex: "2 1 160px" })} />
        <input placeholder="Duration" value={task.duration} onChange={(e) => updateTask(task.id, { duration: e.target.value })} style={inputStyle({ flex: "0 1 100px" })} />
        <button onClick={() => removeTask(task.id)} style={{ background: "none", border: "none", color: COLORS.textFaint, cursor: "pointer", fontSize: 16 }}>×</button>
      </div>

      {task.activity.trim() && question && (
        <div style={{ paddingLeft: 2 }}>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>
            Question {TASK_QUESTIONS.findIndex((x) => x.key === nq) + 1} of 6: {question.text}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => updateTask(task.id, { [nq]: n })} style={{ ...btnStyle(COLORS.panelRaised), color: COLORS.text, border: `1px solid ${COLORS.hairline}`, width: 34, padding: "6px 0" }}>{n}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: COLORS.textFaint, marginTop: 4 }}>1 = strongly no · 5 = strongly yes</div>
        </div>
      )}

      {task.activity.trim() && !question && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 12, flexWrap: "wrap" }}>
          <span style={{ color: COLORS.textMuted }}>Leverage: {lev}/15</span>
          <span style={{ color: COLORS.textMuted }}>Leak: {leak}/15</span>
          {q && <span style={{ color: QUADRANT_INFO[q].color, border: `1px solid ${QUADRANT_INFO[q].color}`, borderRadius: 2, padding: "2px 8px" }}>{q}</span>}
          <button onClick={() => updateTask(task.id, { attention: null, strategic: null, orgSuffer: null, delegated: null, urgency: null, interrupt: null })} style={{ background: "none", border: "none", color: COLORS.textFaint, cursor: "pointer", fontSize: 11, textDecoration: "underline" }}>redo scoring</button>
        </div>
      )}
    </div>
  );
}

function AttentionMappingQuadrant({ topTasks }) {
  const scored = topTasks.filter((t) => t.activity.trim() && leverageScore(t) !== null && leakScore(t) !== null);
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 420, height: 300, border: `1px solid ${COLORS.hairline}`, marginBottom: 26, marginTop: 4 }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: "50%", height: "50%", background: `${COLORS.strategic}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: COLORS.textFaint, textAlign: "center", padding: 6 }}>Strategic Focus Zone</div>
      <div style={{ position: "absolute", top: 0, right: 0, width: "50%", height: "50%", background: `${COLORS.admin}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: COLORS.textFaint, textAlign: "center", padding: 6 }}>Important but Poorly Structured</div>
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "50%", height: "50%", background: `${COLORS.textFaint}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: COLORS.textFaint, textAlign: "center", padding: 6 }}>Low Impact Maintenance</div>
      <div style={{ position: "absolute", bottom: 0, right: 0, width: "50%", height: "50%", background: `${COLORS.reactive}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: COLORS.textFaint, textAlign: "center", padding: 6 }}>Executive Attention Trap</div>
      {scored.map((t) => {
        const lev = leverageScore(t), leak = leakScore(t);
        const left = (leak / 15) * 100, top = 100 - (lev / 15) * 100;
        const q = quadrantFor(lev, leak);
        return (
          <div key={t.id} title={`${t.activity} — leverage ${lev}, leak ${leak}`} style={{
            position: "absolute", left: `${left}%`, top: `${top}%`, width: 10, height: 10, borderRadius: "50%",
            background: QUADRANT_INFO[q].color, transform: "translate(-50%, -50%)", border: "1px solid #1C1B19",
          }} />
        );
      })}
      <div style={{ position: "absolute", bottom: -20, left: 0, fontSize: 10, color: COLORS.textFaint }}>Low leak</div>
      <div style={{ position: "absolute", bottom: -20, right: 0, fontSize: 10, color: COLORS.textFaint }}>High leak</div>
      <div style={{ position: "absolute", top: -18, left: 0, fontSize: 10, color: COLORS.textFaint }}>High leverage</div>
    </div>
  );
}

function QuadrantExplanation({ topTasks }) {
  const scored = topTasks.filter((t) => t.activity.trim() && leverageScore(t) !== null && leakScore(t) !== null);
  if (!scored.length) {
    return <div style={{ color: COLORS.textFaint, fontSize: 13, marginBottom: 28 }}>Score your tasks above and this explains what each quadrant means for your specific work.</div>;
  }
  const byQuadrant = {};
  scored.forEach((t) => {
    const q = quadrantFor(leverageScore(t), leakScore(t));
    byQuadrant[q] = byQuadrant[q] || [];
    byQuadrant[q].push(t);
  });
  return (
    <div style={{ marginBottom: 28 }}>
      {Object.keys(QUADRANT_INFO).map((q) => {
        const tasks = byQuadrant[q];
        if (!tasks || !tasks.length) return null;
        return (
          <div key={q} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: QUADRANT_INFO[q].color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{q}</span>
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6, paddingLeft: 16 }}>{QUADRANT_INFO[q].meaning}</div>
            {tasks.map((t) => (
              <div key={t.id} style={{ fontSize: 12, color: COLORS.textMuted, paddingLeft: 16 }}>· {t.activity} — leverage {leverageScore(t)}/15, leak {leakScore(t)}/15</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function IdentityCard({ identity }) {
  return (
    <div style={{ padding: 16, background: COLORS.panelRaised, borderRadius: 4, borderLeft: `3px solid ${identity.color}` }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: 16, marginBottom: 4 }}>{identity.name}</div>
      <div style={{ fontSize: 12, fontStyle: "italic", color: COLORS.textMuted, marginBottom: 14 }}>"{identity.quote}"</div>

      <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 4, letterSpacing: "0.03em" }}>CORE ATTENTION STYLE</div>
      <div style={{ fontSize: 13, marginBottom: 12 }}>{identity.attentionStyle.join(" · ")}</div>

      <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 4, letterSpacing: "0.03em" }}>STRATEGIC STRENGTH</div>
      <div style={{ fontSize: 13, marginBottom: 12 }}>{identity.strength.join(" · ")}</div>

      <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 4, letterSpacing: "0.03em" }}>Q2 BLIND SPOT</div>
      <div style={{ fontSize: 13, marginBottom: 12 }}>{identity.blindSpot}</div>

      <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 6, letterSpacing: "0.03em" }}>RACI TENDENCY</div>
      {identity.raci ? (
        <div style={{ marginBottom: 12 }}>
          {["R", "A", "C", "I"].map((letter) => (
            <div key={letter} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ width: 14, fontSize: 12, color: COLORS.textMuted }}>{letter}</span>
              <div style={{ flex: 1, height: 6, background: COLORS.bg, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${(RACI_LEVEL_SCORE[identity.raci[letter]] / 5) * 100}%`, height: "100%", background: identity.color }} />
              </div>
              <span style={{ fontSize: 11, color: COLORS.textFaint, width: 90 }}>{identity.raci[letter]}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, marginBottom: 12 }}>{identity.raciNote}</div>
      )}

      <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 4, letterSpacing: "0.03em" }}>DELEGATION PATTERN</div>
      <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>{identity.delegationPattern}</div>

      <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 4, letterSpacing: "0.03em" }}>STRATEGIC DEVELOPMENT MOVE</div>
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>{identity.developmentMove}</div>
    </div>
  );
}

function IdentityPicker({ identityChoice, setIdentityChoice }) {
  const identity = identityChoice ? IDENTITIES.find((i) => i.key === identityChoice) : null;
  return (
    <>
      <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 8 }}>What is your Attentional Identity?</div>
      <select value={identityChoice || ""} onChange={(e) => setIdentityChoice(e.target.value || null)} style={inputStyle({ marginBottom: 16, width: "100%", maxWidth: 320 })}>
        <option value="" disabled>Choose one…</option>
        {IDENTITIES.map((i) => <option key={i.key} value={i.key}>{i.name}</option>)}
      </select>
      {identity && <IdentityCard identity={identity} />}
    </>
  );
}

const LEVEL3_TABS = [
  { key: "attentionLeak", label: "Strategic Attention & Leak Score" },
  { key: "raci", label: "RACI Audit" },
  { key: "attentionalIdentity", label: "Attentional Identity" },
];

function Level3({ topTasks, updateTask, addTask, removeTask, autoFillTasks, mindSweepItems, updateField, identityChoice, setIdentityChoice }) {
  const [subTab, setSubTab] = useState("attentionLeak");
  const nextActions = mindSweepItems.filter((i) => deriveBucket(i) === "Next Action");
  const assigned = nextActions.filter((i) => i.raci);
  const raPct = assigned.length ? Math.round((assigned.filter((i) => i.raci === "R" || i.raci === "A").length / assigned.length) * 100) : null;
  const fillableCount = mindSweepItems.filter((i) => !i.parentId && !["Reference", "Trash", "Bucket List", "Do It Now"].includes(deriveBucket(i))).length;

  return (
    <>
      <h2 style={levelHeadingStyle}>Strategic Time Management</h2>
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${COLORS.hairline}`, paddingBottom: 4, flexWrap: "wrap" }}>
        {LEVEL3_TABS.map((t) => (
          <button key={t.key} onClick={() => setSubTab(t.key)} style={{ background: "none", border: "none", borderBottom: subTab === t.key ? `2px solid ${COLORS.strategic}` : "2px solid transparent", color: subTab === t.key ? COLORS.text : COLORS.textMuted, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "attentionLeak" && (
        <>
          <SectionLabel>Three Layers of Strategic Shifting</SectionLabel>
          <ThreeLayersDiagram />
          <div style={{ fontSize: 12, color: COLORS.textFaint, marginBottom: 28, textAlign: "center" }}>Identity shapes attention. Attention shapes strategy.</div>

          <SectionLabel>Choose Your Top 5 Time-Consuming Tasks</SectionLabel>
          <button onClick={autoFillTasks} disabled={fillableCount === 0} style={{ ...btnStyle(COLORS.panelRaised), color: COLORS.text, border: `1px solid ${COLORS.hairline}`, opacity: fillableCount === 0 ? 0.5 : 1, cursor: fillableCount === 0 ? "not-allowed" : "pointer", marginBottom: 14 }}>
            Auto-fill top 5 from Planning and Monitoring
          </button>
          {fillableCount === 0 && <div style={{ fontSize: 12, color: COLORS.textFaint, marginBottom: 14 }}>Capture and sort some items in Level 2's Planning and Monitoring first, or just type tasks in below.</div>}
          {topTasks.map((t, i) => (
            <TaskCard key={t.id} task={t} index={i} updateTask={updateTask} removeTask={removeTask} />
          ))}
          <button onClick={addTask} style={{ ...btnStyle(COLORS.panelRaised), color: COLORS.text, border: `1px solid ${COLORS.hairline}`, marginTop: 10, marginBottom: 28 }}>+ Add task</button>

          <SectionLabel>Attention Mapping</SectionLabel>
          <AttentionMappingQuadrant topTasks={topTasks} />
          <QuadrantExplanation topTasks={topTasks} />
        </>
      )}

      {subTab === "raci" && (
        <>
          <SectionLabel>RACI Audit of Next Actions</SectionLabel>
          <div style={{ fontSize: 12, color: COLORS.textFaint, marginBottom: 12 }}>Every Next Action from Level 2 shows up here — tag what you actually are on each one.</div>
          {nextActions.length === 0 ? (
            <div style={{ color: COLORS.textFaint, fontSize: 14, padding: "8px 0" }}>No Next Actions yet — sort some items in Level 2's Planning and Monitoring first.</div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              {nextActions.map((i) => (
                <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: `1px solid ${COLORS.hairline}`, fontSize: 13 }}>
                  <span style={{ flex: 1 }}>{i.text}</span>
                  {Object.keys(RACI_LABELS).map((letter) => (
                    <button key={letter} onClick={() => updateField(i.id, { raci: letter })} title={RACI_LABELS[letter]}
                      style={{ ...btnStyle(i.raci === letter ? COLORS.strategic : COLORS.panelRaised), color: i.raci === letter ? "#1C1B19" : COLORS.textMuted, border: i.raci === letter ? "none" : `1px solid ${COLORS.hairline}`, padding: "3px 9px", fontSize: 11 }}>
                      {letter}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
          {raPct !== null && (
            <div style={{ fontSize: 13, color: COLORS.textMuted }}>{raPct}% of your assigned Next Actions are R/A (yours to own) — {100 - raPct}% are C/I (you're just involved).</div>
          )}
        </>
      )}

      {subTab === "attentionalIdentity" && (
        <>
          <SectionLabel>Attentional Identity</SectionLabel>
          <IdentityPicker identityChoice={identityChoice} setIdentityChoice={setIdentityChoice} />
        </>
      )}
    </>
  );
}

// ================= Level 4: Time Leverage and Systems Design =================
function freshSituation() {
  return { id: uid(), situation: "", dependencyType: null, rootCause: null };
}

const DEPENDENCY_TYPES = [
  { key: "Decision", looksLike: "We need your approval" },
  { key: "Direction", looksLike: "What should we do?" },
  { key: "Competence", looksLike: "We don't know how" },
  { key: "Motivation", looksLike: "We're stuck / disengaged" },
  { key: "Coordination", looksLike: "We need you to align others" },
];

const ROOT_CAUSES = ["Autonomy", "Competence", "Relatedness"];
const ROOT_CAUSE_COLOR = { Autonomy: COLORS.strategic, Competence: COLORS.operations, Relatedness: COLORS.people };

const MOTIVATION_FIXES = {
  Autonomy: { reflection: "What decisions can I stop owning?", checklist: ["Define decision boundaries", "Clarify escalation rules", "Reduce approval layers", "Replace answers with coaching questions", "Allow safe mistakes"] },
  Competence: { reflection: "Where am I repeatedly rescuing people?", checklist: ["Train once instead of fixing repeatedly", "Create templates / standards", "Coach instead of solve", "Reduce ambiguity", "Create competence ladders"] },
  Relatedness: { reflection: "Where do people emotionally disengage from me?", checklist: ["Assign meaningful ownership", "Connect work to purpose", "Shift from tasks → outcomes", "Increase recognition", "Create safer dialogue"] },
};

function rootCauseTally(situations) {
  const tally = { Autonomy: 0, Competence: 0, Relatedness: 0 };
  situations.forEach((s) => { if (s.rootCause) tally[s.rootCause]++; });
  return tally;
}

function Level4({ situations, updateSituation, motivationReflections, updateMotivationReflection, fixCommitments, toggleFix }) {
  return (
    <>
      <h2 style={levelHeadingStyle}>Time Leverage and Systems Design</h2>

      <SectionLabel>Self Determination Theory</SectionLabel>
      <div style={{ fontSize: 12, color: COLORS.textFaint, marginBottom: 16 }}>Think of 5 real situations where your team came back to you when they didn't have to.</div>

      {situations.map((s, i) => (
        <div key={s.id} style={{ padding: "14px 0", borderBottom: `1px solid ${COLORS.hairline}` }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ color: COLORS.textFaint, fontSize: 12, alignSelf: "center" }}>#{i + 1}</span>
            <input placeholder="Situation" value={s.situation} onChange={(e) => updateSituation(s.id, { situation: e.target.value })} style={inputStyle({ flex: 1 })} />
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 220px" }}>
              <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 4 }}>Type of dependency</div>
              <select value={s.dependencyType || ""} onChange={(e) => updateSituation(s.id, { dependencyType: e.target.value })} style={inputStyle({ fontSize: 12, width: "100%" })}>
                <option value="" disabled>Choose…</option>
                {DEPENDENCY_TYPES.map((d) => <option key={d.key} value={d.key}>{d.key} Dependency</option>)}
              </select>
              {s.dependencyType && <div style={{ fontSize: 11, color: COLORS.textFaint, marginTop: 4 }}>"{DEPENDENCY_TYPES.find((d) => d.key === s.dependencyType).looksLike}"</div>}
            </div>
            <div style={{ flex: "1 1 220px" }}>
              <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 4 }}>Root cause (SDT)</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ROOT_CAUSES.map((rc) => (
                  <button key={rc} onClick={() => updateSituation(s.id, { rootCause: rc })}
                    style={{ ...btnStyle(s.rootCause === rc ? ROOT_CAUSE_COLOR[rc] : COLORS.panelRaised), color: s.rootCause === rc ? "#1C1B19" : COLORS.textMuted, border: s.rootCause === rc ? "none" : `1px solid ${COLORS.hairline}`, fontSize: 11, padding: "5px 9px" }}>
                    {rc}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}

      <div style={{ marginTop: 28 }}>
        <SectionLabel>People Motivation Action Plan</SectionLabel>
        {ROOT_CAUSES.map((rc) => (
          <div key={rc} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: ROOT_CAUSE_COLOR[rc], marginBottom: 8 }}>Fixing {rc}</div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 6 }}>{MOTIVATION_FIXES[rc].reflection}</div>
            <textarea value={motivationReflections[rc]} onChange={(e) => updateMotivationReflection(rc, e.target.value)} rows={2} style={inputStyle({ width: "100%", resize: "vertical", fontFamily: "inherit", marginBottom: 10 })} />
            {MOTIVATION_FIXES[rc].checklist.map((item, idx) => {
              const key = `${rc}:${idx}`;
              const checked = fixCommitments.has(key);
              return (
                <div key={idx} onClick={() => toggleFix(key)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer", fontSize: 13, color: checked ? COLORS.text : COLORS.textMuted }}>
                  <span style={{ width: 14, height: 14, border: `1px solid ${ROOT_CAUSE_COLOR[rc]}`, borderRadius: 3, background: checked ? ROOT_CAUSE_COLOR[rc] : "transparent", flexShrink: 0 }} />
                  {item}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

// ================= About Me =================
function AboutMe({ planningByType, planningTotalHours, mindSweepItems, topTasks, identityChoice, situations }) {
  const quadrantCounts = {};
  topTasks.filter((t) => t.activity.trim()).forEach((t) => {
    const q = quadrantFor(leverageScore(t), leakScore(t));
    if (q) quadrantCounts[q] = (quadrantCounts[q] || 0) + 1;
  });
  const hasQuadrantData = Object.keys(quadrantCounts).length > 0;

  const nextActions = mindSweepItems.filter((i) => deriveBucket(i) === "Next Action" && i.raci);
  const raCount = nextActions.filter((i) => i.raci === "R" || i.raci === "A").length;
  const raPct = nextActions.length ? Math.round((raCount / nextActions.length) * 100) : null;

  const identity = identityChoice ? IDENTITIES.find((i) => i.key === identityChoice) : null;
  const typedItems = mindSweepItems.filter((i) => i.type && i.hours);

  const sdtTally = rootCauseTally(situations);
  const sdtTotal = situations.filter((s) => s.rootCause).length;

  return (
    <>
      <h2 style={levelHeadingStyle}>About Me</h2>
      <SectionLabel>Time Allocation (from Planning &amp; Monitoring)</SectionLabel>
      {planningTotalHours === 0 ? (
        <div style={{ color: COLORS.textFaint, fontSize: 14, padding: "8px 0", marginBottom: 28 }}>Capture items with a type and hours in Level 2's Planning and Monitoring and this fills in automatically.</div>
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <AttentionMapView byType={planningByType} totalHours={planningTotalHours} />
          </div>
          <div style={{ marginBottom: 28 }}>
            {TYPES.map((t) => {
              const items = typedItems.filter((i) => i.type === t);
              if (!items.length) return null;
              return (
                <div key={t} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: TYPE_COLOR[t], marginBottom: 4 }}>{t}</div>
                  {items.map((i) => (
                    <div key={i.id} style={{ fontSize: 12, color: COLORS.textMuted, paddingLeft: 10 }}>· {i.text} ({i.hours}h)</div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}

      <SectionLabel>Strategic Attention Pattern</SectionLabel>
      {!hasQuadrantData ? (
        <div style={{ color: COLORS.textFaint, fontSize: 14, padding: "8px 0", marginBottom: 28 }}>Score your top 5 tasks in Level 3 and this fills in automatically.</div>
      ) : (
        <div style={{ marginBottom: 28 }}>
          {Object.entries(quadrantCounts).map(([q, count]) => (
            <div key={q} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "4px 0" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: QUADRANT_INFO[q].color, flexShrink: 0 }} />
              <span style={{ flex: 1, color: COLORS.textMuted }}>{q}</span>
              <span>{count} task{count > 1 ? "s" : ""}</span>
            </div>
          ))}
        </div>
      )}

      <SectionLabel>Delegation Reality (RACI)</SectionLabel>
      {raPct === null ? (
        <div style={{ color: COLORS.textFaint, fontSize: 14, padding: "8px 0", marginBottom: 28 }}>Tag your Next Actions with RACI in Level 3 and this fills in automatically.</div>
      ) : (
        <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 28 }}>{raPct}% of your tagged Next Actions are Responsible/Accountable — {100 - raPct}% are Consulted/Informed.</div>
      )}

      <SectionLabel>Attentional Identity</SectionLabel>
      {!identity ? (
        <div style={{ color: COLORS.textFaint, fontSize: 14, padding: "8px 0", marginBottom: 28 }}>Choose your Attentional Identity in Level 3 and this fills in automatically.</div>
      ) : (
        <div style={{ marginBottom: 28 }}>
          <IdentityCard identity={identity} />
        </div>
      )}

      <SectionLabel>Dependency Tendency (Self Determination Theory)</SectionLabel>
      {sdtTotal === 0 ? (
        <div style={{ color: COLORS.textFaint, fontSize: 14, padding: "8px 0" }}>Classify your dependency situations in Level 4 and this fills in automatically.</div>
      ) : (
        <div>
          {ROOT_CAUSES.map((rc) => sdtTally[rc] > 0 && (
            <div key={rc} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "4px 0" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: ROOT_CAUSE_COLOR[rc], flexShrink: 0 }} />
              <span style={{ flex: 1, color: COLORS.textMuted }}>{rc}</span>
              <span>{sdtTally[rc]} situation{sdtTally[rc] > 1 ? "s" : ""}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, color: COLORS.textMuted, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${COLORS.hairline}` }}>{children}</div>;
}
function inputStyle(extra) {
  return { background: COLORS.panelRaised, border: `1px solid ${COLORS.hairline}`, color: COLORS.text, padding: "8px 10px", borderRadius: 3, fontSize: 14, fontFamily: "inherit", outline: "none", ...extra };
}
function btnStyle(bg) {
  return { background: bg, color: "#1C1B19", border: "none", padding: "8px 16px", borderRadius: 3, fontSize: 14, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" };
}
