import { describe, expect, it } from 'vitest';
import {
  buildBusinessPickerText,
  isSwitchBusinessCommand,
  parseBusinessPickerChoice,
} from './businessRouter.js';

describe('businessRouter picker', () => {
  const options = [
    { salonId: 'a', label: 'Bontle - Entle', subtitle: 'Salon', industryTemplate: 'salon' },
    { salonId: 'b', label: 'Dr Marley - Dispensary', subtitle: 'Retail', industryTemplate: 'dispensary' },
  ];

  it('builds numbered picker copy', () => {
    const text = buildBusinessPickerText(options);
    expect(text).toBe(
      [
        '*Welcome — which business can we help you with?*',
        '',
        '1  *BontleEntle*',
        '2  *Dr Marley*',
        '',
        'Reply with a number to continue.',
        'Reply *SWITCH* anytime to change businesses',
      ].join('\n'),
    );
  });

  it('parses numeric and name choices', () => {
    expect(parseBusinessPickerChoice('1', options)?.salonId).toBe('a');
    expect(parseBusinessPickerChoice('2', options)?.salonId).toBe('b');
    expect(parseBusinessPickerChoice('Dr Marley', options)?.salonId).toBe('b');
    expect(parseBusinessPickerChoice('bontleentle', options)?.salonId).toBe('a');
  });

  it('detects switch command', () => {
    expect(isSwitchBusinessCommand('switch')).toBe(true);
    expect(isSwitchBusinessCommand('Change Business')).toBe(true);
    expect(isSwitchBusinessCommand('hi')).toBe(false);
  });
});
