import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const logoPath = join(root, "src/assets/solupair-logo.png");
const publicDir = join(root, "public");

/** Crisp favicon raster — black canvas, contained logo, glow trimmed at small sizes. */
async function renderFaviconPng(size, { crushGlow = false } = {}) {
  const padding = Math.max(2, Math.round(size * 0.1));
  const inner = size - padding * 2;

  const trimmed = await sharp(logoPath)
    .flatten({ background: "#000000" })
    .trim({ threshold: 15 })
    .resize(inner, inner, { fit: "contain", background: "#000000" })
    .png()
    .toBuffer();

  let pipeline = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    },
  }).composite([{ input: trimmed, gravity: "center" }]);

  if (crushGlow) {
    pipeline = pipeline.linear(1.35, -55).gamma(1.08);
  }

  return pipeline.png().toBuffer();
}

const outputs = [
  { file: "favicon-16.png", size: 16, crushGlow: true },
  { file: "favicon-32.png", size: 32, crushGlow: true },
  { file: "favicon-48.png", size: 48, crushGlow: false },
  { file: "apple-touch-icon.png", size: 180, crushGlow: false },
];

const icoSizes = [16, 32, 48];
const icoBuffers = await Promise.all(
  icoSizes.map((size) => renderFaviconPng(size, { crushGlow: size <= 32 })),
);

for (const { file, size, crushGlow } of outputs) {
  const png = await renderFaviconPng(size, { crushGlow });
  const outPath = join(publicDir, file);
  writeFileSync(outPath, png);
  console.log(`Wrote ${outPath} (${png.length} bytes)`);
}

const ico = await pngToIco(icoBuffers);
const icoPath = join(publicDir, "favicon.ico");
writeFileSync(icoPath, ico);
console.log(`Wrote ${icoPath} (${ico.length} bytes)`);
