'use client';

import { useRef, useState } from 'react';
import { Film, ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { apiUploadFile, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { SaveErrorFeedback, SaveSuccessFeedback } from '@/components/save-feedback';
import { SAVE_MESSAGES } from '@/lib/save-messages';
import { useSaveFeedback } from '@/lib/use-save-feedback';
import { cn } from '@/lib/utils';

export type CampaignMediaType = 'image' | 'video';

const IMAGE_MAX = 5 * 1024 * 1024;
const GIF_MAX = 5 * 1024 * 1024;
const VIDEO_MAX = 16 * 1024 * 1024;

function mimeToMediaType(mime: string): CampaignMediaType | null {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return null;
}

interface Props {
  token: string;
  mediaUrl: string | null;
  mediaType: CampaignMediaType | null;
  onChange: (next: { mediaUrl: string | null; mediaType: CampaignMediaType | null }) => void;
  disabled?: boolean;
}

export function CampaignMediaUpload({ token, mediaUrl, mediaType, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const { success, error, clear, reportSuccess, reportError } = useSaveFeedback();

  const preview = localPreview ?? mediaUrl;

  async function handleFile(file: File) {
    clear();
    const type = mimeToMediaType(file.type);
    if (!type) {
      reportError('Use JPEG, PNG, WebP, GIF, or MP4 video.');
      return;
    }
    const isGif = file.type === 'image/gif';
    const max = type === 'video' ? VIDEO_MAX : isGif ? GIF_MAX : IMAGE_MAX;
    if (file.size > max) {
      reportError(type === 'video' ? 'Videos must be under 16 MB.' : 'Images and GIFs must be under 5 MB.');
      return;
    }

    setUploading(true);
    const blobUrl = URL.createObjectURL(file);
    setLocalPreview(blobUrl);

    try {
      const { publicUrl } = await apiUploadFile(file, 'campaign', token);
      URL.revokeObjectURL(blobUrl);
      setLocalPreview(null);
      onChange({ mediaUrl: publicUrl, mediaType: type });
      reportSuccess(SAVE_MESSAGES.mediaUploaded);
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

  function clearMedia() {
    if (localPreview && localPreview.startsWith('blob:')) {
      URL.revokeObjectURL(localPreview);
    }
    setLocalPreview(null);
    clear();
    onChange({ mediaUrl: null, mediaType: null });
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="space-y-3">
      {preview ? (
        <div className="relative rounded-xl border overflow-hidden bg-muted/30">
          {mediaType === 'video' || preview.endsWith('.mp4') ? (
            <video src={preview} controls className="w-full max-h-48 object-cover bg-black" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Newsletter attachment" className="w-full max-h-48 object-cover" />
          )}
          <div className="absolute top-2 right-2 flex gap-1">
            <BadgePill type={mediaType ?? 'image'} />
            {!disabled && !uploading && (
              <button
                type="button"
                onClick={clearMedia}
                className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="Remove media"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
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
              <div className="flex gap-2">
                <ImageIcon className="size-6 text-muted-foreground" />
                <Film className="size-6 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium">Add photo or video</span>
              <span className="text-xs text-muted-foreground text-center max-w-xs">
                JPG, PNG, WebP, GIF up to 5 MB · MP4 up to 16 MB
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
          Replace media
        </Button>
      )}

      <SaveSuccessFeedback message={success} className="text-xs" />
      <SaveErrorFeedback message={error} className="text-xs" />

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
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

function BadgePill({ type }: { type: CampaignMediaType }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white uppercase tracking-wide">
      {type === 'video' ? <Film className="size-3" /> : <ImageIcon className="size-3" />}
      {type}
    </span>
  );
}
