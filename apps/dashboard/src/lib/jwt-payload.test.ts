import { describe, expect, it } from 'vitest';
import { isJwtExpired, readJwtPayload } from './jwt-payload';

function b64url(obj: Record<string, unknown>): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json).toString('base64url');
}

describe('jwt-payload', () => {
  it('readJwtPayload parses payload', () => {
    const token = `h.${b64url({ sub: 'x', exp: 9999999999 })}.s`;
    expect(readJwtPayload(token)?.sub).toBe('x');
  });

  it('isJwtExpired is true for past exp', () => {
    const token = `h.${b64url({ exp: 1 })}.s`;
    expect(isJwtExpired(token)).toBe(true);
  });

  it('isJwtExpired is false for future exp', () => {
    const token = `h.${b64url({ exp: Math.floor(Date.now() / 1000) + 3600 })}.s`;
    expect(isJwtExpired(token)).toBe(false);
  });
});
