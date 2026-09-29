import { DomainError, ERROR_MESSAGES_IT, type ErrorCode } from '@asta/core';
import { ZodError } from 'zod';

export interface ErrorBody {
  error: ErrorCode | 'INTERNAL' | 'UNAUTHORIZED';
  message: string;
}

export function toErrorBody(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof DomainError) {
    const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : err.code === 'RATE_LIMITED' ? 429 : 400;
    return { status, body: { error: err.code, message: err.message !== err.code ? err.message : ERROR_MESSAGES_IT[err.code] } };
  }
  if (err instanceof ZodError) {
    return { status: 400, body: { error: 'INVALID_INPUT', message: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') } };
  }
  console.error('[server] unexpected error', err);
  return { status: 500, body: { error: 'INTERNAL', message: 'Errore interno' } };
}
