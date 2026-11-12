#!/usr/bin/env bash
# tools/make-icons.sh — 重新產生 icons/ 內 9 個圖標（可選，需要 ImageMagick）
#
# 只有「改品牌色／改圖案」時才需要跑：npm run icons
# 日常建置完全不需要 ImageMagick，public/ 直接複製現成的 icons/。
#
# 設計跟 docs/33 G11 圖標標準：
#   - 全部 PNG／ICO（唔用 SVG），滿版、無白邊、主體居中約 60%。
#   - 5 種顏色以上、純色平塗；16×16 另外手繪，唔靠縮圖。
#   - maskable 版本主體收在中央 66% 安全區。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/icons"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

command -v convert >/dev/null || { echo "✗ 需要 ImageMagick（convert）"; exit 1; }

# 主圖：月亮／星／撲克牌／骰子，深藍夜空底
convert -size 1024x1024 xc:'#0b0c10' \
  -fill '#141c2e' -draw 'circle 512,512 512,60' \
  -fill '#9e7bff' -draw 'circle 812,192 812,86' \
  -fill '#141c2e' -draw 'circle 846,168 846,92' \
  -fill '#ff806f' -draw "translate 256,578 rotate -14 roundrectangle -160,-224 160,224 26,26" \
  -fill none -stroke '#ffd9cf' -strokewidth 9 -draw "translate 256,578 rotate -14 roundrectangle -126,-192 126,192 18,18" \
  -stroke none \
  -fill '#f5f1e2' -draw "polygon 190,96 206,146 256,162 206,178 190,228 174,178 124,162 174,146" \
  -fill '#d8ff5f' -draw "translate 512,524 rotate 8 roundrectangle -292,-292 292,292 66,66" \
  -fill '#0b0c10' -draw "translate 512,524 rotate 8 circle -152,-152 -152,-104 circle 152,152 152,200 circle 152,-152 152,-104 circle -152,152 -152,200 circle 0,0 0,48" \
  "$WORK/base.png"

# maskable：同一構圖縮到 80%（主體留在中央 66% 安全區）
convert -size 1024x1024 xc:'#0b0c10' \
  -fill '#141c2e' -draw 'circle 512,512 512,150' \
  -fill '#9e7bff' -draw 'circle 752,256 752,171' \
  -fill '#141c2e' -draw 'circle 779,237 779,175' \
  -fill '#ff806f' -draw "translate 307,565 rotate -14 roundrectangle -128,-179 128,179 21,21" \
  -fill none -stroke '#ffd9cf' -strokewidth 7 -draw "translate 307,565 rotate -14 roundrectangle -101,-154 101,154 14,14" \
  -stroke none \
  -fill '#f5f1e2' -draw "polygon 254,179 267,219 307,232 267,245 254,285 241,245 201,232 241,219" \
  -fill '#d8ff5f' -draw "translate 512,522 rotate 8 roundrectangle -234,-234 234,234 53,53" \
  -fill '#0b0c10' -draw "translate 512,522 rotate 8 circle -122,-122 -122,-83 circle 122,122 122,161 circle 122,-122 122,-83 circle -122,122 -122,161 circle 0,0 0,38" \
  "$WORK/mask.png"

convert "$WORK/base.png" -resize 512x512 -dither FloydSteinberg -colors 64 -strip PNG8:"$OUT/icon-512.png"
convert "$WORK/base.png" -resize 192x192 -dither FloydSteinberg -colors 32 -strip PNG8:"$OUT/icon-192.png"
convert "$WORK/mask.png" -resize 512x512 -dither FloydSteinberg -colors 64 -strip PNG8:"$OUT/icon-maskable-512.png"
convert "$WORK/mask.png" -resize 192x192 -dither FloydSteinberg -colors 32 -strip PNG8:"$OUT/icon-maskable-192.png"
convert "$WORK/base.png" -resize 180x180 -dither FloydSteinberg -colors 32 -strip PNG8:"$OUT/apple-touch-icon.png"
convert "$WORK/base.png" -resize 32x32 -dither FloydSteinberg -colors 24 -strip PNG8:"$OUT/favicon-32.png"
convert "$WORK/base.png" -resize 48x48 -dither FloydSteinberg -colors 32 -strip PNG8:"$WORK/favicon-48.png"

# 16×16 手繪：只保留「深底＋青檸骰子＋四點」，縮到分頁都認得出
convert -size 16x16 xc:'#0b0c10' \
  -fill '#d8ff5f' -draw 'roundrectangle 1,1 14,14 3,3' \
  -fill '#0b0c10' -draw 'circle 5,6 5,7.6 circle 10.5,6 10.5,7.6 circle 5,10.5 5,12.1 circle 10.5,10.5 10.5,12.1' \
  -strip PNG8:"$OUT/favicon-16.png"

# ICO 由 16／32／48 三個 PNG 合成
convert "$OUT/favicon-16.png" "$OUT/favicon-32.png" "$WORK/favicon-48.png" "$OUT/favicon.ico"

# 1200×630 分享預覽圖
convert "$WORK/base.png" -resize 540x540 "$WORK/og-die.png"
convert -size 1200x630 xc:'#0b0c10' \
  "$WORK/og-die.png" -geometry +40+45 -gravity northwest -composite \
  -font DejaVu-Sans-Bold -fill '#d8ff5f' -pointsize 62 -annotate +650+150 'POCKET PLAY' \
  -font DejaVu-Sans -fill '#f5f1e2' -pointsize 31 -annotate +652+255 'Offline party games' \
  -annotate +652+302 '& pocket tools' \
  -fill '#ff806f' -draw 'rectangle 652,370 1032,374' \
  -font DejaVu-Sans -fill '#9e7bff' -pointsize 25 -annotate +652+412 'DICE  ·  CARDS  ·  SECRET ROLES' \
  -font DejaVu-Sans-Bold -fill '#8f97a8' -pointsize 21 -annotate +652+480 'NO SIGNAL? NO PROBLEM.' \
  -dither FloydSteinberg -colors 96 -strip PNG8:"$OUT/og-image.png"

echo "✓ icons/ 已更新（9 個檔案）"
