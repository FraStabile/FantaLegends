import type { CommentaryTemplates } from './templateTypes';

/**
 * Italian live-commentary template library, one voice per CommentaryTone.
 *
 * Every tone provides every key of COMMENTARY_KEYS. See templateTypes.ts for the
 * placeholder list. Notes on actor semantics that are easy to get wrong:
 *   - save*:                 {p} = goalkeeper, {o} = shooter
 *   - penalty_missed:saved:  {p} = goalkeeper, {o} = taker
 *   - penalty_scored / shootout_kick:*: {p} = taker, {o} = goalkeeper
 *   - own_goal:              {p} is from {t} (unlucky side), {opp} benefits
 *   - goal*:                 {o} = assist man, may be missing → used sparingly, never
 *                            in goal:solo, goal:long_shot, goal:free_kick
 */
export const TEMPLATES: CommentaryTemplates = {
  // ───────────────────────────── CLASSICO ─────────────────────────────
  classico: {
    kickoff: [
      "Si parte! {home} contro {away}, il pallone comincia a rotolare.",
      "Fischio d'inizio: {home} e {away} si affrontano, che vinca il migliore.",
      "Squadre schierate, arbitro pronto: comincia {home}-{away}.",
    ],
    halftime: [
      "Finisce il primo tempo: {home}-{away} {score}.",
      "Duplice fischio, si va al riposo sul {score}.",
      "Intervallo: {home} e {away} rientrano negli spogliatoi sul {score}.",
    ],
    'fulltime:win': [
      "Finisce qui! {t} batte {opp}, risultato finale {score}.",
      "Triplice fischio: vittoria meritata per {t}, {opp} si arrende sul {score}.",
      "È finita: {t} porta a casa l'intera posta, {score} il punteggio conclusivo.",
    ],
    'fulltime:draw': [
      "Finisce in parità: {home}-{away} {score}, un punto a testa.",
      "Triplice fischio, nessun vincitore: {score} tra {home} e {away}.",
      "Si chiude sul {score}: {home} e {away} si dividono la posta.",
    ],
    pass: [
      "{p} appoggia per {o}, manovra pulita.",
      "Bel fraseggio: {p} serve {o} sulla corsa.",
      "{p} alza la testa e trova {o} libero.",
      "Palla da {p} a {o}, {t} fa girare il pallone con pazienza.",
    ],
    dribble: [
      "{p} salta {o} con un bel dribbling!",
      "Finta e controfinta: {p} lascia sul posto {o}.",
      "Che giocata di {p}, {o} resta a guardare.",
      "{p} punta {o}, lo supera in velocità e va via.",
    ],
    tackle: [
      "Ottimo intervento di {p}, che ruba palla a {o}.",
      "{p} entra deciso e pulito su {o}: pallone recuperato.",
      "Chiusura puntuale di {p}, {o} perde il possesso.",
      "Tempismo perfetto: {p} anticipa {o} e {t} può ripartire.",
    ],
    interception: [
      "{p} legge bene la traiettoria e intercetta.",
      "Intercetto di {p}, che spezza la manovra di {opp}.",
      "Attento {p}: si mette in mezzo e recupera il pallone per {t}.",
    ],
    chance: [
      "{p} inventa per {o}: occasione per {t}!",
      "Attenzione, {p} mette {o} in condizione di calciare!",
      "Si apre uno spazio: {p} serve {o} in zona pericolosa.",
      "{t} si affaccia in area, {p} cerca {o}...",
    ],
    'chance:through_ball': [
      "Filtrante di {p}! {o} scatta alle spalle della difesa.",
      "{p} taglia il campo con un passaggio in profondità per {o}.",
      "Che imbucata di {p}, {o} è lanciato verso la porta!",
    ],
    'chance:cross': [
      "Cross di {p} dalla fascia, {o} attacca il pallone in area.",
      "{p} mette in mezzo: {o} è pronto all'impatto!",
      "Traversone teso di {p} a cercare la testa di {o}.",
    ],
    'chance:cutback': [
      "{p} arriva sul fondo e scarica all'indietro per {o}.",
      "Palla arretrata di {p}, {o} arriva a rimorchio!",
      "{p} si libera sulla linea di fondo e serve {o} al centro.",
    ],
    big_chance: [
      "Occasionissima per {p}! Tutto solo davanti alla porta!",
      "Attenzione! {p} si trova la palla buona, qui non può sbagliare...",
      "Clamorosa opportunità per {t}: {p} ha lo specchio spalancato!",
      "{p} a tu per tu con il portiere, momento decisivo!",
    ],
    counter: [
      "Ripartenza di {t}! {p} guida il contropiede.",
      "{t} ribalta l'azione in un lampo, {p} in campo aperto.",
      "Contropiede! {p} corre verso l'area di {opp}.",
    ],
    shot: [
      "{p} ci prova!",
      "Tiro di {p}...",
      "{p} carica il destro e calcia verso la porta.",
      "Conclusione di {p} dall'interno dell'area...",
    ],
    'shot:long_shot': [
      "{p} tenta la conclusione dalla distanza!",
      "Da lontano! {p} lascia partire un gran tiro...",
      "{p} prova la botta da fuori area.",
    ],
    'shot:header': [
      "Stacco di testa di {p}!",
      "{p} svetta e colpisce di testa...",
      "Incornata di {p} in mezzo all'area!",
    ],
    save: [
      "Grande parata di {p} sul tiro di {o}!",
      "{p} si distende e respinge la conclusione di {o}.",
      "Attento {p}, blocca in due tempi il tentativo di {o}.",
      "Niente da fare per {o}: {p} dice di no.",
    ],
    'save:header': [
      "{p} vola e toglie dall'incrocio il colpo di testa di {o}!",
      "Riflesso felino di {p} sull'incornata di {o}.",
      "{o} ci prova di testa, ma {p} è piazzato benissimo.",
    ],
    'save:long_shot': [
      "{p} non si fa sorprendere dalla botta di {o}.",
      "Gran tiro di {o}, ma {p} c'è e devia in angolo.",
      "{p} vede partire il pallone e para senza affanni il tiro di {o}.",
    ],
    'save:one_on_one': [
      "Uscita perfetta di {p}, che chiude lo specchio a {o}!",
      "{o} a tu per tu con {p}... e il portiere vince il duello!",
      "Miracolo di {p} in uscita bassa su {o}!",
    ],
    post: [
      "Palo! {p} colpisce il legno!",
      "Sfortunato {p}: il pallone sbatte sul palo.",
      "Il palo nega la gioia a {p}!",
    ],
    crossbar: [
      "Traversa! Che conclusione di {p}!",
      "{p} centra in pieno la traversa, che peccato!",
      "La traversa trema ancora sul tiro di {p}.",
    ],
    miss: [
      "Fuori! {p} non trova lo specchio.",
      "{p} calcia alto sopra la traversa.",
      "Conclusione imprecisa di {p}, pallone sul fondo.",
      "Di poco a lato il tentativo di {p}.",
    ],
    'miss:header': [
      "Colpo di testa di {p} che termina fuori.",
      "{p} incorna, ma il pallone sorvola la traversa.",
      "Stacco imperioso di {p}, mira sbagliata di poco.",
    ],
    'miss:long_shot': [
      "Da lontano {p} non inquadra la porta.",
      "Il tiro dalla distanza di {p} finisce abbondantemente fuori.",
      "Ci ha provato {p} da fuori, ma la palla vola in tribuna.",
    ],
    blocked: [
      "Tiro di {p} respinto da {o}!",
      "{o} si immola e mura la conclusione di {p}.",
      "Muro di {o}: il tentativo di {p} non passa.",
    ],
    corner: [
      "Calcio d'angolo per {t}, va {p} alla battuta.",
      "Angolo per {t}: {p} sistema il pallone sulla bandierina.",
      "{p} si prepara a calciare il corner per {t}.",
      "Ancora un angolo per {t}, se ne occupa {p}.",
    ],
    foul: [
      "Fallo di {p} su {o}, l'arbitro fischia.",
      "{p} trattiene {o}: punizione.",
      "Intervento irregolare di {p} ai danni di {o}.",
      "{o} va giù dopo il contatto con {p}, è fallo.",
    ],
    yellow: [
      "Cartellino giallo per {p}.",
      "L'arbitro ammonisce {p}, che dovrà stare attento.",
      "Giallo a {p}: intervento troppo irruento.",
    ],
    red: [
      "Rosso! {p} viene espulso, {t} resta in inferiorità!",
      "Espulsione per {p}: doccia anticipata.",
      "L'arbitro non ha dubbi, cartellino rosso per {p}.",
    ],
    penalty_awarded: [
      "Rigore per {t}! {p} viene steso in area!",
      "L'arbitro indica il dischetto: {p} conquista il penalty per {t}.",
      "Calcio di rigore! {p} è bravo a guadagnarselo.",
    ],
    penalty_scored: [
      "Rigore trasformato! {p} spiazza {o}.",
      "{p} dal dischetto non sbaglia: {o} da una parte, pallone dall'altra.",
      "{p} calcia forte e centrale, {o} non può nulla.",
    ],
    penalty_missed: [
      "Rigore sbagliato! {p} calcia fuori!",
      "{p} spara alto dal dischetto, occasione sprecata.",
      "Incredibile, {p} manda il penalty a lato!",
    ],
    'penalty_missed:saved': [
      "Parato! {p} ipnotizza {o} dal dischetto!",
      "{p} intuisce e respinge il rigore di {o}!",
      "Che intervento di {p}: il penalty di {o} non entra.",
    ],
    goal: [
      "Gol! Rete di {p} per {t}!",
      "{p} insacca! Esulta {t}.",
      "È gol! Assist di {o}, finalizza {p}.",
      "{p} non perdona e gonfia la rete!",
      "Rete! {o} lo serve, {p} deposita in fondo al sacco.",
    ],
    'goal:header': [
      "Gol di testa di {p}! Imparabile.",
      "Incornata vincente di {p}, palla in rete!",
      "{p} stacca più in alto di tutti sul pallone di {o}: gol!",
    ],
    'goal:long_shot': [
      "Che gol di {p}! Una staffilata da lontano!",
      "Da fuori area! {p} la infila all'incrocio!",
      "Bolide di {p} dalla distanza, il portiere non ci arriva!",
    ],
    'goal:one_on_one': [
      "{p} a tu per tu con il portiere: freddo, gol!",
      "Solo davanti al portiere, {p} non sbaglia!",
      "{o} lo lancia, {p} scavalca il portiere in uscita: rete!",
    ],
    'goal:free_kick': [
      "Punizione magistrale di {p}! Palla sopra la barriera e in rete!",
      "Che calcio piazzato di {p}, il pallone si infila all'angolino!",
      "{p} disegna una parabola perfetta: gol su punizione!",
    ],
    'goal:volley': [
      "Al volo! {p} colpisce di controbalzo e segna!",
      "Che coordinazione di {p}: tiro al volo e gol!",
      "{o} crossa, {p} la prende al volo: che rete!",
    ],
    'goal:solo': [
      "Gol splendido di {p}, che fa tutto da solo!",
      "{p} parte palla al piede, salta tutti e segna!",
      "Azione personale di {p}: una prodezza da applausi!",
    ],
    'goal:counter': [
      "Contropiede letale di {t}: gol di {p}!",
      "{t} riparte e colpisce: rete di {p}!",
      "Ripartenza da manuale, {o} per {p} e gol!",
    ],
    own_goal: [
      "Autogol! {p} devia nella propria porta, regalo per {opp}.",
      "Sfortuna nera per {p}: tocco maldestro e palla nella rete di {t}.",
      "Che beffa per {t}: {p} batte il proprio portiere.",
    ],
    defensive_error: [
      "Errore di {p} in fase difensiva!",
      "Disattenzione di {p}, pallone perso in una zona delicata.",
      "{p} sbaglia il disimpegno, occhio al pericolo!",
    ],
    injury: [
      "{p} resta a terra, entrano i sanitari.",
      "Problema fisico per {p}, gioco fermo.",
      "{p} si tocca la coscia, speriamo non sia nulla di grave.",
    ],
    shootout_start: [
      "Si va ai calci di rigore! {home} contro {away}, emozioni forti.",
      "Serie dei rigori tra {home} e {away}: servono nervi saldi.",
      "Tutto si decide dal dischetto: comincia la lotteria tra {home} e {away}.",
    ],
    'shootout_kick:scored': [
      "{p} segna, {o} spiazzato.",
      "Rigore realizzato da {p}, nulla da fare per {o}.",
      "{p} non trema: palla in rete.",
    ],
    'shootout_kick:missed': [
      "{p} sbaglia! {o} esulta.",
      "Errore di {p} dal dischetto, {o} tiene vivi i suoi.",
      "Niente da fare per {p}: rigore fallito.",
    ],
    'tail:equalizer': [
      "Tutto da rifare, siamo in parità: {score}!",
      "Il pareggio rimette tutto in discussione: {score}.",
    ],
    'tail:go_ahead': [
      "{t} passa in vantaggio: {score}.",
      "Sorpasso! Ora il punteggio dice {score}.",
    ],
    'tail:late': [
      "Siamo al {min}', un gol che può pesare tantissimo!",
      "Rete arrivata nel finale, al {min}'.",
    ],
    'tail:brace': [
      "Doppietta personale per {p}!",
      "Seconda rete di giornata per {p}.",
    ],
    'tail:hattrick': [
      "Tripletta! Il pallone se lo porta a casa {p}.",
      "Tre gol per {p}: prestazione memorabile.",
    ],
    'tail:comeback': [
      "Rimonta completata: {score}!",
      "{t} ribalta tutto, che rimonta!",
    ],
  },

  // ───────────────────────────── EPICO ─────────────────────────────
  epico: {
    kickoff: [
      "Suonano i corni di guerra: {home} contro {away}, la battaglia ha inizio!",
      "Il destino apre il suo libro: {home} e {away} scendono nell'arena!",
      "Si accendono le torce, trema la terra: comincia {home}-{away}!",
    ],
    halftime: [
      "Tregua a metà battaglia! {home}-{away} {score}, gli eroi si ritirano nelle tende.",
      "Cala il sipario sul primo atto: {score}. La leggenda è solo a metà.",
      "Riposo dei guerrieri sul {score}: {home} e {away} affilano le spade.",
    ],
    'fulltime:win': [
      "È FINITA! {t} conquista la gloria eterna, {opp} cade sul {score}!",
      "I cantori scriveranno di questa impresa: {t} trionfa, {score}!",
      "Il regno è di {t}! {opp} si inchina, il verdetto è {score}!",
    ],
    'fulltime:draw': [
      "Nessun vincitore, nessun vinto: {home} e {away} si separano sul {score}, come titani esausti.",
      "Il fato non ha scelto: {score}. Tra {home} e {away} la guerra continuerà.",
      "Pari! {score}! Due eserciti ancora in piedi, la leggenda resta sospesa.",
    ],
    pass: [
      "{p} consegna il pallone a {o} come si passa una spada sacra.",
      "Un filo invisibile unisce {p} e {o}: il pallone viaggia!",
      "{p} illumina la via per {o}!",
      "Dal piede di {p} a quello di {o}: {t} avanza come una falange!",
    ],
    dribble: [
      "{p} danza tra le rovine: {o} è solo un'ombra alle sue spalle!",
      "Come il vento tra le colonne, {p} supera {o}!",
      "{o} prova a sbarrare il passo, ma {p} è un fulmine inafferrabile!",
      "Magia di {p}! {o} crolla come un titano colpito dagli dei!",
    ],
    tackle: [
      "{p} si erge come un bastione e strappa il pallone a {o}!",
      "Colpo di scudo di {p}! {o} viene disarmato!",
      "Il guardiano {p} non concede passaggio: palla tolta a {o}!",
      "Come un'aquila in picchiata, {p} piomba su {o} e recupera!",
    ],
    interception: [
      "{p} legge il futuro e spezza la trama nemica!",
      "Intercettato! {p} ferma la freccia prima che colpisca!",
      "Occhi di falco per {p}: il pallone ora è di {t}!",
    ],
    chance: [
      "{p} apre le porte del tempio per {o}!",
      "Si squarcia il cielo: {p} trova {o}, {t} fiuta la gloria!",
      "Attenzione! {p} arma il braccio di {o}!",
      "Un varco nella muraglia di {opp}: {p} serve {o}!",
    ],
    'chance:through_ball': [
      "Una lama di luce! Il filtrante di {p} libera {o}!",
      "{p} fende la difesa come una lama nella nebbia: {o} corre verso la gloria!",
      "Passaggio profetico di {p}, {o} è lanciato nella notte!",
    ],
    'chance:cross': [
      "Dal cielo piove il cross di {p}: {o} si prepara a colpire!",
      "{p} scaglia il pallone nell'area come una cometa, {o} attende!",
      "Traiettoria divina di {p}, {o} vola a cercarla!",
    ],
    'chance:cutback': [
      "{p} arriva ai confini del mondo e restituisce il pallone a {o}!",
      "Dalla linea di fondo, {p} offre a {o} il calice della gloria!",
      "Scarico all'indietro di {p}: {o} ha il destino tra i piedi!",
    ],
    big_chance: [
      "IL MOMENTO È ADESSO! {p} davanti alla porta, il mondo trattiene il respiro!",
      "Tutto si ferma: {p} ha la gloria a un passo!",
      "Gli dei guardano {p}: occasione colossale per {t}!",
      "Il tempo si congela! {p} e la porta, nient'altro!",
    ],
    counter: [
      "Cavalcata di {t}! {p} guida la carica verso le mura di {opp}!",
      "{t} si scatena come una tempesta, {p} in testa all'esercito!",
      "Contropiede furioso! {p} galoppa verso la leggenda!",
    ],
    shot: [
      "{p} scocca la freccia!",
      "Il tuono parte dal piede di {p}!",
      "{p} carica tutta la forza del mondo e calcia!",
      "Ecco il colpo di {p}...",
    ],
    'shot:long_shot': [
      "Da distanze siderali, {p} lancia il suo giavellotto!",
      "{p} sfida le leggi della fisica: tiro da lontanissimo!",
      "Una catapulta! {p} scaglia il pallone da fuori!",
    ],
    'shot:header': [
      "{p} si alza verso il cielo e colpisce di testa!",
      "Come un ariete sacro, {p} incorna!",
      "{p} vola sopra gli uomini e colpisce!",
    ],
    save: [
      "MURAGLIA! {p} respinge l'assalto di {o}!",
      "Le mani di {p} sono scudi di bronzo: {o} si arrende!",
      "Parata immortale di {p}, {o} non ci crede!",
      "{p}, guardiano della porta, nega la gloria a {o}!",
    ],
    'save:header': [
      "{p} vola come un'aquila e toglie l'incornata a {o}!",
      "Colpo di testa di {o}, ma {p} sfida la gravità!",
      "Riflessi divini di {p} sull'ariete {o}!",
    ],
    'save:long_shot': [
      "La catapulta di {o} si infrange sulle mani di {p}!",
      "{p} spegne il fuoco del tiro di {o}!",
      "Nessuna distanza spaventa {p}: il bolide di {o} è respinto!",
    ],
    'save:one_on_one': [
      "Duello all'alba: {o} contro {p}... e vince il guardiano!",
      "{p} si fa gigante e chiude ogni spiraglio a {o}!",
      "Uscita eroica di {p}, {o} resta a mani vuote!",
    ],
    post: [
      "IL PALO! Gli dei hanno deviato il colpo di {p}!",
      "Il legno trema e respinge {p}: il fato è crudele!",
      "{p} colpisce il palo, un grido si leva dagli spalti!",
    ],
    crossbar: [
      "TRAVERSA! L'architrave del tempio respinge {p}!",
      "{p} fa tremare la traversa, il cielo si oscura!",
      "La traversa vibra come una corda di lira: {p} ci è andato vicinissimo!",
    ],
    miss: [
      "Il colpo di {p} si perde nell'oblio!",
      "Fuori! {p} vede la gloria sfumare nel vento!",
      "{p} manca il bersaglio, gli dei non erano con lui.",
      "La freccia di {p} vola lontano dalla meta!",
    ],
    'miss:header': [
      "L'incornata di {p} si perde tra le nuvole!",
      "{p} vola, colpisce... ma il cielo dice di no!",
      "Testa di {p}, pallone oltre le mura!",
    ],
    'miss:long_shot': [
      "Il giavellotto di {p} si perde oltre l'orizzonte!",
      "{p} sfida la distanza, ma la distanza vince!",
      "Da lontano {p} tenta l'impossibile: il pallone svanisce sul fondo!",
    ],
    blocked: [
      "{o} si getta come un martire: il colpo di {p} si infrange!",
      "Scudo umano! {o} ferma il tiro di {p}!",
      "{p} calcia, ma {o} è una roccia millenaria!",
    ],
    corner: [
      "Angolo per {t}! {p} si avvicina alla bandierina come a un altare.",
      "{p} prepara l'assedio dalla bandierina per {t}!",
      "Calcio d'angolo: {t} cinge d'assedio la fortezza, batte {p}!",
      "La bandierina chiama, {p} risponde: corner per {t}!",
    ],
    foul: [
      "{p} abbatte {o} come un albero secolare!",
      "Colpo proibito di {p} su {o}: l'arbitro interviene!",
      "{o} cade sotto la furia di {p}!",
      "Scontro tra titani: {p} travolge {o}, è fallo!",
    ],
    yellow: [
      "Il giudice alza il vessillo giallo su {p}!",
      "Ammonito {p}: un marchio d'ambra sul suo nome.",
      "Cartellino giallo per {p}, il primo avvertimento degli dei!",
    ],
    red: [
      "ROSSO! {p} viene esiliato dal campo di battaglia!",
      "Il giudice condanna {p}: cacciato dall'arena!",
      "Cartellino rosso per {p}, {t} dovrà combattere in inferiorità!",
    ],
    penalty_awarded: [
      "RIGORE! {p} cade in area e {t} vede la gloria a un passo!",
      "Il dito del giudice indica il dischetto: {p} ha conquistato il rigore per {t}!",
      "Penalty! {p} strappa a {opp} il colpo di grazia per {t}!",
    ],
    penalty_scored: [
      "IMPLACABILE! {p} trafigge {o} dal dischetto!",
      "{p} guarda {o} negli occhi e lo colpisce al cuore: GOL!",
      "Sangue freddo da eroe: {p} non lascia scampo a {o}!",
    ],
    penalty_missed: [
      "NO! {p} tradisce il suo popolo, il rigore vola via!",
      "Il fato beffa {p}: dal dischetto, fuori!",
      "{p} calcia verso le stelle, e le stelle se lo tengono!",
    ],
    'penalty_missed:saved': [
      "PARATO! {p} diventa leggenda, {o} è in ginocchio!",
      "{p} legge l'anima di {o} e para il rigore!",
      "Il guardiano {p} ferma il destino: rigore di {o} respinto!",
    ],
    goal: [
      "GOOOOOOL! {p} scrive il suo nome nella storia!",
      "RETE! {p} squarcia il cielo e {t} esplode!",
      "GOOOL! {o} prepara, {p} scaglia il fulmine!",
      "Gli dei applaudono: {p} ha segnato!",
      "È GOL! L'assist di {o}, la zampata di {p}: un poema!",
    ],
    'goal:header': [
      "GOOOOL DI TESTA! {p} vola più in alto di Icaro!",
      "Incornata leggendaria di {p}, la rete si arrende!",
      "Dal cross di {o}, {p} sale in cielo e colpisce: GOOOL!",
    ],
    'goal:long_shot': [
      "GOOOOOOL! Una cannonata da un altro mondo di {p}!",
      "Il giavellotto di {p} trafigge la porta: RETE STRATOSFERICA!",
      "Da lontanissimo! {p} scaglia il fulmine di Zeus: GOL!",
    ],
    'goal:one_on_one': [
      "Faccia a faccia col guardiano, {p} vince il duello: GOOOL!",
      "{p} solo contro il destino... e il destino si piega: RETE!",
      "{o} lo lancia nell'arena, {p} colpisce: GOOOOL!",
    ],
    'goal:free_kick': [
      "GOOOOL! La punizione di {p} disegna un arcobaleno!",
      "{p} scavalca la barriera come un'aquila: RETE DIVINA!",
      "Calcio piazzato celestiale di {p}, il pallone bacia la rete!",
    ],
    'goal:volley': [
      "AL VOLO! {p} colpisce come un dio del tuono: GOOOL!",
      "Coordinazione da semidio: {p} la prende al volo ed è RETE!",
      "{o} disegna, {p} scolpisce al volo: GOOOOL!",
    ],
    'goal:solo': [
      "GOOOOOOL! {p} attraversa l'inferno da solo e segna!",
      "Un'odissea solitaria: {p} salta tutti ed è RETE!",
      "{p} contro il mondo intero... e vince lui! GOOOL!",
    ],
    'goal:counter': [
      "La carica di {t} si abbatte su {opp}: GOL DI {p}!",
      "Contropiede fulmineo! {p} chiude l'assalto: GOOOL!",
      "{o} lancia la cavalleria, {p} sfonda le mura: RETE!",
    ],
    own_goal: [
      "Tragedia greca! {p} colpisce la propria porta, {opp} ringrazia il fato!",
      "Il destino è beffardo: {p} infila la rete di {t}!",
      "Autogol di {p}: un dramma che {t} non dimenticherà.",
    ],
    defensive_error: [
      "Crepa nelle mura! {p} sbaglia e la fortezza trema!",
      "{p} vacilla, il nemico è alle porte!",
      "Un errore di {p} spalanca le porte della città!",
    ],
    injury: [
      "L'eroe {p} è ferito, cade sul campo di battaglia...",
      "{p} a terra, il suo esercito trattiene il fiato.",
      "Un colpo ha fermato {p}: il guerriero resta giù.",
    ],
    shootout_start: [
      "È L'ORA DEL GIUDIZIO! Rigori tra {home} e {away}!",
      "Il duello finale: {home} e {away} si affidano al dischetto!",
      "La leggenda si decide qui, uno contro uno: rigori tra {home} e {away}!",
    ],
    'shootout_kick:scored': [
      "{p} colpisce, {o} è battuto: il cammino continua!",
      "Rete! {p} non trema davanti a {o}!",
      "{p} infila {o}, il destino resta aperto!",
    ],
    'shootout_kick:missed': [
      "{p} cade! {o} si erge come un gigante!",
      "Il rigore di {p} svanisce, {o} alza le braccia al cielo!",
      "Tragedia per {p}: il tiro non entra!",
    ],
    'tail:equalizer': [
      "E la guerra ricomincia: {score}!",
      "Parità ristabilita, gli dei rimescolano le carte: {score}!",
    ],
    'tail:go_ahead': [
      "{t} prende il comando della battaglia: {score}!",
      "Il vessillo di {t} sventola più in alto: {score}!",
    ],
    'tail:late': [
      "Al {min}', quando tutto sembrava scritto!",
      "Un colpo nel crepuscolo, minuto {min}!",
    ],
    'tail:brace': [
      "DOPPIETTA! {p} entra nel mito!",
      "Due volte {p}! Il suo nome risuona tra gli spalti!",
    ],
    'tail:hattrick': [
      "TRIPLETTA! {p} siede tra gli dei dell'Olimpo!",
      "Tre colpi, tre reti: {p} è leggenda vivente!",
    ],
    'tail:comeback': [
      "RIMONTA EPICA! {t} risorge dalle ceneri: {score}!",
      "Come la fenice, {t} rinasce: {score}!",
    ],
  },

  // ───────────────────────────── TECNICO ─────────────────────────────
  tecnico: {
    kickoff: [
      "Calcio d'inizio tra {home} e {away}: vediamo chi riuscirà a imporre il proprio piano gara.",
      "Si comincia: {home} contro {away}, occhio a come si posizioneranno le linee in fase di non possesso.",
      "Partiti! {home}-{away}, primi minuti di studio per leggere le distanze tra i reparti.",
    ],
    halftime: [
      "Fine primo tempo, {home}-{away} {score}: negli spogliatoi si lavorerà sulle correzioni tattiche.",
      "Intervallo sul {score}. Da rivedere l'occupazione dei mezzi spazi da entrambe le parti.",
      "Si va al riposo: {score}. Partita finora decisa dalla gestione delle transizioni.",
    ],
    'fulltime:win': [
      "Finisce {score}: {t} ha interpretato meglio le fasi della partita, {opp} troppo lunga tra i reparti.",
      "Triplice fischio, {t} supera {opp} ({score}) con una gestione del possesso più matura.",
      "{t} vince {score}: pressing più efficace e maggiore qualità nelle scelte negli ultimi metri contro {opp}.",
    ],
    'fulltime:draw': [
      "Termina {score} tra {home} e {away}: equilibrio tattico, pochi spazi concessi.",
      "Pareggio {score}: {home} e {away} si sono neutralizzate a vicenda sul piano strutturale.",
      "{home}-{away} finisce {score}, un risultato coerente con la produzione offensiva vista.",
    ],
    pass: [
      "{p} trova {o} tra le linee, rompendo la prima pressione.",
      "Passaggio verticale di {p} per {o}, che riceve orientato verso la porta.",
      "{p} scarica su {o} e {t} consolida il possesso.",
      "Linea di passaggio pulita: {p} serve {o} sul lato debole.",
      "{p} attira il pressing e libera {o} con il tempo giusto.",
    ],
    dribble: [
      "{p} attacca il piede d'appoggio di {o} e lo supera nell'uno contro uno.",
      "Cambio di direzione di {p}: {o} ha il baricentro sbagliato e viene saltato.",
      "{p} sfrutta la conduzione in progressione e brucia {o} in campo aperto.",
      "Postura del corpo ingannevole di {p}, {o} legge male e resta fuori dall'azione.",
    ],
    tackle: [
      "Contrasto pulito di {p} su {o}: ottima lettura del tempo d'intervento.",
      "{p} accorcia su {o} e recupera il pallone, trigger di pressione perfetto.",
      "{p} scivola sul lato giusto e toglie il pallone a {o} senza commettere fallo.",
      "Recupero alto di {p} ai danni di {o}: {t} può attaccare una difesa non schierata.",
    ],
    interception: [
      "{p} legge la linea di passaggio e intercetta: ottimo posizionamento preventivo.",
      "Intercetto di {p}, che anticipa sulla ricezione: {t} riconquista in transizione.",
      "{p} chiude la traccia centrale e riconquista il possesso per {t}.",
    ],
    chance: [
      "{p} trova {o} nel mezzo spazio: situazione potenzialmente pericolosa per {t}.",
      "Rifinitura di {p} per {o}, che riceve alle spalle della linea di centrocampo.",
      "{t} manipola il blocco di {opp}: {p} libera {o} in zona di conclusione.",
      "Superiorità creata sul lato forte, {p} serve {o} con i tempi giusti.",
    ],
    'chance:through_ball': [
      "Filtrante di {p} nello spazio tra centrale e terzino: {o} attacca la profondità.",
      "{p} vede il movimento a smarcarsi di {o} e lo serve alle spalle della linea difensiva.",
      "Tracciante di {p}, {o} parte sul filo del fuorigioco e riceve in corsa.",
    ],
    'chance:cross': [
      "Cross di {p} sul secondo palo, {o} attacca lo spazio con il timing giusto.",
      "{p} mette in mezzo a rientrare, {o} prova a prendere posizione sul marcatore.",
      "Traversone teso di {p} tra portiere e linea difensiva: {o} arriva lanciato.",
    ],
    'chance:cutback': [
      "{p} arriva sul fondo e scarica all'indietro verso il dischetto: {o} riceve senza pressione.",
      "Cutback di {p}, la difesa scappa verso la porta e {o} resta libero a rimorchio.",
      "{p} sfrutta la linea di fondo e serve {o} nella zona più pericolosa dell'area.",
    ],
    big_chance: [
      "Occasione ad altissima probabilità di realizzazione per {p}!",
      "{p} riceve in zona centrale, senza pressione: situazione da gol quasi certo.",
      "Posizione ideale per {p}: angolo di tiro ampio e portiere sbilanciato.",
      "{t} crea la miglior occasione finora: {p} ha tempo e spazio per calciare.",
    ],
    counter: [
      "Transizione positiva di {t}: {p} conduce e {opp} è scoperta alle spalle.",
      "Ripartenza di {t} con {p} che attacca il campo libero, difesa di {opp} in inferiorità numerica.",
      "{p} guida il contropiede: {t} ha il vantaggio posizionale in campo aperto.",
    ],
    shot: [
      "{p} calcia sul primo palo...",
      "Conclusione di {p} dopo un controllo orientato.",
      "{p} cerca il tiro con il piede forte.",
      "Tiro di {p} dall'interno dell'area, poco angolo a disposizione...",
    ],
    'shot:long_shot': [
      "{p} prova da fuori: tiro a bassa probabilità, ma la difesa gli ha concesso spazio.",
      "Conclusione dalla distanza di {p}, che sfrutta il blocco basso di {opp}.",
      "{p} calcia dal limite con il collo pieno...",
    ],
    'shot:header': [
      "{p} attacca il pallone sul primo palo e colpisce di testa.",
      "Colpo di testa di {p}, buon tempo di stacco sul marcatore.",
      "{p} anticipa tutti in area e indirizza di testa...",
    ],
    save: [
      "Ottimo piazzamento di {p}, che neutralizza la conclusione di {o}.",
      "{p} riduce l'angolo e respinge il tiro di {o}.",
      "Parata di {p}: buona lettura della traiettoria calciata da {o}.",
      "{p} resta in piedi fino all'ultimo e blocca il tentativo di {o}.",
    ],
    'save:header': [
      "{p} copre bene il primo palo e respinge il colpo di testa di {o}.",
      "Reattività di {p} sull'incornata ravvicinata di {o}.",
      "{p} si fa trovare in posizione sul colpo di testa di {o}: parata di lettura.",
    ],
    'save:long_shot': [
      "{p} vede partire il tiro di {o} e ha tutto il tempo per sistemarsi.",
      "Tiro da fuori di {o}, {p} è ben posizionato e devia.",
      "{p} para la conclusione di {o}: tiro centrale, poca pericolosità reale.",
    ],
    'save:one_on_one': [
      "{p} esce con i tempi giusti e chiude lo specchio a {o}.",
      "Uno contro uno vinto da {p}: ha aspettato che {o} scoprisse l'intenzione.",
      "Posizione a stella di {p}, che copre lo specchio e ferma {o}.",
    ],
    post: [
      "Palo di {p}: esecuzione quasi perfetta, manca pochissimo.",
      "{p} cerca il secondo palo e trova il legno.",
      "Il palo respinge la conclusione di {p}: scelta di tiro corretta, esecuzione millimetrica mancata.",
    ],
    crossbar: [
      "Traversa di {p}: il pallone si è alzato un filo di troppo.",
      "{p} calcia sotto la palla e trova la traversa.",
      "Conclusione di {p} sulla traversa: impatto potente ma poco controllo.",
    ],
    miss: [
      "Fuori il tiro di {p}: postura del corpo non ideale al momento dell'impatto.",
      "{p} calcia di prima intenzione, ma senza precisione.",
      "Conclusione di {p} a lato: troppa fretta, poteva controllare.",
      "{p} spara alto: il busto era troppo indietro.",
    ],
    'miss:header': [
      "Colpo di testa di {p} fuori misura: impatto col pallone non pulito.",
      "{p} stacca bene, ma non riesce a indirizzare verso il basso.",
      "Incornata di {p} a lato, disturbato dal diretto marcatore.",
    ],
    'miss:long_shot': [
      "Tiro da lontano di {p} a lato: scelta ottimistica.",
      "{p} prova da fuori ma il pallone non scende: fuori.",
      "Conclusione dalla distanza di {p} imprecisa, possesso sprecato per {t}.",
    ],
    blocked: [
      "{o} chiude la linea di tiro e respinge la conclusione di {p}.",
      "Tiro di {p} murato da {o}, ottimo scivolamento difensivo.",
      "{o} si frappone con il corpo e blocca il tentativo di {p}.",
    ],
    corner: [
      "Angolo per {t}: {p} alla battuta, vediamo se ci sarà uno schema sul primo palo.",
      "Corner per {t}, {p} sulla bandierina. {opp} difende a zona mista.",
      "{p} si prepara a calciare l'angolo: {t} carica l'area con i saltatori.",
      "Calcio d'angolo per {t}, {p} potrebbe cercare la soluzione corta.",
    ],
    foul: [
      "Fallo tattico di {p} su {o}: interrompe la transizione sul nascere.",
      "{p} arriva in ritardo su {o}: contatto inevitabile.",
      "{p} trattiene {o} per evitare la ripartenza.",
      "Intervento scomposto di {p} ai danni di {o}, punizione in zona interessante.",
    ],
    yellow: [
      "Ammonizione per {p}: fallo tattico che l'arbitro sanziona correttamente.",
      "Giallo a {p}, che ora dovrà gestire i duelli con più cautela.",
      "{p} ammonito: da qui in poi sarà condizionato nei contrasti.",
    ],
    red: [
      "Espulsione per {p}: {t} dovrà ridisegnarsi con un uomo in meno.",
      "Rosso a {p}, un colpo pesante per gli equilibri di {t}.",
      "{p} lascia il campo: {t} costretta ad abbassare il baricentro.",
    ],
    penalty_awarded: [
      "Rigore per {t}: {p} attacca lo spazio e viene steso in area.",
      "{p} guadagna il penalty per {t} con un'ottima protezione della palla.",
      "Penalty per {t}: {p} si inserisce con i tempi giusti e viene toccato.",
    ],
    penalty_scored: [
      "{p} trasforma: rincorsa lenta, attende il movimento di {o} e calcia dall'altra parte.",
      "Rigore di {p} angolato a mezza altezza, {o} intuisce ma non ci arriva.",
      "Esecuzione pulita di {p}, {o} si muove troppo presto.",
    ],
    penalty_missed: [
      "{p} sbaglia: rincorsa troppo lunga, perde la coordinazione.",
      "Rigore fuori di {p}: ha cercato troppo l'angolo.",
      "{p} calcia alto, il piede d'appoggio è scivolato.",
    ],
    'penalty_missed:saved': [
      "{p} para il rigore di {o}: ha studiato la rincorsa e aspettato fino all'ultimo.",
      "{p} legge le anche di {o} e respinge il penalty.",
      "Ottima intuizione di {p}, che si butta sul lato giusto e ferma {o}.",
    ],
    goal: [
      "Gol di {p}! Movimento senza palla perfetto e conclusione precisa.",
      "{p} segna: {t} capitalizza la superiorità creata in zona palla.",
      "Rete di {p} su assist di {o}: sviluppo manovrato da manuale.",
      "{p} finalizza con freddezza, la difesa di {opp} era disallineata.",
      "Gol! {o} rifinisce nel corridoio centrale, {p} chiude a rete.",
    ],
    'goal:header': [
      "{p} segna di testa: ha attaccato lo spazio tra i centrali.",
      "Gol di testa di {p}, timing di stacco perfetto sul marcatore.",
      "Cross di {o} a rientrare, {p} incorna sul primo palo: gol.",
    ],
    'goal:long_shot': [
      "Gol da fuori di {p}: {opp} non ha scalato sul portatore e lui ne approfitta.",
      "{p} segna dalla distanza con una traiettoria a scendere imprendibile.",
      "Conclusione a bassa probabilità, esecuzione altissima: gran gol di {p}.",
    ],
    'goal:one_on_one': [
      "{p} vince il duello col portiere: attende l'uscita e la mette sotto.",
      "Uno contro uno risolto da {p} con un tocco sul palo lontano.",
      "Lancio di {o} sul filo del fuorigioco, {p} batte il portiere in uscita.",
    ],
    'goal:free_kick': [
      "Punizione di {p} a giro sopra la barriera: il portiere era posizionato male.",
      "{p} calcia la punizione sul palo del portiere e lo sorprende.",
      "Calcio piazzato perfetto di {p}: rotazione e velocità ideali.",
    ],
    'goal:volley': [
      "{p} colpisce al volo con perfetta coordinazione: gol.",
      "Tiro al volo di {p} con il corpo sopra il pallone: traiettoria bassa, rete.",
      "{o} crossa e {p} impatta al volo senza stoppare: esecuzione tecnica di altissimo livello.",
    ],
    'goal:solo': [
      "{p} parte in conduzione, elimina due uomini e segna: iniziativa individuale decisiva.",
      "Gol di {p} in solitaria: ha sfruttato le distanze larghe tra i reparti di {opp}.",
      "{p} fa tutto da solo, conduzione e conclusione: {opp} non ha mai scalato.",
    ],
    'goal:counter': [
      "Transizione letale di {t}: {p} chiude l'azione in pochi secondi.",
      "Gol in ripartenza di {p}: {opp} era sbilanciata in avanti.",
      "{o} verticalizza subito dopo il recupero, {p} finalizza il contropiede.",
    ],
    own_goal: [
      "Autorete di {p}: tentativo di chiusura in scivolata che finisce nella porta di {t}.",
      "{p} devia nella propria rete, {opp} ringrazia: difesa di {t} disorganizzata.",
      "Sfortunato {p}, intervento difensivo con il corpo sbilanciato e palla nella propria porta.",
    ],
    defensive_error: [
      "Errore di {p} in impostazione dal basso: palla persa sotto pressione.",
      "{p} sbaglia la lettura della profondità e apre un corridoio.",
      "Controllo difettoso di {p} in zona pericolosa: {t} scoperta.",
    ],
    injury: [
      "{p} si ferma: sembra un problema muscolare, dopo uno scatto.",
      "{p} resta a terra dopo il contrasto, staff medico in campo.",
      "Infortunio per {p}: {t} dovrà rivedere gli equilibri.",
    ],
    shootout_start: [
      "Si va ai rigori tra {home} e {away}: conteranno la gestione della tensione e lo studio dei rigoristi.",
      "Calci di rigore: {home} e {away} si giocano tutto sulla precisione individuale.",
      "Serie dal dischetto tra {home} e {away}, i portieri avranno studiato le preferenze dei tiratori.",
    ],
    'shootout_kick:scored': [
      "{p} segna: angolato, {o} spiazzato.",
      "Rigore perfetto di {p}, {o} parte in anticipo.",
      "{p} realizza con un tiro a mezza altezza, imprendibile per {o}.",
    ],
    'shootout_kick:missed': [
      "{p} sbaglia: esecuzione troppo centrale, {o} ringrazia.",
      "Errore di {p}, ha cambiato idea durante la rincorsa.",
      "{p} non trova la porta: tensione evidente nel gesto.",
    ],
    'tail:equalizer': [
      "Equilibrio ristabilito: {score}.",
      "Si riparte da zero, {score}: cambia la gestione della partita.",
    ],
    'tail:go_ahead': [
      "{t} in vantaggio, {score}: ora può gestire con un blocco più basso.",
      "Sorpasso, {score}: {opp} dovrà alzare il baricentro.",
    ],
    'tail:late': [
      "Gol al {min}': tempistica che pesa enormemente sull'inerzia della partita.",
      "Siamo al {min}', poco tempo per le contromisure.",
    ],
    'tail:brace': [
      "Doppietta per {p}, riferimento offensivo costante.",
      "Secondo gol di {p}: i movimenti in area fanno la differenza.",
    ],
    'tail:hattrick': [
      "Tripletta di {p}: prestazione offensiva completa.",
      "Tre reti per {p}, {opp} non ha mai trovato le contromisure.",
    ],
    'tail:comeback': [
      "Rimonta completata: {score}. Le correzioni di {t} hanno funzionato.",
      "{t} ribalta il risultato, {score}: partita cambiata dalle scelte a gara in corso.",
    ],
  },

  // ───────────────────────────── IRONICO ─────────────────────────────
  ironico: {
    kickoff: [
      "Comincia {home}-{away}. Le aspettative sono alte, i piedi un po' meno.",
      "Si parte: {home} contro {away}. Qualcuno avrà letto il regolamento, speriamo.",
      "Fischio d'inizio tra {home} e {away}. Mettetevi comodi, o almeno provateci.",
    ],
    halftime: [
      "Intervallo sul {score}. Tè caldo e profonde riflessioni per {home} e {away}.",
      "Fine primo tempo: {home}-{away} {score}. Il meglio, si spera, deve ancora venire.",
      "Si va al riposo sul {score}. Negli spogliatoi voleranno parole, forse anche tazze.",
    ],
    'fulltime:win': [
      "Finisce {score}: {t} vince, {opp} scopre il fascino della sconfitta con dignità.",
      "Triplice fischio: {t} esulta, {opp} medita. {score}, tutto regolare.",
      "{t} batte {opp} {score}. Nessuno si stupisca, o forse sì.",
    ],
    'fulltime:draw': [
      "{home}-{away} {score}: nessuno ha perso, che è quasi come vincere. Quasi.",
      "Pareggio {score}. Un risultato che accontenta tutti e non entusiasma nessuno.",
      "Finisce {score} tra {home} e {away}. Tutti a casa, con un punto e qualche dubbio.",
    ],
    pass: [
      "{p} passa a {o}. Rivoluzionario.",
      "{p} serve {o}, e il pallone arriva pure. Applausi.",
      "Passaggio di {p} per {o}: il calcio, ogni tanto, è semplice.",
      "{p} si libera del pallone dandolo a {o}. Responsabilità condivisa.",
    ],
    dribble: [
      "{p} salta {o}, che ancora si chiede dove sia finito il pallone.",
      "{o} prova a fermare {p}. Prova, appunto.",
      "Dribbling di {p}: {o} rimane lì, come una statua in un parco.",
      "{p} supera {o} con una finta. {o} ci è cascato con grande convinzione.",
    ],
    tackle: [
      "{p} toglie il pallone a {o}, che evidentemente non ci teneva poi così tanto.",
      "Contrasto vinto da {p}: {o} dovrà ripassare il capitolo «protezione palla».",
      "{p} ruba palla a {o} con una naturalezza quasi offensiva.",
      "{o} aveva il pallone. Poi è arrivato {p}.",
    ],
    interception: [
      "{p} intercetta. Il passaggio era talmente leggibile che l'avrebbe preso anche un lampione.",
      "Intercetto di {p}: grazie per il regalo, dicono da {t}.",
      "{p} si mette in mezzo alla traiettoria. Non è magia, è geometria.",
    ],
    chance: [
      "{p} apparecchia per {o}. Ora vediamo se sa usare le posate.",
      "Occasione per {t}: {p} serve {o}, che ha tutto il tempo di complicarsi la vita.",
      "{p} mette {o} davanti a una scelta. Speriamo quella giusta.",
      "{p} trova {o} in area. Per una volta, tutto sembra funzionare.",
    ],
    'chance:through_ball': [
      "Filtrante di {p}: la difesa di {opp} guarda {o} andar via con aria interrogativa.",
      "{p} infila la difesa. {o} ringrazia e parte, fuorigioco permettendo.",
      "{p} lancia {o} in profondità: la linea difensiva era in pausa caffè.",
    ],
    'chance:cross': [
      "Cross di {p}: {o} ha un appuntamento con il pallone. Speriamo sia puntuale.",
      "{p} mette in mezzo, {o} ci si butta con fiducia. Troppa, forse.",
      "Traversone di {p}. In area c'è {o}, e un certo ottimismo.",
    ],
    'chance:cutback': [
      "{p} arriva sul fondo e torna indietro per {o}. Il passaggio all'indietro più utile della giornata.",
      "Scarico di {p} per {o}, solo al limite dell'area piccola. Nessuno lo marca, chissà perché.",
      "{p} serve {o} a rimorchio: la difesa di {opp} è andata a vedere altrove.",
    ],
    big_chance: [
      "{p} ha davanti la porta. Grande, vuota, immobile. Cosa potrà mai andare storto?",
      "Occasione enorme per {p}. Anche troppo enorme, ci si sente quasi in imbarazzo.",
      "{p} si trova la palla del gol. Il pubblico trattiene il fiato, per sicurezza.",
      "Per {p} è quasi più difficile sbagliare. Quasi.",
    ],
    counter: [
      "Contropiede di {t}: {p} corre, {opp} riflette sulle proprie scelte di vita.",
      "{t} riparte con {p}. La difesa di {opp} arranca, con stile.",
      "{p} guida la ripartenza. {opp} è ancora nell'altra metà campo, a pensarci su.",
    ],
    shot: [
      "{p} tira. Con convinzione, diciamo.",
      "Conclusione di {p}. Vediamo dove va, lo scopriremo insieme.",
      "{p} ci prova, perché no.",
      "Tiro di {p}, con più speranza che mira...",
    ],
    'shot:long_shot': [
      "{p} tira da lontano. Molto lontano. Ammirevole ottimismo.",
      "Da fuori area {p} tenta la sorte: il coraggio non gli manca.",
      "{p} calcia da una distanza che richiederebbe il passaporto.",
    ],
    'shot:header': [
      "{p} ci mette la testa. Letteralmente.",
      "Colpo di testa di {p}, con tutto il cervello a disposizione.",
      "{p} incorna. Speriamo nella direzione giusta.",
    ],
    save: [
      "{p} para il tiro di {o}. Del resto è il suo lavoro, ogni tanto lo fa.",
      "{o} calcia, {p} blocca. Nessuna sorpresa, zero drammi.",
      "Parata di {p}: {o} ci aveva sperato, per circa mezzo secondo.",
      "{p} dice di no a {o}. Educatamente, ma con fermezza.",
    ],
    'save:header': [
      "Colpo di testa di {o}, {p} lo prende. La testa non basta, serviva anche la mira.",
      "{p} respinge l'incornata di {o}: bella idea, esecuzione rivedibile.",
      "{o} ci prova di testa, {p} ci arriva con le mani. Le mani vincono.",
    ],
    'save:long_shot': [
      "{o} tira da lontano, {p} ha il tempo di pensarci e parare.",
      "Da fuori, {o} sfida {p}. Il portiere ringrazia per il preavviso.",
      "{p} blocca il tiro di {o}: più un omaggio che una conclusione.",
    ],
    'save:one_on_one': [
      "{o} solo davanti a {p}. {p} vince. {o} ci penserà stanotte.",
      "Uno contro uno: {p} batte {o}, che aveva già pensato all'esultanza.",
      "{p} esce e ferma {o}. L'attaccante guarda il cielo, ma lì non c'è nessuno a cui dare la colpa.",
    ],
    post: [
      "Palo di {p}. Il legno ringrazia per l'attenzione.",
      "{p} colpisce il palo: mira quasi perfetta, risultato perfettamente inutile.",
      "Il palo salva tutti da un gol di {p}. Anche {p}, forse.",
    ],
    crossbar: [
      "Traversa di {p}. Bella, ma non vale nulla.",
      "{p} centra la traversa: esercizio di precisione, peccato fosse la cosa sbagliata.",
      "La traversa respinge {p}. Un giorno ci farà pace.",
    ],
    miss: [
      "{p} manda fuori. L'intenzione c'era, tutto il resto no.",
      "Fuori! {p} ha scelto una porta immaginaria.",
      "Tiro di {p} a lato. Il pubblico in tribuna ringrazia per il souvenir.",
      "{p} calcia alto. Un omaggio agli uccelli di passaggio.",
    ],
    'miss:header': [
      "Colpo di testa di {p}, fuori. La testa era giusta, la direzione meno.",
      "{p} incorna a lato. Serviva un pizzico di precisione, o un navigatore.",
      "Testa di {p}, palla fuori. Riproveremo.",
    ],
    'miss:long_shot': [
      "Tiro da lontano di {p}: il pallone sta ancora viaggiando.",
      "{p} prova da fuori, e fuori resta.",
      "Conclusione di {p} dalla distanza, in orbita. La NASA è stata avvisata.",
    ],
    blocked: [
      "{o} si mette davanti al tiro di {p}. Coraggio o distrazione, lo sapremo solo al replay.",
      "Tiro di {p} murato da {o}. Il corpo umano, questo strumento difensivo.",
      "{p} calcia addosso a {o}. Almeno ha colpito qualcosa.",
    ],
    corner: [
      "Angolo per {t}. {p} va alla bandierina con passo solenne.",
      "Corner per {t}, lo batte {p}. Si accettano scommesse sull'esito.",
      "{p} sistema il pallone per l'angolo. In area si formano piccoli gruppi di sospettosi.",
      "Calcio d'angolo per {t}: momento di grande speranza e scarsa probabilità.",
    ],
    foul: [
      "{p} ferma {o} con un metodo non previsto dal regolamento.",
      "Fallo di {p} su {o}. Un abbraccio non richiesto.",
      "{p} affronta {o} con entusiasmo eccessivo. L'arbitro fischia.",
      "{o} a terra, {p} con le mani alzate: il classico «non l'ho neanche toccato».",
    ],
    yellow: [
      "Giallo per {p}. Un piccolo ricordo di questa giornata.",
      "{p} ammonito, con l'aria di chi non capisce cosa ha fatto. Tutti gli altri l'hanno capito.",
      "Cartellino giallo a {p}: primo avviso, gentile ma deciso.",
    ],
    red: [
      "Rosso per {p}. La doccia lo aspetta, calda si spera.",
      "{p} espulso: esce con passo lento, come a dire che non è finita. Invece sì.",
      "Cartellino rosso a {p}. {t} ringrazia per il contributo.",
    ],
    penalty_awarded: [
      "Rigore per {t}! {p} va giù in area con una certa teatralità, ma l'arbitro ci crede.",
      "Penalty per {t}: {p} lo conquista con abilità, o talento drammatico.",
      "{p} viene toccato in area: rigore per {t}. Il pubblico di {opp} non la prende bene.",
    ],
    penalty_scored: [
      "{p} segna il rigore, {o} si tuffa dall'altra parte con grande impegno.",
      "Rigore trasformato da {p}. {o} ha indovinato tutto, tranne l'angolo.",
      "{p} dal dischetto: gol. {o} saluta il pallone mentre passa.",
    ],
    penalty_missed: [
      "{p} sbaglia il rigore. Un gesto di grande generosità.",
      "Rigore fuori di {p}. Ha preferito mirare alla gloria del ridicolo.",
      "{p} calcia alto: il pallone cerca ancora la porta.",
    ],
    'penalty_missed:saved': [
      "{p} para il rigore di {o}. {o} pensava fosse più facile, e aveva ragione.",
      "{o} dal dischetto, {p} respinge. Un momento imbarazzante, ma solo per uno dei due.",
      "{p} ferma il rigore di {o}: stanotte qualcuno dormirà benissimo, qualcun altro no.",
    ],
    goal: [
      "Gol di {p}. Finalmente qualcosa di concreto.",
      "{p} segna e {t} esulta. Tutti gli altri meno.",
      "Rete di {p} su servizio di {o}. Il lavoro di squadra, a volte, funziona.",
      "{p} la mette dentro. Chi l'avrebbe detto? Beh, qualcuno sì.",
      "Gol! {o} lo serve su un piatto d'argento, {p} non deve fare altro che firmare.",
    ],
    'goal:header': [
      "Gol di testa di {p}. Dicono che la testa serva anche a questo.",
      "{p} incorna in rete: una testa più utile del previsto.",
      "{o} crossa, {p} ci mette la fronte: gol. Semplice, se ci riesci.",
    ],
    'goal:long_shot': [
      "Gol da fuori di {p}. Nessuno ci credeva, lui forse nemmeno.",
      "{p} segna da lontano: il portiere sta ancora guardando l'incrocio.",
      "Tiro da lontanissimo di {p}, gol. Magari lo rifà, magari no.",
    ],
    'goal:one_on_one': [
      "{p} solo contro il portiere, e per una volta vince l'attaccante.",
      "Uno contro uno, {p} segna. Il portiere ci ha provato, con modesto successo.",
      "{o} lancia, {p} batte il portiere. Tutto troppo facile.",
    ],
    'goal:free_kick': [
      "Gol su punizione di {p}. La barriera saltava, il pallone di più.",
      "{p} infila la punizione: il portiere aveva sistemato la barriera, peccato per il resto.",
      "Punizione di {p} all'angolino. Oggi il piede è in vena.",
    ],
    'goal:volley': [
      "Gol al volo di {p}. Per fortuna non ci ha pensato troppo.",
      "{p} colpisce al volo e segna: la coordinazione, questa sconosciuta, oggi c'è.",
      "Cross di {o}, volée di {p}, rete. Non provateci a casa.",
    ],
    'goal:solo': [
      "{p} fa tutto da solo e segna. I compagni lo guardano con ammirazione e leggera inutilità.",
      "Azione personale di {p}: salta tutti e segna. Il gioco di squadra può attendere.",
      "Gol di {p}, che dribbla mezzo mondo. L'altra metà guarda.",
    ],
    'goal:counter': [
      "Contropiede di {t}, gol di {p}. {opp} era ancora nell'altra area a discutere.",
      "{p} chiude la ripartenza: {opp} ha scoperto che anche difendere è importante.",
      "{o} lancia, {p} segna in contropiede. Efficienza quasi svizzera.",
    ],
    own_goal: [
      "Autogol di {p}. Un gesto di grande generosità nei confronti di {opp}.",
      "{p} segna, ma nella porta sbagliata. {t} non apprezza lo spirito.",
      "{p} batte il proprio portiere: {opp} ringrazia sentitamente.",
    ],
    defensive_error: [
      "Errore di {p}. Una scelta creativa, diciamo.",
      "{p} regala il pallone agli avversari. Il Natale arriva presto quest'anno.",
      "{p} si complica la vita da solo. Talento raro.",
    ],
    injury: [
      "{p} resta a terra. Speriamo non sia niente, magari solo l'orgoglio.",
      "Problema per {p}, che si ferma. I sanitari arrivano con la loro solita calma.",
      "{p} si tocca la gamba. Speriamo sia solo un crampo, e non il morale.",
    ],
    shootout_start: [
      "Rigori tra {home} e {away}: il momento in cui tutti dimenticano come si calcia un pallone.",
      "Si va ai calci di rigore. {home} e {away} scoprono la bellezza dell'ansia.",
      "Lotteria dei rigori tra {home} e {away}. Si consiglia di non guardare.",
    ],
    'shootout_kick:scored': [
      "{p} segna, {o} ci ha provato con buona volontà.",
      "Rigore di {p} a segno. {o} si tuffa con grazia, e basta.",
      "{p} non sbaglia. Nemmeno un po' di suspense, grazie.",
    ],
    'shootout_kick:missed': [
      "{p} sbaglia. {o} ringrazia e si sistema i guanti.",
      "Rigore fallito da {p}. Momento di riflessione collettiva.",
      "{p} calcia e non segna. Poteva andare meglio, e anche peggio.",
    ],
    'tail:equalizer': [
      "E quindi si ricomincia: {score}. Che fatica.",
      "Parità, {score}. Tutto il lavoro di prima, cancellato.",
    ],
    'tail:go_ahead': [
      "{t} davanti, {score}. Ora c'è da tenerlo, il vantaggio. Auguri.",
      "{score} per {t}. Qualcuno si ricordi di difendere.",
    ],
    'tail:late': [
      "Al {min}'. Tempismo impeccabile, o quasi crudele.",
      "Minuto {min}: c'è chi aveva già spento la tv.",
    ],
    'tail:brace': [
      "Doppietta di {p}. Ha preso gusto.",
      "Secondo gol di {p}: non era un caso, a quanto pare.",
    ],
    'tail:hattrick': [
      "Tripletta di {p}. Ora non se lo toglieranno più dai piedi.",
      "Tre gol per {p}: qualcuno fermi quest'uomo, possibilmente legalmente.",
    ],
    'tail:comeback': [
      "Rimonta di {t}: {score}. Chi era già uscito dal bar ha sbagliato.",
      "{t} ribalta tutto, {score}. Mai dare nulla per scontato.",
    ],
  },

  // ───────────────────────────── TRASH ─────────────────────────────
  trash: {
    kickoff: [
      "RAGAZZI SI PARTE! {home} contro {away}, allacciate le cinture e chiamate la mamma!",
      "{home} vs {away}: fischio d'inizio, il server del calcio sta già sudando.",
      "Iniziaaaa! {home}-{away}, il caos ha ufficialmente preso il microfono.",
    ],
    halftime: [
      "Pausa! {home}-{away} {score}, tutti a fare scroll sul telefono per quindici minuti.",
      "Fine primo tempo sul {score}: il mio cuore è in modalità aereo.",
      "Intervallo, {score}. Qualcuno porti un defibrillatore e delle patatine.",
    ],
    'fulltime:win': [
      "FINITAAA! {t} ASFALTA {opp} {score}, contenuto certificato da screenshot!",
      "{t} vince {score}, {opp} disinstalla il gioco e va a vivere in montagna.",
      "È FINITA! {t} {score}, {opp} riceve la notifica «sconfitta» e la ignora.",
    ],
    'fulltime:draw': [
      "Pareggio {score}! {home} e {away} si stringono la mano, poi si bloccano sui social.",
      "{score} e tutti a casa: un pareggio che sa di pizza fredda.",
      "Finisce {score} tra {home} e {away}. Nessuno vince, il caos sì.",
    ],
    pass: [
      "{p} passa a {o} con la delicatezza di un messaggio vocale di tre minuti.",
      "Palla da {p} a {o}, connessione a fibra ottica!",
      "{p} serve {o}: passaggio così pulito che ci puoi mangiare sopra.",
      "{p} per {o}, la chimica è reale, shippiamoli!",
    ],
    dribble: [
      "{p} manda {o} al supermercato a comprare il latte! OLÉ!",
      "{o} è stato cancellato dalla realtà da {p}! Ankle breaker certificato!",
      "{p} fa girare {o} come una trottola, qualcuno lo raccolga!",
      "Ma cos'è?! {p} lascia {o} in buffering!",
    ],
    tackle: [
      "{p} arriva e RUBA il pallone a {o}, tipo borseggiatore professionista!",
      "Contrasto di {p}: {o} ha perso il pallone, la dignità e il wifi!",
      "{p} dice «questo è mio» e se lo prende da {o}. Rispetto.",
      "{o} aveva il pallone, poi {p} ha premuto CTRL+X!",
    ],
    interception: [
      "{p} intercetta! Ha letto il passaggio prima che lo scrivessero!",
      "Bloccato! {p} fa lo spoiler all'azione di {opp}!",
      "{p} si mette in mezzo come un pop-up pubblicitario: palla a {t}!",
    ],
    chance: [
      "{p} serve {o}... OCCHIO CHE QUI SUCCEDE QUALCOSA!",
      "{p} regala a {o} un'occasione con fiocco e bigliettino!",
      "Attenzione attenzione! {p} per {o}, {t} fiuta il sangue... ehm, il gol!",
      "{p} carica il colpo per {o}, il pubblico va in tilt!",
    ],
    'chance:through_ball': [
      "Filtrante di {p} che TAGLIA la difesa come un coltello nel burro! {o} vola!",
      "{p} imbuca per {o}, la difesa di {opp} è ancora in fila alla posta!",
      "Passaggio illegale di {p}! {o} parte e la difesa lagga!",
    ],
    'chance:cross': [
      "Cross di {p}, {o} in area come uno squalo in piscina!",
      "{p} spara la palla in mezzo, {o} è già in posizione da meme!",
      "Traversone di {p}! {o} attacca il pallone come fosse l'ultimo panino al buffet!",
    ],
    'chance:cutback': [
      "{p} arriva sul fondo e fa il ritorno al passato per {o}!",
      "Palla indietro di {p}, {o} tutto solo come me il sabato sera!",
      "{p} rimette dietro per {o}, la difesa di {opp} è andata a farsi un caffè!",
    ],
    big_chance: [
      "OH NO OH NO OH NO! {p} DAVANTI ALLA PORTA!",
      "{p} ha una chance così grande che si vede da Google Maps!",
      "QUI SE SBAGLIA LO BANNANO! {p} tutto solo!",
      "{p} contro la porta vuota, il mio battito è a 200!",
    ],
    counter: [
      "CONTROPIEDE! {p} parte a razzo, {opp} con la connessione a 56k!",
      "{t} riparte più veloce di un rider in ritardo, guida {p}!",
      "{p} scappa via, {opp} rincorre come in un sogno dove le gambe non funzionano!",
    ],
    shot: [
      "{p} TIRAAAA!",
      "{p} calcia con la potenza di mille microonde!",
      "Tiro di {p}, preparate i popcorn...",
      "{p} spara! Via col vento!",
    ],
    'shot:long_shot': [
      "{p} tira da casa sua! Letteralmente dal divano!",
      "Missile balistico di {p} da distanza siderale!",
      "{p} calcia da lontanissimo, il pallone sta prenotando un volo!",
    ],
    'shot:header': [
      "{p} tira di TESTA con la forza di un ariete medievale!",
      "Craniata di {p}! Il pallone ha il mal di testa!",
      "{p} colpisce di testa, pettinatura a rischio!",
    ],
    save: [
      "{p} PARA! {o} è stato rimandato a settembre!",
      "Ma {p} ha le mani di velcro?! Niente per {o}!",
      "{p} chiude la saracinesca, {o} rimane col conto in sospeso!",
      "NO NO NO! {p} dice «non oggi» a {o}!",
    ],
    'save:header': [
      "{p} vola come un gatto sul divano e ferma la testata di {o}!",
      "{o} di testa, {p} di mani: le mani vincono sempre, è scienza!",
      "Riflesso da videogioco di {p} sull'incornata di {o}!",
    ],
    'save:long_shot': [
      "Missile di {o}, ma {p} lo intercetta come un sistema antimissile!",
      "{p} para il bolide di {o} e si soffia sulle mani!",
      "{o} spara da lontano, {p} risponde «ok boomer» e para.",
    ],
    'save:one_on_one': [
      "{p} esce come un lottatore di wrestling e ferma {o}!",
      "Uno contro uno: {p} fa il boss finale e {o} perde tutte le vite!",
      "{o} solo davanti a {p}... e {p} lo manda in modalità spettatore!",
    ],
    post: [
      "PALOOOO! {p} prende il legno, il legno prende paura!",
      "{p} colpisce il palo: il palo chiede un avvocato!",
      "DING! Il palo suona come un campanello, {p} disperato!",
    ],
    crossbar: [
      "TRAVERSAAA! {p} fa vibrare la porta come un subwoofer!",
      "{p} spacca la traversa, qualcuno chiami un falegname!",
      "La traversa ha salvato tutti da {p}, ma ora è traumatizzata!",
    ],
    miss: [
      "Fuori! {p} ha colpito un piccione in terzo anello!",
      "{p} sbaglia così male che il pallone chiede asilo politico!",
      "Il tiro di {p} è andato così lontano che serve il GPS!",
      "{p} manda fuori, lo stadio emette un suono tipo modem!",
    ],
    'miss:header': [
      "Colpo di testa di {p} fuori! Testa sì, bussola no!",
      "{p} incorna nel nulla cosmico!",
      "{p} di testa... direzione: Plutone!",
    ],
    'miss:long_shot': [
      "Il tiro di {p} è appena atterrato in un altro comune!",
      "{p} da lontano: il pallone è ancora in orbita!",
      "{p} prova la botta, colpisce solo la nostra fiducia!",
    ],
    blocked: [
      "{o} si butta davanti al tiro di {p} come un eroe dei film d'azione!",
      "MURO! {o} ferma {p}, livello difesa: cemento armato!",
      "{p} calcia, {o} fa da scudo umano! Rispetto massimo!",
    ],
    corner: [
      "Angolo per {t}! {p} va alla bandierina, il caos si sta caricando!",
      "Corner per {t}: in area c'è più traffico che in tangenziale, batte {p}!",
      "{p} batte l'angolo per {t}, tutti pronti al mosh pit!",
      "Calcio d'angolo, {t} ci crede! {p} col piede caldo!",
    ],
    foul: [
      "{p} stende {o} come un tappeto IKEA!",
      "Fallo di {p} su {o}: chiamate il mago del cerotto!",
      "{p} entra su {o} con la delicatezza di una betoniera!",
      "{o} a terra, {p} fa la faccia da angioletto: NON CI CREDE NESSUNO!",
    ],
    yellow: [
      "GIALLO per {p}! Il cartellino color evidenziatore!",
      "{p} ammonito, ora gioca in modalità hardcore!",
      "Giallo a {p}: prima story del giorno!",
    ],
    red: [
      "ROSSOOO! {p} bannato dalla partita!",
      "{p} espulso! Log out forzato, arrivederci!",
      "Cartellino rosso per {p}: game over, inserire moneta!",
    ],
    penalty_awarded: [
      "RIGOREEE! {p} va giù in area e {t} impazzisce!",
      "{p} conquista il rigore per {t}! Il VAR sta ancora caricando!",
      "Penalty per {t}! {p} cade come in una soap opera!",
    ],
    penalty_scored: [
      "{p} SEGNAAA! {o} si è tuffato nella dimensione sbagliata!",
      "Rigore di {p}: {o} spiazzato, sta ancora cercando il pallone!",
      "{p} dal dischetto con la freddezza di un freezer: {o} battuto!",
    ],
    penalty_missed: [
      "{p} SBAGLIA IL RIGORE! Il pallone è in un'altra galassia!",
      "{p} calcia fuori, momento cringe della settimana!",
      "Rigore di {p} in curva, i tifosi ringraziano per il regalo!",
    ],
    'penalty_missed:saved': [
      "{p} PARA IL RIGORE! {o} voleva solo tornare a casa!",
      "{p} è il boss finale: rigore di {o} bloccato!",
      "{p} para e {o} entra in crisi esistenziale!",
    ],
    goal: [
      "GOOOOOOOL! {p} ha rotto internet!",
      "{p} SEGNAAA! La rete è in fiamme, qualcuno chiami i pompieri!",
      "GOL DI {p}! {o} lo imbecca e {p} fa esplodere lo stadio!",
      "MA COSA HA FATTO {p}?! GOL! Sto piangendo!",
      "{o} passa, {p} segna, io urlo: CHE GOOOL!",
    ],
    'goal:header': [
      "GOL DI TESTA DI {p}! Craniata da sollevamento pesi!",
      "{p} segna di testa, il pallone ha visto le stelle!",
      "{o} crossa e {p} incorna: GOOOL! Testa di platino!",
    ],
    'goal:long_shot': [
      "GOOOOL DA CASA SUA! {p} ha segnato da un altro fuso orario!",
      "{p} tira da lontanissimo e SEGNA! Il portiere chiede il rimborso!",
      "Missile terra-aria di {p}: GOL! Ho perso la voce!",
    ],
    'goal:one_on_one': [
      "{p} faccia a faccia col portiere e lo umilia: GOOOL!",
      "Uno contro uno, {p} sceglie la violenza: GOL!",
      "{o} lancia, {p} fa il cucchiaio mentale: GOOOL!",
    ],
    'goal:free_kick': [
      "PUNIZIONE DI {p} A GIRO: GOOOL! La barriera è ancora lì che salta!",
      "{p} calcia la punizione e il pallone fa un TikTok prima di entrare!",
      "Calcio piazzato di {p}: gol da poster in cameretta!",
    ],
    'goal:volley': [
      "AL VOLOOO! {p} ha appena rotto la fisica: GOL!",
      "{p} la colpisce al volo e segna, qualcuno lo metta in un museo!",
      "{o} crossa, {p} spara al volo: GOOOL! Sto male!",
    ],
    'goal:solo': [
      "{p} SALTA TUTTI! Anche l'arbitro! Anche i raccattapalle! GOL!",
      "Azione solitaria di {p} che manco nei videogiochi a difficoltà facile: GOOOL!",
      "{p} contro il mondo e il mondo perde: GOL!",
    ],
    'goal:counter': [
      "Contropiede supersonico di {t}: GOOOL DI {p}!",
      "{t} riparte a razzo, {p} segna e {opp} è ancora in fase di caricamento!",
      "{o} lancia la bomba, {p} la fa esplodere: GOL IN CONTROPIEDE!",
    ],
    own_goal: [
      "AUTOGOL DI {p}! Ha sbagliato porta come quando sbagli chat!",
      "{p} segna nella propria rete! {opp} manda un cuoricino!",
      "Clamoroso! {p} infila il suo portiere: {t} vuole cambiare squadra!",
    ],
    defensive_error: [
      "{p} combina un disastro epocale in difesa!",
      "Errore di {p}: momento blooper da compilation!",
      "{p} sbaglia e la difesa di {t} va in crash!",
    ],
    injury: [
      "{p} è a terra! Servono i sanitari, e forse un abbraccio.",
      "Problema per {p}, che si ferma. Barra della salute in rosso!",
      "{p} resta giù, speriamo solo in un reset rapido.",
    ],
    shootout_start: [
      "RIGORIII! {home} contro {away}, qui si soffre come a un esame orale!",
      "Lotteria dei rigori tra {home} e {away}: il mio cuore sta facendo parkour!",
      "Si va ai rigori! {home} e {away} nella boss fight finale!",
    ],
    'shootout_kick:scored': [
      "{p} SEGNA! {o} saluta il pallone!",
      "{p} infila {o}: freddezza da frigorifero industriale!",
      "Rigore di {p} dentro! {o} tuffato nel vuoto!",
    ],
    'shootout_kick:missed': [
      "{p} SBAGLIA! {o} balla la macarena!",
      "Rigore di {p} fallito! Il pallone è andato a fare la spesa!",
      "{p} non segna, {o} diventa virale!",
    ],
    'tail:equalizer': [
      "PAREGGIO! {score}, TUTTO RESETTATO!",
      "Si ricomincia da capo: {score}, il caos regna!",
    ],
    'tail:go_ahead': [
      "{t} davanti! {score}, e ora tremate!",
      "SORPASSO! {score}, {opp} in panico!",
    ],
    'tail:late': [
      "AL {min}'! Il cardiologo è in linea!",
      "Minuto {min}, roba da coronarie!",
    ],
    'tail:brace': [
      "DOPPIETTA DI {p}! Ha sbloccato l'achievement!",
      "{p} fa due su due, modalità beast attivata!",
    ],
    'tail:hattrick': [
      "TRIPLETTAAA! {p} si porta a casa il pallone, la rete e pure la panchina!",
      "{p} TRE GOL! Qualcuno gli tolga il joystick!",
    ],
    'tail:comeback': [
      "RIMONTA FOLLE! {t} torna dall'aldilà: {score}!",
      "{t} ribalta tutto, {score}! Plot twist da serie tv!",
    ],
  },

  // ───────────────────────────── BAR SPORT ─────────────────────────────
  bar_sport: {
    kickoff: [
      "Oh, si comincia! {home} contro {away}, e io ho già ordinato il secondo caffè.",
      "Dai che parte {home}-{away}! Chi ha fatto l'asta migliore? Lo scopriamo adesso.",
      "Fischio d'inizio! {home} e {away}, e qui al bar già si litiga sulle formazioni.",
    ],
    halftime: [
      "Intervallo: {home}-{away} {score}. Un altro giro di spritz che qui c'è da discutere.",
      "Fine primo tempo sul {score}. Io l'avevo detto, eh, l'avevo detto!",
      "Si va al riposo, {score}. Ma quello lì chi l'ha comprato? Parliamone.",
    ],
    'fulltime:win': [
      "Finita! {t} vince {score}, e quelli di {opp} adesso stanno zitti per una settimana!",
      "{t} porta a casa la partita {score}. Crediti spesi bene, altroché!",
      "È finita {score}! {t} festeggia, {opp} già parla di rifondazione all'asta.",
    ],
    'fulltime:draw': [
      "Pareggio {score}. Né carne né pesce, come il panino del bar.",
      "{home}-{away} {score}, un punto per uno. Tutti scontenti, quindi giusto così.",
      "Finisce {score}. Ma dai, con quei giocatori lì dovevano vincere tutti e due!",
    ],
    pass: [
      "{p} la dà a {o}. Bravo, semplice, come ti ho sempre detto!",
      "Passaggio di {p} per {o}. Almeno quello lo sa fare.",
      "{p} serve {o}: ecco, così si gioca, non come la settimana scorsa!",
      "Toh, {p} per {o}. Ogni tanto una cosa giusta, dai.",
    ],
    dribble: [
      "Ma hai visto {p}?! Ha fatto fare la figura del birillo a {o}!",
      "{p} salta {o} come se non ci fosse. Te l'avevo detto che era forte!",
      "Oh, {o} è ancora lì che cerca il pallone! Che numero di {p}!",
      "{p} se lo beve {o}! E c'era chi non lo voleva all'asta!",
    ],
    tackle: [
      "{p} gliela toglie a {o}! Così si fa, grinta!",
      "Entrata di {p} su {o}, pulita pulita. Uno così lo prendevo pure io.",
      "{p} ruba palla a {o}. Ma dove guardava quello?",
      "Grande {p}! {o} va a casa senza pallone.",
    ],
    interception: [
      "{p} la legge e la prende! Ha visto tutto prima degli altri.",
      "Intercetto di {p}. Uno che la partita la capisce, mica come certi altri.",
      "{p} la ferma! Ecco perché l'ho pagato quei crediti in più.",
    ],
    chance: [
      "{p} la mette per {o}... dai, dai, DAI!",
      "Occhio che {p} trova {o}! Qui ci siamo!",
      "{p} serve {o}. Se non la butta dentro stavolta, cambio bar.",
      "Oh, {p} per {o}, occasione per {t}! Alzatevi!",
    ],
    'chance:through_ball': [
      "Ma che palla di {p}! {o} è da solo, la difesa di {opp} dorme!",
      "{p} filtra per {o}. Te l'avevo detto che vedeva il gioco!",
      "Imbucata di {p}, {o} va! Ma la difesa di {opp} chi l'ha comprata?",
    ],
    'chance:cross': [
      "Cross di {p}, {o} in mezzo! Dai che la prende!",
      "{p} la mette in mezzo, {o} c'è! Dai, di testa!",
      "Palla dentro di {p}! {o}, ti prego, non ciccarla!",
    ],
    'chance:cutback': [
      "{p} arriva in fondo e la dà indietro a {o}! Tutto solo! Ma che fa la difesa?!",
      "Scarico di {p} per {o}, libero come un uccellino!",
      "{p} la rimette indietro per {o}. Qui se non segna offre lui!",
    ],
    big_chance: [
      "Oh oh oh, {p} è solo! SOLO!",
      "{p} ha il gol sul piede! Se la sbaglia gli tolgo il saluto!",
      "Ma è da solo {p}! Con tutti i crediti che è costato, deve segnare!",
      "DAI {p}! Questa la segnava anche mio nonno!",
    ],
    counter: [
      "Contropiede di {t}! Vai {p}, vai che sono tutti dietro!",
      "{p} parte in contropiede, quelli di {opp} arrancano come al giovedì al calcetto!",
      "Ripartenza di {t}, {p} con la palla! Corri, corri!",
    ],
    shot: [
      "{p} tira!",
      "Calcia {p}... dai!",
      "Tiro di {p}! Alza la testa, alza la testa!",
      "{p} ci prova! Ma perché non la passa mai?",
    ],
    'shot:long_shot': [
      "{p} tira da lì?! Ma è matto?!",
      "{p} ci prova da fuori... Mah, vediamo.",
      "Da quaranta metri {p}! Io ci avrei pensato due volte.",
    ],
    'shot:header': [
      "{p} di testa! Salta, salta!",
      "Colpo di testa di {p}! Dai che ci siamo!",
      "{p} stacca di testa... oh!",
    ],
    save: [
      "Ma che para {p}?! {o} si mette le mani nei capelli!",
      "{p} la prende! Il miglior acquisto dell'asta, te lo dico io!",
      "Parata di {p} su {o}. Ma tirala forte, benedetto ragazzo!",
      "{p} dice no a {o}! Portiere pagato una miseria e para tutto!",
    ],
    'save:header': [
      "{o} di testa e {p} la toglie! Ma come ha fatto?!",
      "Parata di {p} sulla testata di {o}. Riflessi da gatto, oh!",
      "{p} vola su {o}! Io me lo tengo stretto quello!",
    ],
    'save:long_shot': [
      "{o} tira da lontano, {p} la blocca. Ma sì, figurati.",
      "Tiro di {o} da fuori, {p} sbadiglia e la prende.",
      "{p} para la botta di {o}. Te l'avevo detto che non entrava!",
    ],
    'save:one_on_one': [
      "{o} solo davanti a {p}... e la sbaglia! Ma no, l'ha parata {p}! Fenomeno!",
      "{p} esce e ipnotizza {o}! Ma come si fa?!",
      "Uno contro uno, vince {p}! {o} stasera non esce di casa.",
    ],
    post: [
      "PALO! Ma porca miseria, {p}!",
      "{p} prende il palo! Io non ci credo, oh!",
      "Il palo! {p}, ma di pochissimo! Ma che sfortuna!",
    ],
    crossbar: [
      "Traversa di {p}! Ma dai! Ma dai!",
      "{p} la stampa sulla traversa! Qui al bar è caduta una tazzina!",
      "Traversa! {p}, un dito più in basso e facevamo festa!",
    ],
    miss: [
      "Fuori! Ma {p}, ma che fai?!",
      "{p} la manda in tribuna. E l'hanno pagato tutti quei crediti!",
      "Ma dove la tira {p}?! Io ero meglio da giovane!",
      "{p} sbaglia. Te l'avevo detto che non era da comprare!",
    ],
    'miss:header': [
      "{p} di testa fuori. Ma con la testa ci deve pensare, non solo colpire!",
      "Incornata di {p}... alta. Ma va' là!",
      "{p} di testa, fuori di un metro. Mamma mia, che errore!",
    ],
    'miss:long_shot': [
      "{p} tira da lontano, fuori. E ti pareva!",
      "Tiro di {p} da fuori, sulle nuvole. Passala, la prossima volta!",
      "{p} ci prova da lì, e la manda al parcheggio.",
    ],
    blocked: [
      "{o} la ribatte! {p}, ma tirala da un'altra parte!",
      "Tiro di {p} addosso a {o}. Classico.",
      "{o} si butta e la ferma! Quello lì difende come un leone.",
    ],
    corner: [
      "Angolo per {t}, batte {p}. Speriamo che non la metta in curva come l'ultima volta.",
      "Corner per {t}! {p} alla bandierina, tutti dentro!",
      "{p} batte l'angolo per {t}. Dai che su palla inattiva siamo forti!",
      "Calcio d'angolo per {t}. {p}, mettila in mezzo e non fare il fenomeno!",
    ],
    foul: [
      "{p} stende {o}! Ma è fallo, arbitro, è fallo!",
      "Fallo di {p} su {o}. Eh vabbè, ci sta, dai.",
      "{p} entra duro su {o}. Ma questo gioca a calcio o a rugby?",
      "{o} va giù, {p} protesta. Ma dai, sempre la stessa storia!",
    ],
    yellow: [
      "Giallo a {p}! Ma se non ha fatto niente! Beh, quasi niente.",
      "{p} ammonito. Te l'avevo detto che era una testa calda.",
      "Cartellino giallo per {p}. E al fantacalcio sono mezzo punto in meno!",
    ],
    red: [
      "Rosso a {p}! Ma cosa ha fatto quel disgraziato?!",
      "{p} espulso! E adesso chi gioca? Io l'avevo detto di prendere le riserve!",
      "Via {p}, cartellino rosso! {t} adesso sono cavoli amari.",
    ],
    penalty_awarded: [
      "Rigore per {t}! {p} buttato giù! Oh, finalmente l'arbitro vede qualcosa!",
      "Penalty! {p} se lo guadagna. Ma era rigore? Ma certo che era rigore!",
      "Rigore per {t}! {p} va giù... sì, un po' si è buttato, ma ci sta.",
    ],
    penalty_scored: [
      "{p} dal dischetto... GOL! {o} di là, il pallone di qua!",
      "Rigore di {p}, dentro! Col bonus al fantacalcio, pure!",
      "{p} spiazza {o}. Freddo, eh? Io tremavo solo a guardare.",
    ],
    penalty_missed: [
      "{p} sbaglia il rigore! Ma no! Ma NO!",
      "Rigore fuori di {p}. Ma chi gliel'ha fatto tirare?!",
      "{p} la manda in curva. Ecco, adesso offre lui il giro.",
    ],
    'penalty_missed:saved': [
      "Parato! {p} para il rigore a {o}! Ma è un fenomeno quello!",
      "{p} ipnotizza {o}! Bonus rigore parato, io impazzisco!",
      "{o} tira, {p} para! Ma chi l'ha preso a così poco quel portiere?!",
    ],
    goal: [
      "GOOOL! {p}! Te l'avevo detto, TE L'AVEVO DETTO!",
      "Ha segnato {p}! Ecco perché l'ho pagato così tanto!",
      "Gol di {p}! Palla di {o}, e lui la butta dentro! Offro io!",
      "{p} la mette dentro! Qui al bar sono volati i cornetti!",
      "Assist di {o}, gol di {p}! Più tre al fantacalcio, andiamo!",
    ],
    'goal:header': [
      "Di testa {p}! Gol! Ma che stacco, oh!",
      "{p} incorna ed è gol! Sembra di vedere me da giovane!",
      "Cross di {o}, testa di {p}, GOL! Semplice, no?",
    ],
    'goal:long_shot': [
      "Da là! Da là l'ha messa {p}! Ma siete matti?!",
      "{p} tira da lontano e SEGNA! E io che gli urlavo di passarla!",
      "Gol di {p} da fuori! Scusa {p}, ritiro tutto quello che ho detto!",
    ],
    'goal:one_on_one': [
      "{p} solo davanti al portiere, e la mette! Freddo come una birra!",
      "Uno contro uno, {p} non perdona! Gol!",
      "Lancio di {o}, {p} scavalca il portiere! Ma che gol!",
    ],
    'goal:free_kick': [
      "Punizione di {p}, GOL! Che pennellata, oh!",
      "{p} su punizione la mette all'incrocio! Questo vale tutti i crediti dell'asta!",
      "Gol di {p} su calcio piazzato! Il portiere è rimasto lì a guardare!",
    ],
    'goal:volley': [
      "Al volo {p}! Gol! Ma come ha fatto?!",
      "{p} la colpisce al volo ed è dentro! Roba da far cadere il bicchiere!",
      "{o} la mette, {p} al volo: GOL! Io mi alzo in piedi!",
    ],
    'goal:solo': [
      "{p} fa tutto da solo e segna! Gli altri possono pure andare a casa!",
      "Ma hai visto {p}? Ne ha saltati tre e l'ha messa dentro!",
      "Da solo {p}! Te l'avevo detto che era un campione!",
    ],
    'goal:counter': [
      "Contropiede di {t} e gol di {p}! Così si gioca, veloci!",
      "{p} chiude il contropiede, gol! {opp} era tutta in avanti come dei polli!",
      "{o} la lancia, {p} la mette! Ripartenza perfetta!",
    ],
    own_goal: [
      "Autogol di {p}! Ma che ha fatto?! {opp} ringrazia!",
      "{p} la mette nella sua porta! Io non ci posso credere, ma è uno dei nostri o dei loro?",
      "Autorete di {p}. E quello al fantacalcio è meno due, ciao!",
    ],
    defensive_error: [
      "Ma che fa {p}?! Ma che fa?!",
      "Errore di {p}. Te l'avevo detto che in difesa ci voleva un altro!",
      "{p} regala palla. Ma svegliati!",
    ],
    injury: [
      "{p} è a terra. Oh, speriamo niente di grave che è il mio titolare.",
      "Problema per {p}. Eh, l'età si fa sentire.",
      "{p} si ferma, si tocca la gamba. Ma no, proprio adesso!",
    ],
    shootout_start: [
      "Rigori tra {home} e {away}! Qui nessuno respira, al bar hanno spento pure la macchina del caffè.",
      "Si va ai rigori! {home} contro {away}, io non guardo, ditemi voi.",
      "Calci di rigore: {home} e {away}. Ecco, adesso vediamo chi ha i nervi saldi!",
    ],
    'shootout_kick:scored': [
      "{p} segna, {o} battuto! Vai!",
      "Dentro {p}! {o} da una parte, palla dall'altra.",
      "{p} la mette, freddo freddo. Bravo!",
    ],
    'shootout_kick:missed': [
      "{p} sbaglia! {o} esulta! Ma noooo!",
      "Rigore sbagliato da {p}. Ma chi l'ha messo in lista?!",
      "{p} la manda fuori. Io lo sapevo, lo sapevo!",
    ],
    'tail:equalizer': [
      "Pareggio! {score}, tutto da rifare!",
      "{score}, siamo pari! Dai che adesso la vinciamo!",
    ],
    'tail:go_ahead': [
      "{t} avanti {score}! Ora non facciamo scherzi!",
      "Vantaggio {t}, {score}! Chiudetevi dietro, adesso!",
    ],
    'tail:late': [
      "Al {min}'! Ma a che ora finisce questa partita?!",
      "Minuto {min}! Chi era andato via prima si mangia le mani!",
    ],
    'tail:brace': [
      "Doppietta di {p}! Asta vinta, ragazzi!",
      "Due gol per {p}! E voi che non lo volevate!",
    ],
    'tail:hattrick': [
      "Tripletta di {p}! Gli pago da bere per un mese!",
      "Tre gol {p}! Il miglior affare della storia dell'asta!",
    ],
    'tail:comeback': [
      "Rimontata! {score}! Ve l'avevo detto di non mollare!",
      "{t} la ribalta, {score}! Questo bar non dimenticherà!",
    ],
  },
};
