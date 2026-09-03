#!/usr/bin/env node
/**
 * Upload a local product photo to Supabase Storage and insert a products row.
 *
 * Usage:
 *   node uploadProduct.js ./images/paracetamol.jpg "Paracetamol 500mg" 45.00 "Pain relief, 20 tablets"
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (.env).
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const BUCKET = 'product-images';

function usageAndExit(code = 1) {
  console.error(
    'Usage: node uploadProduct.js <imagePath> <name> <price> <caption>\n' +
      'Example: node uploadProduct.js ./images/paracetamol.jpg "Paracetamol 500mg" 45.00 "Pain relief, 20 tablets"',
  );
  process.exit(code);
}

function mimeFromExt(filePath) {
  const ext = extname(filePath).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  return map[ext] ?? 'application/octet-stream';
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'product';
}

async function main() {
  const [, , imagePathArg, name, priceRaw, caption] = process.argv;
  if (!imagePathArg || !name || priceRaw === undefined || caption === undefined) {
    usageAndExit(1);
  }

  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
    process.exit(1);
  }

  const imagePath = resolve(imagePathArg);
  if (!existsSync(imagePath) || !statSync(imagePath).isFile()) {
    console.error(`File not found: ${imagePath}`);
    process.exit(1);
  }

  const price = Number(priceRaw);
  if (Number.isNaN(price)) {
    console.error(`Invalid price: ${priceRaw}`);
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const bytes = readFileSync(imagePath);
  const contentType = mimeFromExt(imagePath);
  const objectPath = `${slugify(name)}-${randomUUID()}${extname(imagePath).toLowerCase() || '.jpg'}`;

  console.log(`Uploading ${basename(imagePath)} → ${BUCKET}/${objectPath} …`);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, bytes, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    console.error('Upload failed:', uploadError.message);
    process.exit(1);
  }

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  const imageUrl = publicData?.publicUrl;
  if (!imageUrl) {
    console.error('Upload succeeded but public URL could not be resolved.');
    process.exit(1);
  }

  const { data: row, error: insertError } = await supabase
    .from('products')
    .insert({
      name,
      price,
      image_url: imageUrl,
      caption,
    })
    .select('id, name, price, image_url, caption')
    .single();

  if (insertError) {
    console.error('DB insert failed:', insertError.message);
    // Best-effort cleanup so failed inserts don't leave orphaned files
    await supabase.storage.from(BUCKET).remove([objectPath]).catch(() => undefined);
    process.exit(1);
  }

  console.log('Product created:');
  console.log(`  id:         ${row.id}`);
  console.log(`  name:       ${row.name}`);
  console.log(`  price:      ${row.price}`);
  console.log(`  caption:    ${row.caption}`);
  console.log(`  image_url:  ${row.image_url}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
