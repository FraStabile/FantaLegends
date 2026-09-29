import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Catalog, eligibleItems, SLOTS, type CatalogItem, type Position, type Slot } from '@asta/core';
import { C, R, S, SLOT_COLORS, T } from '@/lib/theme';
import { useLeague } from '@/lib/hooks/useLeague';
import { clientFor } from '@/lib/store/session';
import { toast } from '@/lib/store/toasts';
import { haptic } from '@/lib/haptics';
import { SLOT_IT, SLOT_SHORT } from '@/lib/format';
import type { GenerationPreview } from '@/lib/net/types';
import { Button, Card, Chip, EmptyState, Header, ItemRow, Pill, Row, Screen, Section, Segmented, Stepper, TextField } from '@/components/ui';

const DEFAULT_PROMPT = 'Genera 40 giocatori storici, dal 1980 al 2025, distribuiti in modo equilibrato per ruolo.';
const PAGE = 60;

export default function PoolScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { view, isMaster } = useLeague(id);
  const [slot, setSlot] = useState<Slot | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const items = useMemo(() => (view ? eligibleItems(view.config, view.customItems) : []), [view?.config, view?.customItems]);
  const counts = useMemo(() => {
    const out: Record<Slot, number> = { GK: 0, DF: 0, MF: 0, FW: 0, COACH: 0 };
    for (const i of items) out[Catalog.slotOf(i)]++;
    return out;
  }, [items]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => (slot === 'ALL' || Catalog.slotOf(i) === slot) && (!q || i.name.toLowerCase().includes(q)))
      .sort((a, b) => b.overall - a.overall);
  }, [items, slot, query]);

  if (!view) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={C.gold} size="large" />
        </View>
      </Screen>
    );
  }

  const canEdit = isMaster && view.status === 'lobby';
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/league/${id}`));

  return (
    <Screen>
      <Row style={{ marginBottom: S.sm }}>
        <Button small variant="ghost" label="‹ Lega" onPress={back} />
      </Row>
      <Header kicker={view.config.name} title="Pool giocatori" subtitle={`${items.length} elementi idonei · preset ${view.config.poolPreset}`} />

      {view.config.poolPreset === 'CUSTOM' ? (
        <Card style={{ marginTop: S.md, borderColor: C.goldDeep }}>
          <Text style={T.small}>🎨 Preset CUSTOM: all'asta andranno solo i giocatori aggiunti dal Master (a mano o generati con l'AI).</Text>
        </Card>
      ) : null}

      {canEdit ? (
        <>
          <AiGenerator leagueId={view.id} />
          <ManualPlayerForm leagueId={view.id} />
          <CustomItemsList leagueId={view.id} items={view.customItems} />
        </>
      ) : null}

      <Section title="Elementi idonei">
        <TextField value={query} onChangeText={(t) => { setQuery(t); setLimit(PAGE); }} placeholder="🔍 Cerca per nome" autoCorrect={false} />
        <View style={styles.chips}>
          <Chip label={`Tutti ${items.length}`} active={slot === 'ALL'} onPress={() => { setSlot('ALL'); setLimit(PAGE); }} />
          {SLOTS.map((s) => (
            <Chip key={s} label={`${SLOT_SHORT[s]} ${counts[s]}`} color={SLOT_COLORS[s]} active={slot === s} onPress={() => { setSlot(s); setLimit(PAGE); }} />
          ))}
        </View>
        {filtered.length === 0 ? (
          <EmptyState emoji="🕵️" title="Nessun giocatore" body={view.config.poolPreset === 'CUSTOM' ? 'Aggiungi giocatori manualmente o generali con l\'AI.' : 'Prova a cambiare filtro o ricerca.'} />
        ) : (
          <Card style={{ paddingVertical: S.xs }}>
            {filtered.slice(0, limit).map((item) => (
              <ItemRow key={item.id} item={item} onPress={() => router.push(`/player/${item.id}?league=${view.id}`)} />
            ))}
            {filtered.length > limit ? (
              <Button small variant="ghost" label={`Mostra altri (${filtered.length - limit})`} style={{ marginVertical: S.md }} onPress={() => setLimit((l) => l + PAGE)} />
            ) : null}
          </Card>
        )}
      </Section>
    </Screen>
  );
}

// ───────────────────────────── AI generation

function AiGenerator({ leagueId }: { leagueId: string }) {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<GenerationPreview | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const generate = async () => {
    setLoading(true);
    try {
      const p = await clientFor(leagueId).generatePlayers(leagueId, prompt.trim());
      setPreview(p);
      setSelected(new Set(p.items.map((i) => i.id)));
      haptic.success();
    } catch (e) {
      toast.error('Generazione fallita', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (!preview) return;
    setConfirming(true);
    try {
      const n = await clientFor(leagueId).confirmGeneration(leagueId, preview.generationId, [...selected]);
      toast.gold(`${n} giocatori aggiunti al pool! ✨`);
      setPreview(null);
      setSelected(new Set());
    } catch (e) {
      toast.error('Impossibile aggiungere', (e as Error).message);
    } finally {
      setConfirming(false);
    }
  };

  const toggle = (itemId: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });

  return (
    <Section title="Genera con AI">
      <Card>
        <Text style={[T.small, { marginBottom: S.sm }]}>Descrivi i giocatori che vuoi: epoca, numero, ruoli. Ci pensa l'AI ✨</Text>
        <TextField value={prompt} onChangeText={setPrompt} multiline maxLength={400} style={{ height: 96, paddingTop: S.md, textAlignVertical: 'top' }} />
        <Button label="Genera giocatori" icon="✨" variant="primary" loading={loading} disabled={prompt.trim().length < 5} onPress={() => void generate()} />

        {preview ? (
          <View style={{ marginTop: S.lg }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Pill label={preview.source === 'claude' ? '🤖 CLAUDE AI' : '💾 DATABASE OFFLINE'} color={preview.source === 'claude' ? C.gold : C.cyan} solid />
              <Text style={[T.small, T.number]}>
                {selected.size}/{preview.items.length} selezionati
              </Text>
            </Row>
            {preview.note ? <Text style={[T.small, { marginTop: S.sm }]}>{preview.note}</Text> : null}
            {preview.rejected > 0 ? <Text style={[T.small, { marginTop: 2, color: C.orange }]}>{preview.rejected} scartati perché non validi</Text> : null}
            <Row style={{ marginTop: S.sm }}>
              <Button small variant="ghost" label="Tutti" onPress={() => setSelected(new Set(preview.items.map((i) => i.id)))} />
              <Button small variant="ghost" label="Nessuno" onPress={() => setSelected(new Set())} />
            </Row>
            <View style={{ marginTop: S.sm }}>
              {preview.items.map((item) => {
                const on = selected.has(item.id);
                return (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onPress={() => toggle(item.id)}
                    right={
                      <View style={[styles.check, on && styles.checkOn]}>
                        {on ? <Text style={{ color: '#1A1405', fontWeight: '900' }}>✓</Text> : null}
                      </View>
                    }
                  />
                );
              })}
            </View>
            <Row style={{ marginTop: S.md }}>
              <Button label="Scarta" variant="ghost" style={{ flex: 1 }} onPress={() => setPreview(null)} />
              <Button label={`Aggiungi ${selected.size} al pool`} variant="gold" style={{ flex: 2 }} disabled={selected.size === 0} loading={confirming} onPress={() => void confirm()} />
            </Row>
          </View>
        ) : null}
      </Card>
    </Section>
  );
}

// ───────────────────────────── manual player

function ManualPlayerForm({ leagueId }: { leagueId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position>('FW');
  const [overall, setOverall] = useState(75);
  const [nationality, setNationality] = useState('ITA');
  const [prime, setPrime] = useState('2020-2024');
  const [club, setClub] = useState('');
  const [busy, setBusy] = useState(false);

  const primeOk = /^\d{4}-\d{4}$/.test(prime);
  const valid = name.trim().length >= 2 && nationality.trim().length >= 2 && primeOk;

  const submit = async () => {
    setBusy(true);
    try {
      const item = await clientFor(leagueId).addCustomPlayer(leagueId, {
        name: name.trim(),
        position,
        overall,
        nationality: nationality.trim().toUpperCase(),
        primePeriod: prime,
        historicalClub: club.trim() || undefined,
      });
      haptic.success();
      toast.success(`${item.name} aggiunto! ⚽`, `${SLOT_IT[Catalog.slotOf(item)]} · ${item.overall} OVR`);
      setName('');
      setClub('');
    } catch (e) {
      toast.error('Impossibile aggiungere', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Aggiungi giocatore manualmente">
      <Card>
        {!open ? (
          <Button variant="dark" icon="➕" label="Crea un giocatore" onPress={() => setOpen(true)} />
        ) : (
          <>
            <TextField label="Nome" value={name} onChangeText={setName} maxLength={40} placeholder="Es. Mario Rossi" />
            <Text style={[T.tiny, { marginBottom: 6 }]}>Ruolo</Text>
            <Segmented<Position>
              options={(['GK', 'DF', 'MF', 'FW'] as Position[]).map((p) => ({ value: p, label: SLOT_SHORT[p] }))}
              value={position}
              onChange={setPosition}
            />
            <Stepper label="Overall" value={overall} onChange={setOverall} min={40} max={99} />
            <Row style={{ marginTop: S.md, alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <TextField label="Nazionalità" value={nationality} onChangeText={(t) => setNationality(t.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))} maxLength={3} autoCapitalize="characters" placeholder="ITA" />
              </View>
              <View style={{ flex: 1.4 }}>
                <TextField label="Prime" value={prime} onChangeText={setPrime} maxLength={9} placeholder="2005-2010" keyboardType="numbers-and-punctuation" />
              </View>
            </Row>
            {!primeOk ? <Text style={[T.small, { color: C.orange, marginTop: -S.sm, marginBottom: S.sm }]}>Formato prime: AAAA-AAAA</Text> : null}
            <TextField label="Club storico" value={club} onChangeText={setClub} maxLength={40} placeholder="Es. Amatori Calcio" />
            <Row>
              <Button label="Chiudi" variant="ghost" style={{ flex: 1 }} onPress={() => setOpen(false)} />
              <Button label="Aggiungi" icon="⚽" variant="gold" style={{ flex: 2 }} disabled={!valid} loading={busy} onPress={() => void submit()} />
            </Row>
          </>
        )}
      </Card>
    </Section>
  );
}

// ───────────────────────────── custom items

function CustomItemsList({ leagueId, items }: { leagueId: string; items: CatalogItem[] }) {
  const [removing, setRemoving] = useState<string | null>(null);
  const remove = async (item: CatalogItem) => {
    setRemoving(item.id);
    try {
      await clientFor(leagueId).removeCustomItem(leagueId, item.id);
      toast.info(`${item.name} rimosso dal pool`);
    } catch (e) {
      toast.error('Impossibile rimuovere', (e as Error).message);
    } finally {
      setRemoving(null);
    }
  };
  return (
    <Section title={`Giocatori personalizzati · ${items.length}`}>
      <Card style={{ paddingVertical: S.xs }}>
        {items.length === 0 ? (
          <Text style={[T.small, { paddingVertical: S.md }]}>Nessun giocatore personalizzato. Generali con l'AI o creali a mano!</Text>
        ) : (
          items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onPress={() => router.push(`/player/${item.id}?league=${leagueId}`)}
              right={
                <Pressable onPress={() => void remove(item)} disabled={removing === item.id} style={styles.remove} hitSlop={8}>
                  {removing === item.id ? <ActivityIndicator color={C.red} size="small" /> : <Text style={{ color: C.red, fontWeight: '900' }}>✕</Text>}
                </Pressable>
              }
            />
          ))
        )}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: S.sm },
  check: { width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: C.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: C.gold, borderColor: C.gold },
  remove: { width: 32, height: 32, borderRadius: R.pill, borderWidth: 1, borderColor: `${C.red}66`, alignItems: 'center', justifyContent: 'center' },
});
