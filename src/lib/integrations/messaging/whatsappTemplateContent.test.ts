import { describe, expect, it } from 'vitest';
import { validateWhatsappCardTemplate } from './whatsappTemplateContent.js';

describe('validateWhatsappCardTemplate', () => {
  it('requires body text', () => {
    const errors = validateWhatsappCardTemplate({ body: '', headerText: 'Sale' });
    expect(errors).toContain('Body text is required.');
  });

  it('rejects body text over 1024 characters', () => {
    const errors = validateWhatsappCardTemplate({ body: 'a'.repeat(1025), headerText: 'Sale' });
    expect(errors).toContain('Body text must be 1024 characters or fewer.');
  });

  it('rejects footer over 60 characters', () => {
    const errors = validateWhatsappCardTemplate({ body: 'Hi', headerText: 'Sale', footer: 'a'.repeat(61) });
    expect(errors).toContain('Footer must be 60 characters or fewer.');
  });

  it('requires at least one of header image, header text, or a button', () => {
    const errors = validateWhatsappCardTemplate({ body: 'Hi there' });
    expect(errors).toContain('Add a header image, header text, or at least one button.');
  });

  it('accepts a card with only a header image', () => {
    const errors = validateWhatsappCardTemplate({ body: 'Hi there', mediaUrl: 'https://cdn.example.com/a.jpg' });
    expect(errors).toEqual([]);
  });

  it('rejects non-HTTPS media URLs', () => {
    const errors = validateWhatsappCardTemplate({ body: 'Hi there', mediaUrl: 'http://cdn.example.com/a.jpg' });
    expect(errors).toContain('Header image URL must use HTTPS.');
  });

  it('rejects more than 3 buttons', () => {
    const errors = validateWhatsappCardTemplate({
      body: 'Hi there',
      actions: [
        { type: 'URL', title: 'A', url: 'https://example.com' },
        { type: 'URL', title: 'B', url: 'https://example.com' },
        { type: 'URL', title: 'C', url: 'https://example.com' },
        { type: 'URL', title: 'D', url: 'https://example.com' },
      ],
    });
    expect(errors).toContain('At most 3 buttons are allowed.');
  });

  it('requires a URL for URL buttons', () => {
    const errors = validateWhatsappCardTemplate({
      body: 'Hi there',
      actions: [{ type: 'URL', title: 'Book now' }],
    });
    expect(errors).toContain('URL buttons need a link.');
  });

  it('requires a phone number for phone buttons', () => {
    const errors = validateWhatsappCardTemplate({
      body: 'Hi there',
      actions: [{ type: 'PHONE_NUMBER', title: 'Call us' }],
    });
    expect(errors).toContain('Phone buttons need a number.');
  });

  it('accepts a valid card with body, header text, and a button', () => {
    const errors = validateWhatsappCardTemplate({
      body: 'Hi there',
      headerText: 'Summer Sale',
      actions: [{ type: 'URL', title: 'Book now', url: 'https://example.com/book' }],
    });
    expect(errors).toEqual([]);
  });
});
