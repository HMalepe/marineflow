'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SectionFeedback } from '@/components/save-feedback';

/** Inline success/error for a single save form (clears success after timeout). */
export function useSaveFeedback(autoClearMs = 3000) {
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), autoClearMs);
    return () => clearTimeout(timer);
  }, [success, autoClearMs]);

  const clear = useCallback(() => {
    setSuccess(null);
    setError(null);
  }, []);

  const reportSuccess = useCallback((message: string) => {
    setError(null);
    setSuccess(message);
  }, []);

  const reportError = useCallback((message: string) => {
    setSuccess(null);
    setError(message);
  }, []);

  return { success, error, clear, reportSuccess, reportError };
}

/** Per-section feedback for settings-style pages with many save blocks. */
export function useMultiSectionSaveFeedback(autoClearMs = 3000) {
  const [sections, setSections] = useState<Record<string, SectionFeedback>>({});

  const reportSuccess = useCallback(
    (section: string, message: string) => {
      setSections((prev) => ({ ...prev, [section]: { success: message, error: undefined } }));
      setTimeout(() => {
        setSections((prev) => {
          if (prev[section]?.success !== message) return prev;
          const next = { ...prev };
          delete next[section];
          return next;
        });
      }, autoClearMs);
    },
    [autoClearMs],
  );

  const reportError = useCallback((section: string, message: string) => {
    setSections((prev) => ({ ...prev, [section]: { success: undefined, error: message } }));
  }, []);

  const clearSection = useCallback((section: string) => {
    setSections((prev) => {
      if (!prev[section]) return prev;
      const next = { ...prev };
      delete next[section];
      return next;
    });
  }, []);

  const getSection = useCallback((section: string) => sections[section], [sections]);

  return { getSection, reportSuccess, reportError, clearSection };
}
