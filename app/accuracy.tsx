/**
 * Accuracy / track-record screen — the committee proof.
 *
 * Reads the published verification dataset (loadVerification → verification.json).
 * Shows Brier Skill Score vs baseline, a week-by-week hit/near/miss strip,
 * calibration, and per-lead skill. When the dataset isn't published yet, shows
 * an honest "track record building" state — never invented numbers.
 */

import { useEffect, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, FontFamily, GlassStyle } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { ScaledText } from '@/components/ui/ScaledText';
import { loadVerification, formatGeneratedAt, type VerificationData } from '@/services/forecastService';

const HIT = '#4ade80';
const NEAR = '#facc15';
const MISS = '#ef4444';

export default function AccuracyScreen() {
  const router = useRouter();
  const { isDarkMode, language } = useSettings();
  const th = language === 'th';
  const theme = Colors[isDarkMode ? 'dark' : 'light'];
  const glass = GlassStyle[isDarkMode ? 'dark' : 'light'];

  const [status, setStatus] = useState<'loading' | 'ready' | 'empty'>('loading');
  const [data, setData] = useState<VerificationData | null>(null);

  useEffect(() => {
    let active = true;
    loadVerification().then((d) => {
      if (!active) return;
      const meaningful = d && (d.bss !== undefined || (d.weeks && d.weeks.length > 0));
      setData(d);
      setStatus(meaningful ? 'ready' : 'empty');
    }).catch(() => active && setStatus('empty'));
    return () => { active = false; };
  }, []);

  const muted = theme.textMuted ?? theme.textSecondary;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerSide}
          accessibilityRole="button" accessibilityLabel={th ? 'กลับ' : 'Back'}>
          <ScaledText style={[styles.backChevron, { color: theme.text }]}>‹</ScaledText>
        </TouchableOpacity>
        <ScaledText style={[styles.headerTitle, { color: theme.text }]}>
          {th ? 'ความแม่นยำของโมเดล' : 'Model accuracy'}
        </ScaledText>
        <View style={styles.headerSide} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {status === 'loading' && (
          <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
        )}

        {status === 'empty' && (
          <View style={[styles.card, glass]}>
            <ScaledText style={[styles.bigEmoji]}>📊</ScaledText>
            <ScaledText style={[styles.emptyTitle, { color: theme.text }]}>
              {th ? 'กำลังสะสมผลการทำนาย' : 'Track record is building'}
            </ScaledText>
            <ScaledText style={[styles.emptyBody, { color: muted }]}>
              {th
                ? 'โมเดลรันทุกสัปดาห์ ระบบกำลังเก็บผลทำนายเทียบกับสภาพอากาศที่เกิดจริง เพื่อรายงานความแม่นยำที่นี่เร็วๆ นี้'
                : 'The model runs weekly. We are accumulating predictions vs. what actually happened, and will report verified accuracy here soon.'}
            </ScaledText>
          </View>
        )}

        {status === 'ready' && data && (
          <>
            {data.period && (
              <ScaledText style={[styles.period, { color: muted }]}>
                {th ? 'ข้อมูล' : 'Period'} {data.period.start} – {data.period.end} · {data.period.weeks} {th ? 'สัปดาห์' : 'weeks'}
              </ScaledText>
            )}

            {/* BSS headline */}
            {data.bss !== undefined && (
              <View style={[styles.card, glass]}>
                <View style={styles.bssRow}>
                  <ScaledText style={[styles.bssNum, { color: data.bss > 0 ? HIT : MISS }]}>
                    {data.bss > 0 ? '+' : ''}{data.bss.toFixed(2)}
                  </ScaledText>
                  <View style={{ flex: 1 }}>
                    <ScaledText style={[styles.bssLabel, { color: theme.text }]}>Brier Skill Score</ScaledText>
                    <ScaledText style={[styles.bssSub, { color: muted }]}>
                      {th ? 'เทียบค่าเฉลี่ยภูมิอากาศ (baseline)' : 'vs climatology baseline'}
                      {data.bss > 0 ? (th ? ' · มี skill จริง ▲' : ' · real skill ▲') : ''}
                    </ScaledText>
                  </View>
                </View>
              </View>
            )}

            {/* Week-by-week track record */}
            {data.weeks && data.weeks.length > 0 && (
              <View style={[styles.card, glass]}>
                <ScaledText style={[styles.sech, { color: theme.text }]}>
                  {th ? 'รายสัปดาห์ — ทำนาย vs เกิดจริง' : 'Week by week — predicted vs actual'}
                </ScaledText>
                <View style={styles.weeks}>
                  {data.weeks.map((wk, i) => (
                    <View key={i} style={[styles.wk, {
                      backgroundColor: wk.outcome === 'hit' ? HIT : wk.outcome === 'near' ? NEAR : MISS,
                    }]} />
                  ))}
                </View>
                <View style={styles.legend}>
                  <Legend color={HIT} label={th ? 'ถูก' : 'hit'} />
                  <Legend color={NEAR} label={th ? 'ใกล้เคียง' : 'near'} />
                  <Legend color={MISS} label={th ? 'พลาด' : 'miss'} />
                </View>
              </View>
            )}

            {/* Per-lead skill */}
            {data.per_lead && data.per_lead.length > 0 && (
              <View style={[styles.card, glass]}>
                <ScaledText style={[styles.sech, { color: theme.text }]}>
                  {th ? 'skill แยกตามระยะ (lead)' : 'Skill by lead'}
                </ScaledText>
                {data.per_lead.map((l) => {
                  const pct = Math.max(0, Math.min(1, l.bss)) * 100;
                  return (
                    <View key={l.lead} style={styles.leadRow}>
                      <ScaledText style={[styles.leadLab, { color: theme.text }]}>lead {l.lead}</ScaledText>
                      <View style={[styles.track, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)' }]}>
                        <View style={[styles.fill, { width: `${pct}%` }]} />
                      </View>
                      <ScaledText style={[styles.leadVal, { color: muted }]}>{l.bss.toFixed(2)}</ScaledText>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Calibration */}
            {data.calibration && data.calibration.length > 0 && (
              <View style={[styles.card, glass]}>
                <ScaledText style={[styles.sech, { color: theme.text }]}>
                  {th ? 'ความน่าเชื่อถือ (calibration)' : 'Calibration'}
                </ScaledText>
                <View style={styles.calib}>
                  {data.calibration.map((c, i) => (
                    <View key={i} style={styles.cb}>
                      <View style={[styles.cbar, { height: `${Math.max(4, c.observed * 100)}%`, backgroundColor: '#4f9cf9' }]} />
                      <ScaledText style={[styles.cbl, { color: muted }]}>{Math.round(c.predicted * 100)}%</ScaledText>
                    </View>
                  ))}
                </View>
                <ScaledText style={[styles.note, { color: muted }]}>
                  {th ? 'ทำนาย X% → เกิดจริง ~X% (ยิ่งตรงยิ่งน่าเชื่อถือ)' : 'predicted X% → observed ~X% (closer = more reliable)'}
                </ScaledText>
              </View>
            )}

            {data.generated_at && (
              <ScaledText style={[styles.asof, { color: muted }]}>
                {th ? 'อัปเดตล่าสุด' : 'Updated'} {formatGeneratedAt(data.generated_at, th ? 'th' : 'en')}
              </ScaledText>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.lg}>
      <View style={[styles.sw, { backgroundColor: color }]} />
      <ScaledText style={styles.lgText}>{label}</ScaledText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10 },
  headerSide: { width: 44, alignItems: 'center' },
  backChevron: { fontSize: 30, fontWeight: '300', lineHeight: 32 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontFamily: FontFamily.display, fontWeight: '700' },
  scroll: { padding: 14, paddingBottom: 40, gap: 12 },
  center: { paddingVertical: 60, alignItems: 'center' },
  card: { borderRadius: 16, padding: 16, marginBottom: 12 },
  period: { fontSize: 11, textAlign: 'center', marginBottom: 4 },
  bssRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bssNum: { fontSize: 38, fontFamily: FontFamily.display, fontWeight: '800', letterSpacing: -1 },
  bssLabel: { fontSize: 14, fontFamily: FontFamily.bodySemi, fontWeight: '700' },
  bssSub: { fontSize: 11, fontFamily: FontFamily.body, marginTop: 2, lineHeight: 15 },
  sech: { fontSize: 12, fontFamily: FontFamily.bodySemi, fontWeight: '700', marginBottom: 8 },
  weeks: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  wk: { width: 16, height: 16, borderRadius: 4 },
  legend: { flexDirection: 'row', gap: 14, marginTop: 10 },
  lg: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sw: { width: 11, height: 11, borderRadius: 3 },
  lgText: { fontSize: 10, fontFamily: FontFamily.body, color: '#8aa0b6' },
  leadRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  leadLab: { fontSize: 11, width: 48, fontFamily: FontFamily.bodyMedium },
  track: { flex: 1, height: 9, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#4ade80', borderRadius: 5 },
  leadVal: { fontSize: 10, width: 36, textAlign: 'right', fontFamily: FontFamily.body },
  calib: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 70 },
  cb: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 3 },
  cbar: { width: '70%', borderRadius: 3, minHeight: 4 },
  cbl: { fontSize: 8, fontFamily: FontFamily.body },
  note: { fontSize: 9.5, marginTop: 6, fontFamily: FontFamily.body },
  bigEmoji: { fontSize: 40, textAlign: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 16, fontFamily: FontFamily.display, fontWeight: '700', textAlign: 'center' },
  emptyBody: { fontSize: 12, fontFamily: FontFamily.body, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  asof: { fontSize: 10, textAlign: 'center', marginTop: 4 },
});
