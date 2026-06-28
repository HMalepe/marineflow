import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const serverDir = join(process.cwd(), ".output/server");
const configPath = join(serverDir, "wrangler.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

const today = new Date().toISOString().slice(0, 10);
if (!config.compatibility_date || config.compatibility_date > today) {
  config.compatibility_date = today;
}

config.name = "solupair-landing";
config.workers_dev = true;
config.assets = {
  ...config.assets,
  directory: "../public",
};

delete config.routes;

const serverConfig = `${JSON.stringify(config, null, 2)}\n`;
writeFileSync(configPath, serverConfig);

// Root wrangler.json so Cloudflare's default `npx wrangler deploy` works.
const rootConfig = {
  ...config,
  $schema: "./node_modules/wrangler/config-schema.json",
  main: ".output/server/index.mjs",
  assets: {
    ...config.assets,
    directory: ".output/public",
  },
};

writeFileSync(join(process.cwd(), "wrangler.json"), `${JSON.stringify(rootConfig, null, 2)}\n`);

console.log("Patched wrangler.json for solupair-landing deploy");
