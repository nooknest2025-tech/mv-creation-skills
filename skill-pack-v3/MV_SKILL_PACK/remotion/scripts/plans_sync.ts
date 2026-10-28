// gen/plans.yaml -> src/lib/plans.gen.json (committed; a test checks it is in sync)
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import YAML from "yaml";
// fileURLToPath (not URL.pathname): on Windows .pathname gives "/C:/..." which becomes "C:\\C:\\..."
const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "../../gen/plans.yaml"), dst = path.join(here, "../src/lib/plans.gen.json");
export const plansJson = () => JSON.stringify(YAML.parse(fs.readFileSync(src, "utf8")), null, 1) + "\n";
export const plansPaths = { src, dst };
if (process.argv[1]?.match(/plans_sync\.ts$/)) { fs.writeFileSync(dst, plansJson()); console.log("✅ " + dst); }
