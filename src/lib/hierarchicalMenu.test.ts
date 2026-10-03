import { describe, expect, it } from 'vitest';
import {
  buildMainMenuText,
  buildSubMenuText,
  isMenuNavigationInput,
  isValidSubMenuChoice,
  menuWelcomeLine,
  parseFreeTextSupportIntent,
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

  it('builds My Bookings sub-menu without duplicate Book option', () => {
    const text = buildSubMenuText('my_appointments');
    expect(text).toContain('1 — View');
    expect(text).toContain('2 — Reschedule');
    expect(text).toContain('3 — Cancel');
    expect(text).not.toMatch(/^\d — Book$/m);
  });

  it('builds Rewards sub-menu without misleading Coupons entry', () => {
    const text = buildSubMenuText('rewards');
    expect(text).toContain('1 — My Points');
    expect(text).toContain('3 — Referrals');
    expect(text).not.toContain('Coupons');
  });

  it('hides Rewards from main menu when loyalty is disabled', () => {
    const text = buildMainMenuText({ ...salon, botLoyaltyEnabled: false });
    expect(text).toContain('1 — Book an appointment');
    expect(text).toContain('4 — Promotions');
    expect(text).not.toMatch(/^\d — Rewards$/m);
    expect(parseMainMenuSelection('4', { botLoyaltyEnabled: false })).toEqual({
      kind: 'category',
      id: 'promotions',
    });
    expect(parseMainMenuSelection('7', { botLoyaltyEnabled: false })).toBeNull();
  });

  it('parses main menu selections', () => {
    expect(parseMainMenuSelection('1')).toEqual({ kind: 'direct', action: 'book' });
    expect(parseMainMenuSelection('3')).toEqual({ kind: 'category', id: 'services' });
    expect(parseMainMenuSelection('7')).toEqual({ kind: 'category', id: 'support' });
    expect(parseMainMenuSelection('99')).toBeNull();
  });

  it('validates sub-menu choices per category', () => {
    expect(isValidSubMenuChoice('services', 5)).toBe(false);
    expect(isValidSubMenuChoice('my_appointments', 3)).toBe(true);
    expect(isValidSubMenuChoice('my_appointments', 4)).toBe(false);
    expect(isValidSubMenuChoice('rewards', 3)).toBe(true);
    expect(isValidSubMenuChoice('rewards', 4)).toBe(false);
  });

  it('detects menu navigation input', () => {
    expect(isMenuNavigationInput(undefined, '1')).toBe(true);
    expect(isMenuNavigationInput(undefined, '7')).toBe(true);
    expect(isMenuNavigationInput(undefined, 'hello')).toBe(false);
    expect(isMenuNavigationInput(undefined, 'menu')).toBe(true);
    expect(isMenuNavigationInput('services', '1')).toBe(false);
    expect(isMenuNavigationInput('services', '6')).toBe(false);
    expect(isMenuNavigationInput('my_appointments', '1')).toBe(true);
    expect(isMenuNavigationInput('services', 'REFERRAL')).toBe(true);
  });

  it('drops booking entirely for the software vertical — no appointments, no orders', () => {
    const softwareSalon = { ...salon, industryTemplate: 'software' };
    const text = buildMainMenuText(softwareSalon);
    expect(text).not.toContain('Book a demo');
    expect(text).not.toMatch(/^\d — Book/m);
    expect(text).not.toContain('My Bookings');
    expect(text).toContain('Services');
    expect(text).toContain('Support');
    expect(text).not.toContain("I'll book it for you");

    // Book was item 1 and My Bookings item 2 on the normal menu — both gone, so
    // Services shifts up to take the first slot.
    expect(parseMainMenuSelection('1', softwareSalon)).toEqual({ kind: 'category', id: 'services' });
    expect(parseMainMenuSelection('99', softwareSalon)).toBeNull();
  });

  it('keeps the normal booking menu for every other vertical, including unknown ones', () => {
    expect(buildMainMenuText({ ...salon, industryTemplate: 'barbershop' })).toContain('Book an appointment');
    expect(buildMainMenuText({ ...salon, industryTemplate: undefined })).toContain('Book an appointment');
  });

  it('routes natural-language support phrases to review or issue flows', () => {
    expect(parseFreeTextSupportIntent('i want to complain')).toBe('leave_review');
    expect(parseFreeTextSupportIntent('I want to leave a review')).toBe('leave_review');
    expect(parseFreeTextSupportIntent('rate my visit')).toBe('leave_review');
    expect(parseFreeTextSupportIntent('report an issue with my booking')).toBe('report_issue');
    expect(parseFreeTextSupportIntent('support')).toBe('show_support_menu');
    expect(parseFreeTextSupportIntent('1')).toBeNull();
    expect(parseFreeTextSupportIntent('hello')).toBeNull();
  });
});
