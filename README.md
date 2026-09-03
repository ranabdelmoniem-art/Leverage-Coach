# Leverage — Time Management Training App (Levels 2-4)

A pure client-side React app covering Levels 2, 3, and 4 of "Leverage," a
time management training for managers. No backend, no API key, no server
of any kind — the whole app is static files served by Vercel.

Deployed from this repo at `ranabdelmoniem-art/Leverage-Coach`, with a QR
code in the physical planner pointing at the live Vercel URL. Pushing to
`main` here triggers Vercel to rebuild and redeploy automatically — the
live URL and QR code never need to change as the app grows.

## App structure

Four top-level tabs, in this display order: **About Me, Level 2, Level 3,
Level 4**. The app opens on **Level 2** by default.

### Level 2: Structured Productivity
- **Time Assessment** — Activity Log → Attention Map, based on the ETAM
  classification workflow. Fully deterministic.
- **Planning and Monitoring** — guided GTD-style sort (Actionable/Non-
  Actionable, the 2-minute rule, Project decomposition into sub-tasks,
  Calendar/Waiting On/Next Action routing). Mind-sweep capture takes an
  optional ETAM type + hours per item, which feeds About Me's Time
  Allocation view (not the Time Assessment Activity Log).
- Every date field across the app (Calendar sub-tab and elsewhere) uses a
  custom-built `DateField` popover component rather than a native
  `<input type="date">`, since native pickers rendered inconsistently
  across the deployment environment.

### Level 3: Strategic Time Management
- **Strategic Attention & Leak Score** — a "Three Layers of Strategic
  Shifting" diagram, then time-consuming tasks (no cap on count), each
  scored via a one-question-at-a-time flow across 6 questions, producing a
  Leverage Score and Leak Score plotted on a 2x2 quadrant, with a
  deterministic written explanation. Tasks can be auto-filled from Level
  2's captures (button-triggered, never silent/automatic).
- **RACI Audit** — every Next Action from Level 2 gets tagged
  R/A/C/I; computes the Responsible/Accountable vs. Consulted/Informed
  split.
- **Attentional Identity** — a dropdown of 5 fixed identities
  (Opportunist, Diplomat, Expert, Achiever, Strategist), each showing a
  card with attention style, strategic strength, Q2 blind spot, RACI
  tendencies, delegation pattern, and a development move. This choice is
  the single source of truth, mirrored (not duplicated) in About Me.

### Level 4: Time Leverage and Systems Design
One exercise: Self Determination Theory.
- 5 fixed situation rows, each classified by dependency type
  (Decision/Direction/Competence/Motivation/Coordination) and, separately,
  by SDT root cause (Autonomy/Competence/Relatedness) — two distinct
  classification steps.
- "People Motivation Action Plan": a reflection question per root cause
  plus a 5-item actionable checklist per root cause.

### About Me
Read-only dashboard, mirrors state from elsewhere — not a data-entry
point:
- **Time Allocation** — from Level 2's Planning & Monitoring captures.
- **Strategic Attention Pattern** — quadrant counts from Level 3.
- **Delegation Reality (RACI)** — % breakdown from Level 3.
- **Attentional Identity** — mirrors the Level 3 selection.
- **Dependency Tendency (SDT)** — tallies from Level 4's 5 situations.

## Local development

```bash
npm run install:all   # installs frontend deps
npm run dev           # Vite dev server at http://localhost:5173
```

## Deploying

Already set up on Vercel, building automatically from `main`:

```bash
git add .
git commit -m "..."
git push
```

`vercel.json` points Vercel at `frontend/` for both the build command and
output directory — no environment variables or serverless functions are
needed anymore.

## Known limitations

- Level 3's auto-fill and Level 4's situations don't track duration/hours
  the way Time Assessment does — some About Me percentages are item-count
  or hours-if-provided based, not fully rigorous time accounting.
- The custom `DateField` popover hasn't been tested across every mobile
  browser — worth a dedicated QA pass on phones (viewport edge clipping,
  touch event quirks are the most likely failure modes for a hand-rolled
  popover).

## If the AI coach ever comes back

An earlier version of this app called the Anthropic API for an AI coach
feature. That required a backend proxy (never safe to call the API with a
real key directly from the browser) and has been removed entirely per a
later decision — there is currently no coach, no backend, and no API key
anywhere in this project. Re-adding it would mean re-introducing a small
backend (Express server or Vercel serverless function) to hold the API key
server-side, same as before.
