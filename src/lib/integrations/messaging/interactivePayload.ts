import type { InteractiveButtons, InteractiveCtaUrl, InteractiveMessage } from './types.js';
import {
  assertValidInteractiveList,
  normalizeInteractiveList,
  truncateListField,
  validateInteractiveListPayload,
} from './interactiveList.js';

export function normalizeInteractiveButtons(interactive: InteractiveButtons): InteractiveButtons {
  return {
    type: 'button',
    header: interactive.header ? truncateListField(interactive.header.trim(), 60) : undefined,
    body: truncateListField(interactive.body.trim(), 1024),
    footer: interactive.footer ? truncateListField(interactive.footer.trim(), 60) : undefined,
    buttons: interactive.buttons.slice(0, 3).map((b) => ({
      id: truncateListField(b.id.trim(), 256),
      title: truncateListField(b.title.trim(), 20),
    })),
  };
}

export function validateInteractiveButtonsPayload(interactive: InteractiveButtons): string[] {
  const errors: string[] = [];
  if (interactive.type !== 'button') errors.push('interactive.type must be "button"');
  if (!interactive.body?.trim()) errors.push('interactive.body is required');
  if (!interactive.buttons?.length) errors.push('at least one button is required');
  if (interactive.buttons.length > 3) errors.push('interactive buttons support max 3 buttons');
  const seen = new Set<string>();
  for (const btn of interactive.buttons) {
    if (!btn.id?.trim()) errors.push('button.id is required');
    if (!btn.title?.trim()) errors.push('button.title is required');
    if (btn.title.length > 20) errors.push(`button title exceeds 20 chars: ${btn.title}`);
    if (btn.id && seen.has(btn.id)) errors.push(`duplicate button.id: ${btn.id}`);
    if (btn.id) seen.add(btn.id);
  }
  return errors;
}

export function assertValidInteractiveButtons(interactive: InteractiveButtons): void {
  const errors = validateInteractiveButtonsPayload(interactive);
  if (errors.length > 0) {
    throw new Error(`Invalid interactive buttons: ${errors.join('; ')}`);
  }
}

export function normalizeInteractiveCtaUrl(interactive: InteractiveCtaUrl): InteractiveCtaUrl {
  const normalized: InteractiveCtaUrl = {
    type: 'cta_url',
    header: interactive.header ? truncateListField(interactive.header.trim(), 60) : undefined,
    body: truncateListField(interactive.body.trim(), 1024),
    footer: interactive.footer ? truncateListField(interactive.footer.trim(), 60) : undefined,
    displayText: truncateListField(interactive.displayText.trim(), 20),
    url: interactive.url.trim(),
  };
  if (interactive.secondaryAction) {
    normalized.secondaryAction = {
      displayText: truncateListField(interactive.secondaryAction.displayText.trim(), 20),
      url: interactive.secondaryAction.url.trim(),
    };
  }
  return normalized;
}

export function validateInteractiveCtaUrlPayload(interactive: InteractiveCtaUrl): string[] {
  const errors: string[] = [];
  if (interactive.type !== 'cta_url') errors.push('interactive.type must be "cta_url"');
  if (!interactive.body?.trim()) errors.push('interactive.body is required');
  if (!interactive.displayText?.trim()) errors.push('displayText is required');
  if (!interactive.url?.trim()) errors.push('url is required');
  if (!/^https:\/\//i.test(interactive.url.trim())) errors.push('url must start with https://');
  if (interactive.secondaryAction) {
    if (!interactive.secondaryAction.displayText?.trim()) {
      errors.push('secondaryAction.displayText is required');
    }
    if (!interactive.secondaryAction.url?.trim()) {
      errors.push('secondaryAction.url is required');
    } else if (!/^https:\/\//i.test(interactive.secondaryAction.url.trim())) {
      errors.push('secondaryAction.url must start with https://');
    }
  }
  return errors;
}

export function assertValidInteractiveCtaUrl(interactive: InteractiveCtaUrl): void {
  const errors = validateInteractiveCtaUrlPayload(interactive);
  if (errors.length > 0) {
    throw new Error(`Invalid interactive cta_url: ${errors.join('; ')}`);
  }
}

export function normalizeInteractiveMessage(interactive: InteractiveMessage): InteractiveMessage {
  if (interactive.type === 'list') return normalizeInteractiveList(interactive);
  if (interactive.type === 'cta_url') return normalizeInteractiveCtaUrl(interactive);
  return normalizeInteractiveButtons(interactive);
}

export function validateInteractiveMessage(interactive: InteractiveMessage): string[] {
  if (interactive.type === 'list') return validateInteractiveListPayload(interactive);
  if (interactive.type === 'cta_url') return validateInteractiveCtaUrlPayload(interactive);
  return validateInteractiveButtonsPayload(interactive);
}

export function assertValidInteractiveMessage(interactive: InteractiveMessage): void {
  if (interactive.type === 'list') assertValidInteractiveList(interactive);
  else if (interactive.type === 'cta_url') assertValidInteractiveCtaUrl(interactive);
  else assertValidInteractiveButtons(interactive);
}

export function buildCloudInteractivePayload(interactive: InteractiveMessage): Record<string, unknown> {
  const normalized = normalizeInteractiveMessage(interactive);
  assertValidInteractiveMessage(normalized);

  if (normalized.type === 'button') {
    return {
      type: 'interactive',
      interactive: {
        type: 'button',
        ...(normalized.header ? { header: { type: 'text', text: normalized.header } } : {}),
        body: { text: normalized.body },
        ...(normalized.footer ? { footer: { text: normalized.footer } } : {}),
        action: {
          buttons: normalized.buttons.map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    };
  }

  if (normalized.type === 'cta_url') {
    return {
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        ...(normalized.header ? { header: { type: 'text', text: normalized.header } } : {}),
        body: { text: normalized.body },
        ...(normalized.footer ? { footer: { text: normalized.footer } } : {}),
        action: {
          name: 'cta_url',
          parameters: {
            display_text: normalized.displayText,
            url: normalized.url,
          },
        },
      },
    };
  }

  return {
    type: 'interactive',
    interactive: {
      type: 'list',
      ...(normalized.header ? { header: { type: 'text', text: normalized.header } } : {}),
      body: { text: normalized.body },
      ...(normalized.footer ? { footer: { text: normalized.footer } } : {}),
      action: {
        button: normalized.button,
        sections: normalized.sections.map((section) => ({
          ...(section.title ? { title: section.title } : {}),
          rows: section.rows.map((row) => ({
            id: row.id,
            title: row.title,
            ...(row.description ? { description: row.description } : {}),
          })),
        })),
      },
    },
  };
}
