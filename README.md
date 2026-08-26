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
pnpm --filter @pixel-valley/web dev
```

浏览器打开 Vite 提示的本地地址（默认 `http://localhost:5173`）。

`/api` 与 `/ws` 由 Vite **同源反代**到 `http://localhost:8787`（Hono 默认端口），保证 Cookie `pv_session` 为 same-site。不要让浏览器直连 API 的另一 origin。

## 测试

```bash
pnpm test
```

## 类型检查

```bash
pnpm typecheck
```
