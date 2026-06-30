import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

/** Knock out black/near-black background; keep neon strokes and white type. */
async function knockOutBackground(input, output, { threshold = 36, cropToNameOnly = false } = {}) {
  let loader = sharp(input);

  if (cropToNameOnly) {
    const meta = await sharp(input).metadata();
    const cropHeight = Math.max(1, Math.min(meta.height ?? 1, Math.round((meta.height ?? 1) * 0.48)));
    loader = sharp(input).extract({
      left: 0,
      top: 0,
      width: meta.width ?? 1,
      height: cropHeight,
    });
  }

  const { data, info } = await loader.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

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

  const png = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ threshold: 12 })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();

  writeFileSync(output, png);
  const outMeta = await sharp(png).metadata();
  console.log(`Wrote ${output} (${png.length} bytes, ${outMeta.width}x${outMeta.height}, alpha: ${outMeta.hasAlpha})`);
}

const jobs = [
  {
    source: join(root, "src/assets/solupair-logo-source.png"),
    output: join(root, "src/assets/solupair-logo.png"),
  },
  {
    source: join(root, "src/assets/solupair-wordmark-source.png"),
    output: join(root, "src/assets/solupair-wordmark.png"),
    threshold: 32,
    cropToNameOnly: true,
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
  });
}
