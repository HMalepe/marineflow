export type WhatsappTemplateCategory = 'MARKETING' | 'UTILITY';
export type WhatsappTemplateStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type WhatsappCardActionType = 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY' | 'COPY_CODE' | 'VOICE_CALL';

export interface WhatsappCardAction {
  type: WhatsappCardActionType;
  title: string;
  url?: string;
  phone?: string;
  code?: string;
}

export interface WhatsappTemplate {
  id: string;
  name: string;
  category: WhatsappTemplateCategory;
  language: string;
  headerText: string | null;
  mediaUrl: string | null;
  body: string;
  footer: string | null;
  buttons: WhatsappCardAction[];
  status: WhatsappTemplateStatus;
  rejectionReason: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const WHATSAPP_BUTTON_TYPE_LABELS: { id: WhatsappCardActionType; label: string }[] = [
  { id: 'URL', label: 'Open link' },
  { id: 'PHONE_NUMBER', label: 'Call number' },
  { id: 'QUICK_REPLY', label: 'Quick reply' },
  { id: 'COPY_CODE', label: 'Copy code' },
  { id: 'VOICE_CALL', label: 'Voice call' },
];

export function whatsappButtonTypeLabel(type: WhatsappCardActionType): string {
  return WHATSAPP_BUTTON_TYPE_LABELS.find((t) => t.id === type)?.label ?? type;
}
