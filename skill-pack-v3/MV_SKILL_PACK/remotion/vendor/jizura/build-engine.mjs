// Rebuild the browser-only concatenation from the pinned upstream source files.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const source=path.join(dir,'src');
const files=fs.readdirSync(source).filter(n=>n.endsWith('.js')).sort();
const head='/* JIZURA 0.10.1, Copyright (c) 2026 hakoniwa, MIT. See LICENSE and THIRD_PARTY_NOTICES.md. */\nif (typeof window !== "undefined" && typeof document !== "undefined") {\n';
const text=head+files.map(n=>fs.readFileSync(path.join(source,n),'utf8')).join('\n')+'\n}\n';
fs.writeFileSync(path.join(dir,'engine.js'),text,'utf8');
console.log(`Built JIZURA engine from ${files.length} source files`);
