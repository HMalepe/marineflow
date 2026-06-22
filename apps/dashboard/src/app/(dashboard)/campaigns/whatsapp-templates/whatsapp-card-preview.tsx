import { ExternalLink, Phone, RotateCcw, Copy, Mic } from 'lucide-react';
import type { WhatsappCardAction, WhatsappCardActionType } from './whatsapp-template-types';

function ButtonIcon({ type }: { type: WhatsappCardActionType }) {
  switch (type) {
    case 'URL':
      return <ExternalLink className="size-3.5" />;
    case 'PHONE_NUMBER':
      return <Phone className="size-3.5" />;
    case 'VOICE_CALL':
      return <Mic className="size-3.5" />;
    case 'COPY_CODE':
      return <Copy className="size-3.5" />;
    default:
      return <RotateCcw className="size-3.5" />;
  }
}

export function WhatsappCardPreview({
  headerText,
  mediaUrl,
  body,
  footer,
  buttons,
}: {
  headerText: string | null;
  mediaUrl: string | null;
  body: string;
  footer: string | null;
  buttons: WhatsappCardAction[];
}) {
  const hasContent = headerText || mediaUrl || body.trim() || footer || buttons.length > 0;

  return (
    <div className="rounded-xl border bg-gradient-to-b from-[#e5ddd5] to-[#d9d0c7] dark:from-[#0b141a] dark:to-[#111b21] p-4 shadow-inner">
      <div className="mx-auto max-w-[260px] rounded-[1.25rem] border-[6px] border-[#1f2c34] dark:border-[#2a3942] bg-[#0b141a] p-2 shadow-lg">
        {!hasContent ? (
          <div className="rounded-lg bg-[#dcf8c6] dark:bg-[#005c4b] px-3 py-6 text-center text-[12px] text-muted-foreground">
            Your card preview will appear here…
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden bg-[#dcf8c6] dark:bg-[#005c4b]">
            {mediaUrl && (
              <div className="bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl} alt="" className="w-full max-h-36 object-cover" />
              </div>
            )}
            <div className="px-3 py-2.5 space-y-1.5">
              {headerText && <p className="text-[13px] font-bold leading-snug text-[#111] dark:text-[#e9edef]">{headerText}</p>}
              {body.trim() && (
                <p className="text-[13px] leading-relaxed text-[#111] dark:text-[#e9edef] whitespace-pre-wrap break-words">
                  {body}
                </p>
              )}
              {footer && <p className="text-[11px] text-[#3a5a45] dark:text-[#8ba99a]">{footer}</p>}
            </div>
            {buttons.length > 0 && (
              <div className="border-t border-black/10 dark:border-white/10">
                {buttons.map((btn, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium text-[#00a5f4] border-t border-black/5 dark:border-white/5 first:border-t-0"
                  >
                    <ButtonIcon type={btn.type} />
                    {btn.title || 'Button'}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <p className="text-[9px] text-right text-[#8696a0] pr-1 pt-1">12:30 ✓✓</p>
      </div>
    </div>
  );
}
