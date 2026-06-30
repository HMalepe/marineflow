import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

/** Knock out black/near-black background; keep neon strokes and white type. */
async function knockOutBackground(input, output, { threshold = 36, cropToNameOnly = false } = {}) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

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

  let pipeline;

  if (cropToNameOnly) {
    // Source wordmark includes slogan (and a divider) below the name — keep name only.
    const rowDensity = new Array(info.height).fill(0);
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * 4;
        if (data[i + 3] > 10) rowDensity[y] += 1;
      }
    }

    const peakDensity = Math.max(...rowDensity);
    let cropHeight = info.height;
    for (let y = 1; y < info.height; y++) {
      if (rowDensity[y - 1] >= peakDensity * 0.45 && rowDensity[y] < peakDensity * 0.12) {
        cropHeight = y;
        break;
      }
    }

    const base = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toBuffer();

    const cropped = await sharp(base)
      .extract({ left: 0, top: 0, width: info.width, height: cropHeight })
      .png()
      .toBuffer();

    pipeline = sharp(cropped);
  } else {
    pipeline = sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    });
  }

  const png = await pipeline.trim({ threshold: 12 }).png({ compressionLevel: 9, effort: 10 }).toBuffer();

  writeFileSync(output, png);
  const meta = await sharp(png).metadata();
  console.log(`Wrote ${output} (${png.length} bytes, ${meta.width}x${meta.height}, alpha: ${meta.hasAlpha})`);
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
