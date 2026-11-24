import { readFile } from "node:fs/promises";
import { createApp } from "./app.js";
import { asaasSandboxRoutes } from "./asaas-sandbox.js";
import { createPool, migrate } from "./db.js";

const url = URL.parse(process.env.PUBLIC_URL ?? "");
const apiKey = process.env.ASAAS_SANDBOX_API_KEY?.trim();
const testerEmail = process.env.ASAAS_SANDBOX_TEST_EMAIL?.trim().toLowerCase();
if (!url || url.protocol !== "https:" || url.hostname === "api.valeserraemar.com.br")
  throw new Error("Configure uma URL HTTPS própria para a API de teste.");
if (!apiKey || !testerEmail || process.env.NODE_ENV !== "development")
  throw new Error("Configure a chave do Sandbox, a conta de teste e NODE_ENV=development.");

const db = createPool();
let app;
try {
  await migrate(db);
  await db.query(await readFile(new URL("../sql/004_asaas_sandbox.sql", import.meta.url), "utf8"));
  app = await createApp({
    db, origin: url.origin, mediaDir: process.env.MEDIA_DIR || "./media-sandbox", logger: true,
  });
  await app.register(asaasSandboxRoutes, { db, origin: url.origin, apiKey, testerEmail });
  await app.listen({ host: process.env.HOST || "127.0.0.1", port: Number(process.env.PORT || "3101") });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, async () => {
      await app.close();
      await db.end();
    });
  }
} catch (error) {
  await app?.close();
  await db.end();
  throw error;
}
