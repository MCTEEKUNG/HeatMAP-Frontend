# ดีไซน์: พอร์ต HeatMAP-Frontend (Expo) + ต่อ DeepSeek bridge

วันที่: 2026-06-13
สถานะ: ร่างเพื่อ review (ยังไม่อนุมัติ)
บริบท: **subsystem #2 (เวอร์ชันใช้ดีไซน์เดิมของผู้ใช้)** — ใช้ HeatMAP-Frontend (Expo/RN) ที่ผู้ใช้ออกแบบเอง แทน HeatAhead (PWA ที่สร้างไว้ก่อนหน้า ซึ่ง **park** ไว้ที่ `Heatwave_Frontend` ไม่ลบ)
repo นี้: `C:\Users\ASUS\HeatMAP_Frontend` (decoupled, git ของตัวเอง)

> เชื่อม DeepSeek ผ่าน **bridge เดิม** = static `forecast_provinces.json` (77 จังหวัด × lead 2–6, schema_version 1). ไม่แตะ `Heatwave_AI` (ต้นทาง) และไม่แตะ `DeepSeek_Heatwave`.

---

## 1. เป้าหมาย
ใช้ HeatMAP-Frontend (mobile app ดีไซน์เดิม: MAP/ALERTS/SAFETY/SETTINGS, calm-authority) แต่ **เปลี่ยนแหล่งข้อมูลจาก Render API ของ Heatwave_AI → static contract ของ DeepSeek** และปรับความหมายเวลา short-range→sub-seasonal ; รันเป็น Expo **web** (decoupled, static deploy)

## 2. Non-goals
- ไม่แตะ `Heatwave_AI/HeatMAP-Frontend` (ต้นทาง — คัดสำเนาออกมา) และไม่แตะ `DeepSeek_Heatwave`
- ไม่ลบ HeatAhead (park ที่ `Heatwave_Frontend`)
- ไม่ตั้ง backend/API server, ไม่ใช้ Render/Supabase/Elysia ; ไม่ทำ push notification รอบนี้
- ไม่ออกแบบ UI ใหม่ (ใช้ดีไซน์เดิม) — งานคือ data layer + semantics + strip

## 3. Source → repo
คัด `Heatwave_AI/HeatMAP-Frontend/` → `C:\Users\ASUS\HeatMAP_Frontend/` **ยกเว้น** `node_modules/`, `.git/`, `.expo/`, `*.log`, `.env` (gitignore ตั้งไว้แล้ว) → `bun install` ใหม่ในนี้

## 4. Data bridge + adapter (หัวใจ — เก็บ signature เดิม)
แอปเรียกผ่าน `services/forecastService.ts`:
- `getForecastMap(): Promise<MapForecastPoint[]>` — `{province_id, lat, lon, probability, risk_level, target_date, generated_at, model_version?}`
- `getProvinceForecast(id, days?): Promise<ProvinceForecastDay[]>` — `{target_date, probability, predicted_label, risk_level, swbgt_pred, generated_at}`
- `RiskLevel = 'low'|'moderate'|'high'|'extreme'`

**แผน:** สร้าง `services/deepseekContract.ts` (โหลด `forecast_provinces.json` จาก `EXPO_PUBLIC_FORECAST_URL`, cache) + ปรับ `forecastService.ts` ให้ทั้งสองฟังก์ชัน transform จาก contract แทนการเรียก `apiService` (Render). หน้าจอ/hook (map.tsx, useProvinceForecast) **ไม่ต้องแก้** เพราะ type ปลายทางเหมือนเดิม.
- **risk mapping** DeepSeek→app: `Low→low, Normal→moderate, Elevated→high, High→extreme`
- **map:** ต่อจังหวัดใช้ **lead 2** เป็น "ค่าปัจจุบัน" → MapForecastPoint (target_date = issue_date + 14)
- **province:** lead 2–6 → ProvinceForecastDay (target_date = issue_date + lead×7) ; `predicted_label` = (severity ≥ elevated) ; `swbgt_pred` = ไม่มี → ตั้ง `null` + ซ่อนใน UI
- `services/provincesService.ts` (`getProvinces`) → derive จาก contract (มี 77 จังหวัด id/code/name_th/name_en/region/lat/lon ครบ)

## 5. Semantic adaptation (short-range → sub-seasonal)
- `app/(tabs)/alerts.tsx` ปัจจุบันสร้าง **ปฏิทินรายวัน (month grid)** จาก forecast รายวัน — ของ DeepSeek เป็น **รายสัปดาห์ 2–6** → แทนปฏิทินด้วย **outlook รายสัปดาห์** (การ์ด/แถวต่อ lead 2–6 + วันที่เป้าหมาย + risk) ; ลบ logic `buildMonthGrid`/`CalendarDay`
- label "+2H / 7-day / รายวัน" → "outlook 2–6 สัปดาห์ / รายสัปดาห์" (แก้ `i18n/translations.ts`, 344 บรรทัด — เฉพาะ key ที่เกี่ยว)
- MAP คงดีไซน์เดิม (เปลี่ยนแค่ที่มาข้อมูล) ; SAFETY = เนื้อหา static (คงไว้) ; SETTINGS คงไว้ (province/lang/theme)

## 6. Strip (Heatwave_AI-specific)
ลบ/ตัดออกจากสำเนา: `app/liff.tsx` (+ LIFF init ใน `app/_layout.tsx`), `app/checklist.tsx` (ถ้าเป็น LINE-specific), `services/nearbyPlaces.ts` + การเรียก cooling-centres (Google/Overpass) ในหน้าจอ, `services/apiService.ts` Render client (แทนด้วย contract), `NotificationService.ts`/`weatherService.ts` ถ้าไม่ใช้แล้ว. เก็บ tab `(tabs)/map|alerts|settings` + SAFETY. นำ route ที่ลบออกจาก `app/_layout.tsx`.

## 7. Run / deploy
Expo web: `bun install` → `bun run web` (dev) / `bunx expo export -p web` (static) → deploy static (Vercel/Pages). `EXPO_PUBLIC_FORECAST_URL` = local synced `assets/forecast_provinces.json` หรือ DeepSeek Pages URL. Sync dev data = คัด `DeepSeek_Heatwave/docs/forecast_provinces.json` มาวาง.

## 8. Risks & mitigations
- **Codebase ใหญ่ (851-line map + หลาย service/hook + i18n):** งานหลักคือ data layer + alerts adaptation + strip ; UI อื่นคงเดิม → คุมขอบเขตด้วยการเก็บ type ปลายทางเดิม (หน้าจอไม่ต้องรื้อ)
- **alerts.tsx ปฏิทินรายวัน:** เป็นจุดแก้ใหญ่สุด (daily→weekly) — แยกเป็น task เฉพาะ
- **Expo web build:** react-native-maps อาจมีปัญหาบน web → map ใช้ leaflet/react-leaflet (มี dep แล้ว) บน web ; ทดสอบ `expo export -p web`
- **Data-model mismatch ซ่อนใน UI:** field ที่ DeepSeek ไม่มี (swbgt_pred, hourly) ต้องไล่ซ่อน/ปรับ label ให้ครบ — ตรวจทุกหน้าจอที่ใช้
- **strip กระทบ build:** ลบ route/service แล้วต้องเอา import/refs ออกให้หมด (build ผ่าน)

## 9. Acceptance criteria
1. `HeatMAP_Frontend` รัน `bun install` + `bun run web` ได้ ; `bunx expo export -p web` สร้าง static ได้ไม่ error
2. MAP โชว์ 77 จังหวัดระบายสีจาก `forecast_provinces.json` (lead 2) ; tap → province detail
3. Province detail = outlook lead 2–6 (prob + risk mapped + target_date) ; ไม่มี field ค้างที่ DeepSeek ไม่มี (swbgt ฯลฯ)
4. ALERTS = weekly outlook (ไม่มีปฏิทินรายวัน/+2H ค้าง)
5. LIFF/cooling-centres/Render client ถูก strip ; ไม่มี import ค้างทำ build พัง
6. ไม่แตะ Heatwave_AI และ DeepSeek_Heatwave ; อ่านข้อมูลผ่าน `EXPO_PUBLIC_FORECAST_URL` เท่านั้น

## 10. การตัดสินใจที่ล็อก
- ใช้ HeatMAP-Frontend (ดีไซน์เดิม) ; HeatAhead park ไว้ ไม่ลบ
- repo แยก `HeatMAP_Frontend` ; bridge = static `forecast_provinces.json` (ไม่มี server)
- เก็บ type ปลายทางเดิม (MapForecastPoint/ProvinceForecastDay/RiskLevel) → หน้าจอแก้น้อย
- risk: Low→low, Normal→moderate, Elevated→high, High→extreme
- map = lead 2 ; province = lead 2–6 ; swbgt ตัด
- strip: LIFF/LINE, cooling-centres, Render API client
