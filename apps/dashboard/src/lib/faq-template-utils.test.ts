import { describe, expect, it } from 'vitest';
import {
  countUsedFaqTemplates,
  faqMatchesTemplate,
  filterAvailableFaqTemplates,
  normalizeFaqQuestion,
} from './faq-template-utils.js';
import type { FaqTemplate } from '../app/(dashboard)/faqs/faq-templates.js';

const hoursTemplate: FaqTemplate = {
  category: 'General',
  businessTypes: ['All'],
  question: 'What are your opening hours?',
  answer: 'We are open Mon–Fri.',
};

const parkingTemplate: FaqTemplate = {
  category: 'General',
  businessTypes: ['All'],
  question: 'Is there parking available?',
  answer: 'Yes, free parking out front.',
};

describe('FAQ template availability', () => {
  it('1 — hides a template when the salon already has the exact question', () => {
    expect(filterAvailableFaqTemplates([hoursTemplate], ['What are your opening hours?'])).toHaveLength(0);
  });

  it('2 — hides a template when the owner shortened the question after using it', () => {
    expect(faqMatchesTemplate('What are your hours?', 'What are your opening hours?')).toBe(true);
    expect(filterAvailableFaqTemplates([hoursTemplate], ['What are your hours?'])).toHaveLength(0);
  });

  it('3 — keeps unrelated templates visible so owners discover new ones', () => {
    expect(filterAvailableFaqTemplates([hoursTemplate, parkingTemplate], ['What are your hours?'])).toEqual([
      parkingTemplate,
    ]);
  });

  it('4 — treats punctuation and casing as the same question', () => {
    expect(normalizeFaqQuestion('What are your opening hours?')).toBe(
      normalizeFaqQuestion('what are your opening hours'),
    );
    expect(faqMatchesTemplate('WHAT ARE YOUR OPENING HOURS?!', 'What are your opening hours?')).toBe(true);
  });

  it('5 — still hides templates linked to pending or rejected FAQs', () => {
    expect(filterAvailableFaqTemplates([parkingTemplate], ['Is there parking available?'])).toHaveLength(0);
    expect(countUsedFaqTemplates([hoursTemplate, parkingTemplate], ['Is there parking available?'])).toBe(1);
  });

  it('6 — does not hide templates when questions are on different topics', () => {
    expect(faqMatchesTemplate('Do you take walk-ins?', 'What are your opening hours?')).toBe(false);
    expect(
      filterAvailableFaqTemplates([hoursTemplate, parkingTemplate], ['Do you take walk-ins?']),
    ).toHaveLength(2);
  });
});
