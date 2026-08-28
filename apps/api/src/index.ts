import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";

const port = Number(process.env.PORT ?? 8787);
const app = createApp();
const mode = process.env.DATABASE_URL ? "postgres" : "memory";

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`像素谷 API http://localhost:${info.port} (${mode})`);
});
