import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { AI_CONTEXT_LABELS, type AiContextCategory } from '@forma/shared';
import { db } from '@/lib/firebase';
import { useData } from '@/lib/data';
import { useProfile } from '@/lib/profile';
import { useConfig, useFeature } from '@/lib/config';
import { api, apiErrorMessage } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { Text } from '@/components/ui/Text';
import { Button, IconButton } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Banner, EmptyState } from '@/components/ui/Feedback';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  safety?: string;
  disclaimers?: string[];
  degraded?: boolean;
  feedback?: 'up' | 'down';
  contextUsed?: AiContextCategory[];
  pending?: boolean;
}
interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

const SUGGESTIONS = [
  'Create a workout for my goal',
  'What should I eat today?',
  'Help with my knee discomfort',
  'Am I recovering well?',
  'Explain progressive overload',
  'Skincare basics for better skin',
  'Which supplements have good evidence?',
];

export default function Coach() {
  const { c } = useTheme();
  const { uid } = useData();
  const { profile } = useProfile();
  const { config } = useConfig();
  const feature = useFeature('aiCoach');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [cid, setCid] = useState<string>();
  const [loadedMessages, setLoadedMessages] = useState<{ cid: string; items: Msg[] }>();
  const messages = cid && loadedMessages?.cid === cid ? loadedMessages.items : [];
  const [optimistic, setOptimistic] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [showHistory, setShowHistory] = useState(false);
  const consented = (profile?.consent?.aiContext ?? []) as AiContextCategory[];
  // Per-request narrowing of what's shared; defaults to the stored consent.
  const [shareOverride, setShareOverride] = useState<AiContextCategory[]>();
  const share = (shareOverride ?? consented).filter((k) => consented.includes(k));
  const setShare = (fn: (s: AiContextCategory[]) => AiContextCategory[]) => setShareOverride(fn(share));
  const list = useRef<FlatList<Msg>>(null);

  useEffect(
    () =>
      onSnapshot(query(collection(db, `users/${uid}/aiConversations`), orderBy('updatedAt', 'desc'), limit(30)), (snap) =>
        setConversations(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Conversation, 'id'>) }))),
      () => undefined),
    [uid],
  );
  useEffect(() => {
    if (!cid) return;
    return onSnapshot(query(collection(db, `users/${uid}/aiConversations/${cid}/messages`), orderBy('createdAt'), limit(200)), (snap) => {
      setLoadedMessages({ cid, items: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Msg, 'id'>) })) });
      setOptimistic([]);
    }, () => undefined);
  }, [uid, cid]);

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || busy) return;
    setError(undefined);
    setText('');
    setBusy(true);
    setOptimistic([{ id: 'local', role: 'user', content: message, createdAt: new Date().toISOString(), pending: true }]);
    try {
      const res = await api.aiChat({ conversationId: cid, message, shareContext: share });
      if (!cid) setCid(res.conversationId);
      else setOptimistic([]);
    } catch (e) {
      setError(apiErrorMessage(e));
      setOptimistic([]);
      setText(message);
    } finally {
      setBusy(false);
    }
  };

  const feedback = (m: Msg, value: 'up' | 'down') => cid && api.aiFeedback({ conversationId: cid, messageId: m.id, value }).catch(() => undefined);

  if (!feature.enabled) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.background, padding: 16 }}>
        <Text variant="title">AI Coach</Text>
        <EmptyState icon="pause-circle-outline" title="Taking a short break" message={feature.message} actionLabel="Browse exercises" onAction={() => router.push('/exercises')} />
      </SafeAreaView>
    );
  }

  const all = [...messages, ...optimistic];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 10 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="sparkles" size={22} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="heading">AI Coach</Text>
            <Text variant="caption" tone="muted">{config ? `${config.ai.usedToday}/${config.ai.dailyLimit} today · ${config.entitlement.planName}` : 'Fitness & wellness assistant'}</Text>
          </View>
          <IconButton icon="time-outline" label="Conversation history" onPress={() => setShowHistory((s) => !s)} />
          <IconButton icon="create-outline" label="New conversation" onPress={() => { setCid(undefined); setShowHistory(false); }} />
        </View>

        {showHistory ? (
          <View style={{ paddingHorizontal: 16, gap: 6, maxHeight: 260 }}>
            {conversations.length ? conversations.map((cv) => (
              <Pressable key={cv.id} accessibilityRole="button" onPress={() => { setCid(cv.id); setShowHistory(false); }} onLongPress={() => deleteDoc(doc(db, `users/${uid}/aiConversations/${cv.id}`)).catch(() => undefined)} style={{ padding: 12, borderRadius: 12, backgroundColor: cv.id === cid ? c.surfaceRaised : c.surface }}>
                <Text variant="label" numberOfLines={1}>{cv.title}</Text>
                <Text variant="caption" tone="subtle">{cv.updatedAt.slice(0, 10)} · long-press to delete</Text>
              </Pressable>
            )) : <Text variant="caption" tone="muted">No conversations yet.</Text>}
          </View>
        ) : null}

        <FlatList
          ref={list}
          style={{ flex: 1 }}
          data={all}
          keyExtractor={(m) => m.id}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1, maxWidth: 760, width: '100%', alignSelf: 'center' }}
          ListEmptyComponent={
            <View style={{ gap: 12 }}>
              <Text variant="title" style={{ textAlign: 'center' }}>How can I help today?</Text>
              <Text variant="caption" tone="muted" style={{ textAlign: 'center' }}>General fitness and wellness education. I can’t diagnose or treat medical conditions.</Text>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} accessibilityRole="button" onPress={() => send(s)} style={({ pressed }) => ({ padding: 14, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, opacity: pressed ? 0.7 : 1, flexDirection: 'row', alignItems: 'center', gap: 10 })}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color={c.primary} />
                  <Text variant="label">{s}</Text>
                </Pressable>
              ))}
            </View>
          }
          renderItem={({ item: m }) => (
            <View style={{ alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <View
                style={{
                  maxWidth: '88%',
                  padding: 14,
                  borderRadius: 18,
                  backgroundColor: m.role === 'user' ? c.primary : c.surface,
                  borderWidth: m.role === 'user' ? 0 : 1,
                  borderColor: m.safety === 'red_flag' ? c.danger : c.border,
                  opacity: m.pending ? 0.7 : 1,
                }}>
                {m.safety === 'red_flag' ? <Text variant="overline" tone="danger" style={{ marginBottom: 4 }}>Safety first</Text> : null}
                <Text style={{ color: m.role === 'user' ? c.primaryText : c.text }} selectable>{m.content}</Text>
                {m.disclaimers?.map((d) => <Text key={d} variant="caption" tone="subtle" style={{ marginTop: 8 }}>{d}</Text>)}
                {m.role === 'assistant' && m.contextUsed?.length ? <Text variant="caption" tone="subtle" style={{ marginTop: 6 }}>Used: {m.contextUsed.join(', ')}</Text> : null}
              </View>
              {m.role === 'assistant' && !m.degraded && m.safety !== 'red_flag' ? (
                <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Helpful" onPress={() => feedback(m, 'up')} hitSlop={8} style={{ padding: 6 }}>
                    <Ionicons name={m.feedback === 'up' ? 'thumbs-up' : 'thumbs-up-outline'} size={16} color={c.textSubtle} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Not helpful" onPress={() => feedback(m, 'down')} hitSlop={8} style={{ padding: 6 }}>
                    <Ionicons name={m.feedback === 'down' ? 'thumbs-down' : 'thumbs-down-outline'} size={16} color={c.textSubtle} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}
          ListFooterComponent={busy ? <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">Coach is thinking…</Text> : undefined}
        />

        <View style={{ padding: 12, gap: 8, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.background }}>
          {error ? <Banner tone="warning">{error}</Banner> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <Text variant="caption" tone="subtle">Share:</Text>
            {consented.length ? consented.map((k) => (
              <Chip key={k} label={AI_CONTEXT_LABELS[k].split(' (')[0]!} selected={share.includes(k)} onPress={() => setShare((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))} />
            )) : <Text variant="caption" tone="subtle" onPress={() => router.push('/settings/privacy')}>No personal data · change in Privacy</Text>}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <TextInput
              testID="coach-input"
              accessibilityLabel="Message the AI Coach"
              value={text}
              onChangeText={setText}
              placeholder="Ask anything…"
              placeholderTextColor={c.textSubtle}
              multiline
              maxLength={4000}
              style={{ flex: 1, minHeight: 48, maxHeight: 140, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, color: c.text, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, fontSize: 16 }}
            />
            <Button label="Send" testID="coach-send" icon="send" onPress={() => send(text)} loading={busy} disabled={!text.trim()} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
