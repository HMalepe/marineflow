import { describe, expect, it } from 'vitest';
import {
  isConversationWakeMessage,
  staffHandoffExpired,
} from './conversationWake.js';

describe('conversationWake', () => {
  describe('isConversationWakeMessage', () => {
    it('matches common greetings', () => {
      expect(isConversationWakeMessage('hi')).toBe(true);
      expect(isConversationWakeMessage('HI')).toBe(true);
      expect(isConversationWakeMessage('hello')).toBe(true);
      expect(isConversationWakeMessage('hey there')).toBe(true);
      expect(isConversationWakeMessage('menu')).toBe(true);
    });

    it('rejects booking choices and long messages', () => {
      expect(isConversationWakeMessage('1')).toBe(false);
      expect(isConversationWakeMessage('book a haircut tomorrow')).toBe(false);
      expect(isConversationWakeMessage('')).toBe(false);
    });
  });

  describe('staffHandoffExpired', () => {
    it('expires after 4 hours', () => {
      const now = Date.parse('2026-06-12T15:00:00Z');
      const last = new Date('2026-06-12T10:00:00Z');
      expect(staffHandoffExpired(last, now)).toBe(true);
    });

    it('is active within 4 hours', () => {
      const now = Date.parse('2026-06-12T15:00:00Z');
      const last = new Date('2026-06-12T14:00:00Z');
      expect(staffHandoffExpired(last, now)).toBe(false);
    });
  });
});
