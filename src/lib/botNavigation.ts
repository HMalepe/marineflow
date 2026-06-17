/** Shared WhatsApp bot navigation command parsing. */

/** One step back in a multi-step flow (booking funnel). */
export function isBackCommand(text: string): boolean {
  return /^(back|undo)\b/i.test(text.trim());
}

/** Explicit main menu request. */
export function isMainMenuCommand(text: string): boolean {
  const t = text.trim();
  return /^menu$/i.test(t) || /^main\s*menu$/i.test(t);
}

/** Return to the main menu from sub-menus, FAQ, support, etc. */
export function isBackToMainMenuCommand(text: string): boolean {
  return isMainMenuCommand(text) || isBackCommand(text);
}

/** "Continue" tap from the inactivity reminder — a no-op that just dismisses the nudge. */
export function isContinueCommand(text: string): boolean {
  return /^continue$/i.test(text.trim());
}
