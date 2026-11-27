import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { deleteOwnAccount } from "./account-deletion.js";
import { maxImageBytes, saveWebp } from "./media.js";
import { adminRoutes } from "./admin/routes.js";
import { row, transaction } from "./db.js";
import { bookingRoutes } from "./bookings.js";
import { catalogRoutes, requireId } from "./catalog.js";
import { credentials, registration, profileInput } from "./schemas.js";
import {
  checkPassword,
  fail,
  issueSession,
  parse,
  passwordHash,
  session,
} from "./security.js";

const limit = (max) => ({
  config: { rateLimit: { max, timeWindow: "1 minute" } },
});
const publicProfile = "name,email,phone";

export async function createApp({
  db,
  origin,
  mediaDir,
  webOrigins = [],
  logger = false,
  trustProxy = false,
  admin,
}) {
  const app = Fastify({
    logger,
    trustProxy,
    bodyLimit: 256 * 1024,
    requestTimeout: 30000,
  });
  await app.register(cors, {
    origin: webOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: [
      "Authorization",
      "X-Guest-Token",
      "Idempotency-Key",
      "Content-Type",
      "Accept",
    ],
  });
  await app.register(rateLimit, { max: 240, timeWindow: "1 minute" });
  await app.register(multipart, {
    limits: { fileSize: maxImageBytes, files: 1, fields: 0, parts: 2 },
  });
  await mkdir(mediaDir, { recursive: true });
  app.setErrorHandler((error, req, reply) => {
    const status =
      error.code === "23505"
        ? 409
        : error.statusCode && error.statusCode < 500
          ? error.statusCode
          : 500;
    if (status === 500)
      req.log.error(
        { code: error.code, kind: error.name },
        "Falha ao processar requisição",
      );
    const message =
      status === 500
        ? "Serviço indisponível."
        : status === 409
          ? "Os dados entram em conflito com um registro existente."
          : error.message;
    return reply.code(status).send({ message });
  });
  app.get("/health", async () => {
    await db.query("SELECT 1 FROM vsm.accounts LIMIT 1");
    return { status: "ok" };
  });
  app.post("/auth/register", limit(8), async (req, reply) => {
    const data = parse(registration, req.body);
    const secret = await passwordHash(data.password);
    const result = await transaction(db, async (client) => {
      const id = randomUUID();
      const profile = await row(
        client,
        "INSERT INTO vsm.accounts(id,email,name,phone,password_hash) VALUES($1,$2,$3,$4,$5) RETURNING " +
          publicProfile,
        [id, data.email, data.name, data.phone, secret],
      );
      return { profile, token: await issueSession(client, id) };
    });
    return reply.code(201).send(result);
  });
  app.post("/auth/login", limit(8), async (req) => {
    const { email, password } = parse(credentials, req.body);
    const account = await row(db,
      "SELECT id,password_hash FROM vsm.accounts WHERE email=$1 AND deleted_at IS NULL", [email]);
    const valid = await checkPassword(password, account?.password_hash);
    if (!account || !valid) fail(401, "E-mail ou senha inválidos.");
    return transaction(db, async (client) => {
      const current = await row(client,
        `SELECT ${publicProfile} FROM vsm.accounts
         WHERE id=$1 AND email=$2 AND password_hash=$3 AND deleted_at IS NULL FOR SHARE`,
        [account.id, email, account.password_hash]);
      if (!current) fail(401, "E-mail ou senha inválidos.");
      return { profile: current, token: await issueSession(client, account.id) };
    });
  });
  app.post("/auth/logout", async (req, reply) => {
    const { digest } = await session(db, req);
    await db.query("DELETE FROM vsm.sessions WHERE token_hash=$1", [digest]);
    return reply.code(204).send();
  });
  app.post("/guest-sessions", limit(15), async (req, reply) =>
    reply.code(201).send({ token: await issueSession(db, null) }),
  );
  app.get("/me", async (req) => {
    const { accountId } = await session(db, req);
    const profile = await row(
      db,
      "SELECT " + publicProfile + " FROM vsm.accounts WHERE id=$1 AND deleted_at IS NULL",
      [accountId],
    );
    if (!profile) fail(401, "Sessão inválida ou expirada.");
    return profile;
  });
  app.patch("/me", async (req) => {
    return transaction(db, async (client) => {
      const { accountId, digest } = await session(client, req);
      const { name, email, phone } = parse(profileInput, req.body);
      await client.query("SELECT id FROM vsm.accounts WHERE id=$1 FOR NO KEY UPDATE", [accountId]);
      const profile = await row(client, `UPDATE vsm.accounts SET name=$2,email=$3,phone=$4
        WHERE id=$1 AND deleted_at IS NULL AND EXISTS (
          SELECT 1 FROM vsm.sessions WHERE token_hash=$5 AND expires_at>now()
        ) RETURNING ${publicProfile}`, [accountId, name, email, phone, digest]);
      if (!profile) fail(401, "Sessão inválida ou expirada.");
      return profile;
    });
  });
  app.delete("/me", limit(5), async (req, reply) => {
    const media = await deleteOwnAccount(db, req);
    for (const { id } of media) {
      try {
        await unlink(join(mediaDir, id + ".webp"));
      } catch (error) {
        if (error.code !== "ENOENT")
          req.log.warn({ code: error.code }, "Falha ao limpar mídia de conta excluída");
      }
    }
    return reply.code(204).send();
  });
  app.post("/media", limit(30), async (req, reply) => {
    const { accountId } = await session(db, req);
    if (!req.isMultipart()) fail(422, "Envie uma imagem.");
    const file = await req.file();
    if (!file || file.fieldname !== "file") fail(422, "Envie uma imagem.");
    const input = await file.toBuffer();
    const id = randomUUID();
    const path = join(mediaDir, id + ".webp");
    await saveWebp(input, path);
    try {
      await db.query("INSERT INTO vsm.media(id,owner_id) VALUES($1,$2)", [
        id,
        accountId,
      ]);
    } catch (error) {
      await unlink(path).catch(() => {});
      throw error;
    }
    return reply.code(201).send({ url: origin + "/media/" + id });
  });
  app.get("/media/:id", async (req, reply) => {
    const media = await row(db, "SELECT id FROM vsm.media WHERE id=$1", [
      requireId(req.params.id),
    ]);
    if (!media) fail(404, "Imagem não encontrada.");
    return reply
      .type("image/webp")
      .header("X-Content-Type-Options", "nosniff")
      .header("Cache-Control", "public, max-age=86400")
      .send(createReadStream(join(mediaDir, media.id + ".webp")));
  });
  catalogRoutes(app, db, origin);
  bookingRoutes(app, db);
  if (admin?.email || admin?.passwordHash)
    await app.register(adminRoutes, { prefix: "/admin", logLevel: "warn", db, origin, mediaDir, admin });
  return app;
}
