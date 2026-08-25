# Mobile App — 餐飲點餐快手 PWA

行動優先 PWA 介面(React 18 + Vite + TS + Tailwind),iPhone/Android 可加入主畫面。

主要職責:
- 取餐進度追蹤(預設首頁,輸入 orderNo 或掃 QR)
- 會員專區(個人資訊、優惠券、訂單歷史)
- 即時 WebSocket 更新訂單狀態

## 啟動

```bash
cd /Users/sean/Documents/Agent\ space/smart-dining
npm install
npm run dev --workspace=@smart-dining/mobile
```

預設埠號:`5174`,後端預期:`http://localhost:4000`。
