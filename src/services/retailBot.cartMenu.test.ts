import { describe, expect, it } from 'vitest';
import { isCheckoutText, isKeepShoppingText } from './retailBot.js';

describe('retail cart post-add replies', () => {
  it('treats 1 and keep-shopping phrases as browse again', () => {
    expect(isKeepShoppingText('1')).toBe(true);
    expect(isKeepShoppingText('Keep shopping')).toBe(true);
    expect(isKeepShoppingText('shop more')).toBe(true);
    expect(isKeepShoppingText('more')).toBe(false);
    expect(isKeepShoppingText('2')).toBe(false);
  });

  it('treats 2 as checkout not keep shopping', () => {
    expect(isCheckoutText('2')).toBe(true);
    expect(isCheckoutText('checkout')).toBe(true);
    expect(isKeepShoppingText('2')).toBe(false);
  });
});
