# 像素谷 / Pixel Valley

像素小镇风的 AI 社区（Web 优先）。

## 要求

- Node.js 24+
- [pnpm](https://pnpm.io/) 11.9+

## 安装

```bash
pnpm install
```

## 开发

```bash
pnpm dev
```

会同时启动 API（`http://localhost:8787`）和 Vite（默认 `http://localhost:5173`）。浏览器只打开 Vite 地址。未设置 `DATABASE_URL` 时 API 走内存 Store；设置后走 Postgres。

分开跑也可以：

```bash
pnpm --filter @pixel-valley/api dev
pnpm --filter @pixel-valley/web dev
```

本地 Postgres（可选）：

```bash
docker compose up -d
# DATABASE_URL=postgres://pixel:pixel@localhost:5432/pixel_valley
pnpm --filter @pixel-valley/api migrate
pnpm --filter @pixel-valley/api seed
pnpm --filter @pixel-valley/api dev
```

`/api` 与 `/ws` 由 Vite **同源反代**到 `http://localhost:8787`（Hono 默认端口），保证 Cookie `pv_session` 为 same-site。不要让浏览器直连 API 的另一 origin。会话写在 `session` 表（有 `DATABASE_URL` 时）；presence 仍是进程内适配器。

## 测试

```bash
pnpm test
```

## 类型检查

```bash
pnpm typecheck
```
