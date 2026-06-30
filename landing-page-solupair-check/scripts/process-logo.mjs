import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

/** Upscale small brand assets for crisp retina header display. */
const WORDMARK_UPSCALE = 4;
const LOGO_MIN_LONG_EDGE = 1536;
const NAME_CROP_RATIO = 0.4;

function knockOutPixels(data, threshold) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    if (luma < threshold) {
      data[i + 3] = 0;
      continue;
    }

    if (luma < threshold + 28) {
      const t = (luma - threshold) / 28;
      data[i + 3] = Math.round(255 * t);
    }
  }
}

async function exportPng(pipeline, output, { minWidth, minHeight } = {}) {
  let img = pipeline.trim({ threshold: 12 });

  if (minWidth || minHeight) {
    img = img.resize({
      width: minWidth,
      height: minHeight,
      fit: "inside",
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3,
    });
  }

  const png = await img
    .sharpen({ sigma: 0.65, m1: 0.55, m2: 0.3, x1: 2, y2: 10, y3: 20 })
    .png({ compressionLevel: 6, effort: 10, palette: false })
    .toBuffer();

  writeFileSync(output, png);
  const meta = await sharp(png).metadata();
  console.log(`Wrote ${output} (${png.length} bytes, ${meta.width}x${meta.height}, alpha: ${meta.hasAlpha})`);
}

/** Knock out black/near-black background; keep neon strokes and white type. */
async function knockOutBackground(
  input,
  output,
  { threshold = 36, cropToNameOnly = false, minWidth, minHeight, preUpscale = 1 } = {},
) {
  const sourceMeta = await sharp(input).metadata();
  const srcW = sourceMeta.width ?? 1;
  const srcH = sourceMeta.height ?? 1;

  let loader = sharp(input);

  if (preUpscale > 1) {
    loader = loader.resize({
      width: Math.round(srcW * preUpscale),
      height: Math.round(srcH * preUpscale),
      kernel: sharp.kernel.lanczos3,
    });
  }

  if (cropToNameOnly) {
    const scaledH = Math.round(srcH * preUpscale);
    const cropHeight = Math.max(1, Math.round(scaledH * NAME_CROP_RATIO));
    loader = loader.extract({
      left: 0,
      top: 0,
      width: Math.round(srcW * preUpscale),
      height: cropHeight,
    });
  }

  const { data, info } = await loader.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  knockOutPixels(data, threshold);

  await exportPng(
    sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    }),
    output,
    { minWidth, minHeight },
  );
}

const jobs = [
  {
    source: join(root, "src/assets/solupair-logo-source.png"),
    output: join(root, "src/assets/solupair-logo.png"),
    minWidth: LOGO_MIN_LONG_EDGE,
    minHeight: LOGO_MIN_LONG_EDGE,
  },
  {
    source: join(root, "src/assets/solupair-wordmark-source.png"),
    output: join(root, "src/assets/solupair-wordmark.png"),
    threshold: 32,
    cropToNameOnly: true,
    preUpscale: WORDMARK_UPSCALE,
    minWidth: 1600,
    minHeight: 180,
  },
];

for (const job of jobs) {
  if (!existsSync(job.source)) {
    console.warn(`Skip missing source: ${job.source}`);
    continue;
  }
  await knockOutBackground(job.source, job.output, {
    threshold: job.threshold ?? 36,
    cropToNameOnly: job.cropToNameOnly ?? false,
    minWidth: job.minWidth,
    minHeight: job.minHeight,
    preUpscale: job.preUpscale ?? 1,
  });
}
