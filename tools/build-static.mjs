#!/usr/bin/env node
/*
 * tools/build-static.mjs — 把真正要上線的檔案整理到 public/（零依賴）
 *
 * 為什麼要有這一步：
 *  - Vercel 的 outputDirectory 設為 public，部署只會包含執行期檔案，
 *    不會把 package.json、tools/、README 之類的東西一齊派街。
 *  - 每次建置先清空 public/，避免舊檔殘留（S5 死重零容忍）。
 *  - 清單寫死在這裡，漏檔會即時報錯，不會靜靜部署一個壞掉的 App。
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public');

const FILES = ['index.html', 'styles.css', 'app.js', 'sw.js', 'manifest.webmanifest'];
const DIRS = ['icons', 'vendor'];

const walk = (dir, onFile) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, onFile);
    else onFile(full);
  }
};

const missing = [...FILES, ...DIRS].filter((item) => !existsSync(path.join(ROOT, item)));
if (missing.length) {
  console.error(`✗ 缺少必需檔案：${missing.join('、')}`);
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let total = 0;
for (const file of FILES) {
  cpSync(path.join(ROOT, file), path.join(OUT, file));
  total += statSync(path.join(ROOT, file)).size;
}
for (const dir of DIRS) {
  cpSync(path.join(ROOT, dir), path.join(OUT, dir), { recursive: true });
  walk(path.join(OUT, dir), (full) => { total += statSync(full).size; });
}

console.log(`✓ staged ${FILES.length} files + ${DIRS.join('/')} into public/ (${(total / 1024).toFixed(1)} KB)`);
if (total > 5 * 1024 * 1024) {
  console.error('✗ public/ 超過 5 MB 預算，請先瘦身');
  process.exit(1);
}
