import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const source = join(root, 'public', 'solupair-icon.png');
const WORK_SIZE = 128;
const MARK_SCALE = 0.68;

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

/** Strip dark blue/purple fringe left by glow keying and embolden offsets. */
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

async function embolden(input, spread) {
  const meta = await sharp(input).metadata();
  const pad = spread;
  const width = meta.width + pad * 2;
  const height = meta.height + pad * 2;

  const layers = [];
  for (let dx = -spread; dx <= spread; dx++) {
    for (let dy = -spread; dy <= spread; dy++) {
      if (dx === 0 && dy === 0) continue;
      layers.push({
        input,
        left: pad + dx,
        top: pad + dy,
        blend: 'lighten',
      });
    }
  }
  layers.push({ input, left: pad, top: pad });

  const bold = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(layers)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  cleanDarkHalos(bold.data, bold.info.channels, width, height);

  return sharp(bold.data, {
    raw: { width, height, channels: bold.info.channels },
  })
    .png()
    .toBuffer();
}

async function makeMarkIcon(size) {
  const logo = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = logo;
  const { width, height, channels } = info;

  removeDarkBackground(data, channels);
  cleanDarkHalos(data, channels, width, height);

  const transparentLogo = await sharp(data, {
    raw: { width, height, channels },
  })
    .png()
    .toBuffer();

  const trimmed = await sharp(transparentLogo).trim({ threshold: 1 }).png().toBuffer();

  const maxDim = Math.round(WORK_SIZE * MARK_SCALE);

  const scaled = await sharp(trimmed)
    .resize(maxDim, maxDim, {
      fit: 'inside',
      kernel: sharp.kernel.lanczos3,
    })
    .modulate({ brightness: 1.2, saturation: 1.45 })
    .png()
    .toBuffer();

  const scaledMeta = await sharp(scaled).metadata();
  const left = Math.round((WORK_SIZE - scaledMeta.width) / 2);
  const top = Math.round((WORK_SIZE - scaledMeta.height) / 2);

  const filled = await sharp({
    create: {
      width: WORK_SIZE,
      height: WORK_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: scaled, left, top }])
    .png()
    .toBuffer();

  const bold = await embolden(filled, 2);

  const extracted = await sharp(bold)
    .extract({
      left: 2,
      top: 2,
      width: WORK_SIZE,
      height: WORK_SIZE,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  cleanDarkHalos(extracted.data, extracted.info.channels, WORK_SIZE, WORK_SIZE);

  return sharp(extracted.data, {
    raw: { width: WORK_SIZE, height: WORK_SIZE, channels: extracted.info.channels },
  })
    .resize(size, size, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
}

const icon32 = await makeMarkIcon(32);
const icon180 = await makeMarkIcon(180);

writeFileSync(join(root, 'src', 'app', 'icon.png'), icon32);
writeFileSync(join(root, 'src', 'app', 'apple-icon.png'), icon180);

console.log('Generated bold mark favicons: icon.png (32px), apple-icon.png (180px)');
