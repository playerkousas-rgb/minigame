# AGENTS — 出門玩 · Pocket Play 開工前必讀

> 給任何接手這個 repo 的 Agent／開發者：先讀這一頁，再改任何一行。
> 這個專案是**單頁、零依賴、離線優先的靜態 PWA**，沒有框架、沒有 bundler、沒有後端。

## 1. 五條硬規則（違反 = 不准交付）

| # | 規則 | 為什麼 |
|---|------|--------|
| 1 | `app.js` 是**傳統 script**，不准有 top-level `import`／`export` | `index.html` 用 `<script defer src="./app.js">`；加了 import 瀏覽器直接 SyntaxError，整個 App 白畫面（2026-10 真實事故） |
| 2 | **零 npm 依賴**；第三方程式碼放 `vendor/` 並鎖版本 | 靜態部署沒有 bundler，裸模組名稱（bare specifier）瀏覽器解析不到；也避免部署肥大 |
| 3 | 版號四處同步：`package.json`／`index.html`（meta＋頁尾）／`app.js`／`sw.js` | `npm run check` 會對照，避免「改了程式沒改版號」 |
| 4 | 所有資源**同源**、離線要開得起來 | Service Worker 只快取同源；任何 CDN／外部字體都會令離線版壞掉 |
| 5 | 圖標一律 **PNG／ICO**（`icons/` 9 個檔案），不准 SVG／WebP | iOS／Android 安裝流程與 WhatsApp 預覽只認 PNG／ICO |

## 2. 常用指令

```bash
npm start          # 零依賴本機伺服器 → http://0.0.0.0:4173（Service Worker 需要 http://）
npm run check      # 交付前自檢 13 項：版號／module 用法／語法／引用檔／圖標／manifest／ID／CSP／體積／死重／secret
npm run lint       # 同 check，連 vendor 都做語法檢查
npm run build      # check + 整理 public/（Vercel 的 outputDirectory）
npm run icons      # 需要 ImageMagick，重新產生 icons/
```

## 3. 改動流程

1. **改哪個遊戲／工具**：畫面在 `index.html` 的 `#view-*` section，邏輯在 `app.js` 對應的 `render*`／事件監聽。新增畫面要一併加 `data-game` 入口與說明書（`guide` 內容）。
2. **不要新增建置步驟**：`app.js`、`styles.css`、`index.html` 直接就是上線檔案。
3. **本機切換 view 的規則**：`switchView(name)` 會設定 `hidden` 與 `is-active`；所有 `role="region"` 的 section 都要有 `aria-label`。
4. **有資料要存**：用 `localStorage`，key 加 `pocket-play-` 前綴，讀取一定要 try/catch（使用者可能清了資料或私隱模式）。
5. **涉及連線**：只用 PeerJS（`vendor/peerjs.min.js`），房間 ID 由 `makeClientId` 產生；不要新增輪詢或後端。
6. **改完**：`npm run check && npm run build`，再用手機實測「第一次載入／斷網重開／加入房間」三件事。

## 4. 部署注意

- Vercel：`framework: null`、`outputDirectory: public`、`installCommand: null`（沒有依賴要裝）。
- 安全標頭集中在 `vercel.json`：CSP `script-src 'self'`、`frame-ancestors 'none'`、`nosniff`、`Referrer-Policy`、`Permissions-Policy`。
- Web Analytics 用 `<head>` 的 `/_vercel/insights/script.js`，**不要**再引入 npm 套件。
- 若專案開了 **Deployment Protection**，朋友掃 QR 會登入不到 → 多人連線前必須關閉。
- `og:image` 部署後要改成絕對網址，分享才有預覽圖。

## 5. 交付前 checklist

```
[ ] npm run check 全 PASS
[ ] npm run build 成功、public/ 大小 < 5 MB
[ ] 手機實測：首頁四格 → 任一遊戲 → 說明書 → 返回
[ ] 斷網重開仍可玩（Service Worker 生效）
[ ] 多人房間：房主建 QR、另一部機加入、同步一次
[ ] 改過版號（四處）＋ CHANGELOG 有一行
[ ] 改過 UI 就在 390／768／1440 闊度各看一次
```

## 6. 檔案地圖

```
index.html   所有畫面（10 個遊戲／工具）＋ meta／圖標／結構化資料
styles.css   全部樣式（含 dark、focus-visible、prefers-reduced-motion、手機 390 優化）
app.js       全部邏輯（IIFE、傳統 script）
sw.js        Service Worker（導覽 network-first、靜態 stale-while-revalidate）
icons/       favicon.ico／16／32／apple-touch／192／512／maskable ×2／og-image
tools/       verify（自檢）／serve（本機）／build-static（整理 public）／make-icons
vendor/      QRCode、PeerJS
```
