'use client';

import { useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { apiUploadFile, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StaffAvatar } from './staff-avatar';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp';

interface Props {
  token: string;
  name: string;
  displayName?: string | null;
  avatarUrl: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

export function StaffAvatarUpload({
  token,
  name,
  displayName,
  avatarUrl,
  onChange,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shownUrl = preview ?? avatarUrl;

  async function handleFile(file: File) {
    setError(null);
    if (!file.type.startsWith('image/') || !ACCEPT.split(',').includes(file.type)) {
      setError('Use JPEG, PNG, or WebP.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Photo must be under 5 MB.');
      return;
    }

    setUploading(true);
    const blobUrl = URL.createObjectURL(file);
    setPreview(blobUrl);

    try {
      const { publicUrl } = await apiUploadFile(file, 'staff', token);
      URL.revokeObjectURL(blobUrl);
      setPreview(null);
      onChange(publicUrl);
    } catch (err) {
      URL.revokeObjectURL(blobUrl);
      setPreview(null);
      setError(err instanceof ApiError ? err.message : 'Upload failed — try again.');
    } finally {
      setUploading(false);
    }
  }

  function clearPhoto() {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    setPreview(null);
    setError(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <div className="relative">
          <StaffAvatar
            name={name || 'Staff'}
            displayName={displayName}
            avatarUrl={shownUrl}
            size="lg"
            className={cn(uploading && 'opacity-60')}
          />
          {!disabled && !uploading && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
              aria-label="Upload profile photo"
            >
              <Camera className="size-3.5" />
            </button>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
              <Loader2 className="size-5 text-white animate-spin" />
            </div>
          )}
        </div>

        <div className="space-y-1.5 min-w-0">
          <p className="text-sm font-medium">Profile photo</p>
          <p className="text-xs text-muted-foreground">
            Shown on the roster calendar so you can spot who&apos;s working at a glance.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
            >
              {shownUrl ? 'Replace photo' : 'Add photo'}
            </Button>
            {shownUrl && !disabled && !uploading && (
              <Button type="button" variant="ghost" size="sm" onClick={clearPhoto}>
                <X className="size-3.5 mr-1" />
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
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
