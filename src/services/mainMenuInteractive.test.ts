import { describe, expect, it } from 'vitest';
import type { InteractiveList } from '../lib/integrations/messaging/types.js';
import { codePointLength } from '../lib/integrations/messaging/interactiveList.js';
import { buildCloudInteractivePayload } from '../lib/integrations/messaging/whatsapp-cloud-impl.js';
import {
  buildMainMenuInteractive,
  MAIN_MENU_ROW_IDS_WITH_LOYALTY,
  MAIN_MENU_ROW_IDS_WITHOUT_LOYALTY,
  salonUsesCloudInteractiveMenu,
  truncateListField,
  validateInteractiveListPayload,
} from './mainMenuInteractive.js';

describe('buildMainMenuInteractive', () => {
  const baseSalon = {
    name: 'Glow Salon',
    welcomeMessage: 'Hi there! How can we help?',
    botLoyaltyEnabled: true,
  };

  it('produces a valid list payload with loyalty row', () => {
    const interactive = buildMainMenuInteractive(baseSalon);
    expect(interactive.type).toBe('list');
    expect(validateInteractiveListPayload(interactive)).toEqual([]);
    expect(interactive.sections[0]!.rows.map((r) => r.id)).toContain('3');
    expect(interactive.button.length).toBeLessThanOrEqual(20);
  });

  it('omits loyalty row when botLoyaltyEnabled is false', () => {
    const interactive = buildMainMenuInteractive({ ...baseSalon, botLoyaltyEnabled: false });
    expect(interactive.sections[0]!.rows.map((r) => r.id)).not.toContain('3');
    expect(validateInteractiveListPayload(interactive)).toEqual([]);
  });

  it('uses row ids matching text menu numbers for handleMenu routing', () => {
    expect(
      buildMainMenuInteractive(baseSalon).sections[0]!.rows.map((r) => r.id),
    ).toEqual([...MAIN_MENU_ROW_IDS_WITH_LOYALTY]);
    expect(
      buildMainMenuInteractive({ ...baseSalon, botLoyaltyEnabled: false }).sections[0]!.rows.map(
        (r) => r.id,
      ),
    ).toEqual([...MAIN_MENU_ROW_IDS_WITHOUT_LOYALTY]);
  });

  it('survives extreme salon names and welcome messages', () => {
    const interactive = buildMainMenuInteractive({
      name: 'Salon 💇‍♀️'.repeat(50),
      welcomeMessage: '🎉 Welcome! '.repeat(300),
      botLoyaltyEnabled: true,
    });
    expect(codePointLength(interactive.body)).toBeLessThanOrEqual(1024);
    expect(validateInteractiveListPayload(interactive)).toEqual([]);
    expect(buildCloudInteractivePayload(interactive).type).toBe('interactive');
  });

  it('falls back to default welcome when welcomeMessage is blank whitespace', () => {
    const interactive = buildMainMenuInteractive({
      name: 'Neat Cuts',
      welcomeMessage: '   \n\t  ',
      botLoyaltyEnabled: false,
    });
    expect(interactive.body).toContain('Neat Cuts');
    expect(interactive.body).toContain('Tap below');
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
  it('Graph API payload round-trips validation for loyalty on/off', () => {
    for (const botLoyaltyEnabled of [true, false] as const) {
      const interactive: InteractiveList = buildMainMenuInteractive({
        name: 'Contract Test',
        botLoyaltyEnabled,
      });
      expect(validateInteractiveListPayload(interactive)).toEqual([]);
      const cloud = buildCloudInteractivePayload(interactive);
      expect(cloud.type).toBe('interactive');
      const rows = (cloud.interactive as { action: { sections: { rows: { id: string }[] }[] } })
        .action.sections[0]!.rows;
      expect(rows.every((r) => r.id.length <= 200)).toBe(true);
      expect(rows.every((r) => Object.keys(r).length >= 2)).toBe(true);
    }
  });
});
