/** Prints raw and gzip sizes of the built bundle (run via `npm run bundle-report`). */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '../dist');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
for (const file of walk(root).filter((f) => !f.endsWith('.map') && !f.includes('/types/'))) {
  const buf = readFileSync(file);
  console.log(`${file.slice(root.length + 1).padEnd(24)} raw ${kb(buf.length).padStart(10)}  gzip ${kb(gzipSync(buf, { level: 9 }).length).padStart(9)}`);
}
