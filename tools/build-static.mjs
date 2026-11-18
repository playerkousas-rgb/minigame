#!/usr/bin/env node
/*
 * tools/build-static.mjs — 把版本化來源檔整理到 Vercel public/（零依賴）
 *
 *  - public/ 保留 index.html、app.js 等穩定執行期路徑；版本化檔名是 repo 的唯一來源。
 *  - Gate 模板原封不動複製到 publish root；設定檔亦一併部署。
 *  - 每次建置先清空 public/，避免舊檔殘留（S5 死重零容忍）。
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public');

const FILES = [
  { source: 'index_v1.3.0.html', output: 'index.html' },
  { source: 'styles_v1.3.0.css', output: 'styles.css' },
  { source: 'app_v1.3.0.js', output: 'app.js' },
  { source: 'sw_v1.3.0.js', output: 'sw.js' },
  { source: 'manifest_v1.3.0.webmanifest', output: 'manifest.webmanifest' },
  { source: 'store_gate_v1.0.js', output: 'store_gate_v1.0.js' },
  { source: 'store_gate_config_v1.3.0.js', output: 'store_gate_config_v1.3.0.js' },
];
const DIRS = ['icons', 'vendor'];

const walk = (dir, onFile) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, onFile);
    else onFile(full);
  }
};

const missing = [
  ...FILES.filter(({ source }) => !existsSync(path.join(ROOT, source))).map(({ source }) => source),
  ...DIRS.filter((dir) => !existsSync(path.join(ROOT, dir))),
];
if (missing.length) {
  console.error(`✗ 缺少必需檔案：${missing.join('、')}`);
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let total = 0;
for (const { source, output } of FILES) {
  cpSync(path.join(ROOT, source), path.join(OUT, output));
  total += statSync(path.join(ROOT, source)).size;
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
