import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_ROUTINES, EDUCATION, lastNDays, type WellnessRoutine } from '@forma/shared';
import { useCollection, useMutations } from '@/lib/data';
import { useProfile } from '@/lib/profile';
import { useFeature } from '@/lib/config';
import { useTheme } from '@/lib/theme';
import { newId, nowIso } from '@/lib/ids';
import { useToday } from '@/features/hooks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { Field, Segmented, Toggle } from '@/components/ui/Controls';
import { Banner, EmptyState } from '@/components/ui/Feedback';
import { confirm } from '@/lib/confirm';

type Tab = 'skincare' | 'habits' | 'mindset' | 'cycle';

export default function Glow() {
  const feature = useFeature('skincare');
  const today = useToday();
  const { c } = useTheme();
  const { profile, save: saveProfile } = useProfile();
  const { items: routines } = useCollection<WellnessRoutine>('wellnessRoutines');
  const { save, remove } = useMutations();
  const [tab, setTab] = useState<Tab>('skincare');
  const [doneSteps, setDoneSteps] = useState<Record<string, string[]>>({});
  const [name, setName] = useState('');
  const [steps, setSteps] = useState('');

  if (!feature.enabled) return <Screen title="Skincare & wellness" back><Banner tone="info">{feature.message}</Banner></Screen>;

  const create = async (kind: WellnessRoutine['kind'], routineName: string, stepLabels: readonly string[]) => {
    const id = newId();
    await save('wellnessRoutines', id, { id, kind, name: routineName, steps: stepLabels.map((l, i) => ({ key: `s${i}`, label: l })), completedDays: [], active: true, createdAt: nowIso(), updatedAt: nowIso(), revision: 0, source: 'template' });
  };
  const toggleStep = async (r: WellnessRoutine, key: string) => {
    const cur = doneSteps[r.id] ?? [];
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    setDoneSteps((d) => ({ ...d, [r.id]: next }));
    if (next.length === r.steps.length && !r.completedDays.includes(today)) {
      await save('wellnessRoutines', r.id, { ...r, completedDays: [...r.completedDays, today].slice(-62), updatedAt: nowIso(), revision: (r.revision ?? 0) + 1 });
    }
  };
  const kinds: Record<Tab, WellnessRoutine['kind'][]> = { skincare: ['skincare_am', 'skincare_pm'], habits: ['habit', 'wind_down'], mindset: [], cycle: [] };
  const visible = routines.filter((r) => kinds[tab].includes(r.kind));

  const RoutineCard = ({ r }: { r: WellnessRoutine }) => {
    const done = r.completedDays.includes(today);
    const streak = lastNDays(today, 7).filter((d) => r.completedDays.includes(d)).length;
    return (
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text variant="label">{r.name}{done ? ' ✓' : ''}</Text>
            <Text variant="caption" tone="muted">{streak}/7 days this week</Text>
          </View>
          <IconButton icon="trash-outline" label={`Delete ${r.name}`} tone="danger" onPress={async () => (await confirm('Delete routine?', r.name, 'Delete')) && remove('wellnessRoutines', r.id)} />
        </View>
        {r.steps.map((s) => {
          const checked = done || (doneSteps[r.id] ?? []).includes(s.key);
          return (
            <Pressable key={s.key} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => toggleStep(r, s.key)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
              <Ionicons name={checked ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={checked ? c.accent : c.textSubtle} />
              <Text>{s.label}</Text>
            </Pressable>
          );
        })}
      </Card>
    );
  };

  return (
    <Screen title="Skincare & wellness" back>
      <Segmented options={[{ value: 'skincare', label: 'Skincare' }, { value: 'habits', label: 'Habits' }, { value: 'mindset', label: 'Mindset' }, { value: 'cycle', label: 'Life stage' }]} value={tab} onChange={setTab} />
      {(tab === 'skincare' || tab === 'habits') && (
        <>
          {visible.map((r) => <RoutineCard key={r.id} r={r} />)}
          {!visible.length ? <EmptyState icon="sparkles-outline" title="No routines yet" message="Start with a simple template and make it yours." /> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {kinds[tab].filter((k) => !routines.some((r) => r.kind === k)).map((k) => (
              <Button key={k} label={`Add ${DEFAULT_ROUTINES[k].name}`} size="sm" variant="secondary" icon="add" onPress={() => create(k, DEFAULT_ROUTINES[k].name, DEFAULT_ROUTINES[k].steps)} />
            ))}
          </View>
          <Card style={{ gap: 8 }}>
            <Text variant="heading">Custom routine</Text>
            <Field label="Name" value={name} onChangeText={setName} />
            <Field label="Steps (one per line)" value={steps} onChangeText={setSteps} multiline />
            <Button label="Create" size="sm" disabled={!name.trim() || !steps.trim()} onPress={async () => { await create(tab === 'skincare' ? 'skincare_pm' : 'habit', name.trim(), steps.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 15)); setName(''); setSteps(''); }} />
          </Card>
          {EDUCATION.filter((e) => (tab === 'skincare' ? e.topic === 'skincare' : e.topic === 'habits' || e.topic === 'hydration')).map((e) => (
            <Card key={e.id}><Text variant="label">{e.title}</Text><Text variant="caption" tone="muted" style={{ marginTop: 4 }}>{e.body}</Text></Card>
          ))}
        </>
      )}
      {tab === 'mindset' && EDUCATION.filter((e) => e.topic === 'stress' || e.topic === 'sleep').map((e) => (
        <Card key={e.id}><Text variant="label">{e.title}</Text><Text variant="caption" tone="muted" style={{ marginTop: 4 }}>{e.body}</Text></Card>
      ))}
      {tab === 'cycle' && (
        profile?.consent?.lifeStageContent ? (
          <>
            <Banner tone="info">Optional, general education. FORMA doesn’t track cycles, pregnancy or menopause symptoms, and this isn’t medical advice.</Banner>
            <Card><Text variant="label">Training across the menstrual cycle</Text><Text variant="caption" tone="muted" style={{ marginTop: 4 }}>Energy and comfort can vary through the cycle for some people. Adjusting intensity based on how you feel is reasonable; there’s no single “right” schedule.</Text></Card>
            <Card><Text variant="label">Pregnancy & postpartum</Text><Text variant="caption" tone="muted" style={{ marginTop: 4 }}>Exercise during and after pregnancy should follow guidance from your midwife, obstetrician or doctor. Pelvic-floor and core recovery after birth benefits from professional advice.</Text></Card>
            <Card><Text variant="label">Perimenopause & menopause</Text><Text variant="caption" tone="muted" style={{ marginTop: 4 }}>Strength training, regular activity and good sleep habits support bone and muscle health. Talk to a clinician about symptoms that affect daily life.</Text></Card>
            <Toggle label="Show life-stage content" value onChange={() => saveProfile({ consent: { ...profile.consent, lifeStageContent: false } })} />
          </>
        ) : (
          <Card style={{ gap: 10 }}>
            <Text variant="label">Life-stage content is off</Text>
            <Text variant="caption" tone="muted">Optional education about the menstrual cycle, pregnancy, postpartum and menopause. Nothing is tracked.</Text>
            <Button label="Turn on" size="sm" onPress={() => saveProfile({ consent: { ...profile!.consent, lifeStageContent: true } })} />
          </Card>
        )
      )}
      <Text variant="caption" tone="subtle">Routines support healthy habits; they don’t guarantee a particular appearance or outcome. See a dermatologist for persistent skin concerns.</Text>
    </Screen>
  );
}
