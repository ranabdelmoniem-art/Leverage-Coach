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

function uid() {
  return Math.random().toString(36).slice(2, 9);
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

// Where an item "lives" once sorted: Project/Calendar/Waiting On items graduate
// out of the main Overview into their own dedicated tab.
function homeTab(item) {
  const bucket = deriveBucket(item);
  if (item.parentId) {
    if (bucket === "Calendar" || bucket === "Next Action") return "calendar";
    if (bucket === "Waiting On") return "waitingOn";
    return "projectPlanning"; // still mid-wizard, another Project, or terminal simple bucket
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

function freshItem(text, category, parentId) {
  return {
    id: uid(), text: text.trim(), category, parentId: parentId || null,
    actionable: null, doableNow: null, multiStep: null, hasDate: null, delegate: null,
    nonActionableType: null, waitingOnWhom: "", checkDate: "", scheduledDate: "", scheduledTime: "", deadline: "",
  };
}

export default function LeverageApp() {
  const [entries, setEntries] = useState([
    { id: uid(), activity: "Client renewal call", hours: 1.5, type: "Operations" },
    { id: uid(), activity: "Unplanned escalation from support", hours: 2, type: "Reactive" },
  ]);
  const [mindSweepItems, setMindSweepItems] = useState([]);
  const [activeTab, setActiveTab] = useState("attention");

  const [messages, setMessages] = useState([
    { role: "assistant", content: "I'm your Leverage coach. I'll follow you through all of Level 2 — start with the Activity Log, and I'll pick up wherever you're working." },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesRef = useRef(messages);
  const queueRef = useRef(Promise.resolve());
  const insightCountRef = useRef(0);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const totalHours = entries.reduce((s, e) => s + Number(e.hours || 0), 0);
  const byType = TYPES.map((t) => {
    const hrs = entries.filter((e) => e.type === t).reduce((s, e) => s + Number(e.hours || 0), 0);
    const pct = totalHours > 0 ? (hrs / totalHours) * 100 : 0;
    const [lo, hi] = IDEAL[t];
    const status = totalHours === 0 ? null : pct < lo ? "under" : pct > hi ? "over" : "in";
    return { type: t, hrs, pct, lo, hi, status };
  });

  function enqueueCoachCall(userText, contextNote) {
    queueRef.current = queueRef.current.then(() => callCoach(userText, contextNote));
  }

  async function callCoach(userText, contextNote) {
    setLoading(true);
    setError(null);
    const outgoing = [...messagesRef.current, { role: "user", content: userText }];
    messagesRef.current = outgoing;
    setMessages(outgoing);

    const logSummary = entries.map((e) => `- ${e.activity} — ${e.hours}h — logged as ${e.type}`).join("\n");
    const mapSummary = byType.map((t) => `${t.type}: ${t.hrs.toFixed(1)}h (${t.pct.toFixed(1)}%), ideal ${t.lo}-${t.hi}%, status: ${t.status ?? "no data"}`).join("\n");

    const sortSummary = mindSweepItems.length
      ? mindSweepItems.map((i) => {
          const b = deriveBucket(i);
          let extra = "";
          if (b === "Waiting On") extra = ` — waiting on: ${i.waitingOnWhom || "(no one named)"}, check back: ${i.checkDate || "(no date)"}`;
          if (b === "Calendar") extra = ` — scheduled: ${i.scheduledDate || "(no date)"} ${i.scheduledTime || "(no time)"}`;
          if (b === "Next Action") extra = ` — deadline: ${i.deadline || "(none set)"}`;
          const parentNote = i.parentId ? ` [sub-task of project: "${mindSweepItems.find((p) => p.id === i.parentId)?.text || "?"}"]` : "";
          return `- "${i.text}" (${i.category})${parentNote} — bucket: ${b || "still being sorted"}, home tab: ${homeTab(i)}${extra}`;
        }).join("\n")
      : "(nothing captured yet)";

    const onCalendarCount = mindSweepItems.filter((i) => (deriveBucket(i) === "Calendar" && i.scheduledDate && i.scheduledTime) || (deriveBucket(i) === "Next Action" && i.deadline)).length;
    const doItNowCount = mindSweepItems.filter((i) => deriveBucket(i) === "Do It Now").length;

    let modeInstruction = "Keep full reviews to 2-4 sentences.";
    if (contextNote && contextNote.startsWith("QUICK_CHECK")) {
      modeInstruction = "This is a quick, real-time check on one specific item just logged/sorted/scheduled. Keep it to 1-2 sentences, terse, specific. Do not discuss anything else.";
    } else if (contextNote && contextNote.startsWith("INSIGHT")) {
      insightCountRef.current += 1;
      modeInstruction = `This is a requested synthesis across everything so far (insight request #${insightCountRef.current} this session). Find the single connection between the Time Assessment data and the Planning & Monitoring data that the manager hasn't drawn themselves. If there's a real cross-module link, name it explicitly. 3-5 sentences, still direct. If this is insight request #2 or later, give a genuinely different angle than a typical first insight.`;
    }

    const systemPrompt = `You are the Leverage Time Coach, embedded in the Leverage time-management planner for managers. You follow the manager through all of Level 2: Structured Productivity as one continuous thread.

The app has two main sections: Time Assessment, and Planning and Monitoring. Planning and Monitoring has its own internal tabs: Overview (mind-sweep capture + guided sort for anything not yet resolved, plus anything that resolved to a simple terminal bucket), Project Planning (anything that resolved to Project, plus its single-step sub-tasks), Calendar (anything time-bound: Calendar items with a date+time, and Next Actions once they have a deadline), and Waiting On (anything delegated).

=== TIME ASSESSMENT: ETAM CLASSIFICATION WORKFLOW ===
Ideal attention allocation: Strategic 30-35%, People 20-25%, Operations 20-25%, Admin 5-10%, Reactive 10-15%.
1. Was it planned in advance? NO -> Reactive. YES -> continue.
2. Did it shape strategy/direction, or could only this manager have decided it? YES -> Strategic. NO -> continue.
3. Could someone else on the team have done this competently? YES -> Admin. NO -> continue.
4. Was the core purpose to interact with, develop, or decide about a person? YES -> People. NO -> Operations (default).
Name which gate an entry actually fails when it's miscategorized.

Current logged activities:
${logSummary || "(none logged yet)"}

Current computed Attention Map / Gap Analysis (calculated deterministically, not by you):
${mapSummary}

Planner's own Section 1 prompts: Where were you? What meetings did you attend? Who did you interact with? What interrupted you? What decisions did you make?

=== PLANNING & MONITORING: GUIDED ACTIONABLE SORT ===
1. Actionable? NO -> Reference (info) / Bucket List (someday) / Trash (not needed).
2. Actionable? YES -> Under 2 minutes? YES -> Do It Now (the 2-minute rule — don't file it, just do it).
3. NO -> Single step or multiple steps? Multiple -> Project. A Project is broken into single-step sub-tasks in the Project Planning tab, and EACH sub-task re-enters this exact sequence from question 1.
4. Single step -> Specific date/time needed? YES -> Calendar (gets a date AND a time — it's a specific slot, not just a day).
5. NO -> You or someone else? Someone else -> Waiting On (needs a name + check-back date). Yourself -> Next Action (gets a deadline — a date only, not a specific time slot; a Next Action is due by a day, not scheduled to a minute).
Both Calendar items and Next Actions with a deadline show up in the Calendar tab, distinguished by whether they carry a specific time or just a due date. Waiting On items are still managed on their own tab, but their follow-up date also appears on the calendar grid as a reminder to chase the person — color-coded separately from Calendar and Next Action entries.
Failure points to catch: a Project's sub-tasks that aren't actually single-step; a Calendar item missing its date/time; a Next Action missing its deadline; claiming "Do It Now" for something with real effort; filing something as Reference/Trash/Bucket List when the wording still implies action; a Waiting On item with no owner.

Current captured items, their derived buckets, and which tab they now live in:
${sortSummary}
(${doItNowCount} item(s) resolved to Do It Now. ${onCalendarCount} item(s) are properly on the Calendar tab with a real date.)

=== COACHING PRINCIPLES ===
1. Ground every claim in specific evidence — cite the exact number, activity name, or item text.
2. Sanity-check categorization/sorting using the trees above and name the specific gate or question an entry fails.
3. Push for the specific missing detail rather than saying "be more specific."
4. Surface the single most important issue, not a list of everything wrong.
5. Vary your approach across the conversation — don't open consecutive messages the same way, and don't repeat a challenge you've already made in this thread.
6. Be a coach, not a cheerleader. Direct, professional, no therapy-speak, no excessive validation.
7. Never invent activities, hours, percentages, or captured items that weren't given to you above.

${modeInstruction}
${contextNote ? `\nContext for this message: ${contextNote}` : ""}`;

    try {
      const resp = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: systemPrompt, messages: outgoing.map((m) => ({ role: m.role, content: m.content })) }),
      });
      if (!resp.ok) throw new Error(`API error ${resp.status}`);
      const data = await resp.json();
      const textBlock = (data.content || []).find((b) => b.type === "text");
      const reply = textBlock ? textBlock.text : "I couldn't generate a response — try again.";
      const withReply = [...messagesRef.current, { role: "assistant", content: reply }];
      messagesRef.current = withReply;
      setMessages(withReply);
    } catch (e) {
      setError("The coach couldn't respond just now. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  // ---- Time Assessment handlers ----
  const [form, setForm] = useState({ activity: "", hours: "", type: "Strategic" });
  const [formError, setFormError] = useState(null);

  function addEntry() {
    if (!form.activity.trim()) return;
    const err = inputErrorFor(form.hours);
    if (err) { setFormError(err); return; }
    setFormError(null);
    const newEntry = { id: uid(), activity: form.activity.trim(), hours: Number(form.hours), type: form.type };
    const nextEntries = [...entries, newEntry];
    setEntries(nextEntries);
    setForm({ activity: "", hours: "", type: form.type });
    const flags = flagsFor(newEntry, nextEntries);
    if (flags.length > 0) {
      enqueueCoachCall(`I just logged: "${newEntry.activity}" — ${newEntry.hours}h — ${newEntry.type}.`, `QUICK_CHECK mode. Automated flags: ${flags.join(" ")} Push back on this one entry only, in 1-2 sentences.`);
    }
  }
  function removeEntry(id) { setEntries((prev) => prev.filter((e) => e.id !== id)); }
  function runGapReview() {
    if (loading) return;
    enqueueCoachCall("Run the Gap Analysis review on my current numbers.", "The user wants the Gap Analysis review — focus on principle 2.");
  }

  // ---- Planning & Monitoring handlers ----
  const [sweepCategory, setSweepCategory] = useState("Professional");
  const [sweepText, setSweepText] = useState("");
  const itemsRef = useRef(mindSweepItems);
  useEffect(() => { itemsRef.current = mindSweepItems; }, [mindSweepItems]);

  function captureItem() {
    if (!sweepText.trim()) return;
    setMindSweepItems((prev) => [...prev, freshItem(sweepText, sweepCategory)]);
    setSweepText("");
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
        prev.forEach((i) => {
          if (i.parentId && toRemove.has(i.parentId) && !toRemove.has(i.id)) { toRemove.add(i.id); grew = true; }
        });
      }
      return prev.filter((i) => !toRemove.has(i.id));
    });
  }
  function answerItem(id, patch) {
    setMindSweepItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    setTimeout(() => checkItemNow(id, patch), 0);
  }
  function updateField(id, patch) {
    setMindSweepItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  function checkItemNow(id, patchOverride) {
    const base = itemsRef.current.find((i) => i.id === id);
    if (!base) return;
    const item = patchOverride ? { ...base, ...patchOverride } : base;
    const bucket = deriveBucket(item);
    if (!bucket) return;
    const flags = sortFlagsFor(item);
    if (flags.length > 0) {
      enqueueCoachCall(`Item "${item.text}" -> bucket: ${bucket}.`, `QUICK_CHECK mode. Automated flags: ${flags.join(" ")} Push back on this one item only, in 1-2 sentences.`);
    }
  }
  function resetItem(id) {
    answerItem(id, { actionable: null, doableNow: null, multiStep: null, hasDate: null, delegate: null, nonActionableType: null });
  }
  function runSortReview() {
    if (loading || mindSweepItems.length === 0) return;
    enqueueCoachCall("Review my sort overall.", "The user wants a review of the whole sort — focus on principle 4. Pick the single most questionable classification.");
  }
  function runInsight() {
    if (loading) return;
    enqueueCoachCall("What's your best insight across everything so far?", "INSIGHT mode.");
  }

  const [input, setInput] = useState("");
  function sendTyped() {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    enqueueCoachCall(text, null);
  }

  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  const TABS = [
    { key: "attention", label: "Time Assessment" },
    { key: "sort", label: "Planning and Monitoring" },
  ];

  return (
    <div style={{ minHeight: "100%", background: COLORS.bg, color: COLORS.text, fontFamily: "'IBM Plex Sans', -apple-system, sans-serif", display: "flex", flexDirection: "column" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Fraunces:opsz,wght@9..144,400;9..144,600&display=swap" />
      <div style={{ padding: "20px 28px 0", borderBottom: `1px solid ${COLORS.hairline}` }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, letterSpacing: "0.02em" }}>Leverage</span>
          <span style={{ color: COLORS.textMuted, fontSize: 14 }}>Level 2 · Structured Productivity — prototype</span>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ background: "none", border: "none", borderBottom: activeTab === t.key ? `2px solid ${COLORS.strategic}` : "2px solid transparent", color: activeTab === t.key ? COLORS.text : COLORS.textMuted, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: 1, background: COLORS.hairline, minHeight: 0 }} className="leverage-columns">
        <div style={{ flex: "1 1 480px", background: COLORS.bg, padding: "24px 28px", overflowY: "auto" }}>
          {activeTab === "attention" && (
            <TimeAssessment entries={entries} form={form} setForm={setForm} formError={formError} setFormError={setFormError} addEntry={addEntry} removeEntry={removeEntry} byType={byType} totalHours={totalHours} runGapReview={runGapReview} loading={loading} />
          )}
          {activeTab === "sort" && (
            <PlanningMonitoring items={mindSweepItems} sweepCategory={sweepCategory} setSweepCategory={setSweepCategory} sweepText={sweepText} setSweepText={setSweepText}
              captureItem={captureItem} addSubTask={addSubTask} removeItem={removeItemCascade} answerItem={answerItem} updateField={updateField} checkItemNow={checkItemNow} resetItem={resetItem} runSortReview={runSortReview} loading={loading} />
          )}
        </div>

        <div style={{ flex: "1 1 380px", background: COLORS.panel, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "18px 24px 8px", color: COLORS.textMuted, fontSize: 13, letterSpacing: "0.02em", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Coach thread — follows you across all of Level 2</span>
            <button onClick={runInsight} disabled={loading} style={{ ...btnStyle(COLORS.panelRaised), color: COLORS.strategic, border: `1px solid ${COLORS.strategic}`, fontSize: 11, padding: "4px 10px" }}>✦ Best insight</button>
          </div>
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "0 24px", display: "flex", flexDirection: "column", gap: 14 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", background: m.role === "user" ? COLORS.strategic : COLORS.panelRaised, color: m.role === "user" ? "#1C1B19" : COLORS.text, padding: "10px 14px", borderRadius: 4, fontSize: 14, lineHeight: 1.5 }}>{m.content}</div>
            ))}
            {loading && <div style={{ alignSelf: "flex-start", color: COLORS.textFaint, fontSize: 13, padding: "6px 0" }}>Coach is reviewing…</div>}
            {error && <div style={{ color: COLORS.reactive, fontSize: 13, padding: "6px 0" }}>{error}</div>}
          </div>
          <div style={{ display: "flex", gap: 8, padding: 20, borderTop: `1px solid ${COLORS.hairline}` }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendTyped()} placeholder="Tell the coach about an entry, or ask a question…" style={inputStyle({ flex: 1 })} />
            <button onClick={sendTyped} disabled={loading} style={btnStyle(COLORS.strategic)}>Send</button>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 820px) { .leverage-columns { flex-direction: column; } }`}</style>
    </div>
  );
}

// ================= Time Assessment =================
function TimeAssessment({ entries, form, setForm, formError, setFormError, addEntry, removeEntry, byType, totalHours, runGapReview, loading }) {
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
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", width: "100%", height: 28, borderRadius: 3, overflow: "hidden", background: COLORS.panelRaised }}>
          {totalHours === 0 ? <div style={{ flex: 1 }} /> : byType.filter((t) => t.hrs > 0).map((t) => (
            <div key={t.type} style={{ width: `${t.pct}%`, background: TYPE_COLOR[t.type] }} title={`${t.type}: ${t.pct.toFixed(1)}%`} />
          ))}
        </div>
        <div style={{ fontSize: 12, color: COLORS.textFaint, marginTop: 6 }}>{totalHours.toFixed(1)} hours logged</div>
      </div>
      <div style={{ marginBottom: 28 }}>
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
      <SectionLabel>Section 3 · Gap Analysis</SectionLabel>
      <button onClick={runGapReview} disabled={totalHours === 0 || loading} style={{ ...btnStyle(COLORS.panelRaised), color: COLORS.text, border: `1px solid ${COLORS.hairline}`, opacity: totalHours === 0 ? 0.5 : 1, cursor: totalHours === 0 ? "not-allowed" : "pointer" }}>Send to coach for review</button>
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

function ItemRow({ item, items, depth, addSubTask, removeItem, answerItem, updateField, checkItemNow, resetItem, showBreadcrumb }) {
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
                <input placeholder="Waiting on whom" value={item.waitingOnWhom} onChange={(e) => updateField(item.id, { waitingOnWhom: e.target.value })} onBlur={() => checkItemNow(item.id)} style={inputStyle({ fontSize: 12, padding: "4px 8px", width: 120 })} />
                <span style={{ fontSize: 11, color: COLORS.textFaint }}>Follow up by</span>
                <input type="date" value={item.checkDate} onChange={(e) => updateField(item.id, { checkDate: e.target.value })} onBlur={() => checkItemNow(item.id)} style={inputStyle({ fontSize: 12, padding: "4px 8px" })} />
              </>
            )}

            {bucket === "Calendar" && (
              <>
                <input type="date" value={item.scheduledDate} onChange={(e) => updateField(item.id, { scheduledDate: e.target.value })} onBlur={() => checkItemNow(item.id)} style={inputStyle({ fontSize: 12, padding: "4px 8px" })} />
                <input type="time" value={item.scheduledTime} onChange={(e) => updateField(item.id, { scheduledTime: e.target.value })} onBlur={() => checkItemNow(item.id)} style={inputStyle({ fontSize: 12, padding: "4px 8px" })} />
              </>
            )}

            {bucket === "Next Action" && (
              <>
                <span style={{ fontSize: 11, color: COLORS.textFaint }}>Deadline</span>
                <input type="date" value={item.deadline} onChange={(e) => updateField(item.id, { deadline: e.target.value })} onBlur={() => checkItemNow(item.id)} style={inputStyle({ fontSize: 12, padding: "4px 8px" })} />
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
        <ItemRow key={c.id} item={c} items={items} depth={depth + 1} addSubTask={addSubTask} removeItem={removeItem} answerItem={answerItem} updateField={updateField} checkItemNow={checkItemNow} resetItem={resetItem} showBreadcrumb={false} />
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

function PlanningMonitoring({ items, sweepCategory, setSweepCategory, sweepText, setSweepText, captureItem, addSubTask, removeItem, answerItem, updateField, checkItemNow, resetItem, runSortReview, loading }) {
  const [subTab, setSubTab] = useState("overview");

  const overviewItems = items.filter((i) => homeTab(i) === "overview");
  const projectPool = items.filter((i) => homeTab(i) === "projectPlanning");
  const projectTopLevel = projectPool.filter((i) => !i.parentId || homeTab(items.find((p) => p.id === i.parentId) || {}) !== "projectPlanning");
  const calendarItems = items
    .filter((i) => homeTab(i) === "calendar")
    .sort((a, b) => {
      const ka = deriveBucket(a) === "Calendar" ? `${a.scheduledDate}T${a.scheduledTime}` : `${a.deadline}T99:99`;
      const kb = deriveBucket(b) === "Calendar" ? `${b.scheduledDate}T${b.scheduledTime}` : `${b.deadline}T99:99`;
      return ka.localeCompare(kb);
    });
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
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            <input placeholder="What's on your mind…" value={sweepText} onChange={(e) => setSweepText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && captureItem()} style={inputStyle({ flex: 1 })} />
            <button onClick={captureItem} style={btnStyle(COLORS.strategic)}>Capture</button>
          </div>

          <SectionLabel>Guided Sort</SectionLabel>
          {overviewItems.length === 0 && <div style={{ color: COLORS.textFaint, fontSize: 14, padding: "8px 0" }}>Nothing captured yet, or everything captured has moved to its own tab.</div>}
          <div style={{ marginBottom: 20 }}>
            {overviewItems.map((item) => (
              <ItemRow key={item.id} item={item} items={items} depth={0} addSubTask={addSubTask} removeItem={removeItem} answerItem={answerItem} updateField={updateField} checkItemNow={checkItemNow} resetItem={resetItem} showBreadcrumb={false} />
            ))}
          </div>
          <button onClick={runSortReview} disabled={items.length === 0 || loading} style={{ ...btnStyle(COLORS.panelRaised), color: COLORS.text, border: `1px solid ${COLORS.hairline}`, opacity: items.length === 0 ? 0.5 : 1, cursor: items.length === 0 ? "not-allowed" : "pointer" }}>
            Send whole sort to coach for review
          </button>
        </>
      )}

      {subTab === "projectPlanning" && (
        <>
          <SectionLabel>Project Planning</SectionLabel>
          {projectTopLevel.length === 0 && <div style={{ color: COLORS.textFaint, fontSize: 14, padding: "8px 0" }}>No projects yet — items resolved as "Project" in the Overview sort will appear here to be broken into single steps.</div>}
          {projectTopLevel.map((item) => (
            <ItemRow key={item.id} item={item} items={projectPool} depth={0} addSubTask={addSubTask} removeItem={removeItem} answerItem={answerItem} updateField={updateField} checkItemNow={checkItemNow} resetItem={resetItem} showBreadcrumb={false} />
          ))}
        </>
      )}

      {subTab === "calendar" && (
        <CalendarTab calendarItems={calendarItems} items={items} updateField={updateField} checkItemNow={checkItemNow} />
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
                    <input placeholder="Waiting on whom" value={i.waitingOnWhom} onChange={(e) => updateField(i.id, { waitingOnWhom: e.target.value })} onBlur={() => checkItemNow(i.id)} style={inputStyle({ fontSize: 12, padding: "4px 8px", width: 130 })} />
                    <span style={{ fontSize: 11, color: COLORS.textFaint }}>Follow up by</span>
                    <input type="date" value={i.checkDate} onChange={(e) => updateField(i.id, { checkDate: e.target.value })} onBlur={() => checkItemNow(i.id)} style={inputStyle({ fontSize: 12, padding: "4px 8px" })} />
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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Parses a "YYYY-MM-DD" string into {y, m, d} without going through Date/timezone
// conversion, so a date typed as the 14th never silently becomes the 13th.
function parseYMD(str) {
  if (!str) return null;
  const parts = str.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return { y: parts[0], m: parts[1] - 1, d: parts[2] };
}

function itemDate(item) {
  const bucket = deriveBucket(item);
  if (bucket === "Calendar") return parseYMD(item.scheduledDate);
  if (bucket === "Next Action") return parseYMD(item.deadline);
  if (bucket === "Waiting On") return parseYMD(item.checkDate);
  return null;
}

function CalendarTab({ calendarItems, items, updateField, checkItemNow }) {
  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  // The grid pulls from every item with a temporal marker — Calendar,
  // Next Action, and Waiting On alike — even though Waiting On items are
  // still edited over on their own tab. This is a reminder view, not a
  // second place to manage them.
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
      <SectionLabel>Set the date &amp; time</SectionLabel>
      {calendarItems.length === 0 ? (
        <div style={{ color: COLORS.textFaint, fontSize: 14, padding: "8px 0", marginBottom: 24 }}>Nothing here yet — Calendar items and Next Actions land here once sorted.</div>
      ) : (
        <div style={{ marginBottom: 28 }}>
          {calendarItems.map((i) => {
            const bucket = deriveBucket(i);
            const parent = i.parentId ? items.find((p) => p.id === i.parentId) : null;
            const flags = sortFlagsFor(i);
            return (
              <div key={i.id} style={{ padding: "8px 0", borderBottom: `1px solid ${COLORS.hairline}` }}>
                {parent && <div style={{ fontSize: 11, color: COLORS.textFaint, marginBottom: 2 }}>sub-task of project: {parent.text}</div>}
                <div style={{ display: "flex", gap: 10, fontSize: 13, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ flex: 1 }}>{i.text}</span>
                  <span style={{ color: BUCKET_COLOR[bucket], fontSize: 11 }}>{bucket}</span>
                  {bucket === "Calendar" ? (
                    <>
                      <input type="date" value={i.scheduledDate} onChange={(e) => updateField(i.id, { scheduledDate: e.target.value })} onBlur={() => checkItemNow(i.id)} style={inputStyle({ fontSize: 12, padding: "4px 8px" })} />
                      <input type="time" value={i.scheduledTime} onChange={(e) => updateField(i.id, { scheduledTime: e.target.value })} onBlur={() => checkItemNow(i.id)} style={inputStyle({ fontSize: 12, padding: "4px 8px" })} />
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 11, color: COLORS.textFaint }}>Deadline</span>
                      <input type="date" value={i.deadline} onChange={(e) => updateField(i.id, { deadline: e.target.value })} onBlur={() => checkItemNow(i.id)} style={inputStyle({ fontSize: 12, padding: "4px 8px" })} />
                    </>
                  )}
                </div>
                {flags.length > 0 && <div style={{ color: COLORS.reactive, fontSize: 12, marginTop: 4 }}>{flags[0]}</div>}
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
                    <div key={it.id} title={it.text} style={{ fontSize: 10, color: BUCKET_COLOR[b], borderLeft: `2px solid ${BUCKET_COLOR[b]}`, paddingLeft: 4, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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

function SectionLabel({ children }) {
  return <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, color: COLORS.textMuted, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${COLORS.hairline}` }}>{children}</div>;
}
function inputStyle(extra) {
  return { background: COLORS.panelRaised, border: `1px solid ${COLORS.hairline}`, color: COLORS.text, padding: "8px 10px", borderRadius: 3, fontSize: 14, fontFamily: "inherit", outline: "none", ...extra };
}
function btnStyle(bg) {
  return { background: bg, color: "#1C1B19", border: "none", padding: "8px 16px", borderRadius: 3, fontSize: 14, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" };
}
