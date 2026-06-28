import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const sourcePath = join(root, "src/assets/solupair-logo-source.png");
const outPath = join(root, "src/assets/solupair-logo.png");

/** Knock out black/near-black background; keep neon SP strokes. */
async function knockOutBackground(input, output, { threshold = 36 } = {}) {
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

  const png = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();

  writeFileSync(output, png);
  const meta = await sharp(png).metadata();
  console.log(`Wrote ${output} (${png.length} bytes, alpha: ${meta.hasAlpha})`);
}

await knockOutBackground(sourcePath, outPath);
