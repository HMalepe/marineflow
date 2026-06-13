import { describe, expect, it } from 'vitest';
import {
  buildMainMenuText,
  buildSubMenuText,
  menuWelcomeLine,
  parseMainMenuChoice,
  salonDisplayName,
} from './hierarchicalMenu.js';

describe('hierarchicalMenu', () => {
  const salon = {
    name: 'MarineFlow Demo',
    tradingName: 'Bontle-Entle',
    welcomeMessage: null as string | null,
    metadata: {},
  };

  it('uses trading name for display', () => {
    expect(salonDisplayName(salon)).toBe('Bontle-Entle');
  });

  it('defaults welcome to trading name not internal name', () => {
    expect(menuWelcomeLine(salon)).toBe('Welcome to Bontle-Entle! Reply with a number:');
  });

  it('respects custom welcome message from dashboard', () => {
    expect(
      menuWelcomeLine({ ...salon, welcomeMessage: 'Hi from our team!' }),
    ).toBe('Hi from our team!');
  });

  it('builds six top-level categories', () => {
    const text = buildMainMenuText(salon);
    expect(text).toContain('1 — Appointments');
    expect(text).toContain('6 — Support');
    expect(text).not.toContain('MarineFlow Demo');
  });

  it('builds sub-menus for each category', () => {
    expect(buildSubMenuText('appointments')).toContain('1 — Book');
    expect(buildSubMenuText('support')).toContain('4 — Speak To Reception');
  });

  it('parses main menu choices', () => {
    expect(parseMainMenuChoice('3')).toBe('rewards');
    expect(parseMainMenuChoice('99')).toBeNull();
  });
});
