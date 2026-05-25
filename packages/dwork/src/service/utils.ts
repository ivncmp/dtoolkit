import { randomBytes } from 'node:crypto';

export function genId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString('base64url')}`;
}
