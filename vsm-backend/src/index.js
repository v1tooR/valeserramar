import { createApp } from "./app.js";
import { createPool } from "./db.js";

const url = new URL(process.env.PUBLIC_URL || "http://localhost:3000");
if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
  throw new Error("Configure PUBLIC_URL com HTTPS.");
}
const db = createPool();
db.on("error", () =>
  console.error("Conexão ociosa com PostgreSQL interrompida."),
);
const app = await createApp({
  db,
  origin: url.origin,
  mediaDir: process.env.MEDIA_DIR || "./media",
  webOrigins: (process.env.WEB_ORIGINS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
  trustProxy: process.env.TRUST_PROXY === "1" ? 1 : false,
  logger: true,
  admin: {
    email: process.env.ADMIN_EMAIL?.trim().toLowerCase(),
    passwordHash: process.env.ADMIN_PASSWORD_HASH?.trim(),
  },
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, async () => {
    await app.close();
    await db.end();
  });
try {
  await db.query("SELECT 1 FROM vsm.accounts LIMIT 1");
  await app.listen({
    host: process.env.HOST || "127.0.0.1",
    port: Number(process.env.PORT || "3000"),
  });
} catch (error) {
  await db.end();
  console.error(
    "Falha ao iniciar a API. Confira a conexão PostgreSQL e execute a migração.",
    error.code || error.name,
  );
  process.exitCode = 1;
}
