/** Standard dashboard copy for save confirmations (checkmark appended by SaveSuccessFeedback). */
export const SAVE_MESSAGES = {
  changesSaved: 'Changes saved',
  profileUpdated: 'Profile updated',
  draftSaved: 'Draft saved',
  logoSaved: 'Logo saved',
  logoRemoved: 'Logo removed',
} as const;

export type SaveMessageKey = keyof typeof SAVE_MESSAGES;
