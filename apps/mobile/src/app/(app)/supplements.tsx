import { useState } from 'react';
import { View } from 'react-native';
import { SUPPLEMENTS, SUPPLEMENT_MAP, supplementItemSchema, type SupplementItem } from '@forma/shared';
import { useCollection, useMutations } from '@/lib/data';
import { useFeature } from '@/lib/config';
import { api, apiErrorMessage } from '@/lib/api';
import { newId, nowIso } from '@/lib/ids';
import { useToday } from '@/features/hooks';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { Card } from '@/components/ui/Card';
import { Button, IconButton } from '@/components/ui/Button';
import { ChipGroup, Field, Segmented, Toggle, ListRow } from '@/components/ui/Controls';
import { Badge, Banner, EmptyState } from '@/components/ui/Feedback';
import { confirm } from '@/lib/confirm';

export default function Supplements() {
  const feature = useFeature('supplements');
  const today = useToday();
  const { items } = useCollection<SupplementItem>('supplementInventory');
  const { save, remove } = useMutations();
  const [tab, setTab] = useState<'mine' | 'learn' | 'compare'>('mine');
  const [open, setOpen] = useState<string>();
  const [form, setForm] = useState<Partial<SupplementItem>>({ name: '', trackConsistency: false });
  const [compare, setCompare] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (!feature.enabled) return <Screen title="Supplements" back><Banner tone="info">{feature.message}</Banner></Screen>;

  const add = async () => {
    const id = newId();
    const parsed = supplementItemSchema.safeParse({ ...form, id, active: true, takenDays: [], createdAt: nowIso(), updatedAt: nowIso(), revision: 0, source: 'manual' });
    if (!parsed.success) return;
    await save('supplementInventory', id, parsed.data);
    setForm({ name: '', trackConsistency: false });
  };
  const toggleTaken = (s: SupplementItem) => {
    const days = s.takenDays.includes(today) ? s.takenDays.filter((d) => d !== today) : [...s.takenDays, today].slice(-62);
    return save('supplementInventory', s.id, { ...s, takenDays: days, updatedAt: nowIso(), revision: (s.revision ?? 0) + 1 });
  };
  const ask = async () => {
    setBusy(true);
    try {
      const r = await api.aiChat({ routeKey: 'supplementEducation', message: question });
      setAnswer(`${r.message.content}\n\n${r.message.disclaimers.join(' ')}`);
    } catch (e) {
      setAnswer(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Supplements" back>
      <Banner tone="warning">General information only. Supplements can interact with medicines and conditions — check with a pharmacist or doctor, especially if pregnant, breastfeeding or taking medication. FORMA doesn’t diagnose deficiencies.</Banner>
      <Segmented options={[{ value: 'mine', label: 'My supplements' }, { value: 'learn', label: 'Evidence' }, { value: 'compare', label: 'Compare' }]} value={tab} onChange={setTab} />
      {tab === 'mine' && (
        <>
          {items.length ? items.map((s) => (
            <Card key={s.id}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text variant="label">{s.name}{s.brand ? ` · ${s.brand}` : ''}</Text>
                  <Text variant="caption" tone="muted">{[s.dose, s.timing?.replace('_', ' '), s.note].filter(Boolean).join(' · ') || 'No details'}</Text>
                  {s.trackConsistency ? <Text variant="caption" tone="subtle">Taken {s.takenDays.filter((d) => d >= today.slice(0, 8) + '01').length} days this month</Text> : null}
                </View>
                {s.trackConsistency ? <Button label={s.takenDays.includes(today) ? 'Taken ✓' : 'Mark taken'} size="sm" variant={s.takenDays.includes(today) ? 'secondary' : 'primary'} onPress={() => toggleTaken(s)} /> : null}
                <IconButton icon="trash-outline" label="Remove" tone="danger" onPress={async () => (await confirm('Remove supplement?', s.name, 'Remove')) && remove('supplementInventory', s.id)} />
              </View>
              {s.referenceId && SUPPLEMENT_MAP.get(s.referenceId) ? <Text variant="caption" tone="primary" onPress={() => { setTab('learn'); setOpen(s.referenceId); }}>View evidence summary</Text> : null}
            </Card>
          )) : <EmptyState icon="flask-outline" title="No supplements saved" message="Keep a private list of what you take, with timing and notes." />}
          <Card style={{ gap: 10 }}>
            <Text variant="heading">Add a supplement</Text>
            <Field label="Name" value={form.name ?? ''} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} />
            <Field label="Brand (optional)" value={form.brand ?? ''} onChangeText={(t) => setForm((f) => ({ ...f, brand: t || undefined }))} />
            <Field label="Dose as on the label (optional)" value={form.dose ?? ''} onChangeText={(t) => setForm((f) => ({ ...f, dose: t || undefined }))} />
            <Text variant="label">Timing</Text>
            <ChipGroup scroll options={['morning', 'pre_workout', 'post_workout', 'with_meals', 'evening', 'as_needed'].map((t) => ({ value: t, label: t.replace('_', ' ') }))} value={form.timing ?? ''} onChange={(v) => setForm((f) => ({ ...f, timing: v as SupplementItem['timing'] }))} />
            <Text variant="label">Link to evidence summary</Text>
            <ChipGroup scroll options={[{ value: '', label: 'None' }, ...SUPPLEMENTS.map((s) => ({ value: s.id, label: s.name }))]} value={form.referenceId ?? ''} onChange={(v) => setForm((f) => ({ ...f, referenceId: (v as string) || undefined }))} />
            <Field label="Ingredients / notes (optional)" value={form.ingredientsNote ?? ''} onChangeText={(t) => setForm((f) => ({ ...f, ingredientsNote: t || undefined }))} multiline />
            <Toggle label="Track when I take it" value={!!form.trackConsistency} onChange={(v) => setForm((f) => ({ ...f, trackConsistency: v }))} />
            <Button label="Save" disabled={!form.name?.trim()} onPress={add} />
          </Card>
        </>
      )}
      {tab === 'learn' && (
        <>
          {SUPPLEMENTS.map((s) => (
            <Card key={s.id} onPress={() => setOpen(open === s.id ? undefined : s.id)} accessibilityLabel={s.name}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="label">{s.name}</Text>
                <Badge label={`Evidence: ${s.evidence}`} tone={s.evidence === 'strong' ? 'success' : s.evidence === 'moderate' ? 'primary' : 'default'} />
              </View>
              <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>{s.summary}</Text>
              {open === s.id ? (
                <View style={{ gap: 6, marginTop: 8 }}>
                  <Text variant="caption"><Text variant="caption" style={{ fontWeight: '700' }}>Common use: </Text>{s.commonUse}</Text>
                  <Text variant="caption" style={{ fontWeight: '700' }}>Cautions</Text>
                  {s.cautions.map((x) => <Text key={x} variant="caption" tone="muted">• {x}</Text>)}
                  {s.interactions.length ? <Text variant="caption" style={{ fontWeight: '700' }}>Possible interactions</Text> : null}
                  {s.interactions.map((x) => <Text key={x} variant="caption" tone="muted">• {x}</Text>)}
                  <Text variant="caption" tone="subtle">Source: {s.sources.map((x) => `${x.title} — ${x.publisher}`).join('; ')}</Text>
                </View>
              ) : null}
            </Card>
          ))}
          <Card variant="hero" style={{ gap: 8 }}>
            <Text variant="heading">Ask about a supplement</Text>
            <Field label="Question" placeholder="e.g. Is creatine safe to take long term?" value={question} onChangeText={setQuestion} />
            <Button label="Ask" icon="sparkles" size="sm" disabled={!question.trim()} onPress={ask} loading={busy} />
            {answer ? <Text>{answer}</Text> : null}
          </Card>
        </>
      )}
      {tab === 'compare' && (
        <>
          <Text tone="muted">Pick two or three to compare evidence, cautions and interactions.</Text>
          <ChipGroup multi options={SUPPLEMENTS.map((s) => ({ value: s.id, label: s.name }))} value={compare} onChange={(v) => setCompare((v as string[]).slice(-3))} />
          {compare.map((id) => {
            const s = SUPPLEMENT_MAP.get(id)!;
            return (
              <Card key={id}>
                <ListRow title={s.name} subtitle={`Evidence: ${s.evidence} · ${s.category}`} />
                <Text variant="caption" tone="muted">{s.commonUse}</Text>
                <Text variant="caption" tone="subtle" style={{ marginTop: 4 }}>Cautions: {s.cautions.length} · Interactions: {s.interactions.join(' ') || 'none listed'}</Text>
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}
