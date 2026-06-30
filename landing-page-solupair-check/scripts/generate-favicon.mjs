import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const logoPath = join(root, "src/assets/solupair-logo.png");
const publicDir = join(root, "public");

const SUPER_SAMPLE = 512;
/** Logo occupies 85% of icon box — ~15% smaller than a full-bleed mark. */
const MARK_SCALE = 0.85;

let transparentMarkPromise;

function removeDarkBackground(data, channels) {
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const chroma = max - Math.min(r, g, b);

    if (max < 20 || (max < 64 && chroma < 36)) {
      data[i + 3] = 0;
    } else if (max < 90 && chroma < 48) {
      const fade = (max - 64) / (90 - 64);
      data[i + 3] = Math.round(Math.min(1, Math.max(0, fade)) * 200);
    }

    if (data[i + 3] < 24) {
      data[i + 3] = 0;
    }
  }
}

function cleanDarkHalos(data, channels, width, height) {
  const alphaAt = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    return data[(y * width + x) * channels + 3];
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const a = data[i + 3];
      if (a === 0) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);

      const nearTransparent =
        alphaAt(x - 1, y) < 28 ||
        alphaAt(x + 1, y) < 28 ||
        alphaAt(x, y - 1) < 28 ||
        alphaAt(x, y + 1) < 28;

      const darkBlueFringe = b >= r && b >= g && max < 115;
      const darkMagentaFringe = r > g && r > b && max < 90;

      if (darkBlueFringe && max < 72) {
        data[i + 3] = 0;
        continue;
      }

      if (nearTransparent && (darkBlueFringe || darkMagentaFringe) && max < 80) {
        data[i + 3] = 0;
        continue;
      }

      if (darkBlueFringe && max < 130) {
        const t = Math.min(1, (max - 45) / 70);
        data[i] = Math.round(55 + t * 60);
        data[i + 1] = Math.round(215 + t * 40);
        data[i + 2] = Math.round(238 + t * 17);
        data[i + 3] = Math.round(a * (0.55 + t * 0.45));
      }
    }
  }
}

async function getTransparentMark() {
  if (transparentMarkPromise) return transparentMarkPromise;

  transparentMarkPromise = (async () => {
    const { data, info } = await sharp(logoPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    removeDarkBackground(data, 4);
    cleanDarkHalos(data, 4, info.width, info.height);

    return sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .trim({ threshold: 8 })
      .png()
      .toBuffer();
  })();

  return transparentMarkPromise;
}

async function polishSmallIcon(buffer, size) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  cleanDarkHalos(data, 4, info.width, info.height);

  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .sharpen({
      sigma: size <= 16 ? 0.55 : 0.42,
      m1: 1.15,
      m2: 0.22,
    })
    .png()
    .toBuffer();
}

/** Transparent favicon raster — supersampled SP mark, no black plate. */
async function renderFaviconPng(size) {
  const trimmed = await getTransparentMark();
  const inner = Math.max(1, Math.round(size * MARK_SCALE));
  const isSmall = size <= 48;
  const superInner = Math.max(Math.round(inner * 8), isSmall ? SUPER_SAMPLE : inner * 4);

  let hiRes = sharp(trimmed).resize(superInner, superInner, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    kernel: sharp.kernel.lanczos3,
  });

  if (isSmall) {
    hiRes = hiRes.modulate({ brightness: 1.12, saturation: 1.35 });
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
      background: { r: 0, g: 0, b: 0, alpha: 0 },
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
