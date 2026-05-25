'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WizardData } from '../page';

interface Props {
  data: WizardData;
  updateData: (d: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export interface FaqEntry {
  question: string;
  answer: string;
}

const SUGGESTED_FAQS: FaqEntry[] = [
  { question: 'What are your opening hours?', answer: '' },
  { question: 'Do you accept walk-ins?', answer: '' },
  { question: 'What is your cancellation policy?', answer: '' },
  { question: 'Where are you located?', answer: '' },
];

export function StepFaqs({ data, updateData, onNext, onBack }: Props) {
  const [faqs, setFaqs] = useState<FaqEntry[]>(data.faqs ?? []);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  function addFaq() {
    if (!question.trim() || !answer.trim()) return;
    const updated = [...faqs, { question: question.trim(), answer: answer.trim() }];
    setFaqs(updated);
    updateData({ faqs: updated });
    setQuestion('');
    setAnswer('');
  }

  function addSuggested(faq: FaqEntry) {
    const updated = [...faqs, faq];
    setFaqs(updated);
    updateData({ faqs: updated });
  }

  function removeFaq(idx: number) {
    const updated = faqs.filter((_, i) => i !== idx);
    setFaqs(updated);
    updateData({ faqs: updated });
  }

  const unusedSuggestions = SUGGESTED_FAQS.filter(
    (s) => !faqs.some((f) => f.question === s.question),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">FAQ Content</h2>
        <p className="text-sm text-muted-foreground mt-1">
          The bot will answer these questions automatically. You can add more later.
        </p>
      </div>

      {unusedSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Suggested questions:</p>
          <div className="flex flex-wrap gap-2">
            {unusedSuggestions.map((s) => (
              <button
                key={s.question}
                type="button"
                onClick={() => addSuggested(s)}
                className="px-2 py-1 rounded border text-xs hover:bg-accent transition-colors"
              >
                + {s.question}
              </button>
            ))}
          </div>
        </div>
      )}

      {faqs.length > 0 && (
        <div className="space-y-2">
          {faqs.map((f, i) => (
            <div key={i} className="p-3 rounded-md border space-y-1">
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium">{f.question}</p>
                <Button variant="ghost" size="sm" onClick={() => removeFaq(i)}>
                  Remove
                </Button>
              </div>
              {f.answer ? (
                <p className="text-xs text-muted-foreground">{f.answer}</p>
              ) : (
                <Input
                  placeholder="Type the answer..."
                  className="text-xs"
                  onBlur={(e) => {
                    if (e.target.value.trim()) {
                      const updated = faqs.map((fq, idx) =>
                        idx === i ? { ...fq, answer: e.target.value.trim() } : fq,
                      );
                      setFaqs(updated);
                      updateData({ faqs: updated });
                    }
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="border rounded-md p-4 space-y-3">
        <p className="text-sm font-medium">Add custom FAQ</p>
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-xs">Question</Label>
            <Input
              placeholder="e.g. Do you do children's haircuts?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Answer</Label>
            <Input
              placeholder="e.g. Yes! We offer kids cuts for ages 3+."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={addFaq} disabled={!question.trim() || !answer.trim()}>
          + Add FAQ
        </Button>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>
          {faqs.length > 0 ? 'Continue' : 'Skip for now'}
        </Button>
      </div>
    </div>
  );
}
