#!/usr/bin/env node
/*
 * tools/verify.mjs — 零依賴交付前自檢（對應「防呆 F」與「雙版號 V」）
 *
 * 這支腳本存在的理由：2026-10 有人把 `import '@vercel/analytics'` 加進
 * 一支用 <script defer>（傳統 script）載入的 app.js，語法合法、`node --check`
 * 也過，但瀏覽器一載入就 SyntaxError，整個 App 白畫面。
 * 所以以下三件事不再靠人眼：
 *   1. app.js 是傳統 script 就不可有 top-level import/export。
 *   2. package.json／index.html（meta＋頁尾）／app.js／sw.js 的版號必須一致。
 *   3. HTML／manifest／Service Worker 引用的每個檔案都要真的存在。
 *
 * 用法：
 *   node tools/verify.mjs            # 人讀
 *   node tools/verify.mjs --json     # 機讀（CI）
 *   node tools/verify.mjs --strict   # 連 vendor 都做語法檢查
 * 有任何 FAIL → exit 1。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = new Set(process.argv.slice(2));
const JSON_OUT = argv.has('--json');
const STRICT = argv.has('--strict');

const results = [];
const record = (level, id, detail) => results.push({ level, id, detail });
const pass = (id, detail) => record('PASS', id, detail);
const warn = (id, detail) => record('WARN', id, detail);
const fail = (id, detail) => record('FAIL', id, detail);

const abs = (rel) => path.join(ROOT, rel);
const exists = (rel) => existsSync(abs(rel));
const read = (rel) => readFileSync(abs(rel), 'utf8');
const size = (rel) => statSync(abs(rel)).size;
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

/* ---------- 1. 版號一致（V） ---------- */
const pkg = JSON.parse(read('package.json'));
const html = read('index.html');
const app = read('app.js');
const sw = read('sw.js');

const pick = (text, re) => (text.match(re) || [])[1];
const versions = {
  'package.json': pkg.version,
  'index.html meta': pick(html, /<meta name="app-version" content="([^"]+)"/),
  'index.html 頁尾': pick(html, /©\s*\d{4}\s*Scout System\s*·\s*v([0-9.]+)/),
  'app.js APP_VERSION': pick(app, /const APP_VERSION = '([^']+)'/),
  'sw.js APP_VERSION': pick(sw, /const APP_VERSION = '([^']+)'/),
  'sw.js 快取名': sw.includes('const CACHE_NAME = `pocket-play-v${APP_VERSION}`') ? pick(sw, /const APP_VERSION = '([^']+)'/) : null,
};
const unique = new Set(Object.values(versions));
const missing = Object.entries(versions).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  fail('version', `以下位置找不到版號：${missing.join('、')}`);
} else if (unique.size > 1) {
  fail('version', `版號不一致：${Object.entries(versions).map(([k, v]) => `${k}=${v}`).join(' / ')}`);
} else {
  pass('version', `版號一致：v${pkg.version}（package.json／index.html meta＋頁尾／app.js／sw.js）`);
}

/* ---------- 2. 傳統 script 不可有 top-level import/export ---------- */
const appScriptTag = (html.match(/<script[^>]*src="\.\/app\.js"[^>]*>/) || [])[0] || '';
const appIsModule = /type="module"/.test(appScriptTag);
const topLevelModuleSyntax = /^[ \t]*(import|export)\b/m.test(app);
const bareImport = /^[ \t]*import\s[^;]*?from\s+['"][^./][^'"]*['"]/m.test(app);
if (!appScriptTag) {
  fail('module', 'index.html 找不到 <script src="./app.js">');
} else if (topLevelModuleSyntax && !appIsModule) {
  fail('module', 'app.js 有 top-level import/export，但 index.html 用 <script defer>（非 module）→ 瀏覽器會 SyntaxError，整個 App 停擺');
} else if (appIsModule && !/\bdefer\b/.test(appScriptTag)) {
  warn('module', 'app.js 以 type="module" 載入（預設 deferred），請確認 vendor 腳本已先執行');
} else {
  pass('module', `app.js 載入方式與語法一致（${appIsModule ? 'ES module' : '傳統 script'}）`);
}
if (bareImport) {
  fail('module', 'app.js 出現裸模組名稱（bare specifier）；靜態部署的瀏覽器無法解析，需改成相對路徑或改用 CDN／snippet');
}

/* ---------- 3. 語法檢查 ---------- */
const syntaxTargets = ['app.js', 'sw.js', 'tools/verify.mjs', 'tools/build-static.mjs', 'tools/serve.mjs'];
if (STRICT) syntaxTargets.push('vendor/qrcode.js', 'vendor/peerjs.min.js');
const broken = [];
for (const file of syntaxTargets) {
  if (!exists(file)) { broken.push(`${file}（不存在）`); continue; }
  try {
    execFileSync(process.execPath, ['--check', abs(file)], { stdio: 'pipe' });
  } catch (error) {
    broken.push(file);
  }
}
if (broken.length) fail('syntax', `語法檢查失敗：${broken.join('、')}`);
else pass('syntax', `${syntaxTargets.length} 個 JS/MJS 檔語法正常`);

/* ---------- 4. HTML／manifest／SW 引用的檔案都存在 ---------- */
const missingAssets = new Set();
const externalRefs = new Set();
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const url = match[1];
  if (/^(data:|mailto:|#|javascript:)/i.test(url)) continue;
  if (/^https?:/i.test(url)) { externalRefs.add(url); continue; }
  if (url.startsWith('/_vercel/')) continue; // Vercel 平台注入，本機不存在屬正常
  const clean = url.replace(/^\/+/, '').replace(/^\.\//, '').replace(/[?#].*$/, '');
  if (!clean) continue;
  if (!exists(clean)) missingAssets.add(`index.html → ${url}`);
}

const manifest = JSON.parse(read('manifest.webmanifest'));
for (const icon of manifest.icons || []) {
  const clean = String(icon.src).replace(/^\.\//, '');
  if (!exists(clean)) missingAssets.add(`manifest → ${icon.src}`);
}

const shellBlock = (sw.match(/const APP_SHELL = \[([\s\S]*?)\];/) || [])[1] || '';
for (const match of shellBlock.matchAll(/'([^']+)'/g)) {
  const clean = match[1].replace(/^\.\//, '');
  if (!clean) continue;
  if (!exists(clean)) missingAssets.add(`sw.js APP_SHELL → ${match[1]}`);
}

if (missingAssets.size) fail('assets', `引用了不存在的檔案：${[...missingAssets].join('；')}`);
else pass('assets', 'HTML／manifest／Service Worker 引用的檔案全部存在');

if (externalRefs.size) warn('offline', `HTML 有外部資源（離線時載入不到）：${[...externalRefs].join('、')}`);
else pass('offline', 'HTML 沒有外部資源，完全離線可開');

/* ---------- 5. 圖示規格（PNG 尺寸／ICO） ---------- */
const pngSize = (rel) => {
  const buffer = readFileSync(abs(rel));
  if (buffer.readUInt32BE(0) !== 0x89504e47) return null;
  return `${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}`;
};
const iconSpec = {
  'icons/favicon-16.png': '16x16',
  'icons/favicon-32.png': '32x32',
  'icons/apple-touch-icon.png': '180x180',
  'icons/icon-192.png': '192x192',
  'icons/icon-512.png': '512x512',
  'icons/icon-maskable-192.png': '192x192',
  'icons/icon-maskable-512.png': '512x512',
  'icons/og-image.png': '1200x630',
};
const iconProblems = [];
let iconBytes = 0;
for (const [rel, expected] of Object.entries(iconSpec)) {
  if (!exists(rel)) { iconProblems.push(`${rel} 不存在`); continue; }
  const dims = pngSize(rel);
  if (dims !== expected) iconProblems.push(`${rel} 尺寸 ${dims || '不是 PNG'}（應為 ${expected}）`);
  iconBytes += size(rel);
}
const icoPath = 'icons/favicon.ico';
if (!exists(icoPath)) iconProblems.push('icons/favicon.ico 不存在');
else {
  const ico = readFileSync(abs(icoPath));
  if (ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) iconProblems.push('icons/favicon.ico 格式不正確');
  iconBytes += size(icoPath);
}
if (iconProblems.length) fail('icons', iconProblems.join('；'));
else if (iconBytes > 260 * 1024) warn('icons', `9 個圖標合共 ${kb(iconBytes)}，超過 260 KB 預算`);
else pass('icons', `9 個圖標齊（PNG／ICO）合共 ${kb(iconBytes)}，在 260 KB 預算內`);

/* ---------- 6. manifest 與主題色 ---------- */
const theme = pick(html, /<meta name="theme-color" content="([^"]+)"/);
const purposes = (manifest.icons || []).map((icon) => `${icon.purpose || 'any'}:${icon.sizes}`);
const manifestProblems = [];
if (manifest.display !== 'standalone') manifestProblems.push('display 應為 standalone');
if (manifest.theme_color !== theme) manifestProblems.push(`theme_color ${manifest.theme_color} ≠ meta theme-color ${theme}`);
if (manifest.background_color !== theme) manifestProblems.push(`background_color ${manifest.background_color} ≠ meta theme-color ${theme}`);
if (!purposes.some((p) => p.startsWith('any') && p.includes('192'))) manifestProblems.push('缺 192 any 圖標');
if (!purposes.some((p) => p.startsWith('any') && p.includes('512'))) manifestProblems.push('缺 512 any 圖標');
if (!purposes.some((p) => p.startsWith('maskable'))) manifestProblems.push('缺 maskable 圖標');
if (!pick(html, /<link rel="manifest" href="([^"]+)"/)) manifestProblems.push('HTML 未掛 manifest');
if (manifestProblems.length) fail('manifest', manifestProblems.join('；'));
else pass('manifest', 'manifest 完整：standalone、4 個圖標、主題色與 HTML 一致');

/* ---------- 7. HTML 結構（ID 對照／重複 ID） ---------- */
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const idSet = new Set(ids);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
const usedIds = [...new Set([...app.matchAll(/\$\(\s*['"]#([A-Za-z0-9_-]+)['"]/g)].map((m) => m[1]))];
const danglingIds = usedIds.filter((id) => !idSet.has(id));
const ariaRefs = [...new Set([...html.matchAll(/aria-(?:labelledby|controls|describedby)="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)))];
const danglingAria = ariaRefs.filter((id) => id && !idSet.has(id));
if (duplicateIds.length) fail('ids', `重複 ID：${duplicateIds.join('、')}`);
if (danglingIds.length) fail('ids', `app.js 選到不存在的 ID：${danglingIds.join('、')}`);
if (danglingAria.length) fail('ids', `aria-labelledby／controls 指去不存在的 ID：${danglingAria.join('、')}`);
if (!duplicateIds.length && !danglingIds.length && !danglingAria.length) {
  pass('ids', `${idSet.size} 個 ID 全部對得上（app.js ${usedIds.length} 個、ARIA ${ariaRefs.length} 個）`);
}

/* ---------- 7b. 安裝到主畫面／版本更新流程 ---------- */
const installIds = ['installAppButton', 'installHelpModal', 'updateBanner', 'updateNowButton'];
const missingUi = installIds.filter((id) => !html.includes(`id="${id}"`));
const flowProblems = [];
if (missingUi.length) flowProblems.push(`index.html 缺 ${missingUi.join('、')}`);
if (!app.includes('beforeinstallprompt')) flowProblems.push('app.js 沒有攔 beforeinstallprompt（Android 安裝按鈕會失效）');
if (!app.includes("type: 'SKIP_WAITING'")) flowProblems.push("app.js 沒有向 SW 送出 SKIP_WAITING");
if (!/updatefound/.test(app)) flowProblems.push('app.js 沒有監聽 updatefound');
if (!sw.includes("event.data.type !== 'SKIP_WAITING'")) flowProblems.push('sw.js 沒有處理 SKIP_WAITING');
const installBlock = (sw.match(/self\.addEventListener\('install'[\s\S]*?\n\}\);/) || [''])[0];
if (/\.then\(\(\) => self\.skipWaiting\(\)\)/.test(installBlock)) {
  flowProblems.push('sw.js 在 install 無條件 skipWaiting（會玩到一半偷換版，應等用戶按「立即更新」）');
}
if (flowProblems.length) fail('update-flow', flowProblems.join('；'));
else pass('update-flow', '安裝入口（Android prompt／iOS 教學）與「立即更新」流程齊全，SW 不會偷換版');

/* ---------- 8. 部署標頭（A／VL） ---------- */
let vercel = null;
try { vercel = JSON.parse(read('vercel.json')); } catch (error) { fail('headers', 'vercel.json 不是合法 JSON'); }
if (vercel) {
  const all = (vercel.headers || []).flatMap((entry) => entry.headers || []);
  const header = (key) => (all.find((item) => item.key.toLowerCase() === key.toLowerCase()) || {}).value || '';
  const csp = header('content-security-policy');
  const problems = [];
  if (!csp) problems.push('缺 Content-Security-Policy');
  else {
    if (!/script-src[^;]*'self'/.test(csp)) problems.push("CSP 需有 script-src 'self'");
    if (csp.includes("'unsafe-eval'")) problems.push("CSP 不應有 'unsafe-eval'");
    if (!/frame-ancestors/.test(csp)) problems.push('CSP 缺 frame-ancestors');
  }
  if (!header('x-content-type-options')) problems.push('缺 X-Content-Type-Options');
  if (!header('referrer-policy')) problems.push('缺 Referrer-Policy');
  if (!header('permissions-policy')) problems.push('缺 Permissions-Policy');
  if (vercel.outputDirectory !== 'public') problems.push('outputDirectory 應為 public（只部署建置產物）');
  if (problems.length) fail('headers', problems.join('；'));
  else pass('headers', 'vercel.json 有 CSP／nosniff／Referrer／Permissions 標頭，只部署 public/');
}

/* ---------- 9. 體積與死重（S） ---------- */
const runtimeFiles = [
  'index.html', 'styles.css', 'app.js', 'sw.js', 'manifest.webmanifest',
  ...Object.keys(iconSpec), 'icons/favicon.ico',
  'vendor/qrcode.js', 'vendor/peerjs.min.js',
];
const runtimeBytes = runtimeFiles.filter(exists).reduce((sum, file) => sum + size(file), 0);
if (runtimeBytes > 5 * 1024 * 1024) fail('size', `執行期檔案 ${kb(runtimeBytes)} 超過 5 MB`);
else pass('size', `執行期檔案 ${kb(runtimeBytes)}（上限 5 MB）`);

const junk = [];
const skipDirs = new Set(['.git', 'node_modules', 'public', 'icons']);
const walk = (dir) => {
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name).replace(/^\.\//, '');
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      walk(rel);
    } else if (/\.(bak|tmp|old|swp|log)$/i.test(entry.name) || entry.name === '.DS_Store') {
      junk.push(rel);
    }
  }
};
walk('.');
if (junk.length) warn('junk', `發現暫存／備份檔：${junk.join('、')}`);
else pass('junk', '沒有 *.bak／*.tmp／*.old／*.log 等死重檔案');

/* ---------- 10. 防呆：CSP 友善度＋敏感字串 ---------- */
if (/\beval\s*\(|new Function\s*\(/.test(app)) warn('csp', 'app.js 用了 eval/new Function，嚴格 CSP 會失效');
else pass('csp', 'app.js 沒有 eval／new Function');

const secretPatterns = [
  [/sk-[A-Za-z0-9]{20,}/, 'OpenAI 風格的 sk- key'],
  [/gh[pousr]_[A-Za-z0-9]{20,}/, 'GitHub token'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/AIza[0-9A-Za-z_-]{30,}/, 'Google API key'],
];
const scanned = ['app.js', 'sw.js', 'index.html', 'vercel.json', 'tools/verify.mjs', 'tools/serve.mjs', 'tools/build-static.mjs'];
const leaked = [];
for (const file of scanned) {
  if (!exists(file)) continue;
  const text = read(file);
  for (const [re, label] of secretPatterns) if (re.test(text)) leaked.push(`${file}（${label}）`);
}
if (leaked.length) fail('secrets', `疑似 secret：${leaked.join('、')}`);
else pass('secrets', '前端檔案無疑似 secret');

/* ---------- 輸出 ---------- */
const counts = results.reduce((acc, item) => ({ ...acc, [item.level]: (acc[item.level] || 0) + 1 }), {});
const ok = !results.some((item) => item.level === 'FAIL');

if (JSON_OUT) {
  process.stdout.write(JSON.stringify({ tool: 'verify', version: pkg.version, ok, counts, checks: results }, null, 2) + '\n');
} else {
  const icon = { PASS: '✓', WARN: '!', FAIL: '✗' };
  for (const item of results) process.stdout.write(`${icon[item.level]} ${item.id.padEnd(9)} ${item.detail}\n`);
  process.stdout.write(`\n${ok ? '✓ 全部通過' : '✗ 有 FAIL，先修好再部署'}（PASS ${counts.PASS || 0} · WARN ${counts.WARN || 0} · FAIL ${counts.FAIL || 0}）\n`);
}
process.exit(ok ? 0 : 1);
