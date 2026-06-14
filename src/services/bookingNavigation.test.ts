import { describe, expect, it } from 'vitest';
import {
  isBackCommand,
  isBackToMainMenuCommand,
  isMainMenuCommand,
} from '../lib/botNavigation.js';

describe('booking back navigation commands', () => {
  it('recognises BACK and UNDO (case insensitive)', () => {
    expect(isBackCommand('BACK')).toBe(true);
    expect(isBackCommand('back')).toBe(true);
    expect(isBackCommand(' undo ')).toBe(true);
    expect(isBackCommand('background')).toBe(false);
  });

  it('recognises MENU and main menu', () => {
    expect(isMainMenuCommand('MENU')).toBe(true);
    expect(isMainMenuCommand('menu')).toBe(true);
    expect(isMainMenuCommand('main menu')).toBe(true);
    expect(isMainMenuCommand('menu please')).toBe(false);
  });

  it('isBackToMainMenuCommand covers back and menu', () => {
    expect(isBackToMainMenuCommand('back')).toBe(true);
    expect(isBackToMainMenuCommand('MENU')).toBe(true);
    expect(isBackToMainMenuCommand('hello')).toBe(false);
  });
});
