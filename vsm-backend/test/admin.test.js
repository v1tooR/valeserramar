import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import sharp from "sharp";
import { createApp } from "../src/app.js";
import { migrate } from "../src/db.js";
import { hash, passwordHash } from "../src/security.js";

test("Painel web: sessão, revisão com histórico, publicação e consultas de suporte", async (t) => {
  const temp = await mkdtemp(join(tmpdir(), "vsm-admin-"));
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  const postgres = new EmbeddedPostgres({
    databaseDir: join(temp, "pg"), port, user: "postgres", password: "local-admin-fixture",
    persistent: false, initdbFlags: ["--encoding=UTF8"],
    postgresFlags: ["-c", "unix_socket_directories="], onLog: () => {},
  });
  let db, app, withoutAdmin, started;
  const clientClosures = [];
  try {
    await postgres.initialise();
    await postgres.start();
    started = true;
    db = new pg.Pool({
      host: "127.0.0.1", port, user: "postgres", password: "local-admin-fixture",
    });
    db.on("connect", client =>
      clientClosures.push(new Promise(resolve => client.once("end", resolve))));
    await migrate(db);
    const origin = "https://api.example.test";
    const email = "admin@example.test";
    const password = "senha-admin-de-teste";
    const admin = { email, passwordHash: await passwordHash(password), accountsFile: "" };
    const options = { db, origin, mediaDir: join(temp, "media") };
    withoutAdmin = await createApp(options);
    assert.equal((await withoutAdmin.inject("/admin")).statusCode, 404);
    app = await createApp({ ...options, admin });

    const send = (method, url, payload, headers = {}) =>
      app.inject({ method, url, payload, headers });
    const form = (url, fields, headers = {}) => send(
      "POST", url, new URLSearchParams(fields).toString(),
      { origin, "content-type": "application/x-www-form-urlencoded", ...headers },
    );
    const get = (path, cookie) => send("GET", path, undefined, { cookie });
    const login = await app.inject("/admin/entrar");
    assert.equal(login.statusCode, 200);
    assert.equal(login.headers["cache-control"], "no-store");
    assert.equal(login.headers["referrer-policy"], "same-origin");
    assert.match(login.headers["content-security-policy"], /frame-ancestors 'none'/);
    assert.match(login.body, /Entrar no painel/);
    assert.equal((await app.inject("/admin/assets/marca.png")).headers["content-type"], "image/png");
    assert.equal((await app.inject("/admin")).headers.location, "/admin/entrar");
    assert.equal((await form("/admin/entrar", { email, password }, { origin: "https://other.example.test" })).statusCode, 403);
    assert.equal((await form("/admin/entrar", { email, password: "senha-incorreta" })).statusCode, 401);
    const signedIn = await form("/admin/entrar", { email, password });
    assert.equal(signedIn.statusCode, 303, signedIn.body);
    const header = signedIn.headers["set-cookie"];
    assert.match(header, /^__Secure-vsm-admin=[A-Za-z0-9_-]{43}; Path=\/admin; Max-Age=28800; HttpOnly; SameSite=Strict; Secure$/);
    const cookie = header.split(";")[0];
    const adminToken = cookie.split("=")[1];
    assert.equal((await db.query("SELECT token_hash FROM vsm.admin_sessions")).rows[0].token_hash, hash(adminToken));
    assert.equal((await send("GET", "/me", undefined, { authorization: "Bearer " + adminToken })).statusCode, 401);
    const overview = await get("/admin", cookie);
    assert.equal(overview.statusCode, 200, overview.body);
    assert.match(overview.body, /Nenhum estabelecimento aguardando análise/);

    const staffEmail = "revisao@example.test";
    const staffPassword = "senha-revisao-de-teste";
    const accountsFile = join(temp, "admin-contas.json");
    await writeFile(accountsFile, JSON.stringify([
      { email: staffEmail, passwordHash: await passwordHash(staffPassword) },
    ]));
    await app.close();
    const team = { ...options, admin: { ...admin, accountsFile } };
    app = await createApp(team);
    assert.equal((await get("/admin", cookie)).statusCode, 200);
    assert.equal((await form("/admin/entrar", { email: staffEmail, password })).statusCode, 401);
    const staffLogin = await form("/admin/entrar", { email: staffEmail, password: staffPassword });
    assert.equal(staffLogin.statusCode, 303, staffLogin.body);
    const staffCookie = staffLogin.headers["set-cookie"].split(";")[0];
    const staffOverview = await get("/admin", staffCookie);
    assert.equal(staffOverview.statusCode, 200);
    assert.ok(staffOverview.body.includes(staffEmail));

    const owner = { name: "Anunciante do Vale", email: "dono@example.test", phone: "12999999999", password: "dono-local-1234" };
    const registered = await send("POST", "/auth/register", owner);
    assert.equal(registered.statusCode, 201);
    const client = { authorization: "Bearer " + registered.json().token };
    assert.equal((await send("GET", "/admin/estabelecimentos", undefined, client)).statusCode, 303);
    const business = {
      name: "Café <Do Vale> & Cia", segment: "Cafeterias", region: "Vale do Paraíba",
      city: "Caçapava", district: "Centro", description: "Cafeteria de teste",
      address: "Rua do Vale", cep: "12280000", number: "1", phone: owner.phone,
      instagram: "", latitude: null, longitude: null, photo: "", gallery: [],
      hours: Array.from({ length: 7 }, (_, i) => ({ day: String(i), open: true, from: "10:00", to: "22:00" })),
      acceptsReservations: true, amenities: [], rooms: [], checkIn: "", checkOut: "",
    };
    async function submit(data) {
      const created = await send("POST", "/businesses", data, client);
      assert.equal(created.statusCode, 201, created.body);
      const id = created.json().id;
      const pending = await send("POST", "/businesses/" + id + "/submit", {}, client);
      assert.equal(pending.statusCode, 200, pending.body);
      return id;
    }
    const id = await submit(business);
    const other = await submit({ ...business, name: "Segundo cadastro" });
    assert.equal((await app.inject("/catalog")).json().businesses.length, 0);
    const listing = await get("/admin/estabelecimentos?q=café&status=Em%20análise&segment=Cafeterias", cookie);
    assert.equal(listing.statusCode, 200, listing.body);
    assert.match(listing.body, /Café &lt;Do Vale&gt; &amp; Cia/);
    assert.doesNotMatch(listing.body, /Segundo cadastro|Café <Do Vale>/);
    const page = "/admin/estabelecimentos/" + id;
    const extract = (body, key) => body.match(new RegExp('name="' + key + '" value="([^"]+)"'))?.[1];
    async function reviewFields(businessId, sessionCookie = cookie) {
      const detail = await get("/admin/estabelecimentos/" + businessId, sessionCookie);
      assert.equal(detail.statusCode, 200, detail.body);
      const csrf = extract(detail.body, "csrf");
      const version = extract(detail.body, "version");
      assert.ok(csrf && version);
      return { csrf, version };
    }
    const fields = await reviewFields(id);
    assert.equal((await form(page + "/revisar", { ...fields, action: "aprovar" }, client)).statusCode, 303);
    assert.equal((await form(page + "/revisar", { ...fields, csrf: "incorreto", action: "aprovar" }, { cookie })).statusCode, 403);
    assert.equal((await form(page + "/revisar", { ...fields, action: "aprovar" }, { cookie, origin: "https://other.example.test" })).statusCode, 403);
    const approve = () => form(page + "/revisar", { ...fields, action: "aprovar" }, { cookie });
    const outcomes = await Promise.all([approve(), approve()]);
    assert.deepEqual(outcomes.map((response) => response.statusCode).sort(), [303, 409]);
    assert.deepEqual((await app.inject("/catalog")).json().businesses.map((b) => b.id), [id]);
    assert.equal((await db.query("SELECT count(*)::int AS total FROM vsm.admin_reviews")).rows[0].total, 1);
    assert.match((await get(page + "?revisao=aprovar", cookie)).body, /aprovado e publicado/);
    const publishHighlight = (id, placement, enabled, headers = { cookie }, csrf = fields.csrf) =>
      form("/admin/estabelecimentos/" + id + "/destaque", {
        csrf, placement, enabled: enabled ? "1" : "0",
      }, headers);
    const missingCover = await publishHighlight(id, "home", true);
    assert.equal(missingCover.statusCode, 409);
    assert.match(missingCover.body, /foto de capa/);

    const revision = await reviewFields(other, staffCookie);
    const reviewPath = "/admin/estabelecimentos/" + other + "/revisar";
    assert.equal((await form(reviewPath, { ...revision, action: "corrigir" }, { cookie: staffCookie })).statusCode, 422);
    const reason = "Confira o telefone informado.";
    assert.equal((await form(reviewPath, { ...revision, action: "corrigir", reason }, { cookie: staffCookie })).statusCode, 303);
    const workspace = await send("GET", "/me/workspace", undefined, client);
    assert.equal(workspace.json().businesses.find((record) => record.id === other).correction, reason);
    assert.equal((await send("POST", "/businesses/" + other + "/submit", {}, client)).statusCode, 200);
    assert.equal((await form(reviewPath, { ...revision, action: "aprovar" }, { cookie: staffCookie })).statusCode, 409);
    assert.equal((await form(reviewPath, { ...await reviewFields(other), action: "recusar" }, { cookie })).statusCode, 303);
    const audit = await get("/admin/atividade", cookie);
    assert.equal(audit.statusCode, 200, audit.body);
    assert.match(audit.body, /admin@example.test/);
    assert.match(audit.body, /Confira o telefone informado/);
    assert.equal((await db.query("SELECT reviewer FROM vsm.admin_reviews WHERE reason=$1", [reason])).rows[0].reviewer, staffEmail);
    assert.match((await get("/admin/anunciantes?q=dono", cookie)).body, /Anunciante do Vale/);

    const visitor = (await send("POST", "/guest-sessions")).json().token;
    const reserve = await send("POST", "/reservations", {
      businessId: id, kind: "mesa", name: "Visitante de teste", phone: owner.phone,
      start: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      end: "", time: "17:00", adults: 2, children: 0, roomId: "", notes: "Próximo da janela",
    }, { "x-guest-token": visitor });
    assert.equal(reserve.statusCode, 201, reserve.body);
    assert.match((await get("/admin/reservas?status=Pendente&business=" + id, cookie)).body, /Visitante de teste/);
    assert.match((await get("/admin/reservas/" + reserve.json().id, cookie)).body, /Próximo da janela/);
    await db.query("INSERT INTO vsm.subscriptions(business_id,status,plan,amount) VALUES($1,'Ativa','Plano teste',59.90)", [id]);
    assert.match((await get("/admin/assinaturas?business=" + id, cookie)).body, /Plano teste/);

    assert.equal((await form(page + "/revisar", { ...await reviewFields(id), action: "desativar" }, { cookie })).statusCode, 303);
    assert.equal((await app.inject("/catalog")).json().businesses.length, 0);

    const signup = "/admin/estabelecimentos/novo";
    const account = (await db.query("SELECT id FROM vsm.accounts WHERE email=$1", [owner.email])).rows[0];
    const accountsPage = await get("/admin/anunciantes", staffCookie);
    assert.ok(accountsPage.body.includes(signup + "?owner=" + account.id));
    const signupPage = await get(signup + "?owner=" + account.id, staffCookie);
    assert.equal(signupPage.statusCode, 200);
    assert.match(signupPage.body, /Cadastrar estabelecimento/);
    assert.match(signupPage.body, /multipart\/form-data/);
    assert.match(signupPage.body, /value="dono@example\.test"/);
    assert.match(signupPage.body, /name="gallery" type="file" multiple/);
    assert.match(signupPage.body, /0 de 20 fotos/);
    const galleryScript = await app.inject("/admin/assets/gallery.js?v=1");
    assert.equal(galleryScript.statusCode, 200);
    assert.match(galleryScript.headers["content-type"], /text\/javascript/);
    const signupKey = extract(signupPage.body, "key");
    const signupCsrf = extract(signupPage.body.slice(signupPage.body.indexOf('class="registration-form')), "csrf");
    assert.ok(signupKey && signupCsrf);
    const signupFields = {
      csrf: signupCsrf, key: signupKey, ownerEmail: owner.email, name: "Café cadastrado pelo painel",
      category: "Doceria", location: "Vale do Paraíba|Caçapava", address: "Rua das Flores",
      phone: owner.phone, description: "Doceria e café <no Vale>.", "open-1": "1", "from-1": "08:00", "to-1": "17:00",
    };
    const samplePng = await sharp({
      create: { width: 1526, height: 1024, channels: 4, background: { r: 40, g: 110, b: 72, alpha: 0.65 } },
    }).png().toBuffer();
    const galleryPng = await sharp({
      create: { width: 4, height: 3, channels: 3, background: "#2a694b" },
    }).png().toBuffer();
    const fullGallery = Array.from({ length: 20 }, () => galleryPng);
    async function multipartSignup(fields = {}, logo = samplePng, withPhotos = true, cover = samplePng, gallery = []) {
      const multipart = new FormData();
      Object.entries({ ...signupFields, ...fields }).forEach(([field, value]) => multipart.append(field, value));
      multipart.append("photo", new Blob(withPhotos && cover ? [cover] : [], { type: "image/png" }), withPhotos && cover ? "capa.png" : "");
      multipart.append("logo", new Blob(withPhotos && logo ? [logo] : [], { type: "image/png" }), withPhotos && logo ? "marca.png" : "");
      gallery.forEach((photo, index) =>
        multipart.append("gallery", new Blob([photo], { type: "image/png" }), "galeria-" + index + ".png"));
      multipart.append("complete", "1");
      const body = new Response(multipart);
      return {
        payload: Buffer.from(await body.arrayBuffer()),
        headers: { origin, cookie: staffCookie, "content-type": body.headers.get("content-type") },
      };
    }
    async function registerFromPanel({ payload, headers }, path = signup) {
      return send("POST", path, payload, headers);
    }
    const signupRequest = await multipartSignup({}, samplePng, true, samplePng, fullGallery);
    assert.equal((await registerFromPanel({ ...signupRequest, headers: { ...signupRequest.headers, cookie: "" } })).statusCode, 303);
    assert.equal((await registerFromPanel({ ...signupRequest,
      headers: { ...signupRequest.headers, origin: "https://other.example.test" } })).statusCode, 403);
    assert.equal((await registerFromPanel(await multipartSignup({ csrf: "inválido" }))).statusCode, 403);
    const badOwner = await registerFromPanel(await multipartSignup({ ownerEmail: "naoexiste@example.test" }));
    assert.equal(badOwner.statusCode, 422);
    assert.match(badOwner.body, /Doceria e café &lt;no Vale&gt;\./);
    const brokenPhoto = await registerFromPanel(await multipartSignup({}, Buffer.from("imagem inválida")));
    assert.equal(brokenPhoto.statusCode, 422);
    const tooManyPhotos = await registerFromPanel(await multipartSignup({}, samplePng, true, samplePng,
      [...fullGallery, galleryPng]));
    assert.equal(tooManyPhotos.statusCode, 422);
    assert.match(tooManyPhotos.body, /A galeria pode ter até 20 fotos/);
    assert.deepEqual(await readdir(options.mediaDir), []);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM vsm.media")).rows[0].count, 0);
    assert.equal((await db.query("SELECT count(*)::int AS count FROM vsm.businesses")).rows[0].count, 2);

    const [createdInPanel, repeated] = await Promise.all([
      registerFromPanel(signupRequest), registerFromPanel(signupRequest),
    ]);
    assert.equal(createdInPanel.statusCode, 303, createdInPanel.body);
    assert.equal(repeated.statusCode, 303, repeated.body);
    assert.equal(repeated.headers.location, createdInPanel.headers.location);
    const createdPath = createdInPanel.headers.location.split("?")[0];
    const createdId = createdPath.split("/").at(-1);
    const createdDetail = await get(createdInPanel.headers.location, staffCookie);
    assert.equal(createdDetail.statusCode, 200);
    assert.match(createdDetail.body, /cadastrado e enviado para análise/);
    assert.match(createdDetail.body, /Cadastrado pelo painel/);
    assert.equal((await app.inject("/catalog")).json().businesses.length, 0);

    const newWorkspace = (await send("GET", "/me/workspace", undefined, client)).json();
    const registeredFromPanel = newWorkspace.businesses.find(b => b.id === createdId);
    assert.equal(registeredFromPanel.status, "Em análise");
    assert.equal(registeredFromPanel.segment, "Cafeterias");
    assert.equal(registeredFromPanel.subcategory, "Doceria");
    assert.equal(registeredFromPanel.gallery.length, 20);
    assert.equal(new Set(registeredFromPanel.gallery).size, 20);
    assert.equal((await readdir(options.mediaDir)).length, 22);
    assert.deepEqual(registeredFromPanel.hours[1], { day: "Segunda", open: true, from: "08:00", to: "17:00" });
    assert.equal((await db.query("SELECT reviewer FROM vsm.admin_reviews WHERE business_id=$1", [createdId])).rows[0].reviewer, staffEmail);
    for (const image of [registeredFromPanel.photo, registeredFromPanel.logo, ...registeredFromPanel.gallery]) {
      const mediaPath = new URL(image).pathname;
      assert.equal((await db.query("SELECT owner_id FROM vsm.media WHERE id=$1", [mediaPath.split("/").at(-1)])).rows[0].owner_id, account.id);
      const savedImage = await app.inject(mediaPath);
      assert.equal(savedImage.statusCode, 200);
      assert.equal(savedImage.headers["content-type"], "image/webp");
      const imageMetadata = await sharp(savedImage.rawPayload).metadata();
      const expected = registeredFromPanel.gallery.includes(image) ? [4, 3, false] : [1526, 1024, true];
      assert.deepEqual([imageMetadata.width, imageMetadata.height, imageMetadata.hasAlpha], expected);
    }
    assert.equal((await publishHighlight(createdId, "home", true)).statusCode, 409);
    assert.equal((await form(createdPath + "/revisar", {
      ...await reviewFields(createdId), action: "aprovar",
    }, { cookie })).statusCode, 303);
    const [published] = (await app.inject("/catalog")).json().businesses;
    assert.equal(published.id, createdId);
    assert.deepEqual(published.gallery, registeredFromPanel.gallery);
    assert.equal(published.highlights, undefined);
    assert.match((await get(createdPath, cookie)).body, /Destaques no app/);
    assert.equal((await publishHighlight(createdId, "home", true, client)).statusCode, 303);
    assert.equal((await publishHighlight(createdId, "home", true, { cookie }, "incorreto")).statusCode, 403);
    assert.equal((await publishHighlight(createdId, "other", true)).statusCode, 422);
    const onHome = await publishHighlight(createdId, "home", true);
    assert.equal(onHome.statusCode, 303, onHome.body);
    assert.match((await get(onHome.headers.location, cookie)).body, /Destaques atualizados no app/);
    assert.equal((await publishHighlight(createdId, "explore", true)).statusCode, 303);
    assert.deepEqual((await app.inject("/catalog")).json().businesses[0].highlights, { home: 1, explore: 1 });
    assert.equal((await publishHighlight(createdId, "home", false)).statusCode, 303);
    assert.deepEqual((await app.inject("/catalog")).json().businesses[0].highlights, { home: null, explore: 1 });
    assert.equal((await publishHighlight(createdId, "home", true)).statusCode, 303);
    const { rows: capacity } = await db.query(`
      INSERT INTO vsm.businesses (id, owner_id, status, data, home_highlight)
      SELECT gen_random_uuid(), $1, 'Aprovado', $2, CASE WHEN slot < 15 THEN slot END
      FROM generate_series(2,16) AS slot
      RETURNING id, home_highlight
    `, [account.id, published]);
    try {
      const contenders = capacity.filter(b => b.home_highlight === null);
      const attempts = await Promise.all(contenders.map(b => publishHighlight(b.id, "home", true)));
      assert.deepEqual(attempts.map(response => response.statusCode).sort(), [303, 409]);
      assert.match(attempts.find(response => response.statusCode === 409).body, /15 vagas/);
      const fullCatalog = (await app.inject("/catalog")).json().businesses;
      assert.equal(fullCatalog.filter(b => b.highlights?.home).length, 15);
      assert.equal(fullCatalog.filter(b => b.highlights?.explore).length, 1);
    } finally {
      await db.query("DELETE FROM vsm.businesses WHERE id=ANY($1::uuid[])", [capacity.map(b => b.id)]);
    }

    const blankSignup = await get(signup, staffCookie);
    const lodge = await registerFromPanel(await multipartSignup({
      key: extract(blankSignup.body, "key"), name: "Pousada nova", category: "Pousadas",
      location: "Serra da Mantiqueira|Monteiro Lobato",
    }, samplePng, false));
    assert.equal(lodge.statusCode, 303, lodge.body);
    const lodgeId = lodge.headers.location.split("?")[0].split("/").at(-1);
    const lodgings = (await send("GET", "/me/workspace", undefined, client)).json().businesses;
    const registeredLodge = lodgings.find(item => item.id === lodgeId);
    assert.equal(registeredLodge.segment, "Hospedagem");
    assert.equal(registeredLodge.lodgingType, "Pousadas");
    assert.equal(registeredLodge.city, "Monteiro Lobato");
    assert.equal(registeredLodge.photo, "");
    assert.equal(registeredLodge.logo, undefined);
    assert.deepEqual(registeredLodge.gallery, []);

    assert.equal((await send("PATCH", "/businesses/" + createdId + "/table-reservations",
      { acceptsReservations: true }, client)).statusCode, 200);
    const newReservation = { ...reserve.json(), businessId: createdId };
    const booked = await send("POST", "/reservations", newReservation, { "x-guest-token": visitor });
    assert.equal(booked.statusCode, 201, booked.body);
    const product = await send("POST", "/businesses/" + createdId + "/products", {
      businessId: createdId, name: "Cappuccino", description: "", category: "Bebidas",
      price: 12, photo: "", available: true, extras: [],
    }, client);
    assert.equal(product.statusCode, 201, product.body);
    await db.query("INSERT INTO vsm.subscriptions(business_id,status,plan,amount) VALUES($1,'Ativa','Plano do café',49.90)", [createdId]);

    const edit = createdPath + "/editar";
    assert.equal((await get(edit, "")).statusCode, 303);
    const editPage = await get(edit, staffCookie);
    assert.equal(editPage.statusCode, 200);
    assert.match(editPage.body, /Editar estabelecimento/);
    assert.match(editPage.body, /Remover logotipo atual/);
    assert.match(editPage.body, /20 de 20 fotos/);
    assert.match(editPage.body, /name="removeGallery-0"/);
    assert.match(editPage.body, /As alterações salvas serão exibidas no catálogo/);
    const editFields = {
      key: extract(editPage.body, "key"), version: extract(editPage.body, "version"),
      name: "Café do Vale atualizado", latitude: "-23,100", longitude: "-45.700", removeLogo: "1",
    };
    const badCoordinates = await registerFromPanel(await multipartSignup({
      ...editFields, longitude: "",
    }, null, false), edit);
    assert.equal(badCoordinates.statusCode, 422);
    assert.match(badCoordinates.body, /latitude e a longitude juntas/);
    assert.match(badCoordinates.body, /Café do Vale atualizado/);
    const newCover = await sharp({
      create: { width: 1640, height: 820, channels: 3, background: "#245740" },
    }).png().toBuffer();
    const noRoom = await registerFromPanel(await multipartSignup(editFields, null, false, null, [galleryPng]), edit);
    assert.equal(noRoom.statusCode, 422);
    assert.match(noRoom.body, /A galeria pode ter até 20 fotos/);
    assert.equal((await readdir(options.mediaDir)).length, 22);
    const editRequest = await multipartSignup({ ...editFields, "removeGallery-0": "1" },
      null, true, newCover, [galleryPng]);
    const [edited, repeatedEdit] = await Promise.all([
      registerFromPanel(editRequest, edit), registerFromPanel(editRequest, edit),
    ]);
    assert.equal(edited.statusCode, 303, edited.body);
    assert.equal(repeatedEdit.headers.location, edited.headers.location);
    assert.match((await get(edited.headers.location, staffCookie)).body, /Alterações salvas/);
    const activeCatalog = (await app.inject("/catalog")).json();
    const editedBusiness = activeCatalog.businesses.find(b => b.id === createdId);
    assert.equal(editedBusiness.name, "Café do Vale atualizado");
    assert.equal(editedBusiness.status, "Aprovado");
    assert.equal(editedBusiness.acceptsReservations, true);
    assert.deepEqual([editedBusiness.latitude, editedBusiness.longitude], [-23.1, -45.7]);
    assert.equal(editedBusiness.logo, undefined);
    assert.notEqual(editedBusiness.photo, registeredFromPanel.photo);
    assert.deepEqual(editedBusiness.highlights, { home: 1, explore: 1 });
    assert.deepEqual(editedBusiness.gallery.slice(0, 19), registeredFromPanel.gallery.slice(1));
    assert.equal(editedBusiness.gallery.length, 20);
    assert.ok(!registeredFromPanel.gallery.includes(editedBusiness.gallery.at(-1)));
    assert.equal((await readdir(options.mediaDir)).length, 24);
    const resizedCover = (await app.inject(new URL(editedBusiness.photo).pathname)).rawPayload;
    const resizedMetadata = await sharp(resizedCover).metadata();
    assert.deepEqual([resizedMetadata.width, resizedMetadata.height], [1600, 800]);
    assert.equal(activeCatalog.products[0].id, product.json().id);
    assert.equal((await registerFromPanel(await multipartSignup({
      ...editFields, key: extract((await get(edit, staffCookie)).body, "key"), name: "Edição desatualizada",
    }, null, false), edit)).statusCode, 409);

    const deletePath = createdPath + "/excluir";
    const confirmPage = await get(deletePath, staffCookie);
    assert.equal(confirmPage.statusCode, 200);
    assert.match(confirmPage.body, /Mover para a lixeira/);
    assert.equal((await app.inject("/catalog")).json().businesses[0].id, createdId);
    const deleteFields = { csrf: signupCsrf, version: extract(confirmPage.body, "version") };
    assert.equal((await form(deletePath, { ...deleteFields, csrf: "incorreto" }, { cookie: staffCookie })).statusCode, 403);
    const removed = await form(deletePath, deleteFields, { cookie: staffCookie });
    assert.equal(removed.statusCode, 303, removed.body);
    assert.match((await get(removed.headers.location, staffCookie)).body, /Café do Vale atualizado/);
    assert.doesNotMatch((await get("/admin/estabelecimentos?q=Café%20do%20Vale%20atualizado", staffCookie)).body,
      /entity-name[^>]*>Café do Vale atualizado/);
    assert.deepEqual((await app.inject("/catalog")).json(), { businesses: [], products: [] });
    assert.deepEqual((await db.query(
      "SELECT home_highlight, explore_highlight FROM vsm.businesses WHERE id=$1", [createdId],
    )).rows[0], { home_highlight: null, explore_highlight: null });
    const afterRemoval = (await send("GET", "/me/workspace", undefined, client)).json();
    assert.ok(!afterRemoval.businesses.some(b => b.id === createdId));
    assert.ok(!afterRemoval.products.some(p => p.businessId === createdId));
    assert.equal((await send("GET", "/businesses/" + createdId + "/subscription", undefined, client)).statusCode, 404);
    assert.equal((await send("POST", "/reservations", newReservation, { "x-guest-token": visitor })).statusCode, 422);
    const guestHistory = (await send("GET", "/reservations", undefined, { "x-guest-token": visitor })).json();
    assert.ok(guestHistory.some(booking => booking.id === booked.json().id));
    const bookingPanel = await get("/admin/reservas/" + booked.json().id, staffCookie);
    assert.match(bookingPanel.body, /Na lixeira/);
    const archivedBilling = await get("/admin/assinaturas?status=Ativa&business=" + createdId, staffCookie);
    assert.match(archivedBilling.body, /Plano do café/);
    assert.match(archivedBilling.body, /Na lixeira/);
    assert.equal((await get(edit, staffCookie)).statusCode, 409);

    const trashed = await get(createdPath, staffCookie);
    assert.match(trashed.body, /Restaurar para análise/);
    const restore = await form(createdPath + "/restaurar", {
      csrf: signupCsrf, version: extract(trashed.body, "version"),
    }, { cookie: staffCookie });
    assert.equal(restore.statusCode, 303, restore.body);
    assert.match((await get(restore.headers.location, staffCookie)).body, /restaurado para análise/);
    assert.equal((await app.inject("/catalog")).json().businesses.length, 0);
    assert.equal((await form(createdPath + "/revisar", {
      ...await reviewFields(createdId), action: "aprovar",
    }, { cookie })).statusCode, 303);
    assert.equal((await app.inject("/catalog")).json().businesses[0].id, createdId);
    const activity = await get("/admin/atividade?q=" + encodeURIComponent(staffEmail), cookie);
    assert.match(activity.body, /Dados editados pelo painel/);
    assert.match(activity.body, /Estabelecimento restaurado para análise/);
    assert.match((await get(page, cookie)).body, /Reativar para análise/);
    assert.equal((await form(page + "/revisar", {
      ...await reviewFields(id), action: "reativar",
    }, { cookie })).statusCode, 303);
    assert.match((await get(page + "?revisao=reativar", cookie)).body, /reenviado para análise/);
    const bySubtype = await get("/admin/estabelecimentos?segment=Doceria", staffCookie);
    assert.match(bySubtype.body, /Café do Vale atualizado/);
    assert.doesNotMatch(bySubtype.body, /Pousada nova/);

    const agencySignup = await get(signup, staffCookie);
    assert.match(agencySignup.body, /<option value="Agência de Publicidade">/);
    assert.match(agencySignup.body, /<option value="Vale do Paraíba\|Paraibuna">Paraibuna<\/option>/);
    assert.match(agencySignup.body, /<option value="Serra da Mantiqueira\|Monteiro Lobato">Monteiro Lobato<\/option>/);
    const agencyFields = {
      key: extract(agencySignup.body, "key"), name: "Agência do Vale",
      category: "Agência de Publicidade", location: "Vale do Paraíba|Paraibuna",
    };
    const agency = await registerFromPanel(await multipartSignup(agencyFields, null, false));
    assert.equal(agency.statusCode, 303, agency.body);
    const agencyPath = agency.headers.location.split("?")[0];
    const agencyId = agencyPath.split("/").at(-1);
    const agencyFilter = await get("/admin/estabelecimentos?" +
      new URLSearchParams({ segment: agencyFields.category }), staffCookie);
    assert.match(agencyFilter.body, /Agência do Vale/);
    assert.doesNotMatch(agencyFilter.body, /Café do Vale atualizado/);
    const agencyEdit = await get(agencyPath + "/editar", staffCookie);
    assert.match(agencyEdit.body, /<option value="Agência de Publicidade" selected>/);
    assert.match(agencyEdit.body, /value="Vale do Paraíba\|Paraibuna" selected/);
    const cityFilter = await get("/admin/estabelecimentos?q=Paraibuna", staffCookie);
    assert.match(cityFilter.body, /Agência do Vale/);
    assert.doesNotMatch(cityFilter.body, /Pousada nova/);
    assert.equal((await form(agencyPath + "/revisar", {
      ...await reviewFields(agencyId), action: "aprovar",
    }, { cookie })).statusCode, 303);
    const publishedAgency = (await app.inject("/catalog")).json().businesses.find(b => b.id === agencyId);
    assert.equal(publishedAgency.serviceType, "Agência de Publicidade");
    assert.equal(publishedAgency.segment, "Serviços");
    assert.equal(publishedAgency.city, "Paraibuna");

    await t.test("Editar, excluir e restaurar um anunciante preserva seus registros e controla o acesso ao app", async () => {
      const accountPath = `/admin/anunciantes/${account.id}`;
      const editPath = accountPath + "/editar";
      const deletePath = accountPath + "/excluir";
      const otherOwner = { ...owner, email: "outro@example.test" };
      const otherLogin = await send("POST", "/auth/register", otherOwner);
      assert.equal(otherLogin.statusCode, 201, otherLogin.body);
      const otherClient = { authorization: "Bearer " + otherLogin.json().token };
      const otherBusiness = await send("POST", "/businesses", { ...business, name: "Cafeteria de outra conta" }, otherClient);
      assert.equal(otherBusiness.statusCode, 201, otherBusiness.body);
      const otherId = otherBusiness.json().id;
      assert.equal((await send("POST", `/businesses/${otherId}/submit`, {}, otherClient)).statusCode, 200);
      assert.equal((await form(`/admin/estabelecimentos/${otherId}/revisar`, {
        ...await reviewFields(otherId), action: "aprovar",
      }, { cookie })).statusCode, 303);

      const list = await get("/admin/anunciantes?q=dono", staffCookie);
      assert.ok(list.body.includes(editPath));
      assert.equal((await get(editPath, "")).headers.location, "/admin/entrar");
      const editPage = await get(editPath, staffCookie);
      assert.equal(editPage.statusCode, 200, editPage.body);
      assert.match(editPage.body, /E-mail de acesso ao app/);
      assert.ok(editPage.body.includes(`value="${owner.email}"`));
      const updated = { name: "Anunciante <Novo>", email: email.toUpperCase(), phone: "(12) 99911-2233" };
      const formFields = { csrf: signupCsrf, version: extract(editPage.body, "version"), ...updated };
      assert.equal((await form(editPath, { ...formFields, csrf: "inválido" }, { cookie: staffCookie })).statusCode, 403);
      assert.equal((await form(editPath, { ...formFields, email: "inválido" }, { cookie: staffCookie })).statusCode, 422);
      const duplicate = await form(editPath, { ...formFields, email: otherOwner.email }, { cookie: staffCookie });
      assert.equal(duplicate.statusCode, 409, duplicate.body);
      assert.match(duplicate.body, /Esse e-mail já pertence a outro anunciante/);
      const saved = await form(editPath, formFields, { cookie: staffCookie });
      assert.equal(saved.statusCode, 303, saved.body);
      const detail = await get(saved.headers.location, staffCookie);
      assert.match(detail.body, /Anunciante &lt;Novo&gt;/);
      assert.match(detail.body, /Dados do anunciante editados/);
      assert.equal((await form(editPath, formFields, { cookie: staffCookie })).statusCode, 409);
      assert.equal((await send("GET", "/me", undefined, client)).statusCode, 401);
      assert.equal((await send("POST", "/auth/login", { email: owner.email, password: owner.password })).statusCode, 401);
      const signIn = () => send("POST", "/auth/login", { email, password: owner.password });
      const newLogin = await signIn();
      assert.equal(newLogin.statusCode, 200, newLogin.body);
      assert.deepEqual(newLogin.json().profile, { ...updated, email });
      const newClient = { authorization: "Bearer " + newLogin.json().token };

      assert.equal((await publishHighlight(createdId, "home", true)).statusCode, 303);
      const confirmation = await get(deletePath, staffCookie);
      assert.match(confirmation.body, /Mover para a lixeira/);
      assert.ok((await app.inject("/catalog")).json().businesses.some(b => b.id === createdId));
      const remove = () => form(deletePath, {
        csrf: signupCsrf, version: extract(confirmation.body, "version"),
      }, { cookie: staffCookie });
      const removals = await Promise.all([remove(), remove()]);
      assert.deepEqual(removals.map(response => response.statusCode).sort(), [303, 409]);
      assert.doesNotMatch((await get("/admin/anunciantes", staffCookie)).body, /Anunciante &lt;Novo&gt;/);
      assert.match((await get("/admin/anunciantes/lixeira?q=Novo", staffCookie)).body, /Anunciante &lt;Novo&gt;/);
      assert.equal((await get(editPath, staffCookie)).statusCode, 409);
      assert.equal((await get("/admin", cookie)).statusCode, 200);
      assert.equal((await signIn()).statusCode, 401);
      assert.equal((await send("GET", "/me/workspace", undefined, newClient)).statusCode, 401);
      assert.deepEqual((await app.inject("/catalog")).json().businesses.map(b => b.id), [otherId]);
      assert.deepEqual((await app.inject("/catalog")).json().products, []);
      assert.match((await get(createdPath, staffCookie)).body, /anunciante está na lixeira/);
      assert.equal((await publishHighlight(createdId, "home", true)).statusCode, 409);
      assert.equal((await form(page + "/revisar", {
        ...await reviewFields(id), action: "aprovar",
      }, { cookie })).statusCode, 409);
      const disabledSignup = await get(signup + "?owner=" + account.id, staffCookie);
      const archivedRegistration = await registerFromPanel(await multipartSignup({
        key: extract(disabledSignup.body, "key"), ownerEmail: email,
      }, null, false));
      assert.equal(archivedRegistration.statusCode, 422);
      assert.match(archivedRegistration.body, /conta de anunciante ativa/);
      assert.equal((await send("POST", "/reservations", newReservation, { "x-guest-token": visitor })).statusCode, 422);
      assert.match((await get(`/admin/reservas/${booked.json().id}`, staffCookie)).body, /Visitante de teste/);
      const remaining = await send("GET", "/reservations", undefined, { "x-guest-token": visitor });
      assert.ok(remaining.json().some(reservation => reservation.id === booked.json().id));

      const archived = await get(accountPath, staffCookie);
      assert.match(archived.body, /Restaurar anunciante/);
      const restored = await form(accountPath + "/restaurar", {
        csrf: signupCsrf, version: extract(archived.body, "version"),
      }, { cookie: staffCookie });
      assert.equal(restored.statusCode, 303, restored.body);
      assert.match((await get(restored.headers.location, staffCookie)).body, /Anunciante restaurado/);
      assert.equal((await send("GET", "/me", undefined, newClient)).statusCode, 401);
      assert.equal((await signIn()).statusCode, 200);
      const restoredCatalog = (await app.inject("/catalog")).json();
      assert.equal(restoredCatalog.businesses.find(b => b.id === createdId).highlights, undefined);
      assert.ok(restoredCatalog.businesses.some(b => b.id === agencyId));
      assert.ok(restoredCatalog.businesses.some(b => b.id === otherId));
      assert.ok(!restoredCatalog.businesses.some(b => b.id === id));
      assert.ok(restoredCatalog.products.some(p => p.id === product.json().id));
    });

    await t.test("A exclusão definitiva da lixeira libera o e-mail e preserva as reservas", async () => {
      const accountPath = `/admin/anunciantes/${account.id}`;
      const purgePath = accountPath + "/excluir-definitivamente";
      const originalLogin = await send("POST", "/auth/login", { email, password: owner.password });
      assert.equal(originalLogin.statusCode, 200);
      const originalToken = originalLogin.json().token;
      const activeVersion = extract((await get(accountPath + "/editar", staffCookie)).body, "version");
      assert.equal((await get(purgePath, staffCookie)).statusCode, 409);
      assert.equal((await form(purgePath, {
        csrf: signupCsrf, version: activeVersion, confirmation: email,
      }, { cookie: staffCookie })).statusCode, 409);

      const removed = await form(accountPath + "/excluir", { csrf: signupCsrf, version: activeVersion }, { cookie: staffCookie });
      assert.equal(removed.statusCode, 303, removed.body);
      assert.ok((await get(removed.headers.location, staffCookie)).body.includes(purgePath));
      const page = await get(purgePath, staffCookie);
      assert.equal(page.statusCode, 200);
      assert.match(page.body, /Digite o e-mail da conta para confirmar/);
      const confirm = { csrf: signupCsrf, version: extract(page.body, "version"), confirmation: email.toUpperCase() };
      assert.equal((await form(purgePath, confirm)).headers.location, "/admin/entrar");
      assert.equal((await form(purgePath, { ...confirm, csrf: "inválido" }, { cookie: staffCookie })).statusCode, 403);
      assert.equal((await form(purgePath, { ...confirm, version: activeVersion }, { cookie: staffCookie })).statusCode, 409);
      assert.equal((await form(purgePath, { ...confirm, confirmation: "outra@example.test" }, { cookie: staffCookie })).statusCode, 422);
      const newAccount = { ...owner, email, password: "outra-senha-de-teste" };
      assert.equal((await send("POST", "/auth/register", newAccount)).statusCode, 409);

      const scope = account.id + ":business";
      await db.query("INSERT INTO vsm.requests (scope,key,hash) VALUES ($1,'teste','teste')", [scope]);
      const purge = () => form(purgePath, confirm, { cookie: staffCookie });
      const outcomes = await Promise.all([purge(), purge()]);
      assert.deepEqual(outcomes.map(response => response.statusCode).sort(), [303, 404]);
      const deleted = outcomes.find(response => response.statusCode === 303);
      assert.match((await get(deleted.headers.location, staffCookie)).body, /e-mail foi liberado para um novo cadastro/);
      assert.equal((await get(accountPath, staffCookie)).statusCode, 404);
      assert.equal((await db.query("SELECT id FROM vsm.accounts WHERE id=$1", [account.id])).rowCount, 0);
      assert.equal((await db.query("SELECT id FROM vsm.admin_advertiser_events WHERE account_id=$1", [account.id])).rowCount, 0);
      assert.equal((await db.query("SELECT token_hash FROM vsm.sessions WHERE account_id=$1", [account.id])).rowCount, 0);
      assert.equal((await db.query("SELECT key FROM vsm.requests WHERE scope=$1", [scope])).rowCount, 0);

      const archived = await get(createdPath, staffCookie);
      assert.equal(archived.statusCode, 200);
      assert.match(archived.body, /arquivado para consulta/);
      assert.doesNotMatch(archived.body, /Restaurar para análise/);
      const record = (await db.query(`SELECT owner_id,status,deleted_at,xmin::text AS version
        FROM vsm.businesses WHERE id=$1`, [createdId])).rows[0];
      assert.equal(record.owner_id, null);
      assert.equal(record.status, "Desativado");
      assert.ok(record.deleted_at);
      const restore = await form(createdPath + "/restaurar", { csrf: signupCsrf, version: record.version }, { cookie: staffCookie });
      assert.equal(restore.statusCode, 409);
      assert.match((await get("/admin/estabelecimentos/lixeira", staffCookie)).body, /Anunciante excluído/);
      assert.match((await get(`/admin/reservas/${booked.json().id}`, staffCookie)).body, /Visitante de teste/);
      const guestHistory = await send("GET", "/reservations", undefined, { "x-guest-token": visitor });
      assert.ok(guestHistory.json().some(reservation => reservation.id === booked.json().id));
      assert.equal((await app.inject(new URL(editedBusiness.photo).pathname)).statusCode, 200);

      const registered = await send("POST", "/auth/register", newAccount);
      assert.equal(registered.statusCode, 201, registered.body);
      assert.deepEqual((await send("GET", "/me/workspace", undefined, {
        authorization: "Bearer " + registered.json().token,
      })).json(), { businesses: [], products: [], reservations: [] });
      assert.equal((await send("GET", "/me", undefined, { authorization: "Bearer " + originalToken })).statusCode, 401);
      const catalog = (await app.inject("/catalog")).json();
      assert.deepEqual(catalog.businesses.map(b => b.name), ["Cafeteria de outra conta"]);
      assert.deepEqual(catalog.products, []);
    });

    await writeFile(accountsFile, "[]");
    await app.close();
    app = await createApp(team);
    assert.equal((await get("/admin", staffCookie)).headers.location, "/admin/entrar");
    assert.equal((await get("/admin", cookie)).statusCode, 200);
    const logout = await form("/admin/sair", { csrf: fields.csrf }, { cookie });
    assert.equal(logout.statusCode, 303);
    assert.match(logout.headers["set-cookie"], /Max-Age=0/);
    assert.equal((await get("/admin", cookie)).statusCode, 303);
  } finally {
    await app?.close();
    await withoutAdmin?.close();
    await db?.end();
    await Promise.all(clientClosures);
    if (started) await postgres.stop();
    await rm(temp, { recursive: true, force: true });
  }
});
