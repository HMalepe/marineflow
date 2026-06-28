import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const logoPath = join(root, "src/assets/solupair-logo.png");
const publicDir = join(root, "public");

const SUPER_SAMPLE = 512;

let trimmedLogoPromise;

function getTrimmedLogo() {
  trimmedLogoPromise ??= sharp(logoPath)
    .flatten({ background: "#000000" })
    .trim({ threshold: 18 })
    .png()
    .toBuffer();
  return trimmedLogoPromise;
}

/** Fade dark fringe pixels so neon glow does not read as thick borders at 16–32px. */
function defringeRgba(data, size) {
  const floor = size <= 16 ? 38 : size <= 32 ? 32 : 24;
  const knee = size <= 16 ? 76 : size <= 32 ? 66 : 56;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    if (luma < floor) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
      continue;
    }

    let t = 1;
    if (luma < knee) {
      t = (luma - floor) / (knee - floor);
    }

    // Suppress cyan/magenta halos that read as bold borders at favicon size.
    if (b > r + 6 && b > g + 2 && luma < 90) {
      t *= 0.82;
    } else if (r > g + 6 && r > b + 2 && luma < 90) {
      t *= 0.86;
    }

    if (t < 1) {
      data[i] = Math.round(r * t);
      data[i + 1] = Math.round(g * t);
      data[i + 2] = Math.round(b * t);
    }
  }
}

async function polishSmallIcon(buffer, size) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  defringeRgba(data, size);

  let polished = sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).sharpen({
    sigma: size <= 16 ? 0.62 : 0.48,
    m1: 1.22,
    m2: 0.24,
  });

  return polished.png().toBuffer();
}

/** High-quality favicon raster: supersample, defringe, sharpen. */
async function renderFaviconPng(size) {
  const padding = Math.max(2, Math.round(size * 0.11));
  const inner = size - padding * 2;
  const trimmed = await getTrimmedLogo();
  const isSmall = size <= 48;

  const superInner = Math.max(Math.round(inner * 8), isSmall ? SUPER_SAMPLE : inner * 4);

  let hiRes = sharp(trimmed).resize(superInner, superInner, {
    fit: "contain",
    background: "#000000",
    kernel: sharp.kernel.lanczos3,
  });

  if (isSmall) {
    hiRes = hiRes.linear(1.18, -42).gamma(1.05);
  }

  const hiResBuffer = await hiRes.png().toBuffer();

  let logoBuffer = await sharp(hiResBuffer)
    .resize(inner, inner, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  if (isSmall) {
    logoBuffer = await polishSmallIcon(logoBuffer, size);
  }

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  })
    .composite([{ input: logoBuffer, gravity: "center" }])
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();
}

const outputs = [
  { file: "favicon-16.png", size: 16 },
  { file: "favicon-32.png", size: 32 },
  { file: "favicon-48.png", size: 48 },
  { file: "apple-touch-icon.png", size: 180 },
];

const icoSizes = [16, 32, 48];
const icoBuffers = await Promise.all(icoSizes.map((size) => renderFaviconPng(size)));

for (const { file, size } of outputs) {
  const png = await renderFaviconPng(size);
  const outPath = join(publicDir, file);
  writeFileSync(outPath, png);
  console.log(`Wrote ${outPath} (${png.length} bytes)`);
}

const ico = await pngToIco(icoBuffers);
const icoPath = join(publicDir, "favicon.ico");
writeFileSync(icoPath, ico);
console.log(`Wrote ${icoPath} (${ico.length} bytes)`);
