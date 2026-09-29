# ⚽ Asta Legends

**Il videogioco sociale di calcio basato sull'asta.** Crei una lega privata con gli amici, vi contendete all'asta live leggende e stelle moderne *nel loro prime* (più gli allenatori), e le vostre squadre si sfidano in un campionato simulato minuto per minuto, con telecronaca dinamica, pagelle, classifiche, premi e albo d'oro.

```
Lega privata → Lobby realtime → ASTA LIVE → Campionato → Match Center live → Premi → Albo d'oro → Stagione 2…
```

| | |
|---|---|
| **App** | Expo SDK 57 · React Native 0.86 · Expo Router · iOS / Android / Web |
| **Backend** | Node ≥ 22.13 · Fastify 5 · Socket.IO 4 · SQLite (`node:sqlite`, zero dipendenze native) |
| **Core di gioco** | TypeScript puro condiviso da server e app (`packages/core`) |
| **AI** | Claude (`claude-opus-5`) via Structured Outputs, con fallback offline |
| **Test** | Vitest — 89 test del core + 9 test d'integrazione del server (socket reali) |

---

## Indice

1. [Avvio rapido](#avvio-rapido)
2. [Installazione e configurazione](#installazione-e-configurazione)
3. [Demo Mode](#demo-mode)
4. [Test](#test)
5. [Architettura](#architettura)
6. [Il flusso realtime dell'asta](#il-flusso-realtime-dellasta)
7. [Match Engine](#match-engine)
8. [Modello dati e database](#modello-dati-e-database)
9. [API](#api)
10. [AI Player Generator](#ai-player-generator)
11. [Decisioni tecniche](#decisioni-tecniche)
12. [Limiti noti e prossimi passi](#limiti-noti-e-prossimi-passi)

---

## Avvio rapido

```bash
npm install          # installa tutto il monorepo (core, server, app)
npm run server       # backend su http://localhost:4000
npm run web          # app nel browser su http://localhost:8081
```

Apri l'app, scegli nome e avatar e premi **INIZIA LA DEMO**: parte subito un'asta contro 5 bot, senza bisogno del server.

Per giocare **online con gli amici**: avvia il server, poi in app vai su **Profilo → Server**, inserisci l'indirizzo (es. `http://192.168.1.10:4000` in rete locale) e premi **CONNETTI**. Da lì **Crea lega** genera un codice invito (es. `X7K92P`) condivisibile via codice, link `astalegends://join/X7K92P` o QR code.

## Installazione e configurazione

### Requisiti

- **Node.js ≥ 22.13** (sviluppato su Node 26). Il database usa il modulo integrato `node:sqlite`: nessun database da installare.
- Per il mobile: l'app **Expo Go** sul telefono, oppure Xcode / Android Studio per i simulatori.

### Backend

```bash
cp apps/server/.env.example apps/server/.env   # opzionale
npm run server                                 # = npm run dev -w @asta/server (watch mode)
```

| Variabile | Default | Descrizione |
|---|---|---|
| `PORT` / `HOST` | `4000` / `0.0.0.0` | Porta HTTP + WebSocket |
| `DATABASE_PATH` | `./asta-legends.db` | File SQLite (`:memory:` per sessioni effimere) |
| `CORS_ORIGIN` | `*` | Origini ammesse, separate da virgola |
| `PUBLIC_URL` | `astalegends://join` | Base dei link d'invito |
| `ANTHROPIC_API_KEY` | — | Abilita il generatore AI con Claude (opzionale) |
| `ANTHROPIC_MODEL` | `claude-opus-5` | Modello usato dal generatore |
| `AI_ENABLED` | `true` | `false` forza il generatore offline |
| `EXPO_PUSH_ENABLED` | `true` | Push per gli utenti non connessi |

### Database

Nessun setup: all'avvio il server crea il file SQLite, applica le migrazioni (`apps/server/src/db/schema.ts`) e carica il **seed** (319 giocatori + 44 allenatori). Per ripartire da zero basta cancellare il file `.db`. Lo schema è SQL standard: per passare a Postgres va sostituito solo il repository (`apps/server/src/db/*`).

### Frontend

```bash
npm run mobile       # Expo dev server: QR per Expo Go, i = iOS, a = Android
npm run web          # versione web
```

Sul telefono il server non è `localhost`: usa l'IP del computer nella stessa rete (Profilo → Server), oppure imposta `EXPO_PUBLIC_SERVER_URL` in `apps/mobile/.env`. La scansione dei QR usa `expo-camera`; le notifiche push richiedono una build EAS con `projectId` (vedi [Limiti noti](#limiti-noti-e-prossimi-passi)).

### AI

Il generatore usa l'SDK ufficiale `@anthropic-ai/sdk`. Imposta `ANTHROPIC_API_KEY` (oppure usa un profilo `ant auth login`) e riavvia il server; `GET /health` risponde `"ai": "claude"` quando è attivo. Senza credenziali la funzione continua a funzionare con il **generatore offline**, che risponde alla stessa richiesta strutturata pescando dal database curato.

## Demo Mode

**Home → INIZIA LA DEMO** crea una lega locale con 5 bot e avvia subito l'asta. Gira **interamente sul dispositivo**: l'app esegue in-process lo stesso `LeagueHost` authoritative del server (`LocalClient`), quindi regole, timer, validazione, match engine e telecronaca sono identici all'online. La demo viene salvata in AsyncStorage e riprende dopo un riavvio dell'app.

Si può anche creare una lega demo personalizzata da **Crea lega → Demo offline** e aggiungere bot in lobby.

Gli archetipi dei bot (`packages/core/src/bots/botBrain.ts`):

| Bot | Comportamento |
|---|---|
| 🐷 **Il Risparmiatore** | Offre poco (~72% del valore di riferimento), non supera 1,4× il budget per slot, aspetta l'affare e offre nell'ultimo secondo |
| 🦈 **Lo Squalo** | Reazioni rapide, apre forte sui big e li paga di più (OVR ≥ 88), non fa guerre sui gregari; se lo superi sullo stesso lotto si innervosisce e alza il tetto |
| 🤩 **Il Fan** | Ha idoli (nazionalità / tag / leggende) che strapaga (×1,85), ignora il resto |
| 🧠 **Il Tattico** | Distribuisce il budget sui ruoli, valuta l'allenatore in base all'affinità tattica con la rosa e paga di più chi è l'ultimo "treno" di qualità nel suo ruolo |
| 🎯 **Il Cecchino** | Non si fa mai vedere: offre solo nell'ultimo secondo del timer, sempre di rilancio minimo |
| 🎲 **Lo Scommettitore** | Valutazioni molto rumorose (±45%), rilanci pazzi e ogni tanto una "scommessa" su un bidone |
| 📊 **Il Moneyball** | Toglie il sovrapprezzo da hype alle superstar e paga di più la fascia solida (78–87) |
| 😈 **Il Provocatore** | Apre forte sui big per gonfiarne il prezzo e si sfila prima del valore pieno |
| 💣 **Il Kamikaze** | Punta tutto su uno-due fuoriclasse (OVR ≥ 91), poi completa la rosa a prezzo minimo |

Tutti stimano un **prezzo di riferimento** dall'economia della lega (crediti, slot, scarsità del ruolo), hanno un rumore personale deterministico (non concordano mai sul prezzo), non comprano ruoli che non servono e rispettano la riserva di budget. Nessuno (tranne lo Scommettitore) paga più del minimo per un bidone. I rilanci a salto sono proporzionati al prezzo del lotto; i bot lenti, se il timer sta per scadere, piazzano l'offerta all'ultimo invece di rinunciare.

## Test

```bash
npm test                         # core + server
npm run test -w @asta/core       # 89 test del dominio
npm run test -w @asta/server     # 9 test d'integrazione (HTTP + Socket.IO reali + SQLite)
npm run typecheck                # core, server e app
npm run calibrate -w @asta/core  # 1000 partite simulate: gol, tiri, pareggi, % vittorie del favorito
```

| Area | File | Cosa verifica |
|---|---|---|
| AuctionEngine | `auctionEngine.test.ts` | lotto casuale senza rivelare il prossimo, assegnazione all'ultimo offerente, reset del timer, invenduti, assegnazione d'ufficio, coerenza rose/crediti, pausa |
| BidValidation | `bidValidation.test.ts` | crediti insufficienti, riserva di budget (100 crediti / 6 slot → max 95), ruolo completo, incremento minimo, lotto obsoleto, utente senza crediti |
| RaceConditions | `raceConditions.test.ts` | **due utenti che rilanciano contemporaneamente**, **timer che scade durante un rilancio**, rilancio a 1 ms dalla fine, richieste duplicate, doppio tap, **doppia chiusura / doppio acquisto** |
| TeamValidation | `teamValidation.test.ts` | slot mancanti, rose configurabili, regole della lobby, capienza, passaggio del ruolo di Master |
| MatchEngine | `matchEngine.test.ts` | determinismo, **risultato = somma degli eventi**, timeline cronologica, favorito vince più spesso ma **le sorprese esistono**, rigori nei knockout, i singoli contano (un grande portiere subisce meno) |
| CoachModifiers | `coachModifiers.test.ts` | Guardiola vs Mourinho, gestione del vantaggio, **un allenatore cambia davvero i risultati**, adattabilità |
| PlayerRating | `playerRating.test.ts` | dataset, coerenza overall/statistiche, stile di gioco, valore d'asta, giocatori custom, preset |
| LeagueStandings | `leagueStandings.test.ts` | round robin (ogni coppia una volta), andata/ritorno, bilanciamento casa, tabellone, punti e criteri di classifica |
| MatchSimulation | `matchSimulation.test.ts` | **stagioni complete giocate dai bot** in tutti e 4 i formati fino al campione, premi, albo d'oro, anti-spoiler del live, nuova stagione |
| Reconnect | `reconnect.test.ts` | recupero di lotto/offerta/timer dopo la riconnessione, presenza, **host ricostruito dalla persistenza** (restart), idempotenza dopo il restart |
| Server | `apps/server/test/server.test.ts` | REST e sicurezza, **gara tra due socket reali**, notifica "sei stato superato", **disconnessione e riconnessione**, **restart del server che riprende l'asta da SQLite**, stagione intera persistita, vincolo UNIQUE contro il doppio acquisto |

## Architettura

```
asta-legends/
├── packages/core/            ← DOMINIO + ENGINE (TypeScript puro, nessuna dipendenza da piattaforma)
│   └── src/
│       ├── domain/           tipi, configurazione lega (zod), errori
│       ├── catalog/          seed data (319 giocatori, 44 allenatori), espansione statistiche, pool, set tematici
│       ├── rating/           overall posizionale, valori per zona, gruppi di attributi
│       ├── economy/          riserva di budget / offerta massima
│       ├── team/             validazione rosa e slot
│       ├── auction/          AuctionEngine + BidValidation
│       ├── bots/             archetipi e decisioni dei bot
│       ├── match/            MatchEngine, tattiche, modificatori allenatore, forza squadra, pagelle
│       ├── commentary/       narratore + ~1000 frasi originali in 6 toni
│       ├── tournament/       calendario, classifiche, fasi a eliminazione
│       ├── stats/            statistiche stagionali e premi
│       ├── social/           feed, reazioni, commenti
│       ├── ai/               schema dei dati AI, normalizzazione, parser della richiesta, generatore offline
│       ├── events/           event system (DomainEvent + EventBus)
│       └── league/           comandi di lega, proiezioni per utente, Scheduler, LeagueHost (runtime authoritative)
├── apps/server/              ← BACKEND
│   └── src/
│       ├── db/               schema SQL, repository (mapping aggregato ↔ tabelle), utenti
│       ├── http/             REST (Fastify)
│       ├── realtime/         gateway Socket.IO
│       ├── notifications/    eventi → notifiche in-app + Expo push
│       ├── ai/               generatore con Claude
│       └── leagueRegistry.ts un LeagueHost per lega attiva, persistenza write-through
└── apps/mobile/              ← APP
    └── src/
        ├── app/              schermate (Expo Router)
        ├── components/       ui kit, asta, match center, campionato, lega
        └── lib/              net (GameClient: Remote/Local), store (zustand), hook, tema, haptics
```

Separazione dei livelli richiesta: **UI** (`apps/mobile/src/app`, `components`) · **Domain** (`core/domain`, `team`, `economy`) · **Data/Persistence** (`server/src/db`, `LocalClient` + AsyncStorage) · **Networking/Realtime** (`mobile/src/lib/net`, `server/src/realtime`, `http`) · **Game Engine** (`core/auction`, `core/league`) · **Simulation** (`core/match`, `core/tournament`) · **AI** (`core/ai`, `server/src/ai`, `core/bots`).

### Event system

Ogni transizione del dominio produce `DomainEvent` tipizzati (`AuctionStarted`, `LotOpened`, `BidPlaced`, `AuctionExtended`, `Outbid`, `PlayerSold`, `TeamCompleted`, `MatchStarted`, `MatchEnded`, `TournamentCompleted`, `FeedPosted`, …). Gli eventi di partita (`chance`, `shot`, `save`, `goal`, `yellow`, `red`, …) sono `MatchEvent` della timeline. Lo stesso flusso alimenta:

- **UI** — animazioni (banner "RILANCIA!", SOLD!, GOOOL!) e feedback aptico
- **statistiche** — aggregate solo dagli eventi/risultati delle partite
- **telecronaca** — ogni evento diventa una frase
- **notifiche** — `NotificationService` (server) e toast locali (demo)
- **storico** — feed sociale, ledger dell'asta, archivio stagionale

### State management (app)

- `GameClient` astrae il trasporto: `RemoteClient` (REST + Socket.IO) e `LocalClient` (host in-process). Le leghe `local-*` vanno al client locale, le altre al server: online e demo convivono.
- Lo stato di una lega **non è duplicato nel client**: `useLeague(id)` si iscrive e riceve snapshot authoritative (`LeagueView`) a ogni cambiamento; i comandi sono solo richieste (`run('auction:bid', …)`).
- Store zustand persistiti: sessione (profilo, server, lega attiva, preferenze) e toast.

## Il flusso realtime dell'asta

```
Client A ──auction:bid {lotId, amount, bidId}──▶ ┐
Client B ──auction:bid {lotId, amount, bidId}──▶ ┤  SocketGateway (auth dal token, zod, rate limit)
                                                 ▼
                                   LeagueHost.placeBid  ← comandi serializzati (single thread, nessun await)
                                   ├─ validateBid (stato, lotId, timer server, ruolo, riserva, incremento)
                                   ├─ AuctionEngine: nuova offerta, reset timer, eventi
                                   ├─ syncTimers(): riprogramma chiusura lotto + bot
                                   └─ onChange → LeagueRepository.save (transazione SQLite)
                                                 ▼
                         broadcast coalescente: a ogni socket la SUA proiezione (league:state)
                         + eventi per le animazioni (league:events) + notifiche (notification)
```

- **Il server decide tutto**: timer, validazione, vincitore, crediti, assegnazione. Il client non invia mai la squadra: è ricavata dal token.
- **Race condition**: ogni comando è sincrono e completo prima del successivo; due offerte "simultanee" sono comunque ordinate e la seconda fallisce con `BID_TOO_LOW`. Un'offerta arrivata a `now ≥ endsAt` perde anche se il job di chiusura non è ancora partito.
- **Idempotenza**: ogni offerta ha un `bidId` generato dal client; i duplicati (retry di rete, doppio tap) restituiscono `duplicate: true` senza effetti. Gli ID processati sono persistiti, quindi valgono anche dopo un restart.
- **Timer sincronizzato**: il server invia `endsAt` (orologio server). Il client stima l'offset con uno scambio NTP-like (`time:sync`, RTT minimo) e mostra `endsAt − serverNow()`: tutti vedono lo stesso secondo.
- **Economia**: offerta massima = crediti − (slot rimasti dopo questo acquisto × prezzo minimo). Con 100 crediti e 6 slot vuoti il massimo è 95.
- **Informazioni nascoste**: la coda dei lotti non lascia mai il server (il pool è pubblico ma ordinato alfabeticamente). Crediti, rose e nomi degli offerenti degli altri sono filtrati per utente secondo le regole del Master ("asta al buio").
- **Riconnessione**: Socket.IO riprova con backoff; a ogni connessione il client risincronizza l'orologio e si re-iscrive, ricevendo uno snapshot completo (lotto corrente, scadenza, offerte, feed): niente eventi persi. La presenza (`connected`) è tracciata per membro e mostrata in lobby/asta; il banner "Connessione persa" appare durante la riconnessione.
- **Restart del server**: le leghe con timer attivi (asta, partite live) vengono ricostruite da SQLite all'avvio e i timer riarmati.
- **Fine del pool**: gli invenduti vengono riproposti; se il pool si esaurisce, gli slot mancanti sono assegnati d'ufficio al prezzo minimo (i giocatori più deboli rimasti) — l'asta termina sempre.

## Match Engine

`packages/core/src/match/matchEngine.ts` — simulazione **probabilistica, minuto per minuto, deterministica dato il seed**. Il risultato **non viene mai deciso prima**: è la somma dei gol accaduti negli eventi simulati.

Ogni minuto (più recupero, intervallo, eventuali rigori):

1. **Condizione** — la fatica cresce in base a resistenza e intensità del pressing; il morale oscilla dopo i gol (amplificato dalla *motivazione* dell'allenatore) e rientra gradualmente.
2. **Valori per zona** — attacco / centrocampo / difesa / portiere sono calcolati dalle **statistiche individuali** dei giocatori ancora in campo, pesate per ruolo (un espulso o un infortunato indebolisce davvero la squadra), poi moltiplicate per allenatore, tattica, adattamento della rosa alla tattica, casa/trasferta, forma, morale e **stato della partita** (gestione vantaggio/svantaggio, assalto finale).
3. **Possesso** — controllo del centrocampo contro controllo del centrocampo (possesso/passaggi dell'allenatore, profilo tattico).
4. **Azione** — occasione (attacco vs difesa), recupero palla con eventuale **contropiede** (pressing e *counter* dell'allenatore), falli, calci piazzati, errori difensivi, infortuni.
5. **Duelli individuali** — il tipo di occasione (filtrante, cross/colpo di testa, cutback, azione personale con dribbling contro il difensore, tiro da fuori, uno contro uno, punizione, corner, rigore) determina l'xG, corretto da finalizzazione/testa/tiro da fuori e freddezza del tiratore, marcatura del difensore, qualità del portiere (tuffo, riflessi, presa, piazzamento). Esiti: gol, parata, palo, traversa, fuori, respinta, corner.

Casualità controllata e calibrata su 1000 partite: ~3 gol a partita, ~10 tiri per squadra, ~20% di pareggi, il favorito netto vince ~68% delle volte e perde ~13%. Stesso match in toni di telecronaca diversi → stesso risultato (il narratore ha un RNG separato).

**Allenatori** — i modificatori (possesso, passaggi, pressing, difesa, contropiede, attacco, gestione vantaggio/svantaggio, adattabilità, motivazione) e la tattica preferita entrano direttamente nei moltiplicatori; i test verificano che Guardiola e Mourinho producano partite diverse e che un allenatore sposti i risultati su molte simulazioni.

**Discorso allo spogliatoio** — `match/teamTalk.ts`, stile Football Manager. Prima delle **partite importanti** (fasi a eliminazione diretta, ultima giornata, scontro al vertice, scontro diretto tra squadre vicine in classifica) ogni squadra può parlare una volta ai giocatori, oppure saltare: sceglie una **frase** fra sei e un **tono** (calmo, appassionato, aggressivo, fiducioso). La reazione (*carichi a mille, concentrati, indifferenti, troppo sicuri, nervosi*) dipende da quanto frase e tono si adattano alla situazione (favoriti o sfavoriti, forma, ultimo risultato, posta in palio), dalla *motivazione* dell'allenatore e da una parte di imprevedibilità: le stesse parole possono funzionare o ritorcersi contro. L'effetto entra nel motore come morale iniziale che si attenua nei 90 minuti, più disciplina (cartellini) e concentrazione (errori difensivi): su due squadre alla pari "carichi a mille" porta la vittoria dal 34% al 38%, "nervosi" la fa scendere al 29%. I bot parlano da soli, ognuno col suo tono. Il discorso avversario resta segreto fino al calcio d'inizio; poi il Match Center mostra le reazioni di entrambe le squadre. La reazione è deterministica (seed partita + squadra + scelta), quindi un nuovo tentativo non la cambia.

**Pagelle e MVP** — derivano solo da ciò che il giocatore ha fatto (gol, assist, passaggi chiave, dribbling, contrasti, parate, gol subiti, clean sheet, cartellini, errori, grandi occasioni sbagliate, risultato).

**Match Center** — il server simula al calcio d'inizio e poi **rivela gli eventi su un orologio condiviso** (`kickoffAt + liveMatchSeconds`): tutti vedono la stessa partita nello stesso momento e nessuno può leggere il risultato in anticipo (anche lo snapshot della lega nasconde i punteggi dei match live). Ogni utente può mettere in pausa, recuperare a 2×/4×/10× fino al live, filtrare gli eventi importanti, vedere statistiche live e formazioni; a fine partita replay libero. Il Master può anche scegliere **Simula subito**.

**Telecronaca** — `commentary/templates.ts`: ~170 frasi originali per ciascun tono (**Classico, Epico, Tecnico, Ironico, Trash, Bar Sport**), con varianti per dettaglio (`goal:header`, `save:one_on_one`, …) e "code" situazionali (pareggio, sorpasso, rimonta, doppietta, tripletta, gol all'ultimo). Il narratore evita ripetizioni nella stessa partita.

## Modello dati e database

**Player** (`domain/types.ts`): `id, name, nationality, position, primePeriod, overall, stats{pace, acceleration, shooting, passing, dribbling, ballControl, physical, stamina, strength, defending, marking, tackling, positioning, vision, composure, finishing, heading, longShots, crossing, freeKick, penalty, aggression, diving, handling, reflexes, kicking}, playStyle, foot, heightCm, weakFoot, skillMoves, rarity, baseAuctionValue, tags, historicalClub, era`.

**Seed data** (`core/catalog/seed/`): 54 portieri, 88 difensori, 89 centrocampisti, 88 attaccanti, 44 allenatori, reali, nel loro prime, metà leggende e metà moderni, overall da 50 a 97: campioni, una fascia media (72–84) per rendere l'asta strategica e i **Bidoni** (tag `bidoni`, OVR 50–68), le pippe storiche da prendere a un credito. Il formato di authoring è compatto (6 attributi "faccia" + firme) e `expand.ts` deriva deterministicamente le statistiche di dettaglio modellandole sullo stile di gioco. Un test verifica che l'overall dichiarato sia coerente con quello calcolato dalle statistiche (scarto medio < 3). Preset: **LEGENDS, MODERN, MIXED, RANDOM, CUSTOM** + set tematici (Serie A, Champions, World Cup, Premier, LaLiga, anni 80/90/2000, Cult Heroes, Bidoni).

**Tabelle** (`apps/server/src/db/schema.ts`):

| Tabella | Contenuto | Vincoli principali |
|---|---|---|
| `users` | utenti ospite, hash del token, push token | `token_hash UNIQUE` |
| `leagues` | configurazione, stato, pool, metadati torneo | `code UNIQUE`, `CHECK status` |
| `league_members` | membri, master, ready, bot | `PK(league_id, user_id)`, FK → teams |
| `teams` | squadre, logo, crediti | `CHECK credits ≥ 0` |
| `team_players` | rose per stagione | **`UNIQUE(league_id, season, item_id)`**: niente doppio acquisto |
| `players` / `managers` | catalogo (seed) + giocatori custom/AI per lega | unique parziale sul catalogo |
| `auctions` | stato runtime dell'asta (coda segreta inclusa) | `PK(league_id, season)` |
| `auction_lots` | ledger dei lotti (prezzo, vincitore, d'ufficio) | `CHECK price ≥ 0` |
| `auction_bids` | tutte le offerte | `PK id` (idempotenza) |
| `matches` | calendario, risultati, output della simulazione | `CHECK home ≠ away` |
| `match_events` | timeline minuto per minuto + telecronaca | `PK(match_id, seq)` |
| `statistics` | statistiche per giocatore per partita | `PK(match_id, player_id)` |
| `standings` | classifica per stagione | `PK(league_id, season, team_id)` |
| `awards` | premi di fine torneo | `PK(league_id, season, award_key)` |
| `feed_items` | feed sociale con reazioni e commenti | |
| `seasons` | **albo d'oro**: archivio congelato di ogni stagione (rose, asta, prezzi, risultati, classifica, record, premi) | `PK(league_id, season)` |

## API

**REST** (autenticazione `Authorization: Bearer <token>`):

| Metodo | Percorso | |
|---|---|---|
| `POST` | `/auth/guest` | crea un utente ospite → `{ user, token }` |
| `GET` / `PATCH` | `/me` | profilo, push token |
| `GET` / `POST` | `/leagues` | le mie leghe / crea lega |
| `GET` | `/invite/:code` | anteprima pubblica di un invito |
| `POST` | `/leagues/join` | entra con codice |
| `GET` | `/leagues/:id` | snapshot della lega (proiezione per l'utente) |
| `GET` | `/leagues/:id/matches/:matchId` | Match Center (eventi rivelati fin qui) |
| `GET` | `/leagues/:id/stats` | statistiche stagionali |
| `POST` / `DELETE` | `/leagues/:id/custom-players[/:itemId]` | giocatori aggiunti dal Master |
| `POST` | `/leagues/:id/ai/generate` → `/ai/confirm` | generatore AI con conferma del Master |
| `GET` | `/health` | stato e modalità AI |

**Socket.IO** (richiesta con ack `{ ok, data | error }`): `league:subscribe`, `lobby:ready | config | team | addBots | kick | leave`, `auction:start | bid | pause | resume`, `season:start`, `round:play {mode: live|instant}`, `season:new`, `match:get`, `match:talk {matchId, phrase, tone}`, `stats:get`, `feed:react | comment | chat`, `time:sync`. Push dal server: `league:state`, `league:events`, `notification`.

## AI Player Generator

Il Master scrive ad esempio *"Genera 40 giocatori storici, dal 1980 al 2025, distribuiti in modo equilibrato per ruolo."* (Lega → Pool giocatori → Genera con AI):

1. `parseGenerationPrompt` estrae una richiesta strutturata (quantità, anni, ruoli, allenatori) e calcola i target per ruolo.
2. Il server chiama Claude con **Structured Outputs** (`betaZodOutputFormat`), thinking adattivo e fallback lato server; la risposta è JSON conforme allo schema.
3. `parseAiGeneration` (core) **rivalida e normalizza**: clamp dei valori, overall ricalcolato dalle statistiche se incoerente (±6), rarità e valore d'asta derivati, voci invalide scartate.
4. Il Master vede l'anteprima, seleziona e conferma. Gli elementi non tornano mai dal client: il server conserva la generazione e accetta solo la conferma degli ID.

L'AI **non partecipa alla simulazione**: produce solo dati strutturati; match engine, bot e asta usano esclusivamente numeri validati.

## Decisioni tecniche

- **Un unico core condiviso.** Asta, bot, match engine, torneo, statistiche e telecronaca sono TypeScript puro in `packages/core`, usato identico da server e app. Da qui nasce la Demo Mode offline "gratis" e senza divergenze di regole.
- **Server authoritative con host in memoria + write-through.** Ogni lega attiva ha un `LeagueHost` che serializza i comandi; ogni stato accettato viene salvato in una transazione SQLite *prima* del broadcast. Semplice, senza lock distribuiti, robusto ai restart. Per scalare orizzontalmente: sharding delle leghe per processo (una lega vive su un solo nodo) + adapter Redis di Socket.IO.
- **Snapshot per utente invece di patch.** Una lega pesa pochi KB: inviare la proiezione completa rende la riconnessione banale e impedisce per costruzione di esporre dati nascosti. I burst (più bot nello stesso tick) sono coalescenti.
- **Clock astratto (`Scheduler`).** In produzione timer reali; nei test `ManualScheduler` fa scorrere il tempo in modo deterministico — per questo si possono testare scadenze al millisecondo e intere stagioni in pochi secondi.
- **RNG con seed** per partite, sorteggi e bot: riproducibilità, test esatti, possibilità di ri-simulare una partita per verificarla.
- **`node:sqlite`** invece di driver nativi o ORM: zero compilazioni, migrazioni SQL esplicite, vincoli nel database come seconda linea di difesa.
- **Utenti ospite con token** (solo l'hash è salvato): niente password da gestire per un gioco tra amici; l'account è legato al dispositivo.
- **Anti-spoiler del live** lato server: gli eventi sono rivelati in base all'orologio condiviso, i punteggi dei match in corso non compaiono negli snapshot.

## Limiti noti e prossimi passi

- **Notifiche push**: il server le invia tramite l'API Expo agli utenti offline, ma per ottenere il token serve una build con `projectId` EAS (`npx eas-cli@latest init`). Su web e in assenza di token restano le notifiche in-app.
- **Account**: gli utenti ospite sono legati al dispositivo; un login (es. email magic link) permetterebbe di usare lo stesso account su più dispositivi.
- **Sostituzioni**: la rosa è interamente in campo (niente panchina), quindi il motore non effettua cambi; espulsioni e infortuni lasciano la squadra in inferiorità.
- **Scalabilità**: un solo processo server; il passo successivo è l'adapter Redis per Socket.IO e l'assegnazione delle leghe ai nodi.
- **Lint**: il progetto è tipizzato strict ovunque; ESLint non è installato nel monorepo (`npx expo lint` lo configura al primo avvio).
