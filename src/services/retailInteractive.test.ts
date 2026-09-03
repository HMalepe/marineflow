import { describe, expect, it } from 'vitest';
import { validateInteractiveListPayload } from '../lib/integrations/messaging/interactiveList.js';
import {
  buildBusinessPickerInteractive,
  buildCategoryListInteractive,
  RETAIL_LIST_PAGE_SIZE,
} from './retailInteractive.js';

describe('retail scroll-to-pick menus', () => {
  it('builds a two-business picker as buttons', () => {
    const msg = buildBusinessPickerInteractive([
      { salonId: 'a', label: 'BontleEntle' },
      { salonId: 'b', label: 'Dr Marley', industryTemplate: 'dispensary' },
    ]);
    expect(msg?.type).toBe('button');
    if (msg?.type === 'button') {
      expect(msg.buttons.map((b) => b.id)).toEqual(['1', '2']);
    }
  });

  it('keeps category lists within WhatsApp’s 10-row cap', () => {
    const categories = Array.from({ length: 17 }, (_, i) => ({ name: `Cat ${i + 1}` }));
    const msg = buildCategoryListInteractive({
      shopName: 'Dr Marley',
      categories,
      page: 0,
      hasCart: true,
    });
    expect(msg?.type).toBe('list');
    if (msg?.type === 'list') {
      const rows = msg.sections[0]!.rows;
      expect(rows.length).toBeLessThanOrEqual(10);
      expect(rows.length).toBe(RETAIL_LIST_PAGE_SIZE + 2); // more + cart
      expect(validateInteractiveListPayload(msg)).toEqual([]);
    }
  });
});
