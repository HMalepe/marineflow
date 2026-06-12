import { describe, expect, it } from 'vitest';
import { CAMPAIGN_MEDIA_MIMES, UploadError, validateUploadPurpose } from './uploads.js';

describe('validateUploadPurpose', () => {
  it('accepts campaign JPEG under 5 MB', () => {
    expect(() =>
      validateUploadPurpose('campaign', 'image/jpeg', 4 * 1024 * 1024),
    ).not.toThrow();
  });

  it('accepts campaign GIF under 5 MB', () => {
    expect(() =>
      validateUploadPurpose('campaign', 'image/gif', 1024),
    ).not.toThrow();
  });

  it('rejects unsupported campaign mime types', () => {
    expect(() => validateUploadPurpose('campaign', 'application/pdf', 100)).toThrow(UploadError);
  });

  it('rejects oversized campaign images', () => {
    expect(() =>
      validateUploadPurpose('campaign', 'image/png', 6 * 1024 * 1024),
    ).toThrow(/5 MB/);
  });

  it('rejects oversized campaign videos', () => {
    expect(() =>
      validateUploadPurpose('campaign', 'video/mp4', 17 * 1024 * 1024),
    ).toThrow(/16 MB/);
  });
});

describe('CAMPAIGN_MEDIA_MIMES', () => {
  it('includes gif for newsletter uploads', () => {
    expect(CAMPAIGN_MEDIA_MIMES).toContain('image/gif');
  });
});
