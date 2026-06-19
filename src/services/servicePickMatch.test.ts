import { describe, expect, it } from 'vitest';
import { matchServiceInText } from './botAssistant.js';

const catalog = [
  { id: 'mid', name: 'Mid Fade' },
  { id: 'high', name: 'High Fade' },
  { id: 'low', name: 'Low Fade' },
];

describe('matchServiceInText', () => {
  it('prefers high fade over mid fade in free text', () => {
    expect(matchServiceInText(catalog, 'book me a high fade tomorrow')).toBe('high');
  });

  it('matches exact menu tap title', () => {
    expect(matchServiceInText(catalog, 'High Fade')).toBe('high');
  });

  it('returns null for ambiguous fade-only text', () => {
    expect(matchServiceInText(catalog, 'fade')).toBeNull();
  });

  it('does not default to first catalog item', () => {
    expect(matchServiceInText(catalog, 'something random')).toBeNull();
  });

  it('prefers customer words over wrong AI guess via resolve order', () => {
    expect(matchServiceInText(catalog, 'high fade please')).toBe('high');
  });
});
