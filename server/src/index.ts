import { config as loadEnv } from "dotenv";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { uploadRoute } from "./routes/upload";

loadEnv({ path: ".env.local", override: true });
loadEnv();

function resolveCorsOrigins(): string[] {
  const configuredOrigins = process.env.CORS_ORIGINS;

  if (!configuredOrigins) {
    return [
      "http://localhost:3000",
      "http://localhost:3010",
      "http://localhost:3012",
    ];
  }

  return configuredOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: resolveCorsOrigins(),
    allowMethods: ["POST", "OPTIONS"],
  }),
);

app.route("/api", uploadRoute);

const port = Number(process.env.PORT ?? "3001");

serve({
  fetch: app.fetch,
  port,
});

export default app;
