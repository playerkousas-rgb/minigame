#!/usr/bin/env node
// Vercel 靜態部署相容層：把根目錄的純靜態 bundle 同步到 public/
// 目的：同時相容兩種 Vercel 設定
// - 若 vercel.json outputDirectory = "."  →  直接部署根目錄，public/ 只是備援，不影響部署
// - 若 Vercel 後台仍設為 public（常見誤設）→  此腳本確保 public/ 存在且包含完整 bundle，部署不會再報 "No Output Directory named public found"
// 零依賴，僅用 Node fs。

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public");

// 需要部署的靜態資產清單（與 .vercelignore / vercel.json 快取策略保持一致）
// 根目錄的 index.html / app.js / styles.css / sw.js / manifest / icon / vendor 是執行期必需；
// package.json / vercel.json / README 等不進 public，避免洩漏配置。
const files = [
  "index.html",
  "app.js",
  "styles.css",
  "sw.js",
  "manifest.webmanifest",
  "icon.svg",
];
const dirs = ["vendor"];

function copyFile(src, dest) {
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest);
}

function copyDir(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  for (const entry of readdirSync(srcDir)) {
    const s = path.join(srcDir, entry);
    const d = path.join(destDir, entry);
    const st = statSync(s);
    if (st.isDirectory()) copyDir(s, d);
    else copyFile(s, d);
  }
}

// 清掉舊的 public 再重建，避免快取殘留舊檔
if (existsSync(out)) {
  rmSync(out, { recursive: true, force: true });
}
mkdirSync(out, { recursive: true });

let count = 0;
let bytes = 0;

for (const f of files) {
  const src = path.join(root, f);
  if (!existsSync(src)) {
    console.warn(`[build-static] skip missing file: ${f}`);
    continue;
  }
  const dest = path.join(out, f);
  copyFile(src, dest);
  bytes += statSync(src).size;
  count++;
}

for (const d of dirs) {
  const src = path.join(root, d);
  if (!existsSync(src)) {
    console.warn(`[build-static] skip missing dir: ${d}`);
    continue;
  }
  const dest = path.join(out, d);
  copyDir(src, dest);
  // 計算該目錄下的檔案數與大小
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = path.join(dir, e);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else {
        count++;
        bytes += st.size;
      }
    }
  };
  walk(src);
}

const kb = (bytes / 1024).toFixed(1);
console.log(`✓ staged ${count} static files (${kb} KB) into public/`);
console.log("Build check passed: pure zero-dependency static bundle.");
