# Backend — 待填入

負責實作 Smart Dining 的 REST API + Socket.IO 服務,使用 Node.js + TypeScript + Fastify + Prisma + SQLite。

主要職責:
- REST 端點(見 `/shared-contracts/src/api/endpoints.ts`)
- Socket.IO `/tracking` namespace(見 `/shared-contracts/src/realtime/events.ts`)
- JWT 認證 + bcrypt
- Prisma 資料存取(沿用 `/shared-contracts/prisma/schema.prisma`)

啟動(待補):
```bash
npm run dev
```
