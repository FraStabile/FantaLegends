/** Machine-readable reason codes: the client maps them to localized messages. */
export type ErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INVALID_CONFIG'
  | 'INVALID_STATE'
  | 'LEAGUE_FULL'
  | 'ALREADY_MEMBER'
  | 'NOT_ALL_READY'
  | 'NOT_ENOUGH_PARTICIPANTS'
  | 'POOL_TOO_SMALL'
  | 'NO_OPEN_LOT'
  | 'STALE_LOT'
  | 'LOT_CLOSED'
  | 'BID_TOO_LOW'
  | 'BID_NOT_INTEGER'
  | 'ALREADY_LEADING'
  | 'INSUFFICIENT_CREDITS'
  | 'BUDGET_RESERVE'
  | 'ROLE_FULL'
  | 'ROSTER_FULL'
  | 'ALREADY_SOLD'
  | 'AUCTION_PAUSED'
  | 'INVALID_INPUT'
  | 'RATE_LIMITED'
  | 'AI_UNAVAILABLE';

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'DomainError';
  }
}

export const ERROR_MESSAGES_IT: Record<ErrorCode, string> = {
  NOT_FOUND: 'Elemento non trovato',
  FORBIDDEN: 'Operazione non consentita',
  INVALID_CONFIG: 'Configurazione non valida',
  INVALID_STATE: 'Operazione non disponibile in questa fase',
  LEAGUE_FULL: 'La lega è al completo',
  ALREADY_MEMBER: 'Sei già in questa lega',
  NOT_ALL_READY: 'Non tutti i partecipanti sono pronti',
  NOT_ENOUGH_PARTICIPANTS: 'Servono almeno 2 partecipanti',
  POOL_TOO_SMALL: 'Il pool non ha abbastanza giocatori per completare le rose',
  NO_OPEN_LOT: 'Nessun lotto aperto',
  STALE_LOT: 'Il lotto è cambiato: offerta annullata',
  LOT_CLOSED: 'Tempo scaduto!',
  BID_TOO_LOW: 'Offerta troppo bassa: qualcuno ha già rilanciato',
  BID_NOT_INTEGER: 'L\'offerta deve essere un numero intero',
  ALREADY_LEADING: 'Sei già il miglior offerente',
  INSUFFICIENT_CREDITS: 'Crediti insufficienti',
  BUDGET_RESERVE: 'Devi tenere crediti per completare la rosa',
  ROLE_FULL: 'Hai già completato questo ruolo',
  ROSTER_FULL: 'La tua rosa è completa',
  ALREADY_SOLD: 'Giocatore già venduto',
  AUCTION_PAUSED: 'Asta in pausa',
  INVALID_INPUT: 'Dati non validi',
  RATE_LIMITED: 'Troppe richieste, rallenta!',
  AI_UNAVAILABLE: 'Generatore AI non disponibile',
};
