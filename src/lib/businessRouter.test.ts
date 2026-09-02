import { describe, expect, it } from 'vitest';
import {
  buildBusinessPickerText,
  isSwitchBusinessCommand,
  parseBusinessPickerChoice,
} from './businessRouter.js';

describe('businessRouter picker', () => {
  const options = [
    { salonId: 'a', label: 'Bontle - Entle', subtitle: 'Salon' },
    { salonId: 'b', label: 'Bart Marley - Dispensary', subtitle: 'Retail' },
  ];

  it('builds numbered picker copy', () => {
    const text = buildBusinessPickerText(options);
    expect(text).toContain('1 — *Bontle - Entle*');
    expect(text).toContain('2 — *Bart Marley - Dispensary*');
    expect(text).toContain('SWITCH');
  });

  it('parses numeric and name choices', () => {
    expect(parseBusinessPickerChoice('1', options)?.salonId).toBe('a');
    expect(parseBusinessPickerChoice('2', options)?.salonId).toBe('b');
    expect(parseBusinessPickerChoice('bart', options)?.salonId).toBe('b');
  });

  it('detects switch command', () => {
    expect(isSwitchBusinessCommand('switch')).toBe(true);
    expect(isSwitchBusinessCommand('Change Business')).toBe(true);
    expect(isSwitchBusinessCommand('hi')).toBe(false);
  });
});
