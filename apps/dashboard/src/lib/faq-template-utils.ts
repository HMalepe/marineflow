import type { FaqTemplate } from '../app/(dashboard)/faqs/faq-templates';

/** Lowercase, strip punctuation, collapse whitespace — for comparing questions. */
export function normalizeFaqQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantWords(question: string): string[] {
  const stop = new Set([
    'a', 'an', 'the', 'do', 'does', 'is', 'are', 'can', 'i', 'we', 'you', 'my', 'your', 'our',
  ]);
  return normalizeFaqQuestion(question)
    .split(' ')
    .filter((w) => w.length > 2 && !stop.has(w));
}

/** True when an FAQ likely came from this template (exact or lightly edited question). */
export function faqMatchesTemplate(faqQuestion: string, templateQuestion: string): boolean {
  const faqNorm = normalizeFaqQuestion(faqQuestion);
  const templateNorm = normalizeFaqQuestion(templateQuestion);
  if (!faqNorm || !templateNorm) return false;
  if (faqNorm === templateNorm) return true;
  if (faqNorm.includes(templateNorm) || templateNorm.includes(faqNorm)) return true;

  const faqWords = significantWords(faqQuestion);
  const templateWords = significantWords(templateQuestion);
  if (faqWords.length === 0 || templateWords.length === 0) return false;

  const templateSet = new Set(templateWords);
  const overlap = faqWords.filter((w) => templateSet.has(w)).length;
  const ratio = overlap / Math.min(faqWords.length, templateWords.length);
  return ratio >= 0.75;
}

export function isFaqTemplateUsed(
  template: FaqTemplate,
  existingQuestions: string[],
): boolean {
  return existingQuestions.some((q) => faqMatchesTemplate(q, template.question));
}

export function filterAvailableFaqTemplates(
  templates: FaqTemplate[],
  existingQuestions: string[],
): FaqTemplate[] {
  const used = existingQuestions.filter((q) => q.trim().length > 0);
  if (used.length === 0) return templates;
  return templates.filter((t) => !isFaqTemplateUsed(t, used));
}

export function countUsedFaqTemplates(templates: FaqTemplate[], existingQuestions: string[]): number {
  return templates.length - filterAvailableFaqTemplates(templates, existingQuestions).length;
}
