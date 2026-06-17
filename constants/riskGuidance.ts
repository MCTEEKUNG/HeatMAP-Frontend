// source: WHO / CDC / กรมอนามัย

import type { RiskLevel } from '../services/forecastService';

/** The display-tier vocabulary used by alerts.tsx (todayRisk state). */
export type AlertDisplayTier = 'danger' | 'caution' | 'safe';

/** Health guidance for a single risk tier. */
export interface RiskGuidance {
  headline: string;
  whatsHappening: string;
  actions: string[];
  whoAtRisk: string[];
  warning?: string;
}

/** Bilingual guidance content: Record<'en'|'th', Record<RiskLevel, RiskGuidance>> */
export type GuidanceContent = Record<'en' | 'th', Record<RiskLevel, RiskGuidance>>;

/** Complete health guidance database (8 cells: 4 tiers × 2 langs). */
const guidanceContent: GuidanceContent = {
  en: {
    Low: {
      headline: 'Low Risk — Normal Conditions',
      whatsHappening: 'Heat conditions are normal. No heatwave risk detected.',
      actions: [
        'Drink water regularly throughout the day',
        'Follow normal daily activities',
      ],
      whoAtRisk: [],
    },
    Normal: {
      headline: 'Normal — Stay Hydrated',
      whatsHappening:
        'Heat risk is within seasonal norms. Stay hydrated as a routine precaution.',
      actions: [
        'Drink at least 8 glasses of water per day',
        'Wear light, breathable clothing',
        'Limit strenuous outdoor activity during midday',
      ],
      whoAtRisk: ['Elderly', 'Young children', 'People with chronic illness'],
    },
    Elevated: {
      headline: 'Elevated Risk — Take Precautions',
      whatsHappening:
        'Heatwave probability is elevated for this period. Take active precautions, especially if you are outdoors.',
      actions: [
        'Drink ≥8 glasses of water daily; add electrolytes if exercising >1 hr',
        'Avoid direct sunlight between 10:00–16:00',
        'Move to shaded or air-conditioned spaces during peak heat',
        'Check on elderly relatives and young children',
        'Watch for early heat-exhaustion signs: heavy sweating, dizziness, headache, nausea',
      ],
      whoAtRisk: [
        'Elderly (65+)',
        'Young children under 5',
        'Pregnant women',
        'People with heart, lung, or kidney disease',
        'Outdoor workers and athletes',
        'Those without access to air conditioning',
      ],
      warning:
        'Watch for heat exhaustion: if symptoms persist >1 hr or you vomit, seek medical care.',
    },
    High: {
      headline: 'High Risk — DANGER — Act Now',
      whatsHappening:
        'Heatwave conditions are highly likely. This is a serious health risk — minimize heat exposure immediately.',
      actions: [
        'Stay indoors in air-conditioned spaces — do NOT go outdoors during peak heat',
        'Drink water every 15–20 minutes even if not thirsty; include electrolytes',
        'Wear loose, light-colored, breathable clothing if going out',
        'NEVER leave children or elderly alone in parked vehicles',
        'Know the signs of heat stroke (see Safety Guide) — call 1669 immediately if suspected',
        'Check on vulnerable people every few hours',
      ],
      whoAtRisk: [
        'Elderly (65+)',
        'Infants and young children',
        'Pregnant women',
        'People with cardiovascular, respiratory, or kidney disease',
        'People with diabetes',
        'Outdoor workers',
        'Anyone on certain medications (check with doctor)',
        'Those without air conditioning',
      ],
      warning:
        'EMERGENCY: Heat stroke (body temp >40°C, confusion, hot DRY skin, stops sweating, seizures) → Call 1669 NOW. Cool the body while waiting for help.',
    },
  },
  th: {
    Low: {
      headline: 'ความเสี่ยงต่ำ — สภาพปกติ',
      whatsHappening:
        'สภาพอากาศอยู่ในเกณฑ์ปกติ ไม่พบความเสี่ยงคลื่นความร้อน',
      actions: [
        'ดื่มน้ำสม่ำเสมอตลอดวัน',
        'ดำเนินกิจวัตรประจำวันตามปกติ',
      ],
      whoAtRisk: [],
    },
    Normal: {
      headline: 'ปกติ — รักษาความชุ่มชื้น',
      whatsHappening:
        'ความเสี่ยงความร้อนอยู่ในระดับปกติตามฤดูกาล ดื่มน้ำเป็นประจำเป็นการป้องกันเบื้องต้น',
      actions: [
        'ดื่มน้ำอย่างน้อย 8 แก้วต่อวัน',
        'สวมเสื้อผ้าสีอ่อน ระบายอากาศดี',
        'ลดกิจกรรมกลางแจ้งหนักๆ ช่วงเที่ยงวัน',
      ],
      whoAtRisk: ['ผู้สูงอายุ', 'เด็กเล็ก', 'ผู้มีโรคประจำตัว'],
    },
    Elevated: {
      headline: 'ความเสี่ยงสูง — ระวังตัว',
      whatsHappening:
        'โอกาสเกิดคลื่นความร้อนสูงขึ้นในช่วงนี้ ควรป้องกันตัวอย่างจริงจัง โดยเฉพาะหากอยู่กลางแจ้ง',
      actions: [
        'ดื่มน้ำ ≥8 แก้ว/วัน เพิ่มเกลือแร่หากออกกำลังกายนานกว่า 1 ชม.',
        'หลีกเลี่ยงแสงแดดตรงระหว่าง 10:00–16:00 น.',
        'ย้ายไปอยู่ในร่มหรือที่ที่มีแอร์ช่วงอากาศร้อนจัด',
        'ติดตามดูแลผู้สูงอายุและเด็กเล็กในบ้าน',
        'สังเกตอาการเพลียแดดเบื้องต้น: เหงื่อออกมาก เวียนหัว ปวดหัว คลื่นไส้',
      ],
      whoAtRisk: [
        'ผู้สูงอายุ (65 ปีขึ้นไป)',
        'เด็กอายุต่ำกว่า 5 ปี',
        'หญิงตั้งครรภ์',
        'ผู้ป่วยโรคหัวใจ ปอด หรือไต',
        'แรงงานกลางแจ้งและนักกีฬา',
        'ผู้ที่ไม่มีเครื่องปรับอากาศ',
      ],
      warning:
        'หากอาการเพลียแดดไม่ดีขึ้นภายใน 1 ชั่วโมง หรือมีอาเจียน ให้รีบไปพบแพทย์',
    },
    High: {
      headline: 'ความเสี่ยงสูงมาก — อันตราย — ต้องดำเนินการทันที',
      whatsHappening:
        'มีโอกาสสูงมากที่จะเกิดคลื่นความร้อน นี่คือความเสี่ยงด้านสุขภาพระดับสูง — ลดการสัมผัสความร้อนทันที',
      actions: [
        'อยู่ในอาคารที่มีแอร์ — ห้ามออกกลางแจ้งช่วงอากาศร้อนจัด',
        'ดื่มน้ำทุก 15–20 นาทีแม้ไม่กระหาย เพิ่มเครื่องดื่มเกลือแร่',
        'สวมเสื้อผ้าหลวม สีอ่อน ระบายอากาศดี หากจำเป็นต้องออกข้างนอก',
        'ห้ามทิ้งเด็กหรือผู้สูงอายุไว้ในรถที่จอดเพียงลำพัง',
        'รู้จักสัญญาณลมแดด (ดูคู่มือความปลอดภัย) — โทร 1669 ทันทีหากสงสัย',
        'ตรวจสอบผู้มีความเสี่ยงทุก 2–3 ชั่วโมง',
      ],
      whoAtRisk: [
        'ผู้สูงอายุ (65 ปีขึ้นไป)',
        'ทารกและเด็กเล็ก',
        'หญิงตั้งครรภ์',
        'ผู้ป่วยโรคหัวใจ ระบบทางเดินหายใจ หรือไต',
        'ผู้ป่วยเบาหวาน',
        'แรงงานกลางแจ้ง',
        'ผู้ที่ใช้ยาบางประเภท (ปรึกษาแพทย์)',
        'ผู้ที่ไม่มีเครื่องปรับอากาศ',
      ],
      warning:
        'ฉุกเฉิน: ลมแดด (อุณหภูมิร่างกาย >40°C สับสน ผิวร้อนแห้ง เหงื่อหยุด ชัก) → โทร 1669 ทันที และช่วยทำให้ร่างกายเย็นลงระหว่างรอ',
    },
  },
};

/** Severity scoring for risk levels (used by worstRiskOf). Higher = more severe. */
const RISK_SEVERITY: Record<RiskLevel, number> = {
  High: 4,
  Elevated: 3,
  Normal: 2,
  Low: 1,
};

/**
 * Retrieve health guidance for a specific risk level and language.
 * @param risk The risk level: 'Low' | 'Normal' | 'Elevated' | 'High'
 * @param lang The language: 'en' | 'th'
 * @returns RiskGuidance object with headline, actions, at-risk groups, and optional warning
 */
export function guidanceFor(
  risk: RiskLevel,
  lang: 'en' | 'th',
): RiskGuidance {
  return guidanceContent[lang]?.[risk] ?? guidanceContent['en']['Normal'];
}

/**
 * Map alert tier (from alerts.tsx) to RiskLevel.
 * The alert system uses 'danger', 'caution', 'safe' as its tiers;
 * this converts to the 4-tier RiskLevel system used by backend + HeatHealthCard.
 *
 * Note: 'safe' maps to 'Normal' (not 'Low'), since 'safe' means "no alert required"
 * rather than "truly low risk".
 */
export function tierToRiskLevel(
  today: AlertDisplayTier,
): RiskLevel {
  switch (today) {
    case 'danger':
      return 'High';
    case 'caution':
      return 'Elevated';
    case 'safe':
      return 'Normal';
    default:
      return 'Normal';
  }
}

/**
 * Determine the worst (most severe) risk level from a list of forecast days.
 * Used to compute the weekly worst-case risk for the province forecast panel.
 * Ordering (most to least severe): High > Elevated > Normal > Low
 */
export function worstRiskOf(
  days: Array<{ risk_level: RiskLevel }>,
): RiskLevel {
  if (days.length === 0) return 'Low';

  let worstSeverity = 0;
  let worstRisk: RiskLevel = 'Low';

  for (const day of days) {
    const sev = RISK_SEVERITY[day.risk_level];
    if (sev > worstSeverity) {
      worstSeverity = sev;
      worstRisk = day.risk_level;
    }
  }

  return worstRisk;
}
