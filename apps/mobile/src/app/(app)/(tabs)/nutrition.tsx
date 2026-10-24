import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import {
  ACTIVITY_LABELS,
  MEALS,
  ageFromBirthDate,
  goalToEnergyGoal,
  lastNDays,
  macroTargets,
  suggestedWaterMl,
  type NutritionEntry,
  type HydrationLog,
  type NutritionTargets,
} from '@forma/shared';
import { useCollection, useMutations } from '@/lib/data';
import { useProfile } from '@/lib/profile';
import { useFeature } from '@/lib/config';
import { api, apiErrorMessage } from '@/lib/api';
import { newId, nowIso } from '@/lib/ids';
import { useTargets, useToday } from '@/features/hooks';
import { useTheme } from '@/lib/theme';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { NumberField, Segmented, ListRow } from '@/components/ui/Controls';
import { Banner, SectionHeader } from '@/components/ui/Feedback';
import { BarChart, MacroBar, ProgressRing } from '@/components/charts/Charts';
import { MealLogger } from '@/components/MealLogger';

export default function Nutrition() {
  const { c } = useTheme();
  const today = useToday();
  const { profile } = useProfile();
  const { data: targets } = useTargets();
  const { items: entries } = useCollection<NutritionEntry>('nutritionLogs', { orderBy: 'dayKey', limit: 300 });
  const { items: water } = useCollection<HydrationLog>('hydrationLogs', { orderBy: 'dayKey', limit: 50 });
  const { save, remove } = useMutations();
  const insights = useFeature('nutritionInsights');
  const [tab, setTab] = useState<'today' | 'trends' | 'targets'>('today');
  const [logger, setLogger] = useState<(typeof MEALS)[number]>();
  const [insight, setInsight] = useState<string>();
  const [busy, setBusy] = useState(false);
  const todays = entries.filter((e) => e.dayKey === today);
  const totals = todays.reduce((a, e) => ({ kcal: a.kcal + e.macros.kcal, p: a.p + e.macros.proteinG, cb: a.cb + e.macros.carbsG, f: a.f + e.macros.fatG }), { kcal: 0, p: 0, cb: 0, f: 0 });
  const ml = water.filter((w) => w.dayKey === today).reduce((s, w) => s + w.ml, 0);
  const t = targets ?? { kcal: 2000, proteinG: 100, carbsG: 230, fatG: 65, waterMl: 2000, mode: 'custom' as const, updatedAt: '' };
  const week = lastNDays(today, 7).map((d) => ({ x: d.slice(8), y: Math.round(entries.filter((e) => e.dayKey === d).reduce((s, e) => s + e.macros.kcal, 0)) }));
  const protein7 = lastNDays(today, 7).map((d) => entries.filter((e) => e.dayKey === d).reduce((s, e) => s + e.macros.proteinG, 0)).filter((x) => x > 0);

  const saveMealCombo = async () => {
    if (!todays.length) return;
    const id = newId();
    await save('savedMeals', id, { id, name: `My ${new Date().toLocaleDateString(undefined, { weekday: 'long' })} meal`, items: todays.slice(0, 20).map((e) => ({ name: e.name, foodId: e.foodId, servings: e.servings, macros: e.macros })), createdAt: nowIso(), updatedAt: nowIso(), revision: 0, source: 'manual' });
  };

  const askInsight = async () => {
    setBusy(true);
    try {
      const r = await api.aiChat({ routeKey: 'nutritionInsights', message: 'Look at my recent nutrition logs and targets and give me two or three practical, sustainable suggestions and a couple of meal ideas.' });
      setInsight(`${r.message.content}${r.message.disclaimers.length ? `\n\n${r.message.disclaimers.join(' ')}` : ''}`);
    } catch (e) {
      setInsight(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Nutrition" subtitle="Calories, macros and meals" right={<Button label="Log" size="sm" icon="add" testID="log-meal" onPress={() => setLogger('snack')} />}>
      <Segmented options={[{ value: 'today', label: 'Today' }, { value: 'trends', label: 'Trends' }, { value: 'targets', label: 'Targets' }]} value={tab} onChange={setTab} />
      {tab === 'today' && (
        <>
          <Card style={{ alignItems: 'center', gap: 16 }}>
            <ProgressRing value={totals.kcal} max={t.kcal} size={170} label={`${Math.round(totals.kcal)}`} sublabel={`of ${t.kcal} kcal`} />
            <View style={{ alignSelf: 'stretch', gap: 12 }}>
              <MacroBar label="Protein" value={totals.p} target={t.proteinG} color={c.accent} />
              <MacroBar label="Carbs" value={totals.cb} target={t.carbsG} color={c.info} />
              <MacroBar label="Fats" value={totals.f} target={t.fatG} color={c.warning} />
            </View>
            <Text variant="caption" tone="subtle">Totals are estimates from your entries.</Text>
          </Card>
          {MEALS.map((m) => {
            const list = todays.filter((e) => e.meal === m);
            return (
              <Card key={m}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text variant="label">{m[0]!.toUpperCase() + m.slice(1)}</Text>
                  <Button label="Add" size="sm" variant="ghost" icon="add" onPress={() => setLogger(m)} />
                </View>
                {list.length ? list.map((e) => (
                  <ListRow key={e.id} title={`${e.name}${e.servings !== 1 ? ` × ${e.servings}` : ''}`} subtitle={`~${Math.round(e.macros.kcal)} kcal · P ${Math.round(e.macros.proteinG)}g${e._pending ? ' · waiting to sync' : ''}`} right={<IconButton icon="trash-outline" label={`Remove ${e.name}`} tone="danger" onPress={() => remove('nutritionLogs', e.id)} />} />
                )) : <Text variant="caption" tone="subtle">Nothing logged.</Text>}
              </Card>
            );
          })}
          <Card onPress={() => router.push('/hydration')} accessibilityLabel="Water">
            <ListRow icon="water-outline" title={`Water · ${ml} / ${t.waterMl} ml`} subtitle="Tap to log water" />
          </Card>
          {todays.length > 1 ? <Button label="Save today’s foods as a meal" variant="ghost" onPress={saveMealCombo} /> : null}
          {insights.enabled ? (
            <Card variant="hero">
              <Text variant="heading">Nutrition insights</Text>
              <Text variant="caption" tone="muted" style={{ marginVertical: 6 }}>AI suggestions based on the data you allow in Privacy. Respects your diet and allergies.</Text>
              <Button label="Get suggestions" icon="sparkles" size="sm" onPress={askInsight} loading={busy} />
              {insight ? <Text style={{ marginTop: 10 }}>{insight}</Text> : null}
            </Card>
          ) : null}
        </>
      )}
      {tab === 'trends' && (
        <>
          <Card>
            <Text variant="label">Calories, last 7 days</Text>
            <BarChart data={week} target={t.kcal} />
            <Text variant="caption" tone="subtle">Dashed line: your target. Days with no entries show as empty, not zero intake.</Text>
          </Card>
          <Card>
            <Text variant="label">Average protein on logged days</Text>
            <Text variant="title">{protein7.length ? `${Math.round(protein7.reduce((a, b) => a + b, 0) / protein7.length)} g` : '—'}</Text>
            <Text variant="caption" tone="muted">Target {t.proteinG} g · {protein7.length} of 7 days logged</Text>
          </Card>
        </>
      )}
      {tab === 'targets' && <Targets targets={targets} />}
      <MealLogger visible={!!logger} onClose={() => setLogger(undefined)} dayKey={today} defaultMeal={logger ?? 'snack'} />
    </Screen>
  );
}

function Targets({ targets }: { targets?: NutritionTargets }) {
  const { profile } = useProfile();
  const today = useToday();
  const { save } = useMutations();
  const [edit, setEdit] = useState<Partial<NutritionTargets>>({});
  const calc = useMemo(() => {
    if (!profile?.weightKg || !profile.heightCm || !profile.birthDate) return undefined;
    return macroTargets({ weightKg: profile.weightKg, heightCm: profile.heightCm, age: ageFromBirthDate(profile.birthDate, today), calcSex: profile.calcSex ?? 'prefer_not', activity: profile.activityLevel }, goalToEnergyGoal(profile.primaryGoal));
  }, [profile, today]);
  const current = { ...(targets ?? { kcal: 2000, proteinG: 100, carbsG: 230, fatG: 65, waterMl: 2000, mode: 'custom' as const, updatedAt: '' }), ...edit };
  const persist = (patch: Partial<NutritionTargets>, mode: 'calculated' | 'custom') => save('settings', 'nutritionTargets', { ...current, ...patch, kcal: Math.max(1200, patch.kcal ?? current.kcal), mode, updatedAt: nowIso() });

  return (
    <>
      {calc ? (
        <Card style={{ gap: 6 }}>
          <Text variant="heading">How your estimate is calculated</Text>
          <Text tone="muted">BMR (Mifflin–St Jeor): <Text variant="label">{calc.bmr} kcal</Text></Text>
          <Text tone="muted">× activity ({ACTIVITY_LABELS[profile!.activityLevel]}) = TDEE <Text variant="label">{calc.tdee} kcal</Text></Text>
          <Text tone="muted">Goal adjustment: <Text variant="label">{calc.adjustmentKcal > 0 ? '+' : ''}{calc.adjustmentKcal} kcal</Text> → {calc.kcal} kcal</Text>
          <Text tone="muted">Protein {calc.proteinG} g · Carbs {calc.carbsG} g · Fat {calc.fatG} g</Text>
          {calc.notes.map((n) => <Text key={n} variant="caption" tone="subtle">{n}</Text>)}
          <Text variant="caption" tone="subtle">FORMA caps deficits at 20% (max 500 kcal) and never suggests below 1,200 kcal or your estimated BMR.</Text>
          <Button label="Use these targets" size="sm" onPress={() => persist({ kcal: calc.kcal, proteinG: calc.proteinG, carbsG: calc.carbsG, fatG: calc.fatG, waterMl: suggestedWaterMl(profile?.weightKg, profile?.activityLevel) }, 'calculated')} />
        </Card>
      ) : (
        <Banner tone="info" title="Add details for a personal estimate">Add your height, weight and date of birth in Settings → Profile to calculate a starting estimate. You can also set targets manually below.</Banner>
      )}
      <Card style={{ gap: 10 }}>
        <Text variant="heading">Your targets {current.mode === 'custom' ? '(custom)' : ''}</Text>
        <NumberField label="Calories" unit="kcal" value={current.kcal} onChange={(v) => setEdit((e) => ({ ...e, kcal: v }))} hint="Minimum 1,200 kcal" />
        <NumberField label="Protein" unit="g" value={current.proteinG} onChange={(v) => setEdit((e) => ({ ...e, proteinG: v }))} />
        <NumberField label="Carbohydrates" unit="g" value={current.carbsG} onChange={(v) => setEdit((e) => ({ ...e, carbsG: v }))} />
        <NumberField label="Fat" unit="g" value={current.fatG} onChange={(v) => setEdit((e) => ({ ...e, fatG: v }))} />
        <NumberField label="Water" unit="ml" value={current.waterMl} onChange={(v) => setEdit((e) => ({ ...e, waterMl: v }))} />
        <Button label="Save targets" onPress={() => persist(edit, 'custom')} />
      </Card>
    </>
  );
}
