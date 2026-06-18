import { describe, expect, it } from 'vitest';
import { checkBotRateLimits } from '../lib/botRateLimit.js';
import { BOT_DEBUG } from '../lib/botDebug.js';

describe('bot stability guards', () => {
  describe('checkBotRateLimits', () => {
    it('allows traffic under per-user and per-salon caps', () => {
      expect(checkBotRateLimits(30, 200)).toBe(true);
      expect(checkBotRateLimits(1, 1)).toBe(true);
    });

    it('rejects when either cap is exceeded', () => {
      expect(checkBotRateLimits(31, 1)).toBe(false);
      expect(checkBotRateLimits(1, 201)).toBe(false);
    });
  });

  describe('BOT_DEBUG', () => {
    it('is disabled in test runs', () => {
      expect(BOT_DEBUG).toBe(false);
    });
  });
});
