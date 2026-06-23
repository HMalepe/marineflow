import { describe, expect, it } from 'vitest';
import { matchStaffInText, extractPartySize } from './botAssistant.js';

const staff = [
  { id: 'peter', name: 'Peter' },
  { id: 'mmaki', name: 'Mmaki' },
  { id: 'mmakeup', name: 'Mmaki Mokoena' },
];

describe('matchStaffInText', () => {
  it('matches a stylist named in a compound free-text message', () => {
    expect(matchStaffInText(staff, '15th July 10am for 2 people .. stylist Mmaki')).toBe('mmaki');
  });

  it('matches exact menu tap name', () => {
    expect(matchStaffInText(staff, 'Peter')).toBe('peter');
  });

  it('returns null when no name is present', () => {
    expect(matchStaffInText(staff, 'tomorrow at 3pm')).toBeNull();
  });

  it('does not default to the first staff member on ambiguous text', () => {
    expect(matchStaffInText(staff, 'someone please')).toBeNull();
  });
});

describe('extractPartySize', () => {
  it('extracts a party size from "for N people"', () => {
    expect(extractPartySize('15th July 10am for 2 people .. stylist Mmaki')).toBe(2);
  });

  it('extracts "table of N"', () => {
    expect(extractPartySize('table of 4 please')).toBe(4);
  });

  it('ignores bare digits that are not keyword-anchored', () => {
    expect(extractPartySize('15th July 10am')).toBeNull();
  });

  it('rejects out-of-range sizes', () => {
    expect(extractPartySize('1 person')).toBeNull();
    expect(extractPartySize('25 people')).toBeNull();
  });
});
