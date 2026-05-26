import { randomBytes } from 'node:crypto';

export function genId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString('base64url')}`;
}

const TASK_ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function genTaskId(): string {
  const bytes = randomBytes(8);
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += TASK_ID_ALPHABET[bytes[i] % TASK_ID_ALPHABET.length];
  }
  return id;
}
