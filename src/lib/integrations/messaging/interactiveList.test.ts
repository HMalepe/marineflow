import { describe, expect, it } from 'vitest';
import {
  assertValidInteractiveList,
  normalizeInteractiveList,
  salonUsesCloudInteractiveMenu,
  truncateListField,
  validateInteractiveListPayload,
} from './interactiveList.js';
import type { InteractiveList } from './types.js';

const validList = (): InteractiveList => ({
  type: 'list',
  body: 'Pick an option',
  button: 'Open menu',
  sections: [
    {
      title: 'Options',
      rows: [{ id: '1', title: 'Book', description: 'Schedule visit' }],
    },
  ],
});

describe('truncateListField', () => {
  it('leaves short strings unchanged', () => {
    expect(truncateListField('Book', 24)).toBe('Book');
  });

  it('truncates by Unicode code point without splitting emoji', () => {
    const emoji = '👋'.repeat(15);
    const out = truncateListField(emoji, 10);
    expect([...out].length).toBe(10);
    expect(out).toBe('👋'.repeat(10));
  });

  it('truncates long ASCII', () => {
    expect(truncateListField('A'.repeat(30), 24)).toHaveLength(24);
  });
});

describe('salonUsesCloudInteractiveMenu', () => {
  it('returns true for non-empty phone id', () => {
    expect(salonUsesCloudInteractiveMenu('123456789')).toBe(true);
  });

  it('returns false for null, undefined, blank, or whitespace', () => {
    expect(salonUsesCloudInteractiveMenu(null)).toBe(false);
    expect(salonUsesCloudInteractiveMenu(undefined)).toBe(false);
    expect(salonUsesCloudInteractiveMenu('')).toBe(false);
    expect(salonUsesCloudInteractiveMenu('   ')).toBe(false);
  });
});

describe('normalizeInteractiveList', () => {
  it('trims and caps all fields', () => {
    const normalized = normalizeInteractiveList({
      type: 'list',
      header: `  ${'H'.repeat(80)}  `,
      body: `  ${'B'.repeat(2000)}  `,
      footer: `  ${'F'.repeat(80)}  `,
      button: `  ${'Choose'.repeat(10)}  `,
      sections: [
        {
          title: `  ${'S'.repeat(40)}  `,
          rows: [
            {
              id: `  ${'id'.repeat(100)}  `,
              title: `  ${'T'.repeat(40)}  `,
              description: `  ${'D'.repeat(100)}  `,
            },
          ],
        },
      ],
    });
    expect(validateInteractiveListPayload(normalized)).toEqual([]);
    expect(normalized.header!.length).toBeLessThanOrEqual(60);
    expect(normalized.body.length).toBeLessThanOrEqual(1024);
    expect(normalized.button.length).toBeLessThanOrEqual(20);
    expect(normalized.sections[0]!.rows[0]!.id.length).toBeLessThanOrEqual(200);
  });
});

describe('validateInteractiveListPayload', () => {
  it('accepts a minimal valid list', () => {
    expect(validateInteractiveListPayload(validList())).toEqual([]);
  });

  it('rejects missing body, button, and rows', () => {
    const errors = validateInteractiveListPayload({
      type: 'list',
      body: '   ',
      button: 'This button label is way too long for WhatsApp',
      sections: [{ rows: [] }],
    });
    expect(errors.some((e) => e.includes('body'))).toBe(true);
    expect(errors.some((e) => e.includes('button'))).toBe(true);
    expect(errors.some((e) => e.includes('row'))).toBe(true);
  });

  it('rejects duplicate row ids', () => {
    const errors = validateInteractiveListPayload({
      type: 'list',
      body: 'Body',
      button: 'Menu',
      sections: [{ rows: [{ id: '1', title: 'A' }, { id: '1', title: 'B' }] }],
    });
    expect(errors.some((e) => e.includes('duplicate row.id'))).toBe(true);
  });

  it('rejects more than 10 rows total', () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({
      id: String(i),
      title: `Opt ${i}`,
    }));
    const errors = validateInteractiveListPayload({
      type: 'list',
      body: 'Body',
      button: 'Menu',
      sections: [{ rows }],
    });
    expect(errors.some((e) => e.includes('max 10 rows'))).toBe(true);
  });

  it('rejects more than 10 sections', () => {
    const sections = Array.from({ length: 11 }, (_, i) => ({
      title: `Sec ${i}`,
      rows: [{ id: String(i), title: 'Row' }],
    }));
    const errors = validateInteractiveListPayload({
      type: 'list',
      body: 'Body',
      button: 'Menu',
      sections,
    });
    expect(errors.some((e) => e.includes('max 10 sections'))).toBe(true);
  });

  it('rejects row id over 200 characters', () => {
    const errors = validateInteractiveListPayload({
      type: 'list',
      body: 'Body',
      button: 'Menu',
      sections: [{ rows: [{ id: 'x'.repeat(201), title: 'Row' }] }],
    });
    expect(errors.some((e) => e.includes('row.id exceeds 200'))).toBe(true);
  });
});

describe('assertValidInteractiveList', () => {
  it('throws with joined errors for invalid payload', () => {
    expect(() => assertValidInteractiveList({ ...validList(), body: '' })).toThrow(
      /Invalid interactive list/,
    );
  });
});
