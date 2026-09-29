import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  POOL_PRESETS,
  POOL_SETS,
  totalSlots,
  type CommentaryTone,
  type CompetitionFormat,
  type LeagueConfig,
  type PoolPreset,
  type UnsoldPolicy,
} from '@asta/core';
import { C, R, S, T } from '@/lib/theme';
import { FORMAT_IT, TONE_IT } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { Card, Chip, Row, Section, Segmented, Stepper, SwitchRow, TextField } from '@/components/ui';

const FORMATS: CompetitionFormat[] = ['round_robin', 'double_round_robin', 'groups_knockout', 'knockout'];
const TONES = Object.keys(TONE_IT) as CommentaryTone[];

/** Light client-side checks; the server stays authoritative. Returns the first problem found. */
export function validateConfig(cfg: LeagueConfig): string | null {
  const name = cfg.name.trim();
  if (name.length < 2) return 'Il nome della lega deve avere almeno 2 caratteri';
  if (name.length > 40) return 'Il nome della lega può avere al massimo 40 caratteri';
  const players = cfg.roster.GK + cfg.roster.DF + cfg.roster.MF + cfg.roster.FW;
  if (cfg.roster.GK < 1) return 'Serve almeno un portiere';
  if (players < 2) return 'La rosa deve avere almeno 2 giocatori';
  if (totalSlots(cfg) * cfg.minPrice > cfg.startingCredits) return 'Crediti insufficienti: slot × prezzo minimo supera i crediti iniziali';
  if (cfg.format === 'groups_knockout' && cfg.maxParticipants < 4) return 'Il formato a gironi richiede almeno 4 partecipanti';
  if (cfg.customRules.length > 500) return 'Regole personalizzate: massimo 500 caratteri';
  return null;
}

export function rosterSummary(cfg: LeagueConfig): string {
  const r = cfg.roster;
  const parts = [`${r.GK} POR`, `${r.DF} DIF`, `${r.MF} CEN`, `${r.FW} ATT`];
  if (r.coach) parts.push('ALL');
  return parts.join(' · ');
}

export function LeagueConfigForm({ value, onChange }: { value: LeagueConfig; onChange: (cfg: LeagueConfig) => void }) {
  const set = <K extends keyof LeagueConfig>(key: K, v: LeagueConfig[K]) => onChange({ ...value, [key]: v });
  const setRoster = (patch: Partial<LeagueConfig['roster']>) => onChange({ ...value, roster: { ...value.roster, ...patch } });
  const setVis = (patch: Partial<LeagueConfig['visibility']>) => onChange({ ...value, visibility: { ...value.visibility, ...patch } });
  const toggleSet = (id: string) =>
    set('poolSets', value.poolSets.includes(id) ? value.poolSets.filter((s) => s !== id) : [...value.poolSets, id].slice(0, 10));

  const slots = totalSlots(value);
  const error = validateConfig(value);
  const preset = POOL_PRESETS.find((p) => p.id === value.poolPreset);

  return (
    <View>
      <Section title="La lega">
        <Card>
          <TextField label="Nome lega" value={value.name} onChangeText={(t) => set('name', t)} maxLength={40} placeholder="Es. Lega dei Campioni" />
          <Stepper label="Numero partecipanti" value={value.maxParticipants} onChange={(v) => set('maxParticipants', v)} min={2} max={12} />
          <Stepper label="Crediti iniziali" value={value.startingCredits} onChange={(v) => set('startingCredits', v)} min={5} max={1000} step={5} />
          <Text style={[T.tiny, styles.label]}>Formato competizione</Text>
          <Segmented wrap options={FORMATS.map((f) => ({ value: f, label: FORMAT_IT[f] }))} value={value.format} onChange={(v) => set('format', v)} />
          <SwitchRow label="Casa e trasferta" hint="Vantaggio del fattore campo" value={value.homeAway} onChange={(v) => set('homeAway', v)} />
          <SwitchRow label="Playoff" hint="Fase finale a eliminazione diretta" value={value.playoffs} onChange={(v) => set('playoffs', v)} />
          {value.playoffs ? (
            <View style={{ marginTop: S.md }}>
              <Text style={[T.tiny, { marginBottom: 6 }]}>Squadre ai playoff</Text>
              <Segmented
                options={[
                  { value: '2', label: '2 · Solo finale' },
                  { value: '4', label: '4 · Semi + finale' },
                ]}
                value={String(value.playoffTeams) as '2' | '4'}
                onChange={(v) => set('playoffTeams', v === '2' ? 2 : 4)}
              />
            </View>
          ) : null}
        </Card>
      </Section>

      <Section title="Rosa" right={<Text style={[T.small, T.number, { color: C.gold, fontWeight: '800' }]}>{slots} slot</Text>}>
        <Card>
          <Stepper label="Portieri" value={value.roster.GK} onChange={(v) => setRoster({ GK: v })} min={1} max={3} />
          <Stepper label="Difensori" value={value.roster.DF} onChange={(v) => setRoster({ DF: v })} min={0} max={6} />
          <Stepper label="Centrocampisti" value={value.roster.MF} onChange={(v) => setRoster({ MF: v })} min={0} max={6} />
          <Stepper label="Attaccanti" value={value.roster.FW} onChange={(v) => setRoster({ FW: v })} min={0} max={6} />
          <SwitchRow label="Allenatore" hint="Ogni squadra compra anche un allenatore" value={value.roster.coach} onChange={(v) => setRoster({ coach: v })} />
          <Row style={styles.totalRow}>
            <Text style={T.small}>{rosterSummary(value)}</Text>
            <Text style={[T.h3, T.number, { color: C.gold }]}>{slots} TOT</Text>
          </Row>
        </Card>
      </Section>

      <Section title="Asta">
        <Card>
          <Stepper label="Timer dopo ogni offerta" value={value.bidTimerSeconds} onChange={(v) => set('bidTimerSeconds', v)} min={3} max={60} suffix="s" />
          <Stepper label="Timer apertura lotto" value={value.openingTimerSeconds} onChange={(v) => set('openingTimerSeconds', v)} min={5} max={120} suffix="s" />
          <Stepper label="Incremento minimo" value={value.minIncrement} onChange={(v) => set('minIncrement', v)} min={1} max={50} />
          <Stepper label="Prezzo minimo" value={value.minPrice} onChange={(v) => set('minPrice', v)} min={1} max={20} />
          <Text style={[T.tiny, styles.label]}>Giocatori invenduti</Text>
          <Segmented<UnsoldPolicy>
            options={[
              { value: 'discard', label: 'Scartati' },
              { value: 'requeue', label: 'Rimessi nel pool' },
            ]}
            value={value.unsoldPolicy ?? 'discard'}
            onChange={(v) => set('unsoldPolicy', v)}
          />
          <Text style={[T.small, { marginTop: S.sm }]}>
            {(value.unsoldPolicy ?? 'discard') === 'discard'
              ? 'Chi non riceve offerte esce dall\'asta. Gli scarti servono solo a completare d\'ufficio le rose rimaste scoperte.'
              : 'Chi non riceve offerte torna in fondo al pool e viene richiamato una seconda volta.'}
          </Text>
          <Text style={[T.small, { marginTop: S.sm }]}>
            Riserva minima per completare la rosa: {slots * value.minPrice} / {value.startingCredits} crediti
          </Text>
        </Card>
      </Section>

      <Section title="Pool giocatori">
        <Card>
          <Segmented<PoolPreset> wrap options={POOL_PRESETS.map((p) => ({ value: p.id, label: p.label }))} value={value.poolPreset} onChange={(v) => set('poolPreset', v)} />
          {preset ? <Text style={[T.small, { marginTop: S.sm }]}>{preset.description}</Text> : null}
          <Text style={[T.tiny, styles.label]}>Set tematici {value.poolSets.length ? `(${value.poolSets.length})` : '· tutti'}</Text>
          <View style={styles.wrap}>
            {POOL_SETS.map((s) => (
              <Chip key={s.id} label={`${s.emoji} ${s.label}`} active={value.poolSets.includes(s.id)} onPress={() => toggleSet(s.id)} />
            ))}
          </View>
          <Text style={T.small}>Nessun set selezionato = nessun filtro. Più set = unione dei giocatori.</Text>
        </Card>
      </Section>

      <Section title="Partite">
        <Card>
          <Text style={[T.tiny, { marginBottom: 6 }]}>Tono della telecronaca</Text>
          <View style={styles.toneGrid}>
            {TONES.map((t) => {
              const active = value.commentaryTone === t;
              return (
                <Pressable key={t} onPress={() => { haptic.tap(); set('commentaryTone', t); }} style={({ pressed }) => [styles.tone, active && styles.toneActive, pressed && { opacity: 0.85 }]}>
                  <Text style={{ fontSize: 22 }}>{TONE_IT[t].emoji}</Text>
                  <Text style={[T.h3, { fontSize: 14, color: active ? C.gold : C.text }]}>{TONE_IT[t].label}</Text>
                  <Text style={[T.small, { fontSize: 11 }]} numberOfLines={1}>
                    {TONE_IT[t].hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Stepper label="Durata partita live" value={value.liveMatchSeconds} onChange={(v) => set('liveMatchSeconds', v)} min={20} max={600} step={10} suffix="s" />
        </Card>
      </Section>

      <Section title="Visibilità">
        <Card>
          <SwitchRow label="Crediti degli altri" hint="Durante l'asta" value={value.visibility.othersCredits} onChange={(v) => setVis({ othersCredits: v })} />
          <SwitchRow label="Rose degli altri" hint="Durante l'asta" value={value.visibility.othersRosters} onChange={(v) => setVis({ othersRosters: v })} />
          <SwitchRow label="Nomi degli offerenti" value={value.visibility.bidderNames} onChange={(v) => setVis({ bidderNames: v })} />
          {!value.visibility.bidderNames ? (
            <View style={styles.blind}>
              <Text style={[T.small, { color: C.gold }]}>🕶️ Asta al buio: vedrai solo l'importo delle offerte, non chi le fa.</Text>
            </View>
          ) : null}
        </Card>
      </Section>

      <Section title="Regole personalizzate">
        <TextField
          value={value.customRules}
          onChangeText={(t) => set('customRules', t)}
          multiline
          maxLength={500}
          placeholder="Es. Chi arriva ultimo paga la cena 🍕"
          style={{ height: 110, paddingTop: S.md, textAlignVertical: 'top' }}
        />
      </Section>

      {error ? (
        <View style={styles.error}>
          <Text style={[T.small, { color: C.red, fontWeight: '700' }]}>⚠️ {error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: S.lg, marginBottom: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: S.sm },
  totalRow: { justifyContent: 'space-between', marginTop: S.md },
  toneGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginBottom: S.sm },
  tone: { width: 150, flexGrow: 1, padding: S.md, borderRadius: R.md, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgElevated, gap: 2 },
  toneActive: { borderColor: C.gold, backgroundColor: `${C.gold}14` },
  blind: { marginTop: S.md, padding: S.md, borderRadius: R.md, backgroundColor: `${C.gold}14`, borderWidth: 1, borderColor: C.goldDeep },
  error: { marginTop: S.lg, padding: S.md, borderRadius: R.md, backgroundColor: `${C.red}1A`, borderWidth: 1, borderColor: C.red },
});
