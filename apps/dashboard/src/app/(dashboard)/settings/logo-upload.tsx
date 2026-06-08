'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ImageCropModal } from '@/components/image-crop-modal';
import { cn } from '@/lib/utils';
import { saveLogo } from './actions';

const MAX_BYTES = 10_000_000; // 10 MB before crop (canvas output will be smaller)

interface Props {
  current: string | null;
  salonName: string;
}

export function LogoUpload({ current, salonName }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current);
  const [pending, setPending] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = salonName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (inputRef.current) inputRef.current.value = '';

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, SVG, WebP)');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be under 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setCropSrc(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function handleCropApply(dataUrl: string) {
    setCropSrc(null);
    setPending(dataUrl);
  }

  function handleCropCancel() {
    setCropSrc(null);
  }

  async function handleSave() {
    if (!pending) return;
    setSaving(true);
    setError(null);
    const result = await saveLogo(pending);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setPreview(pending);
      setPending(null);
      router.refresh();
    }
  }

  async function handleRemove() {
    setSaving(true);
    setError(null);
    const result = await saveLogo(null);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setPreview(null);
      setPending(null);
      router.refresh();
    }
  }

  const display = pending ?? preview;

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-5">
          {/* Avatar preview — white bg so dark logos are always visible */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              'relative size-20 rounded-2xl overflow-hidden shrink-0 transition-all',
              'border-2 hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              display ? 'border-border bg-white' : 'border-dashed border-muted-foreground/30 bg-muted/50',
            )}
            aria-label="Upload logo"
          >
            {display ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={display} alt={salonName} className="size-full object-contain p-1.5" />
            ) : (
              <span className="text-xl font-bold text-muted-foreground">{initials}</span>
            )}
            {/* Camera overlay */}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-2xl">
              <svg
                className="size-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z"
                />
              </svg>
            </span>
          </button>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Salon logo</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              PNG, JPG, SVG or WebP · any size
              <br />
              You&apos;ll be able to crop and adjust before saving.
            </p>
            <div className="flex items-center gap-2 pt-0.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => inputRef.current?.click()}
              >
                {display ? 'Change' : 'Upload logo'}
              </Button>
              {preview && !pending && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => void handleRemove()}
                  disabled={saving}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        {pending && (
          <div className="flex items-center gap-3">
            <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : 'Save logo'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setPending(null);
                setCropSrc(null);
              }}
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
            >
              Re-crop
            </Button>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          circular={true}
          outputSize={512}
          onApply={handleCropApply}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );
}
