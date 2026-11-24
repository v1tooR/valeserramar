import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { requireId, uuid } from "../catalog.js";
import { row } from "../db.js";
import { reviewBusiness, reviewStates, setBusinessInTrash } from "../moderation.js";
import { profileInput } from "../schemas.js";
import { checkPassword, fail, hash } from "../security.js";
import { deleteAdvertiserPermanently, editAdvertiser, setAdvertiserInTrash } from "./advertisers.js";
import * as data from "./data.js";
import { createBusiness, editBusiness, registrationPhotos, weekdays } from "./registration.js";
import * as view from "./views.js";

const lifetime = 8 * 60 * 60;
const secretFormat = /^[a-f0-9]{32}:[a-f0-9]{128}$/;
const tokenFormat = /^[A-Za-z0-9_-]{43}$/;
const formLimit = 32 * 1024;
const html = (reply, markup) => reply.type("text/html; charset=utf-8").send(markup);
const accountTag = ({ email, passwordHash }) => hash(email + "\0" + passwordHash);

function validAccount(account) {
  return typeof account?.email === "string" &&
    account.email.length <= 120 && /^\S+@\S+\.\S+$/.test(account.email) &&
    typeof account.passwordHash === "string" && secretFormat.test(account.passwordHash);
}

async function readAccounts(primary, file) {
  const extra = JSON.parse(await readFile(file, "utf8"));
  if (!Array.isArray(extra)) throw new Error("Lista de administradores inválida.");
  const accounts = new Map([[primary.email, primary]]);
  for (const account of extra) {
    if (!validAccount(account) || account.email !== account.email.toLowerCase() || accounts.has(account.email))
      throw new Error("Conta de administrador inválida ou duplicada.");
    accounts.set(account.email, account);
  }
  return accounts;
}

function readCookie(headers, name) {
  for (const part of (headers.cookie || "").split(";")) {
    const [key, value] = part.trim().split("=", 2);
    if (key === name && tokenFormat.test(value ?? "")) return value;
  }
  return null;
}

export async function adminRoutes(app, { db, origin, mediaDir, admin }) {
  const url = new URL(origin);
  const https = url.protocol === "https:";
  if (
    !validAccount(admin) ||
    (!https && (url.protocol !== "http:" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)))
  ) {
    app.log.warn("Painel administrativo indisponível. Confira ADMIN_EMAIL, ADMIN_PASSWORD_HASH e PUBLIC_URL.");
    return;
  }
  const name = https ? "__Secure-vsm-admin" : "vsm-admin";
  let accounts = new Map([[admin.email, admin]]);
  const accountsFile = admin.accountsFile ?? process.env.ADMIN_ACCOUNTS_FILE;
  if (accountsFile) {
    try {
      accounts = await readAccounts(admin, accountsFile);
    } catch {
      app.log.warn("Confira a configuração das contas adicionais do painel.");
    }
  }
  const emailByTag = new Map(Array.from(accounts.values(), (account) => [accountTag(account), account.email]));

  function cookie(value, maxAge = lifetime) {
    return `${name}=${value}; Path=/admin; Max-Age=${maxAge}; HttpOnly; SameSite=Strict` +
      (https ? "; Secure" : "");
  }
  function sameOrigin(request) {
    if (request.headers.origin !== url.origin)
      fail(403, "Abra o painel pelo endereço oficial e tente novamente.");
  }

  app.decorateRequest("adminSession", null);
  app.addHook("onRequest", async (_request, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "same-origin")
      .header("X-Frame-Options", "DENY")
      .header("Content-Security-Policy",
        "default-src 'none'; style-src 'self'; img-src 'self'; script-src 'self'; " +
        "base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  });
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string", bodyLimit: formLimit },
    (_request, body, done) => done(null, Object.fromEntries(new URLSearchParams(body))),
  );
  app.setErrorHandler((error, request, reply) => {
    const code = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    if (code === 500)
      request.log.error({ code: error.code, kind: error.name }, "Falha no painel administrativo");
    const message = code === 500 ? "O painel está indisponível. Tente novamente." :
      code === 429 ? "Muitas tentativas. Aguarde um minuto e tente novamente." : error.message;
    return html(reply.code(code), view.errorPage(message, request.adminSession));
  });

  const assets = [
    ["panel.css", "text/css; charset=utf-8"],
    ["gallery.js", "text/javascript; charset=utf-8"],
    ["marca.png", "image/png"],
  ];
  for (const [file, type] of assets) {
    const contents = await readFile(new URL("./" + file, import.meta.url));
    const caching = file === "marca.png" ? "public, max-age=3600" : "no-cache";
    app.get("/assets/" + file, async (_request, reply) =>
      reply.type(type).header("Cache-Control", caching).send(contents),
    );
  }
  app.get("/entrar", async (_request, reply) => html(reply, view.login()));
  app.post("/entrar", {
    bodyLimit: 8192,
    config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    sameOrigin(request);
    const email = data.filterText(request.body?.email).toLowerCase();
    const account = accounts.get(email);
    const password = request.body?.password;
    const valid = typeof password === "string" && password.length <= 256 &&
      await checkPassword(password, account?.passwordHash);
    if (!valid || !account)
      return html(reply.code(401), view.login("E-mail ou senha inválidos.", email));

    const token = randomBytes(32).toString("base64url");
    await db.query("DELETE FROM vsm.admin_sessions WHERE expires_at<=now()");
    await db.query(
      "INSERT INTO vsm.admin_sessions(token_hash,credential_tag,expires_at) VALUES($1,$2,$3)",
      [hash(token), accountTag(account), new Date(Date.now() + lifetime * 1000)],
    );
    return reply.header("Set-Cookie", cookie(token)).redirect("/admin", 303);
  });

  await app.register(async (panel) => {
    panel.addHook("preHandler", async (request, reply) => {
      const token = readCookie(request.headers, name);
      const digest = token && hash(token);
      const session = digest && await row(db, `SELECT credential_tag FROM vsm.admin_sessions
        WHERE token_hash=$1 AND expires_at>now()`, [digest]);
      const email = emailByTag.get(session?.credential_tag);
      if (!email)
        return reply.redirect("/admin/entrar", 303);

      const csrf = hash("vsm-admin-form:" + token);
      request.adminSession = { email, digest, csrf };
      if (request.method === "POST") {
        sameOrigin(request);
        if (!request.routeOptions.config.registrationForm && request.body?.csrf !== csrf)
          fail(403, "Atualize a página antes de enviar este formulário.");
      }
    });

    panel.get("/", async (request, reply) =>
      html(reply, view.overviewPage(await data.overview(db), request.adminSession, url.origin)));
    panel.get("/estabelecimentos", async (request, reply) =>
      html(reply, view.businessList(await data.businesses(db, request.query), request.adminSession, url.origin)));
    panel.get("/estabelecimentos/lixeira", async (request, reply) =>
      html(reply, view.businessList(await data.businesses(db, request.query, true), request.adminSession, url.origin,
        request.query.excluido === "1")));
    panel.get("/estabelecimentos/novo", async (request, reply) => {
      const owner = request.query.owner;
      const account = typeof owner === "string" && uuid.test(owner) &&
        await row(db, "SELECT email FROM vsm.accounts WHERE id=$1 AND deleted_at IS NULL", [owner]);
      return html(reply, view.registrationPage(request.adminSession, {
        ownerEmail: account?.email, key: randomUUID(),
      }));
    });
    async function editableRecord(id) {
      const business = await data.businessRecord(db, id);
      if (!business) fail(404, "Estabelecimento não encontrado.");
      if (!business.owner_id) fail(409, "Este estabelecimento está arquivado para consulta.");
      if (business.deleted_at) fail(409, "Restaure o estabelecimento da lixeira antes de editar.");
      return business;
    }
    panel.get("/estabelecimentos/:id/editar", async (request, reply) => {
      const business = await editableRecord(requireId(request.params.id));
      const record = business.data;
      const values = {
        ...record, key: randomUUID(), version: business.version,
        category: record.serviceType || record.lodgingType || record.subcategory || record.segment,
        location: record.region + "|" + record.city,
      };
      weekdays.forEach((_, index) => {
        const hour = record.hours?.[index];
        if (hour) {
          values["open-" + index] = hour.open ? "1" : "";
          values["from-" + index] = hour.from;
          values["to-" + index] = hour.to;
        }
      });
      return html(reply, view.registrationPage(request.adminSession, values, { business, origin: url.origin }));
    });
    async function submitBusinessForm(request, reply, id) {
      const values = Object.create(null);
      const staging = await mkdtemp(join(tmpdir(), "vsm-cadastro-"));
      try {
        const photos = await registrationPhotos(request, values, staging);
        const submission = {
          values, photos, mediaDir, origin: url.origin, reviewer: request.adminSession.email,
        };
        const business = id ? await editBusiness(db, submission, id) : await createBusiness(db, submission);
        return reply.redirect(`/admin/estabelecimentos/${business.id}?${id ? "editado" : "cadastro"}=1`, 303);
      } catch (error) {
        if (error.statusCode !== 422 && error.statusCode !== 413) throw error;
        if (!uuid.test(values.key || "")) values.key = randomUUID();
        const business = id ? await editableRecord(id) : undefined;
        return html(reply.code(error.statusCode), view.registrationPage(request.adminSession, values, {
          message: error.message, business, origin: url.origin,
        }));
      } finally {
        await rm(staging, { recursive: true, force: true }).catch(() =>
          request.log.warn("Não foi possível limpar as imagens temporárias do cadastro."));
      }
    }
    const businessForm = { config: { registrationForm: true } };
    panel.post("/estabelecimentos/novo", businessForm, (request, reply) =>
      submitBusinessForm(request, reply));
    panel.post("/estabelecimentos/:id/editar", businessForm, (request, reply) =>
      submitBusinessForm(request, reply, requireId(request.params.id)));
    panel.get("/estabelecimentos/:id", async (request, reply) => {
      const detail = await data.businessDetails(db, requireId(request.params.id));
      if (!detail) fail(404, "Estabelecimento não encontrado.");
      const action = request.query.revisao;
      return html(reply, view.businessPage(detail, request.adminSession, url.origin,
        typeof action === "string" && Object.hasOwn(reviewStates, action) ? action : "",
        {
          created: request.query.cadastro === "1",
          edited: request.query.editado === "1",
          restored: request.query.restaurado === "1",
          highlightSaved: request.query.destaque === "1",
        }));
    });
    panel.post("/estabelecimentos/:id/destaque", { bodyLimit: formLimit }, async (request, reply) => {
      const id = requireId(request.params.id);
      const { placement, enabled } = request.body ?? {};
      if (typeof placement !== "string" || !Object.hasOwn(data.highlightPlacements, placement) ||
          (enabled !== "1" && enabled !== "0"))
        fail(422, "Selecione onde o estabelecimento ficará em destaque.");
      await data.setBusinessHighlight(db, id, placement, enabled === "1");
      return reply.redirect(`/admin/estabelecimentos/${id}?destaque=1`, 303);
    });
    panel.get("/estabelecimentos/:id/excluir", async (request, reply) =>
      html(reply, view.deleteBusinessPage(await editableRecord(requireId(request.params.id)), request.adminSession)));
    async function changeTrash(request, reply, removing) {
      const id = requireId(request.params.id);
      const version = request.body?.version;
      if (typeof version !== "string" || !/^\d{1,10}$/.test(version))
        fail(422, "Atualize a página antes de confirmar.");
      const updated = await setBusinessInTrash(db, { id, version, removing, reviewer: request.adminSession.email });
      if (!updated) fail(409, "O cadastro mudou. Abra a página do estabelecimento antes de confirmar.");
      return reply.redirect(removing ? "/admin/estabelecimentos/lixeira?excluido=1" :
        `/admin/estabelecimentos/${id}?restaurado=1`, 303);
    }
    panel.post("/estabelecimentos/:id/excluir", (request, reply) => changeTrash(request, reply, true));
    panel.post("/estabelecimentos/:id/restaurar", (request, reply) => changeTrash(request, reply, false));
    panel.post("/estabelecimentos/:id/revisar", { bodyLimit: formLimit }, async (request, reply) => {
      const id = requireId(request.params.id);
      const { action, version, reason: input } = request.body ?? {};
      const reason = typeof input === "string" ? input.trim() : "";
      if (
        typeof action !== "string" || !Object.hasOwn(reviewStates, action) ||
        typeof version !== "string" || !/^\d{1,10}$/.test(version) ||
        reason.length > 2000 || (action === "corrigir" && !reason)
      )
        fail(422, "Confira a decisão e o motivo informados.");

      const updated = await reviewBusiness(db, {
        id, action, version, reason, reviewer: request.adminSession.email,
      });
      if (!updated) fail(409, "O cadastro mudou enquanto você analisava. Abra novamente antes de decidir.");
      return reply.redirect(`/admin/estabelecimentos/${id}?revisao=${action}`, 303);
    });
    panel.get("/anunciantes", async (request, reply) =>
      html(reply, view.accountList(await data.accounts(db, request.query), request.adminSession)));
    panel.get("/anunciantes/lixeira", async (request, reply) =>
      html(reply, view.accountList(await data.accounts(db, request.query, true), request.adminSession,
        request.query)));
    panel.get("/anunciantes/:id", async (request, reply) => {
      const account = await data.advertiserRecord(db, requireId(request.params.id));
      const history = await data.advertiserHistory(db, account.id);
      return html(reply, view.advertiserPage(account, history, request.adminSession, request.query));
    });
    async function activeAdvertiser(id) {
      const account = await data.advertiserRecord(db, id);
      if (account.deleted_at) fail(409, "Restaure o anunciante da lixeira para fazer alterações.");
      return account;
    }
    panel.get("/anunciantes/:id/editar", async (request, reply) => {
      const account = await activeAdvertiser(requireId(request.params.id));
      return html(reply, view.advertiserForm(account, request.adminSession));
    });
    panel.post("/anunciantes/:id/editar", { bodyLimit: formLimit }, async (request, reply) => {
      const id = requireId(request.params.id);
      const values = request.body ?? {};
      const profile = profileInput.safeParse(values);
      if (!profile.success) {
        const account = await activeAdvertiser(id);
        return html(reply.code(422), view.advertiserForm(account, request.adminSession, values,
          "Confira o nome, o e-mail e o telefone."));
      }
      try {
        await editAdvertiser(db, { id, version: values.version, profile: profile.data, reviewer: request.adminSession.email });
      } catch (error) {
        if (error.code !== "23505" || error.constraint !== "accounts_email_key") throw error;
        const account = await activeAdvertiser(id);
        return html(reply.code(409), view.advertiserForm(account, request.adminSession, values,
          "Esse e-mail já pertence a outro anunciante."));
      }
      return reply.redirect(`/admin/anunciantes/${id}?editado=1`, 303);
    });
    panel.get("/anunciantes/:id/excluir", async (request, reply) => {
      const account = await activeAdvertiser(requireId(request.params.id));
      return html(reply, view.deleteAdvertiserPage(account, request.adminSession));
    });
    async function changeAdvertiserTrash(request, reply, removing) {
      const id = requireId(request.params.id);
      await setAdvertiserInTrash(db, {
        id, version: request.body?.version, removing, reviewer: request.adminSession.email,
      });
      return reply.redirect(removing ? "/admin/anunciantes/lixeira?excluido=1" :
        `/admin/anunciantes/${id}?restaurado=1`, 303);
    }
    panel.post("/anunciantes/:id/excluir", (request, reply) => changeAdvertiserTrash(request, reply, true));
    panel.post("/anunciantes/:id/restaurar", (request, reply) => changeAdvertiserTrash(request, reply, false));
    async function archivedAdvertiser(id) {
      const account = await data.advertiserRecord(db, id);
      if (!account.deleted_at) fail(409, "Mova o anunciante para a lixeira antes da exclusão definitiva.");
      return account;
    }
    panel.get("/anunciantes/:id/excluir-definitivamente", async (request, reply) => {
      const account = await archivedAdvertiser(requireId(request.params.id));
      return html(reply, view.purgeAdvertiserPage(account, request.adminSession));
    });
    panel.post("/anunciantes/:id/excluir-definitivamente", async (request, reply) => {
      const id = requireId(request.params.id);
      const { version, confirmation } = request.body ?? {};
      try {
        await deleteAdvertiserPermanently(db, { id, version, confirmation });
      } catch (error) {
        if (error.statusCode !== 422) throw error;
        const account = await archivedAdvertiser(id);
        return html(reply.code(422), view.purgeAdvertiserPage(account, request.adminSession, error.message));
      }
      return reply.redirect("/admin/anunciantes/lixeira?apagado=1", 303);
    });
    panel.get("/reservas", async (request, reply) =>
      html(reply, view.bookingList(await data.bookings(db, request.query), request.adminSession)));
    panel.get("/reservas/:id", async (request, reply) => {
      const booking = await data.bookingDetails(db, requireId(request.params.id));
      if (!booking) fail(404, "Reserva não encontrada.");
      return html(reply, view.bookingPage(booking, request.adminSession));
    });
    panel.get("/assinaturas", async (request, reply) =>
      html(reply, view.subscriptionList(await data.subscriptions(db, request.query), request.adminSession)));
    panel.get("/atividade", async (request, reply) =>
      html(reply, view.activityPage(await data.activities(db, request.query), request.adminSession)));
    panel.post("/sair", async (request, reply) => {
      await db.query("DELETE FROM vsm.admin_sessions WHERE token_hash=$1", [request.adminSession.digest]);
      return reply.header("Set-Cookie", cookie("", 0)).redirect("/admin/entrar", 303);
    });
  });
}
