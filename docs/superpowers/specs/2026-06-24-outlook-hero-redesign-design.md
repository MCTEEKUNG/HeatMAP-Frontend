# Design: Outlook-first Hero Redesign + Model Track Record

Date: 2026-06-24
Status: Approved (brainstorm) — implementing

## Goal

Reposition the app so the **S2S sub-seasonal model is the visible star**, while
staying genuinely useful for daily public use. Two audiences, one app:

- **Public** — "what's the heat outlook for my area over the next 4 weeks?"
- **Committee** — "this AI model has real, validated skill, proven over the
  months it has been running."

This corrects the previous design where the full-screen map made the S2S
forecast look like a secondary tab and foregrounded a single Week-1 number.

## Chosen direction (B + light C)

The hero becomes a **4-week outlook for the user's province**, rendered as a
stack of card blocks; the national map drops to a supporting, expandable card.
A model-trust badge links to a dedicated **accuracy / track-record** screen.

### Screen layout (home) — top to bottom, all card blocks

1. **Header** — "พื้นที่ของคุณ · <province>" + "ข้อมูล ณ <generated_at, BKK>".
2. **Outlook card (HERO)** — `OutlookChart`: a 4-node trend for the user's
   province (W1→W4). Each node: colored dot (HeatRisk level), value
   (°C for live / % for S2S), week label + Bangkok date range, source tag
   (สด = Open-Meteo / S2S). Nodes are positioned by risk height and connected
   by line segments so the trend reads at a glance. The selected node is ringed.
3. **Model badge** — "ⓘ โมเดล S2S · พยากรณ์ล่วงหน้า 2-4 สัปดาห์" + "ดูความแม่นยำ ›"
   link to the accuracy screen.
4. **Detail card** — reuse existing `RiskGauge` for the *selected* week
   (value + band chip + 5-level scale with marker + metric footnote) plus the
   plain-language guidance line and "ดูวิธีรับมือ" CTA.
5. **Map card** — `MapGrid` inside a card at reduced height. A single ⤢ control
   expands it to a full-screen overlay (week pills + province selection + close
   ×). Collapse returns to the card.

### Rolling-window semantics (confirmed)

The outlook graph is **redrawn each load** from "today" (Bangkok). It is NOT a
continuous appended history — the 4-week window slides forward and each calendar
week is re-forecast with a shorter lead as it approaches (more accurate),
handing off to Open-Meteo when it becomes the current week. The "past vs actual"
history is a separate track-record view (below), not an extension of this graph.

## Accuracy / Track-record screen (the committee proof)

A dedicated screen (route `/accuracy`, reachable from the model badge):

- **Headline skill** — Brier Skill Score vs climatology baseline (BSS > 0 = real
  skill). Shown with a plain-language gloss.
- **Week-by-week track record** — a strip of past weeks (hit / near / miss),
  shown transparently including misses.
- **Calibration** — predicted-probability vs observed-frequency mini chart.
- **Per-lead skill** — lead 2 / 3 / 4 bars (honest about which horizon is
  strongest).
- All numbers come from real scoring; never claim "always correct".

### Data dependency (phasing)

The track-record needs a published verification dataset. The backend already
has the pieces in `DeepSeek_Heatwave/scripts/verify/` (`archive.py` stores past
forecasts; `run_backtest.py` / `score_operational.py` score them). Phase 2 adds
a workflow step that publishes `verification.json` next to the contract; the
frontend fetches it and renders the screen. If the file is absent, the screen
shows an honest "track record building — back soon" state.

**Phasing:**
- **v1 (this change):** frontend home redesign (Outlook hero, detail, map card,
  model badge) + accuracy screen scaffold that reads `verification.json` if
  present, else a graceful empty state. No invented numbers.
- **v1.5:** backend publishes `verification.json`; accuracy screen lights up.

## Components / files

New (frontend):
- `components/map/OutlookChart.tsx` — View-based 4-week trend (no SVG dep:
  measured `onLayout` width → absolute dots + rotated line segments). Props:
  `weeks: OutlookPoint[]`, `selectedWeek`, `onSelect`.
- `components/map/ModelBadge.tsx` — trust badge + accuracy link.
- `app/accuracy.tsx` — track-record screen (reads `verification.json`).

Changed (frontend):
- `services/forecastService.ts` — add `getProvinceOutlook(provinceId, provinces)`
  returning the user's province point for weeks 1-4 (value, level, source,
  date range). Add `OutlookPoint` type. Add `loadVerification()` (fetch
  `verification.json`, tolerate 404).
- `app/(tabs)/map.tsx` — restructure to the card stack; add `mapExpanded` state;
  reuse `RiskGauge`; mount `OutlookChart` + `ModelBadge`. Keep `selectedWeek`.
- `components/map/WeekSegmentedControl.tsx` — retained only inside the expanded
  full-map overlay (week pills); home uses the OutlookChart for selection.

Backend (phase 1.5, separate change):
- `DeepSeek_Heatwave/.github/workflows/forecast.yml` + a small publish step that
  writes `verification.json` from the verify scripts to the contract repo.

## Data flow

```
provinces (getProvinces, fallback bundled)
   │
map.tsx ─ getProvinceOutlook(myProvince.id, provinces)
   │        ├ week1: getWeek1Map (Open-Meteo)  → source 'open-meteo'
   │        └ week2-4: mapPointsForWeek(contract, weekRange) → source 's2s'
   │      → OutlookPoint[4]  (value, level, source, dates)
   ├─ OutlookChart(weeks, selectedWeek)         // hero
   ├─ RiskGauge(selected week point)            // detail
   └─ MapGrid(selectedWeek data)                // map card / expanded

accuracy.tsx ─ loadVerification() → verification.json | null → render | empty
```

`getProvinceOutlook` reuses cached loads (one contract load, one Open-Meteo
batch), so it is one network round of work, not four.

## Edge cases

- **Province not yet located** — outlook uses a sensible default province until
  GPS resolves; never call Open-Meteo with empty provinces (the cold-load race
  fix: gate on `provinces.length > 0`, and re-run when provinces arrive).
- **Week beyond S2S horizon** (e.g. W4 when issue is fresh) — node shows a muted
  "ยังไม่มีข้อมูล" state; the line skips it.
- **Open-Meteo fails** — W1 node shows an error/neutral state with retry; W2-4
  (S2S) still render.
- **verification.json absent** — accuracy screen shows building state, no fake
  numbers.

## Verification (manual, browser)

- Home shows the 4-week trend for the located province; tapping a node updates
  the detail card + map.
- Source tags correct (W1 สด/blue, W2-4 S2S/amber) and follow the actual data
  source, not the week index.
- Map card expands to full screen and collapses with a single control.
- Cold load: no empty-coordinate Open-Meteo request; W1 populates on first load.
- Accuracy screen: graceful empty state when `verification.json` is missing.

## Out of scope

- Backend verification publishing pipeline (tracked as v1.5).
- Historical "past vs actual" overlay on the outlook graph itself (future).
