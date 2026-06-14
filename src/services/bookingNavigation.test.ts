import { describe, expect, it } from 'vitest';

/** Mirrors bot.ts isBackCommand / isMenuCommand */
function isBackCommand(text: string): boolean {
  return /^(back|undo)\b/i.test(text.trim());
}

function isMenuCommand(text: string): boolean {
  return /^menu$/i.test(text.trim());
}

describe('booking back navigation commands', () => {
  it('recognises BACK and UNDO', () => {
    expect(isBackCommand('BACK')).toBe(true);
    expect(isBackCommand('back')).toBe(true);
    expect(isBackCommand(' undo ')).toBe(true);
    expect(isBackCommand('background')).toBe(false);
  });

  it('recognises MENU only as whole word', () => {
    expect(isMenuCommand('MENU')).toBe(true);
    expect(isMenuCommand('menu please')).toBe(false);
    expect(isMenuCommand('BACK')).toBe(false);
  });
});
