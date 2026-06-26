import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const configPath = join(process.cwd(), ".output/server/wrangler.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

config.name = "solupair-landing";
config.workers_dev = true;
config.assets = {
  ...config.assets,
  directory: "../public",
};

delete config.routes;

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log("Patched wrangler.json for workers.dev deploy");
