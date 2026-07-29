# QA: Local Dominance & AI Visibility Engine

Cost-aware testing runbook. Prefer UI/mock layers first; burn live API only for smoke + accuracy samples.

**Budget while testing (soft caps)**

| Module | Soft weekly test budget |
|--------|-------------------------|
| Local Dominance | ≤ 2–3 × **3×3** Geogrid runs (~$0.10–0.15) |
| AI Visibility (once live) | ≤ 5–10 single-prompt syncs (~$0.25–0.50) |
| Combined | ~$1–2/week for feature QA |

**Do not** use 7×7 grids or 30–50 prompt syncs as smoke tests.

---

## Test fixture (fill before Phase B)

| Field | Value |
|-------|-------|
| Keyword | air con service |
| Manual GPS (lat,lng) | 3.172515, 101.696987 (auto-detected → Titiwangsa / KL) |
| Business name | Ac Cool N Cool Engineering Aircond service |
| Business CID (if known) | |
| Platform | Google |
| Grid for smoke | **3×3** |
| OpenAI / SAIV | No → SAIV 0% expected |
| AI Visibility dev prompts (3–5) | _list when live_ |

**Paid run log (2026-07-22):** 3×3 Google · ~5 credits · SoLV **11.1%** · SAIV **0%** · center cell #1 · pass (see B1)

---

## Phase A — Zero cost (UI / mock)

### A1. AI Visibility Engine (mock vault — $0 API)

Route: `/ai-visibility`

| # | Check | Pass? | Notes |
|---|--------|-------|-------|
| A1.1 | Page loads; no console error / infinite re-render | ☐ | |
| A1.2 | Snapshot cards render (citation share, clusters, top-3, competitor delta) | ☐ | |
| A1.3 | Sync status + credits counter visible (demo values OK) | ☐ | |
| A1.4 | Filters: search, cluster, engine, device, geo, citation status | ☐ | |
| A1.5 | ChatGPT Live vs Base Knowledge; Base Knowledge opens credit modal | ☐ | Confirm modal only — no real charge yet |
| A1.6 | RAG mutual exclusion: Google AIO / Perplexity show N/A when Base Knowledge | ✅ | Manual: Base Knowledge → **N/A – RAG Only** on Google AIO; Live Web restores Cited |
| A1.7 | Matrix virtualizes; sticky Prompt column; horizontal scroll if needed | ☐ | |
| A1.8 | Force Sync on one row → background syncing → completes without crash | ✅ | Background Syncing + toast **Force sync queued** after Sonner singleton fix |
| A1.9 | Optimization action dropdown / deep-links open without portal clipping | ✅ | Menu opens (portal); e.g. Open PR / Entity Module, Run AEO Gap Analysis |
| A1.10 | Light + dark theme readable | ✅ | Light + dark (`html.dark`, body bg ~rgb(10,10,10)) readable |
| A1.11 | Mobile / narrow viewport usable | ✅ | 390×844: hamburger nav; filters + matrix (matrix needs horiz scroll @ 1440 min) |

#### Seed Workspace (Prompt Onboarding)

| # | Check | Pass? | Notes |
|---|--------|-------|-------|
| A1.12 | Open Seed Workspace modal; close without hang | ☐ | |
| A1.13 | Auto-Discover tab: start/stop; staging rows append | ☐ | Demo SSE OK |
| A1.14 | GSC tab: import flow; staging append | ☐ | |
| A1.15 | CSV tab: valid CSV → rows; bad CSV → clear errors | ☐ | |
| A1.16 | Capacity ceiling: cannot exceed 100 staging rows | ☐ | |
| A1.17 | Cost calculator updates with selection / engines / frequency | ☐ | Estimate only |
| A1.18 | Bulk edit + commit; dual handoff toasts (Matrix / Article Studio) | ☐ | |
| A1.19 | After commit, matrix reflects new prompts (or expected mock behavior) | ☐ | |

### A2. Local Dominance UI (no Geogrid Run — $0 API)

Route: `/dashboard/local-dominance`

| # | Check | Pass? | Notes |
|---|--------|-------|-------|
| A2.1 | Page loads; tabs switch (Geogrid / Service Area / Review-Citation as present) | ✅ | Geogrid Intel · Service Area Factory · Review & Citation Hub |
| A2.2 | Geogrid form: keyword, GPS, radius, grid size, platform, business fields | ✅ | All fields present; keyword + GPS fill OK |
| A2.3 | Empty keyword → validation error; **do not** click Run yet | ✅ | Code: early `toast.error('Enter a target keyword')` before fetch; Run click skipped (no paid path) |
| A2.4 | Grid size labels show credit costs (3→5, 5→12, 7→25) | ✅ | Dropdown: 3×3 (5) · 5×5 (12) · 7×7 (25) |
| A2.5 | History / past audits load if any exist | ✅ | Empty state: “No audits yet…” (history API needs auth; unsigned → empty) |
| A2.6 | Empty heatmap / empty state copy sensible before first run | ✅ | No heatmap until result; history empty copy OK |
| A2.7 | Citation / Review / Service Area UIs open; **do not** fire paid actions yet | ✅ | Service Area + Review/Citation forms open; Generate / Run Citation **not** clicked |
| A2.8 | Light + dark theme; mobile usable | ✅ | Dark theme OK; form/tabs usable; history empty when unsigned |
| A2.9 | Settings: DataForSEO (+ optional LLM) keys present **before** Phase B | ⚠️ | Env: `DATAFORSEO_LOGIN/PASSWORD` + `GEMINI_API_KEY` set. Settings UI redirected to Sign-in. No `OPENAI`/`PERPLEXITY` in `.env.local` — confirm workspace AI keys before Phase B if SAIV needed |

---

## Phase B — Cheap live smoke (Local Dominance only)

**Prerequisite:** Phase A pass · fixture filled · credentials OK · you approve the paid run.

### B1. One 3×3 Geogrid (~5 credits · ~$0.03–0.04)

| Setting | Required value |
|---------|----------------|
| Grid | **3×3** |
| Platform | Google |
| Central GPS | **Manual** lat,lng (skip auto-resolve) |
| Keyword + business | From fixture |

| # | Check | Pass? | Notes |
|---|--------|-------|-------|
| B1.1 | Run completes without 500 / empty-all failure | ✅ | Manual browser run completed; scores + heatmap rendered |
| B1.2 | ≥1 cell has map pack data | ✅ | Center (1,1) + corner (0,0) both show top-3 packs |
| B1.3 | SoLV / SAIV render as numbers (not stuck loading) | ✅ | SoLV **11.1%** (1/9); SAIV **0%** (no OpenAI) |
| B1.4 | Heatmap paints; cell click shows map pack | ✅ | Center green **#1**; other cells **—** (target unranked); clicks open packs |
| B1.5 | Audit appears in history | ✅ | Sidebar shows `air con service` 3×3 · SoLV 11.1% · SAIV 0% · 7/22/2026 |
| B1.6 | **Manual accuracy:** pick 2 cells → Google Maps at those coords + keyword → top-3 roughly matches app | ✅ | Auto GPS **accurate** (see below). Center pack = Ac Cool #1; corner (0,0) = competitors only — consistent with SoLV 11.1% |
| B1.7 | Log paid run in fixture notes above | ✅ | Logged 2026-07-22 |

### B2. Optional 5×5 (only if denser SoLV needed)

| # | Check | Pass? | Notes |
|---|--------|-------|-------|
| B2.1 | Explicit approval before run | ✅ | User ran manually (dashboard) |
| B2.2 | Run + spot-check 2 cells | ✅ | 5×5 · SoLV **8%** · SAIV **0%** (pre-quota); heatmap 2× #1 cells; map packs OK (e.g. center / adjacent). Post-quota SAIV verified on later **3×3** (55.6%) |

**Skip during QA:** 7×7 · Bing dual runs · Service Area multi-city · Citation audit spam · Review reply spam.

---

## Phase C — AI Visibility live (after APIs wired)

**Status (2026-07-23):** Live Force Sync wired for **Perplexity · ChatGPT · Claude**. Google AIO deferred (row value preserved). Auth required. Credits: **1 / engine** when master keys are used.

| Engine | Key | Live? |
|--------|-----|-------|
| ChatGPT | `OPENAI_API_KEY` / Settings → AI | ✅ |
| Claude | `ANTHROPIC_API_KEY` / Settings → AI | ✅ |
| Perplexity | `PERPLEXITY_API_KEY` / Settings → AI | ✅ |
| Google AIO | — | ❌ deferred |

| # | Check | Pass? | Notes |
|---|--------|-------|-------|
| C1 | Dev set: **3–5 prompts** only (not full production set) | ☐ | Use mock vault row or seeded prompt |
| C2 | Smoke: **1 prompt** with keys present (OpenAI-only OK → Claude/Pplx → sync_failed) | ☐ | Missing key → **Sync Failed**, not fake Cited |
| C3 | Smoke: **1 prompt × 3 live engines** (OpenAI + Anthropic + Perplexity) | ☐ | ~3 credits if master keys · Google AIO unchanged |
| C4 | Manual verify answers in ChatGPT / Perplexity / Claude | ☐ | |
| C5 | Force Sync one row; credits deduct as designed | ☐ | Toast: **Force sync complete** |
| C6 | Missing-key UX: unconfigured engine shows Sync Failed | ☐ | Implemented |
| C7 | Scale prompt count **last** | ☐ | |

**Do not** burn a full-matrix sync during QA.

---

## Phase D — Guardrails (optional engineering)

| # | Item | Status |
|---|------|--------|
| D1 | Warn or block 7×7 / large sync in non-prod | ☐ |
| D2 | `TEST_MODE` or env cap on grid size / prompt sync count | ☐ |
| D3 | Capture one real Maps JSON fixture for parser / SoLV regression | ☐ |

---

## Pass criteria (summary)

| Phase | Done when |
|-------|-----------|
| A | No console crashes; filters/modals/onboarding behave; LD forms validate without Run |
| B | One 3×3 succeeds; 2 cells manually verified |
| C | 1–5 prompts live-verified; no full-matrix burn during QA |
| D | Optional; reduce accidental spend |

---

## Session log

| Date | Phase / step | Paid? | Result | Notes |
|------|--------------|-------|--------|-------|
| 2026-07-22 | Step 2 · Phase A1 AI Visibility | No | Partial pass | See findings below |
| 2026-07-22 | Capacity fix (Seed) | No | ✅ | Mock vault 240→40; remaining≈62; Discover staged 7/62 |
| 2026-07-22 | Finish Seed A1.14–19 | No | ✅ / notes | GSC→15, CSV→17, commit 15 eligible; matrix shows committed row |
| 2026-07-22 | Seed polish fixes | No | ✅ | CSV geo resolve; split ingest/commit flags; post-commit matrix auto-reload |
| 2026-07-22 | **Step 2 recheck** (post-fix) | No | ✅ Pass | Seed + polish re-verified in browser; ready for Step 3 |
| 2026-07-22 | **Step 3 · Phase A2 Local Dominance UI** | No | ✅ Pass | Tabs/forms/credits OK; no Geogrid/Citation/Service Area paid actions |
| 2026-07-22 | **Phase B1 · 3×3 Geogrid** | Yes (~5 cr) | ✅ Pass | air con service · Ac Cool N Cool · SoLV 11.1% · SAIV 0% · center #1 |
| 2026-07-22 | **Free polish** (A1.6/8–11, A2.8) | No | ✅ | Dropdown/theme/mobile/A1.6 ✅; Sonner toast fixed (window singleton) |
| 2026-07-23 | **Phase B2 · 5×5 Geogrid** | Yes (~12 cr) | ✅ Pass | air con service · SoLV **8%** · SAIV **0%** (OpenAI quota not yet); 2 cells #1 on heatmap |
| 2026-07-23 | **SAIV recheck (3×3)** | Yes (~5 cr + OpenAI) | ✅ Pass | After OpenAI billing: SoLV 11.1% · **SAIV 55.6%** · AI Visible rings |
| 2026-07-23 | **Live AI Visibility adapters** | No (wire only) | ✅ Wired | Force Sync → Perplexity/ChatGPT/Claude; Google AIO deferred; Phase C smoke pending keys |

### Phase B1 findings (manual browser)

| Observation | Detail |
|-------------|--------|
| Center GPS | 3.172515, 101.696987 (KL / Titiwangsa) |
| SoLV | **11.1%** = target top-3 in **1 of 9** cells |
| SAIV | **0%** — expected (OpenAI off) |
| Cell (1,1) | Ac Cool N Cool **#1** · Rehan #2 · Kingway #3 |
| Cell (0,0) | Target **not** in top 3 (My Air Conditioning / Three Bro's / Jensen) — heatmap shows **—** |
| Heatmap | Center green #1; 8 cells dashed = target unranked there (packs may still exist) |
| History | ✅ Sidebar lists this audit + older plumber runs |
| Auto GPS accuracy | ✅ `3.172515, 101.696987` matches **91A Jalan Pekeliling Lama, Titiwangsa** (listing coords ≈ identical) |

### Step 2 findings (AI Visibility Phase A)

| # | Result | Notes |
|---|--------|-------|
| A1.1 | ✅ | Page loads at `/ai-visibility`; no infinite re-render on Seed open |
| A1.2 | ✅ | Recheck: 54.6% / 6 / 83 / +26.6 pts |
| A1.3 | ✅ | Synced + Credits 1,842 / 5,000 |
| A1.4 | ✅ | Filters present (engines, device, live/base, geo, status, clusters, search) |
| A1.5 | ✅ | Recheck: Base Knowledge opens credit modal (~12 credits); Stay on Live Web |
| A1.6 | ✅ | Manual confirm: Base Knowledge → Google AIO **N/A – RAG Only**; Live Web → Cited again |
| A1.7 | ✅ | Matrix rows + virtualized list visible |
| A1.8 | ✅ | Force Sync → Background Syncing + Sonner toast (singleton bridge fix 2026-07-22) |
| A1.9 | ✅ | More optimization actions opens; menuitems visible (no clipping) |
| A1.10–11 | ✅ | Light + dark readable; mobile 390×844 hamburger + filters; matrix horiz-scroll by design (min 1440) |
| A1.12 | ✅ | Seed Workspace opens; closes; **no** max-update-depth loop |
| A1.13 | ✅ | Recheck: Discover → Staging **7/62** |
| A1.14 | ✅ | Recheck: GSC Connect → Import → **15/62**; during **Translating…** Commit stayed **Commit to Visibility Engine** (not Committing…) |
| A1.15 | ✅ | Recheck: CSV with `"Seattle, WA"` / `US - National` / `"Austin, TX"` → geos resolved; Staging **18/62** |
| A1.16 | ✅ | Ceiling still 62 (&lt;100); capacity math intact |
| A1.17 | ✅ | Recheck: Select **18/18** → Est. Monthly Sync Cost **310** credits |
| A1.18 | ✅ | Recheck: Commit showed **Committing…** only during commit; modal closed |
| A1.19 | ✅ | Recheck: matrix top rows include `qa recheck austin roof` / `qa recheck national hvac` / `qa recheck seattle plumber` **without Refresh** |

**Polish fixes re-verified (2026-07-22 recheck):**

1. **CSV location resolve** — `Seattle, WA`, `US - National`, `Austin, TX` all resolved; included in Select-all 18/18.  
2. **Shared processing flag** — GSC Translating… does **not** flip Commit label; only real commit shows Committing….  
3. **Post-commit matrix** — committed rows prepend/appear immediately; no Refresh required.

### Step 3 findings (Local Dominance Phase A2)

| # | Result | Notes |
|---|--------|-------|
| A2.1 | ✅ | `/dashboard/local-dominance` loads; 3 tabs switch |
| A2.2 | ✅ | Keyword, GPS, radius 5, grid, Google/Bing, business name/CID, schedule |
| A2.3 | ✅ | Validation early-return in code; Run not clicked (guarded) |
| A2.4 | ✅ | 3→5 · 5→12 · 7→25 credits in grid dropdown |
| A2.5 | ✅ | History empty copy; auth required for list API |
| A2.6 | ✅ | No heatmap until audit result |
| A2.7 | ✅ | Service Area + Review/Citation UIs open; paid buttons not fired |
| A2.8 | ✅ | Dark theme + narrow viewport smoke; Geogrid form readable |
| A2.9 | ⚠️ | DataForSEO + Gemini in env; Settings needs Sign-in; OpenAI/Perplexity not in env |

### Free polish findings (2026-07-22)

| Check | Result | Notes |
|-------|--------|-------|
| A1.9 Opt dropdown | ✅ | Portal menu: Open PR / Entity Module · Run AEO Gap Analysis |
| A1.8 Force Sync | ✅ | Toast + Background Syncing after Sonner window singleton fix |
| A1.6 RAG N/A | ✅ | Manual screenshots: Base Knowledge → N/A – RAG Only; Live Web → Cited |
| A1.10–11 Theme/mobile | ✅ | AI Visibility light/dark + 390px OK |
| A2.8 Theme/mobile | ✅ | Local Dominance dark OK |

**Still open (non-blocking):** Phase C N/A until live AI Visibility · optional Citation/Service Area paid actions.

---

*Phases A + B1 + B2 + SAIV complete. Optional next: Phase C (live AI Visibility) or wrap.*
