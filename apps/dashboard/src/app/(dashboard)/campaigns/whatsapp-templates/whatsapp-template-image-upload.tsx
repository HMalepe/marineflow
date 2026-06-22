'use client';

import { useRef, useState } from 'react';
import { ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { apiUploadFile, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { SaveErrorFeedback, SaveSuccessFeedback } from '@/components/save-feedback';
import { useSaveFeedback } from '@/lib/use-save-feedback';
import { cn } from '@/lib/utils';

const IMAGE_MAX = 5 * 1024 * 1024;
const ACCEPTED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

interface Props {
  token: string;
  mediaUrl: string | null;
  onChange: (mediaUrl: string | null) => void;
  disabled?: boolean;
}

export function WhatsappTemplateImageUpload({ token, mediaUrl, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const { success, error, clear, reportSuccess, reportError } = useSaveFeedback();

  const preview = localPreview ?? mediaUrl;

  async function handleFile(file: File) {
    clear();
    if (!ACCEPTED_MIMES.includes(file.type)) {
      reportError('Use JPEG, PNG, or WebP for the header image.');
      return;
    }
    if (file.size > IMAGE_MAX) {
      reportError('Header images must be under 5 MB.');
      return;
    }

    setUploading(true);
    const blobUrl = URL.createObjectURL(file);
    setLocalPreview(blobUrl);

    try {
      const { publicUrl } = await apiUploadFile(file, 'whatsapp-template', token);
      URL.revokeObjectURL(blobUrl);
      setLocalPreview(null);
      if (publicUrl.startsWith('data:')) {
        reportError(
          'Uploaded, but this server has no public file storage (S3) configured — Meta cannot fetch a data: URL. Configure S3 before submitting this template for review.',
        );
      } else {
        reportSuccess('Header image uploaded');
      }
      onChange(publicUrl);
    } catch (err) {
      setLocalPreview(null);
      URL.revokeObjectURL(blobUrl);
      reportError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Upload failed — check your connection and try again.',
      );
    } finally {
      setUploading(false);
    }
  }

  function clearImage() {
    if (localPreview && localPreview.startsWith('blob:')) {
      URL.revokeObjectURL(localPreview);
    }
    setLocalPreview(null);
    clear();
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="space-y-3">
      {preview ? (
        <div className="relative rounded-xl border overflow-hidden bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Template header" className="w-full max-h-48 object-cover" />
          {!disabled && !uploading && (
            <button
              type="button"
              onClick={clearImage}
              className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Remove header image"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 transition-colors',
            'hover:border-[#128c7e]/50 hover:bg-[#25d366]/5',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="size-8 text-[#128c7e] animate-spin" />
              <span className="text-sm text-muted-foreground">Uploading…</span>
            </>
          ) : (
            <>
              <ImageIcon className="size-6 text-muted-foreground" />
              <span className="text-sm font-medium">Add header image</span>
              <span className="text-xs text-muted-foreground text-center max-w-xs">
                JPG, PNG, or WebP up to 5 MB
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-[#128c7e] font-medium mt-1">
                <Upload className="size-3.5" />
                Choose file
              </span>
            </>
          )}
        </button>
      )}

      {preview && !disabled && (
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          Replace image
        </Button>
      )}

      <SaveSuccessFeedback message={success} className="text-xs" />
      <SaveErrorFeedback message={error} className="text-xs" />

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIMES.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          if (inputRef.current) inputRef.current.value = '';
        }}
      />
    </div>
  );
}
