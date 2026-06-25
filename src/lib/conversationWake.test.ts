import { ConversationStep } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  isConversationWakeMessage,
  shouldResetConversationOnWake,
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

    it('rejects a greeting followed by real content, so it reaches AI assist instead of resetting', () => {
      expect(isConversationWakeMessage('Hi how are you ?')).toBe(false);
      expect(isConversationWakeMessage('hi, what are your prices?')).toBe(false);
      expect(isConversationWakeMessage("hello, I'd like to book")).toBe(false);
    });
  });

  describe('shouldResetConversationOnWake', () => {
    it('allows reset from menu and booking steps', () => {
      expect(shouldResetConversationOnWake(ConversationStep.MENU)).toBe(true);
      expect(shouldResetConversationOnWake(ConversationStep.PICK_SERVICE)).toBe(true);
    });

    it('blocks reset during complaint, handoff, and other query', () => {
      expect(shouldResetConversationOnWake(ConversationStep.COMPLAINT)).toBe(false);
      expect(shouldResetConversationOnWake(ConversationStep.HANDOFF)).toBe(false);
      expect(shouldResetConversationOnWake(ConversationStep.OTHER_QUERY)).toBe(false);
      expect(shouldResetConversationOnWake(ConversationStep.CONFIRM_CANCEL)).toBe(false);
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
