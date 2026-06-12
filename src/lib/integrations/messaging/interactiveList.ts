import type { InteractiveList } from './types.js';

/** Character count by Unicode code point (matches truncateListField). */
export function codePointLength(text: string): number {
  return [...text].length;
}

/** Truncate by Unicode code point (safe for emoji) to WhatsApp field limits. */
export function truncateListField(text: string, max: number): string {
  const chars = [...text];
  return chars.length <= max ? text : chars.slice(0, max).join('');
}

/** True when salon is on Meta Cloud API (non-empty phone_number_id). */
export function salonUsesCloudInteractiveMenu(whatsappPhoneId?: string | null): boolean {
  return Boolean(whatsappPhoneId?.trim());
}

/** Apply Meta Cloud API length limits to every interactive list field. */
export function normalizeInteractiveList(interactive: InteractiveList): InteractiveList {
  return {
    type: 'list',
    header: interactive.header ? truncateListField(interactive.header.trim(), 60) : undefined,
    body: truncateListField(interactive.body.trim(), 1024),
    footer: interactive.footer ? truncateListField(interactive.footer.trim(), 60) : undefined,
    button: truncateListField(interactive.button.trim(), 20),
    sections: interactive.sections.map((section) => ({
      title: section.title ? truncateListField(section.title.trim(), 24) : undefined,
      rows: section.rows.map((row) => ({
        id: truncateListField(row.id.trim(), 200),
        title: truncateListField(row.title.trim(), 24),
        description: row.description
          ? truncateListField(row.description.trim(), 72)
          : undefined,
      })),
    })),
  };
}

/** Validate interactive list payload against Meta Cloud API limits. Returns error messages. */
export function validateInteractiveListPayload(interactive: InteractiveList): string[] {
  const errors: string[] = [];
  if (interactive.type !== 'list') errors.push('interactive.type must be "list"');
  if (!interactive.body?.trim()) errors.push('interactive.body is required');
  if (!interactive.button?.trim()) errors.push('interactive.button is required');
  if (interactive.button.length > 20) errors.push('interactive.button exceeds 20 characters');
  if (interactive.header && codePointLength(interactive.header) > 60) {
    errors.push('interactive.header exceeds 60 characters');
  }
  if (interactive.footer && codePointLength(interactive.footer) > 60) {
    errors.push('interactive.footer exceeds 60 characters');
  }
  if (codePointLength(interactive.body) > 1024) errors.push('interactive.body exceeds 1024 characters');
  if (!interactive.sections?.length) errors.push('at least one section is required');
  if (interactive.sections.length > 10) errors.push('interactive list supports max 10 sections');

  const seenIds = new Set<string>();
  let totalRows = 0;
  for (const section of interactive.sections) {
    if (section.title && codePointLength(section.title) > 24) {
      errors.push(`section title exceeds 24 characters: ${section.title}`);
    }
    for (const row of section.rows) {
      totalRows++;
      if (!row.id?.trim()) errors.push('row.id is required');
      if (codePointLength(row.id) > 200) errors.push(`row.id exceeds 200 characters: ${row.id.slice(0, 20)}…`);
      if (!row.title?.trim()) errors.push('row.title is required');
      if (codePointLength(row.title) > 24) errors.push(`row title exceeds 24 chars: ${row.title}`);
      if (row.description && codePointLength(row.description) > 72) {
        errors.push(`row description exceeds 72 chars: ${row.id}`);
      }
      if (row.id) {
        if (seenIds.has(row.id)) errors.push(`duplicate row.id: ${row.id}`);
        seenIds.add(row.id);
      }
    }
  }
  if (totalRows === 0) errors.push('at least one row is required');
  if (totalRows > 10) errors.push('interactive list supports max 10 rows total');

  return errors;
}

export function assertValidInteractiveList(interactive: InteractiveList): void {
  const errors = validateInteractiveListPayload(interactive);
  if (errors.length > 0) {
    throw new Error(`Invalid interactive list: ${errors.join('; ')}`);
  }
}
