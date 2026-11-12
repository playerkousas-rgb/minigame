# 更新紀錄

版本號出現於四個地方，`npm run check` 會自動對照，改版時一齊改：

`package.json` → `index.html`（`meta[name=app-version]` ＋ 頁尾）→ `app.js`（`APP_VERSION`）→ `sw.js`（`APP_VERSION`）

## v1.1.0 — 2026-11-12

### 修正（會影響線上能否開啟）
- **移除 `import { inject } from '@vercel/analytics'`**：`app.js` 是用 `<script defer>` 載入的傳統 script，top-level `import` 會令瀏覽器直接 SyntaxError，整個 App 白畫面。改回 Vercel 官方靜態 snippet `/_vercel/insights/script.js`，分析照樣有。
- 刪除 `@vercel/analytics` npm 依賴與 `package-lock.json`，回到真正零依賴。

### 改進
- Service Worker 重寫：只快取同源資源（不再攔截 PeerJS 信令）、導覽用 network-first（不再卡舊版）、只快取 200 OK、跨域與 `/_vercel/` 直接放行。
- 新增完整圖標組（9 個 PNG／ICO）：iOS 主畫面、Android 安裝、maskable、16px 手繪、1200×630 分享圖。
- HTML `<head>` 補齊 favicon／apple-touch-icon／Open Graph／Twitter Card／`apple-mobile-web-app-*`；`description` 更新為與現有遊戲一致。
- `vercel.json` 加入 CSP、Referrer-Policy、Permissions-Policy；部署只輸出 `public/`（不再把 `package.json`、`tools/` 派街，也不再重複上載一份 bundle）。
- 新增 `tools/verify.mjs` 交付前自檢（13 項，含「傳統 script 不可用 import」與版號一致性），`npm run check` 會跑。
- 新增零依賴 `tools/serve.mjs`（`npm start` 不用再 `npx serve` 上網下載）。
- 新增 `tools/make-icons.sh` 可重建圖標；`LICENSE`（MIT）、`CHANGELOG.md`、CI workflow。
- 移除 `icon.svg`（改由 PNG 圖標取代）、移除重複的 `public/` 產物。

## v1.0.0
- 初版：骰子／大話骰／多人骰子房、德州撲克、21 點、百家樂、狼人殺、一夜狼人、誰是臥底、機密特務、幸運輪、分隊、硬幣、計分板、倒數；PWA 離線快取。
