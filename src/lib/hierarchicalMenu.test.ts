import { describe, expect, it } from 'vitest';
import {
  buildMainMenuText,
  buildSubMenuText,
  menuWelcomeLine,
  parseMainMenuSelection,
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

  it('leads with Book an appointment on the main menu', () => {
    const text = buildMainMenuText(salon);
    expect(text).toContain('1 — Book an appointment');
    expect(text).toContain('2 — My appointments');
    expect(text).not.toContain('1 — Appointments');
    expect(text).not.toContain('MarineFlow Demo');
  });

  it('builds my appointments sub-menu without duplicate book option', () => {
    expect(buildSubMenuText('my_appointments')).toContain('1 — View');
    expect(buildSubMenuText('my_appointments')).not.toContain('Book');
  });

  it('parses main menu selections', () => {
    expect(parseMainMenuSelection('1')).toEqual({ kind: 'direct', action: 'book' });
    expect(parseMainMenuSelection('3')).toEqual({ kind: 'category', id: 'services' });
    expect(parseMainMenuSelection('99')).toBeNull();
  });
});
