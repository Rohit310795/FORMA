import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MEALS, scaleMacros, searchFoods, type FoodItem, type Macros, type NutritionEntry, type SavedMeal } from '@forma/shared';
import { useTheme } from '@/lib/theme';
import { useProfile } from '@/lib/profile';
import { useCollection, useMutations } from '@/lib/data';
import { newId, nowIso } from '@/lib/ids';
import { Text } from '@/components/ui/Text';
import { Button, IconButton } from '@/components/ui/Button';
import { ChipGroup, Field, NumberField, Segmented, Stepper } from '@/components/ui/Controls';
import { Badge, Banner } from '@/components/ui/Feedback';

type Meal = (typeof MEALS)[number];
const DIET_TAG: Record<string, string | undefined> = { vegetarian: 'veg', vegan: 'vegan', eggetarian: undefined, jain: 'veg', gluten_free: 'gluten_free' };

function dietWarnings(food: FoodItem, diet?: string, allergies: string[] = []): string[] {
  const out: string[] = [];
  const tag = diet ? DIET_TAG[diet] : undefined;
  if (tag && !food.tags.includes(tag) && !(tag === 'veg' && food.tags.includes('vegan'))) out.push(`Not marked ${diet!.replace('_', '-')}`);
  if (diet === 'eggetarian' && !food.tags.some((t) => ['veg', 'vegan', 'eggetarian'].includes(t))) out.push('Not marked eggetarian');
  const hay = [food.name, ...food.aliases].join(' ').toLowerCase();
  for (const a of allergies) if (a && hay.includes(a.toLowerCase())) out.push(`Contains “${a}”?`);
  if (allergies.some((a) => /dairy|milk|lactose/i.test(a)) && /paneer|dahi|curd|milk|lassi|ghee|whey|yogurt|chaas/i.test(hay)) out.push('May contain dairy');
  if (allergies.some((a) => /nut|peanut|almond/i.test(a)) && /almond|peanut/i.test(hay)) out.push('Contains nuts');
  return out;
}

export function MealLogger({ visible, onClose, dayKey, defaultMeal }: { visible: boolean; onClose: () => void; dayKey: string; defaultMeal: Meal }) {
  const { c } = useTheme();
  const { profile } = useProfile();
  const { save } = useMutations();
  const { items: saved } = useCollection<SavedMeal>('savedMeals');
  const [mode, setMode] = useState<'search' | 'manual' | 'saved'>('search');
  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [q, setQ] = useState('');
  const [food, setFood] = useState<FoodItem>();
  const [servings, setServings] = useState(1);
  const [override, setOverride] = useState<Partial<Macros>>({});
  const [manual, setManual] = useState<{ name: string } & Partial<Macros>>({ name: '' });
  const results = useMemo(() => searchFoods(q, 40), [q]);

  const reset = () => {
    setFood(undefined);
    setServings(1);
    setOverride({});
    setManual({ name: '' });
    setQ('');
  };
  const log = async (entry: Omit<NutritionEntry, 'id' | 'createdAt' | 'updatedAt' | 'revision' | 'source' | 'dayKey' | 'meal'>) => {
    const id = newId();
    await save('nutritionLogs', id, { ...entry, id, dayKey, meal, createdAt: nowIso(), updatedAt: nowIso(), revision: 0, source: 'manual' });
    reset();
    onClose();
  };
  const scaled = food ? scaleMacros(food.per, servings) : undefined;
  const finalMacros = scaled ? { ...scaled, ...Object.fromEntries(Object.entries(override).filter(([, v]) => v !== undefined)) } : undefined;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
        <View style={{ padding: 16, gap: 12, flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="heading">Log food</Text>
            <IconButton icon="close" label="Close" onPress={() => { reset(); onClose(); }} />
          </View>
          <ChipGroup options={MEALS.map((m) => ({ value: m, label: m[0]!.toUpperCase() + m.slice(1) }))} value={meal} onChange={(v) => setMeal(v as Meal)} />
          <Segmented options={[{ value: 'search', label: 'Search' }, { value: 'manual', label: 'Manual' }, { value: 'saved', label: 'Saved meals' }]} value={mode} onChange={(m) => { setMode(m); setFood(undefined); }} />

          {mode === 'search' && !food && (
            <>
              <Field label="Search foods" placeholder="e.g. roti, dal, paneer, oats" value={q} onChangeText={setQ} autoFocus />
              <Text variant="caption" tone="subtle">Starter database with approximate values. Recipes and portions vary — adjust if you know better.</Text>
              <FlatList
                data={results}
                keyExtractor={(f) => f.id}
                renderItem={({ item }) => (
                  <Pressable accessibilityRole="button" onPress={() => setFood(item)} style={({ pressed }) => ({ paddingVertical: 12, borderBottomWidth: 1, borderColor: c.border, opacity: pressed ? 0.7 : 1 })}>
                    <Text variant="label">{item.name}</Text>
                    <Text variant="caption" tone="muted">{item.serving} · ~{item.per.kcal} kcal · P {item.per.proteinG}g · C {item.per.carbsG}g · F {item.per.fatG}g</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                      {dietWarnings(item, profile?.dietPreference, profile?.allergies).map((w) => <Badge key={w} label={w} tone="warning" />)}
                    </View>
                  </Pressable>
                )}
              />
            </>
          )}

          {mode === 'search' && food && finalMacros && (
            <View style={{ gap: 12 }}>
              <Text variant="title" style={{ fontSize: 20 }}>{food.name}</Text>
              <Text variant="caption" tone="muted">Per serving: {food.serving}. {food.sourceNote}</Text>
              {dietWarnings(food, profile?.dietPreference, profile?.allergies).map((w) => <Banner key={w} tone="warning">{w} — please check before eating.</Banner>)}
              <Stepper label="Servings" value={servings} step={0.5} min={0.5} max={10} onChange={setServings} />
              <Text variant="label">Values (edit to correct)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {(['kcal', 'proteinG', 'carbsG', 'fatG'] as const).map((k) => (
                  <View key={`${k}-${servings}`} style={{ width: '47%' }}>
                    <NumberField label={{ kcal: 'Calories', proteinG: 'Protein g', carbsG: 'Carbs g', fatG: 'Fat g' }[k]} value={finalMacros[k]} onChange={(v) => setOverride((o) => ({ ...o, [k]: v }))} decimals={1} />
                  </View>
                ))}
              </View>
              <Button label="Add to log" testID="add-food" onPress={() => log({ name: food.name, foodId: food.id, servings, macros: finalMacros as Macros, estimated: true })} />
              <Button label="Back to search" variant="ghost" onPress={() => setFood(undefined)} />
            </View>
          )}

          {mode === 'manual' && (
            <View style={{ gap: 10 }}>
              <Field label="What did you eat?" value={manual.name} onChangeText={(t) => setManual((m) => ({ ...m, name: t }))} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {(['kcal', 'proteinG', 'carbsG', 'fatG'] as const).map((k) => (
                  <View key={k} style={{ width: '47%' }}>
                    <NumberField label={{ kcal: 'Calories', proteinG: 'Protein g', carbsG: 'Carbs g', fatG: 'Fat g' }[k]} value={manual[k]} onChange={(v) => setManual((m) => ({ ...m, [k]: v }))} decimals={1} />
                  </View>
                ))}
              </View>
              <Text variant="caption" tone="subtle">Your best estimate is fine. Entries are marked as estimates.</Text>
              <Button
                label="Add to log"
                disabled={!manual.name.trim() || manual.kcal === undefined}
                onPress={() => log({ name: manual.name.trim(), servings: 1, macros: { kcal: manual.kcal ?? 0, proteinG: manual.proteinG ?? 0, carbsG: manual.carbsG ?? 0, fatG: manual.fatG ?? 0 }, estimated: true })}
              />
            </View>
          )}

          {mode === 'saved' && (
            <FlatList
              data={saved}
              keyExtractor={(m) => m.id}
              ListEmptyComponent={<Text tone="muted">Save a combination of foods from today’s log to reuse it.</Text>}
              renderItem={({ item }) => {
                const total = item.items.reduce((a, i) => ({ kcal: a.kcal + i.macros.kcal, proteinG: a.proteinG + i.macros.proteinG, carbsG: a.carbsG + i.macros.carbsG, fatG: a.fatG + i.macros.fatG }), { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
                return (
                  <Pressable accessibilityRole="button" onPress={() => log({ name: item.name, servings: 1, macros: total, estimated: true })} style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: c.border }}>
                    <Text variant="label">{item.name}</Text>
                    <Text variant="caption" tone="muted">{item.items.map((i) => i.name).join(', ')} · ~{Math.round(total.kcal)} kcal</Text>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
