import { describe, expect, it } from 'vitest';
import {
  buildMainMenuText,
  buildSubMenuText,
  isMenuNavigationInput,
  isValidSubMenuChoice,
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
    expect(text).toContain('2 — My Bookings');
    expect(text).not.toContain('1 — Appointments');
    expect(text).not.toContain('MarineFlow Demo');
  });

  it('builds My Bookings sub-menu with Book as first option', () => {
    expect(buildSubMenuText('my_appointments')).toContain('1 — Book');
    expect(buildSubMenuText('my_appointments')).toContain('2 — View');
  });

  it('parses main menu selections', () => {
    expect(parseMainMenuSelection('1')).toEqual({ kind: 'direct', action: 'book' });
    expect(parseMainMenuSelection('3')).toEqual({ kind: 'category', id: 'services' });
    expect(parseMainMenuSelection('7')).toEqual({ kind: 'category', id: 'support' });
    expect(parseMainMenuSelection('99')).toBeNull();
  });

  it('validates sub-menu choices per category', () => {
    expect(isValidSubMenuChoice('services', 5)).toBe(true);
    expect(isValidSubMenuChoice('services', 6)).toBe(false);
    expect(isValidSubMenuChoice('my_appointments', 3)).toBe(true);
  });

  it('detects menu navigation input', () => {
    expect(isMenuNavigationInput(undefined, '1')).toBe(true);
    expect(isMenuNavigationInput(undefined, '7')).toBe(true);
    expect(isMenuNavigationInput(undefined, 'hello')).toBe(false);
    expect(isMenuNavigationInput('services', '1')).toBe(true);
    expect(isMenuNavigationInput('services', '6')).toBe(true);
    expect(isMenuNavigationInput('services', '7')).toBe(true);
    expect(isMenuNavigationInput('services', '99')).toBe(false);
    expect(isMenuNavigationInput('services', 'REFERRAL')).toBe(true);
  });
});
