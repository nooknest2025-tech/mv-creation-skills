// gen/plans.yaml -> src/lib/plans.gen.json (committed; a test checks it is in sync)
import fs from "node:fs"; import path from "node:path"; import YAML from "yaml";
const here = path.dirname(new URL(import.meta.url).pathname);
const src = path.join(here, "../../gen/plans.yaml"), dst = path.join(here, "../src/lib/plans.gen.json");
export const plansJson = () => JSON.stringify(YAML.parse(fs.readFileSync(src, "utf8")), null, 1) + "\n";
if (process.argv[1]?.match(/plans_sync\.ts$/)) { fs.writeFileSync(dst, plansJson()); console.log("✅ " + dst); }
