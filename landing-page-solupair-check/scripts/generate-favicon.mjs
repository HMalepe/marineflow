import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const logoPath = join(root, "src/assets/solupair-logo.png");
const outPath = join(root, "public/favicon.ico");

const sizes = [16, 32, 48];
const pngBuffers = await Promise.all(
  sizes.map((size) =>
    sharp(logoPath)
      .resize(size, size, { fit: "cover" })
      .png()
      .toBuffer(),
  ),
);

const ico = await pngToIco(pngBuffers);
writeFileSync(outPath, ico);
console.log(`Wrote ${outPath} (${ico.length} bytes)`);
