# HeatMAP Frontend

A decoupled Expo **web** app showing per-province 2–6 week heatwave risk across Thailand. This is the user-facing HeatMAP design, ported from the original Heatwave_AI project and repointed to DeepSeek's static forecast data.

---

## What it is

A static Expo web application that reads `forecast_provinces.json` produced by the DeepSeek heatwave model and renders per-province heatwave risk for the next 2–6 weeks. No backend, no Python toolchain — just a static export you can deploy anywhere.

---

## Data bridge

The app reads forecast data from a single JSON contract:

```
EXPO_PUBLIC_FORECAST_URL=/forecast_provinces.json   # default
```

In dev and static builds, this resolves to `public/forecast_provinces.json` (served from the web root). In production you can override it with a published URL (e.g. DeepSeek GitHub Pages).

**To refresh dev data:**

```bash
cp ../DeepSeek_Heatwave/docs/forecast_provinces.json public/forecast_provinces.json
```

**Prod override:** set `EXPO_PUBLIC_FORECAST_URL` in your environment to the published URL, e.g.:

```
EXPO_PUBLIC_FORECAST_URL=https://your-org.github.io/DeepSeek_Heatwave/forecast_provinces.json
```

Copy `.env.example` to `.env` and adjust as needed.

---

## Commands

```bash
# Install dependencies
bun install

# Start dev server (web)
bun run web
# or
bunx expo start --web

# Static build → dist/
bunx expo export -p web

# Unit tests (4 tests)
bun run test:unit
```

---

## Deployment

After `bunx expo export -p web`, deploy the `dist/` folder as a static site:

- **Vercel**: `vercel --prod` (configure output directory as `dist`)
- **GitHub Pages**: push `dist/` to a `gh-pages` branch
- **Any static host**: upload `dist/`

The forecast data file (`forecast_provinces.json`) is copied from `public/` into `dist/` automatically by Expo during export, so it ships with the static build.

---

## Decoupling

- No Heatwave_AI backend dependency
- No DeepSeek Python toolchain required
- No live API calls at runtime — data is a static JSON file
- `EXPO_PUBLIC_FORECAST_URL` is the only bridge between this frontend and the DeepSeek model output

---

## Native note

This app targets **web only**. The forecast loader uses a `fetch()` URL pattern. Native iOS/Android would need a different data-loading path (e.g. bundled asset or native file read) since `fetch('/forecast_provinces.json')` does not resolve on device.

---

## Contract: `forecast_provinces.json`

Expected shape (schema version 1):

```json
{
  "schema_version": 1,
  "n_provinces": 77,
  "generated_at": "...",
  "provinces": [ ... ]
}
```

Produced by the DeepSeek heatwave model at `../DeepSeek_Heatwave/docs/forecast_provinces.json`.
