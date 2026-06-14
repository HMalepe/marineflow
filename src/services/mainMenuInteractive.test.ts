import { describe, expect, it } from 'vitest';
import type { InteractiveList } from '../lib/integrations/messaging/types.js';
import { codePointLength } from '../lib/integrations/messaging/interactiveList.js';
import { buildCloudInteractivePayload } from '../lib/integrations/messaging/whatsapp-cloud-impl.js';
import {
  buildMainMenuInteractive,
  MAIN_MENU_ROW_IDS,
  salonUsesCloudInteractiveMenu,
  truncateListField,
  validateInteractiveListPayload,
} from './mainMenuInteractive.js';

describe('buildMainMenuInteractive', () => {
  const baseSalon = {
    name: 'MarineFlow Demo',
    tradingName: 'Bontle-Entle',
    welcomeMessage: 'Hi there! How can we help?',
  };

  it('produces a valid list payload with seven top-level options when loyalty is on', () => {
    const interactive = buildMainMenuInteractive(baseSalon);
    expect(interactive.type).toBe('list');
    expect(validateInteractiveListPayload(interactive)).toEqual([]);
    expect(interactive.sections[0]!.rows).toHaveLength(7);
    expect(interactive.sections[0]!.rows[0]!.title).toBe('Book an appointment');
    expect(interactive.button.length).toBeLessThanOrEqual(20);
  });

  it('omits Rewards row when loyalty is disabled', () => {
    const interactive = buildMainMenuInteractive({ ...baseSalon, botLoyaltyEnabled: false });
    expect(interactive.sections[0]!.rows).toHaveLength(6);
    expect(interactive.sections[0]!.rows.some((r) => r.title === 'Rewards')).toBe(false);
  });

  it('uses trading name in footer not internal demo name', () => {
    const interactive = buildMainMenuInteractive(baseSalon);
    expect(interactive.footer).toContain('Bontle-Entle');
    expect(interactive.footer).not.toContain('MarineFlow Demo');
  });

  it('uses row ids matching text menu numbers for handleMenu routing', () => {
    expect(buildMainMenuInteractive(baseSalon).sections[0]!.rows.map((r) => r.id)).toEqual([
      ...MAIN_MENU_ROW_IDS,
    ]);
  });

  it('survives extreme salon names and welcome messages', () => {
    const interactive = buildMainMenuInteractive({
      name: 'Salon 💇‍♀️'.repeat(50),
      tradingName: 'Bontle-Entle',
      welcomeMessage: '🎉 Welcome! '.repeat(300),
    });
    expect(codePointLength(interactive.body)).toBeLessThanOrEqual(1024);
    expect(validateInteractiveListPayload(interactive)).toEqual([]);
    expect(buildCloudInteractivePayload(interactive).type).toBe('interactive');
  });

  it('falls back to trading name when welcomeMessage is blank', () => {
    const interactive = buildMainMenuInteractive({
      name: 'Neat Cuts Internal',
      tradingName: 'Neat Cuts',
      welcomeMessage: '   \n\t  ',
    });
    expect(interactive.body).toContain('Neat Cuts');
    expect(interactive.body).not.toContain('Internal');
  });
});

describe('salonUsesCloudInteractiveMenu', () => {
  it('gates interactive menus on configured Cloud API phone id', () => {
    expect(salonUsesCloudInteractiveMenu('999')).toBe(true);
    expect(salonUsesCloudInteractiveMenu('')).toBe(false);
    expect(salonUsesCloudInteractiveMenu('  ')).toBe(false);
  });
});

describe('truncateListField', () => {
  it('preserves emoji when truncating', () => {
    const truncated = truncateListField('⭐'.repeat(20), 5);
    expect(truncated).toBe('⭐'.repeat(5));
  });
});

describe('validateInteractiveListPayload', () => {
  it('rejects invalid payloads', () => {
    const errors = validateInteractiveListPayload({
      type: 'list',
      body: '',
      button: 'This button label is way too long',
      sections: [{ rows: [] }],
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('end-to-end menu payload contract', () => {
  it('Graph API payload round-trips validation', () => {
    const interactive: InteractiveList = buildMainMenuInteractive({
      name: 'Contract Test',
      tradingName: 'Contract Test',
    });
    expect(validateInteractiveListPayload(interactive)).toEqual([]);
    const cloud = buildCloudInteractivePayload(interactive);
    expect(cloud.type).toBe('interactive');
    const rows = (cloud.interactive as { action: { sections: { rows: { id: string }[] }[] } })
      .action.sections[0]!.rows;
    expect(rows.every((r) => r.id.length <= 200)).toBe(true);
    expect(rows.every((r) => Object.keys(r).length >= 2)).toBe(true);
  });
});
