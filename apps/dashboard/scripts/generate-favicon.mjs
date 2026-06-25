import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const source = join(root, 'public', 'solupair-icon.png');
const WORK_SIZE = 128;

function removeDarkBackground(data, channels) {
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;

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

async function embolden(input, spread) {
  const meta = await sharp(input).metadata();
  const pad = spread;
  const width = meta.width + pad * 2;
  const height = meta.height + pad * 2;

  const layers = [];
  for (let dx = -spread; dx <= spread; dx++) {
    for (let dy = -spread; dy <= spread; dy++) {
      layers.push({
        input,
        left: pad + dx,
        top: pad + dy,
        blend: 'lighten',
      });
    }
  }
  layers.push({ input, left: pad, top: pad });

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(layers)
    .png()
    .toBuffer();
}

async function makeMarkIcon(size) {
  const logo = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = logo;
  const { width, height, channels } = info;

  removeDarkBackground(data, channels);

  const transparentLogo = await sharp(data, {
    raw: { width, height, channels },
  })
    .png()
    .toBuffer();

  const trimmed = await sharp(transparentLogo).trim({ threshold: 1 }).png().toBuffer();

  const filled = await sharp(trimmed)
    .resize(WORK_SIZE, WORK_SIZE, {
      fit: 'cover',
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
    })
    .modulate({ brightness: 1.24, saturation: 1.5 })
    .png()
    .toBuffer();

  const bold = await embolden(filled, 4);

  return sharp(bold)
    .extract({
      left: 4,
      top: 4,
      width: WORK_SIZE,
      height: WORK_SIZE,
    })
    .sharpen({ sigma: 1, m1: 1.15, m2: 0.55 })
    .resize(size, size, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
}

const icon32 = await makeMarkIcon(32);
const icon180 = await makeMarkIcon(180);

writeFileSync(join(root, 'src', 'app', 'icon.png'), icon32);
writeFileSync(join(root, 'src', 'app', 'apple-icon.png'), icon180);

console.log('Generated bold mark favicons: icon.png (32px), apple-icon.png (180px)');
