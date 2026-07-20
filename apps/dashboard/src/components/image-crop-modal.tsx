'use client';

import { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';

const MAX_CROP_SIZE = 320;

interface Props {
  src: string;
  circular?: boolean;
  outputSize?: number;
  onApply: (dataUrl: string) => void;
  onCancel: () => void;
}

export function ImageCropModal({
  src,
  circular = true,
  outputSize = 512,
  onApply,
  onCancel,
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  // This modal only ever mounts client-side (triggered by a file input's
  // onChange), so window is always available by the time this runs.
  const [cropSize] = useState(() => Math.min(MAX_CROP_SIZE, window.innerWidth - 64));
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDist = useRef<number | null>(null);

  const minScale =
    naturalSize.w > 0
      ? Math.max(cropSize / naturalSize.w, cropSize / naturalSize.h)
      : 1;

  const clampOffset = useCallback(
    (ox: number, oy: number, s: number, nw: number, nh: number) => {
      const maxX = Math.max(0, (nw * s - cropSize) / 2);
      const maxY = Math.max(0, (nh * s - cropSize) / 2);
      return {
        x: Math.max(-maxX, Math.min(maxX, ox)),
        y: Math.max(-maxY, Math.min(maxY, oy)),
      };
    },
    [cropSize],
  );

  function handleLoad() {
    const img = imgRef.current;
    if (!img) return;
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    setNaturalSize({ w: nw, h: nh });
    const ms = Math.max(cropSize / nw, cropSize / nh);
    setScale(ms);
    setOffset({ x: 0, y: 0 });
  }

  function pinchDistance() {
    const pts = Array.from(activePointers.current.values());
    if (pts.length < 2) return null;
    const [a, b] = pts;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function handlePointerDown(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.current.size === 2) {
      dragging.current = false;
      lastPinchDist.current = pinchDistance();
    } else {
      dragging.current = true;
      lastPointer.current = { x: e.clientX, y: e.clientY };
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2) {
      const dist = pinchDistance();
      if (dist != null && lastPinchDist.current != null) {
        const factor = dist / lastPinchDist.current;
        setScale((prev) => {
          const next = Math.max(minScale, Math.min(minScale * 6, prev * factor));
          setOffset((o) => clampOffset(o.x, o.y, next, naturalSize.w, naturalSize.h));
          return next;
        });
      }
      lastPinchDist.current = dist;
      return;
    }

    if (!dragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setOffset((prev) =>
      clampOffset(prev.x + dx, prev.y + dy, scale, naturalSize.w, naturalSize.h),
    );
  }

  function handlePointerUp(e: React.PointerEvent) {
    activePointers.current.delete(e.pointerId);
    lastPinchDist.current = null;
    dragging.current = activePointers.current.size === 1;
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    setScale((prev) => {
      const next = Math.max(minScale, Math.min(minScale * 6, prev * factor));
      setOffset((o) => clampOffset(o.x, o.y, next, naturalSize.w, naturalSize.h));
      return next;
    });
  }

  function handleSlider(e: React.ChangeEvent<HTMLInputElement>) {
    const next = parseFloat(e.target.value);
    setScale(next);
    setOffset((o) => clampOffset(o.x, o.y, next, naturalSize.w, naturalSize.h));
  }

  function handleApply() {
    const img = imgRef.current;
    if (!img || naturalSize.w === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d')!;

    // Map container top-left [0,0] to source image coordinates
    const srcX = naturalSize.w / 2 - (cropSize / 2 + offset.x) / scale;
    const srcY = naturalSize.h / 2 - (cropSize / 2 + offset.y) / scale;
    const srcW = cropSize / scale;
    const srcH = cropSize / scale;

    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outputSize, outputSize);
    onApply(canvas.toDataURL('image/jpeg', 0.92));
  }

  const imgTransform = `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="p-5 border-b">
          <h2 className="font-semibold text-base">Adjust photo</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Drag to reposition · scroll or use slider to zoom
          </p>
        </div>

        {/* Crop viewport */}
        <div className="flex justify-center bg-black/20 py-5">
          <div
            className="relative overflow-hidden cursor-grab active:cursor-grabbing select-none bg-black"
            style={{ width: cropSize, height: cropSize, touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={handleLoad}
              className="absolute top-1/2 left-1/2 max-w-none select-none pointer-events-none"
              style={{ transformOrigin: 'center', transform: imgTransform }}
            />

            {/* Crop overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <svg
                viewBox={`0 0 ${cropSize} ${cropSize}`}
                width={cropSize}
                height={cropSize}
              >
                <defs>
                  <mask id="crop-hole">
                    <rect width="100%" height="100%" fill="white" />
                    {circular ? (
                      <circle
                        cx={cropSize / 2}
                        cy={cropSize / 2}
                        r={cropSize / 2 - 10}
                        fill="black"
                      />
                    ) : (
                      <rect x="10" y="10" width={cropSize - 20} height={cropSize - 20} rx="4" fill="black" />
                    )}
                  </mask>
                </defs>
                <rect
                  width="100%"
                  height="100%"
                  fill="rgba(0,0,0,0.55)"
                  mask="url(#crop-hole)"
                />
                {circular ? (
                  <circle
                    cx={cropSize / 2}
                    cy={cropSize / 2}
                    r={cropSize / 2 - 10}
                    fill="none"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                  />
                ) : (
                  <rect
                    x="10"
                    y="10"
                    width={cropSize - 20}
                    height={cropSize - 20}
                    rx="4"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                  />
                )}
              </svg>
            </div>
          </div>
        </div>

        {/* Zoom slider */}
        <div className="px-5 pt-4 pb-2 flex items-center gap-3">
          <span className="text-muted-foreground text-xs leading-none">−</span>
          <input
            type="range"
            min={minScale}
            max={Math.max(minScale * 5, minScale + 0.001)}
            step={0.001}
            value={scale}
            onChange={handleSlider}
            className="flex-1 accent-primary"
            aria-label="Zoom"
          />
          <span className="text-muted-foreground text-xs leading-none">+</span>
        </div>
        <p className="text-center text-xs text-muted-foreground pb-3">
          {Math.round((scale / minScale) * 100)}% zoom
        </p>

        <div className="flex justify-end gap-3 p-5 pt-0 border-t">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleApply}>
            Apply crop
          </Button>
        </div>
      </div>
    </div>
  );
}
