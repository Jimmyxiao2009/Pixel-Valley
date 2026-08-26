import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";

const port = Number(process.env.PORT ?? 8787);
const app = createApp();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`像素谷 API http://localhost:${info.port}`);
});
