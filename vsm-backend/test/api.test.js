import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import sharp from "sharp";
import { createApp } from "../src/app.js";
import { migrate } from "../src/db.js";
import {
  authSchema,
  businessSchema,
  catalogSchema,
  productSchema,
  reservationSchema,
  workspaceSchema,
} from "../src/schemas.js";

test("API com PostgreSQL: contrato, isolamento, aprovação, mídia e reservas", async () => {
  const temp = await mkdtemp(join(tmpdir(), "vsm-api-"));
  const url = "https://api.example.test";
  const port = Number(process.env.TEST_PG_PORT || "55434");
  const postgres = new EmbeddedPostgres({
    databaseDir: join(temp, "pg"),
    port,
    user: "postgres",
    password: "local-test",
    persistent: false,
    initdbFlags: ["--encoding=UTF8"],
    postgresFlags: ["-c", "unix_socket_directories="],
    onLog: () => {},
    onError: console.error,
  });
  let db, app, started;
  const clientClosures = [];
  try {
    await postgres.initialise();
    await postgres.start();
    started = true;
    db = new pg.Pool({
      host: "127.0.0.1",
      port,
      user: "postgres",
      password: "local-test",
    });
    db.on("connect", client =>
      clientClosures.push(new Promise(resolve => client.once("end", resolve))));
    await migrate(db);
    await migrate(db);
    app = await createApp({ db, origin: url, mediaDir: join(temp, "media") });
    async function send(
      method,
      path,
      { body, token, guest, key, status = 200, headers = {} } = {},
    ) {
      const response = await app.inject({
        method,
        url: path,
        payload: body,
        headers: {
          ...(token ? { authorization: "Bearer " + token } : {}),
          ...(guest ? { "x-guest-token": guest } : {}),
          ...(key ? { "idempotency-key": key } : {}),
          ...headers,
        },
      });
      assert.equal(
        response.statusCode,
        status,
        method + " " + path + " " + response.body,
      );
      if (response.headers["content-type"]?.includes("json"))
        return response.json();
      return response;
    }
    assert.deepEqual(await send("GET", "/health"), { status: "ok" });
    assert.deepEqual(catalogSchema.parse(await send("GET", "/catalog")), {
      businesses: [],
      products: [],
    });
    const body = {
      name: "Conta de teste",
      email: "owner@example.test",
      phone: "12999999999",
      password: "teste-seguro-123",
    };
    const { token } = authSchema.parse(
      await send("POST", "/auth/register", { body, status: 201 }),
    );
    const second = authSchema.parse(
      await send("POST", "/auth/register", {
        body: { ...body, email: "other@example.test" },
        status: 201,
      }),
    ).token;
    await send("POST", "/auth/login", {
      body: { email: body.email, password: "senha-incorreta" },
      status: 401,
    });
    const login = authSchema.parse(
      await send("POST", "/auth/login", {
        body: { email: body.email, password: body.password },
      }),
    );
    await send("POST", "/auth/logout", { token: login.token, status: 204 });
    await send("GET", "/me", { token: login.token, status: 401 });
    assert.equal(
      (
        await send("PATCH", "/me", {
          token,
          body: { ...body, name: "Responsável" },
        })
      ).name,
      "Responsável",
    );

    const png = await sharp({
      create: { width: 3, height: 3, channels: 3, background: "#007755" },
    })
      .png()
      .toBuffer();
    const upload = (data) =>
      Buffer.concat([
        Buffer.from(
          '--file123\r\nContent-Disposition: form-data; name="file"; filename="foto.png"\r\nContent-Type: image/png\r\n\r\n',
        ),
        data,
        Buffer.from("\r\n--file123--\r\n"),
      ]);
    const headers = { "content-type": "multipart/form-data; boundary=file123" };
    await send("POST", "/media", {
      token,
      body: upload(Buffer.from("arquivo inválido")),
      headers,
      status: 422,
    });
    const { url: photo } = await send("POST", "/media", {
      token,
      body: upload(png),
      headers,
      status: 201,
    });
    const media = await send("GET", new URL(photo).pathname);
    assert.equal(media.headers["content-type"], "image/webp");
    assert.equal((await sharp(media.rawPayload).metadata()).format, "webp");
    const photos = await Promise.all(Array.from({ length: 21 }, () =>
      send("POST", "/media", { token, body: upload(png), headers, status: 201 })));

    const data = {
      name: "Cadastro de teste",
      segment: "Restaurantes",
      region: "Vale do Paraíba",
      city: "Aparecida",
      district: "Centro",
      description: "Anúncio validado em teste local",
      address: "Rua A",
      cep: "12570000",
      number: "1",
      phone: body.phone,
      instagram: "",
      latitude: null,
      longitude: null,
      photo,
      logo: photos[20].url,
      gallery: photos.slice(0, 20).map(({ url }) => url),
      hours: Array.from({ length: 7 }, (_, i) => ({
        day: String(i),
        open: true,
        from: "10:00",
        to: "22:00",
      })),
      acceptsReservations: true,
      amenities: [],
      rooms: [],
      checkIn: "",
      checkOut: "",
    };
    await send("POST", "/businesses", {
      token,
      body: { ...data, city: "Pindamonhangaba" },
      status: 422,
    });
    await send("POST", "/businesses", {
      token: second,
      body: data,
      status: 422,
    });
    const oversized = { ...data, gallery: [...data.gallery, data.logo] };
    const rejectedGallery = await send("POST", "/businesses", { token, body: oversized, status: 422 });
    assert.match(rejectedGallery.message, /até 20 fotos/);
    const creates = await Promise.all(
      [1, 2].map(() =>
        send("POST", "/businesses", {
          token,
          body: { ...data, status: "Aprovado" },
          key: "draft-1",
          status: 201,
        }),
      ),
    );
    const b = businessSchema.parse(creates[0]);
    assert.equal(b.id, creates[1].id);
    assert.equal(b.status, "Rascunho");
    assert.deepEqual(b.gallery, data.gallery);
    await send("PATCH", "/businesses/" + b.id, { token, body: oversized, status: 422 });
    const previousGallery = [...oversized.gallery, photo];
    await db.query("UPDATE vsm.businesses SET data = jsonb_set(data, '{gallery}', $2::jsonb) WHERE id=$1",
      [b.id, JSON.stringify(previousGallery)]);
    const preserved = await send("PATCH", "/businesses/" + b.id, {
      token, body: { ...data, gallery: previousGallery },
    });
    assert.deepEqual(preserved.gallery, previousGallery);
    await send("PATCH", `/businesses/${b.id}/table-reservations`, {
      token,
      body: { acceptsReservations: false },
      status: 409,
    });
    await send("PATCH", `/businesses/${b.id}`, {
      token,
      body: { ...data, subcategory: "Estética e Beleza" },
      status: 422,
    });
    await send("PATCH", `/businesses/${b.id}`, {
      token,
      body: { ...data, lodgingType: "Hotéis" },
      status: 422,
    });
    const classified = await send("PATCH", `/businesses/${b.id}`, {
      token,
      body: { ...data, subcategory: "Lanchonetes" },
    });
    assert.equal(classified.subcategory, "Lanchonetes");
    const editedByOldApp = await send("PATCH", `/businesses/${b.id}`, {
      token,
      body: data,
    });
    assert.equal(editedByOldApp.subcategory, "Lanchonetes");
    await send("POST", "/businesses", {
      token,
      body: { ...data, name: "Outro" },
      key: "draft-1",
      status: 409,
    });
    await send("PATCH", "/businesses/" + b.id, {
      token: second,
      body: data,
      status: 404,
    });
    assert.equal(
      workspaceSchema.parse(
        await send("GET", "/me/workspace", { token: second }),
      ).businesses.length,
      0,
    );
    assert.equal((await send("GET", "/catalog")).businesses.length, 0);
    const p = productSchema.parse(
      await send("POST", "/businesses/" + b.id + "/products", {
        token,
        status: 201,
        body: {
          businessId: b.id,
          name: "Item de teste",
          description: "",
          category: "Pratos",
          price: 50,
          photo: "",
          available: true,
          extras: [],
        },
      }),
    );
    const offersPath = `/businesses/${b.id}/offers`;
    const singleOffer = { durationHours: 2, products: [{ productId: p.id, priceCents: 3900 }] };
    await send("POST", offersPath, { body: singleOffer, status: 401 });
    await send("POST", offersPath, { token, body: singleOffer, status: 409 });
    const submitted = await send("POST", "/businesses/" + b.id + "/submit", {
      token,
      body: {},
    });
    assert.equal(submitted.status, "Em análise");
    const review = (...args) =>
      promisify(execFile)(process.execPath, ["src/review.js", ...args], {
        env: {
          ...process.env,
          NODE_ENV: "test",
          DATABASE_URL: `postgresql://postgres:local-test@127.0.0.1:${port}/postgres`,
        },
      });
    assert.match((await review("listar")).stdout, new RegExp(b.id));
    await review("aprovar", b.id);
    const catalog = catalogSchema.parse(await send("GET", "/catalog"));
    assert.equal(catalog.businesses[0].owner, false);
    assert.equal(catalog.businesses[0].subcategory, "Lanchonetes");
    assert.equal(catalog.products[0].id, p.id);

    const dessert = await send("POST", `/businesses/${b.id}/products`, {
      token, body: { ...p, name: "Sobremesa", price: 12 }, status: 201,
    });
    const offerBody = {
      durationHours: 2,
      products: [
        ...singleOffer.products,
        { productId: dessert.id, priceCents: 750 },
      ],
    };
    await send("POST", offersPath, { token: second, body: offerBody, status: 404 });
    await send("POST", offersPath, {
      token,
      body: { ...offerBody, durationHours: 0 },
      status: 422,
    });
    await send("POST", offersPath, {
      token,
      body: { ...offerBody, products: [singleOffer.products[0], { productId: dessert.id, priceCents: 1200 }] },
      status: 422,
    });
    assert.ok((await send("GET", "/catalog")).products.every((item) => !item.offer));
    const [published, retry] = await Promise.all([1, 2].map(() =>
      send("POST", offersPath, { token, body: offerBody, key: "offer-1", status: 201 }),
    ));
    assert.deepEqual(retry, published);
    const expiry = published.products[0].offer.expiresAt;
    assert.ok(Date.parse(expiry) - Date.now() > 7190000);
    for (const response of [
      await send("GET", "/catalog"),
      await send("GET", "/me/workspace", { token }),
    ]) {
      const byId = new Map(response.products.map((item) => [item.id, item]));
      assert.equal(byId.get(p.id).price, 50);
      assert.deepEqual(byId.get(p.id).offer, { price: 39, expiresAt: expiry });
      assert.deepEqual(byId.get(dessert.id).offer, { price: 7.5, expiresAt: expiry });
    }

    await send("PATCH", `/businesses/${b.id}/products/${dessert.id}`, {
      token, body: { ...dessert, available: false },
    });
    await send("POST", offersPath, { token, body: offerBody, status: 422 });
    await send("DELETE", `/businesses/${b.id}/products/${dessert.id}`, {
      token, status: 204,
    });
    assert.equal((await db.query("SELECT * FROM vsm.product_offers WHERE product_id=$1", [dessert.id])).rowCount, 0);
    await db.query("UPDATE vsm.product_offers SET expires_at=now()-interval '1 second' WHERE product_id=$1", [p.id]);
    const [expired] = (await send("GET", "/catalog")).products;
    assert.equal(expired.price, 50);
    assert.equal(expired.offer, undefined);

    const guest = (await send("POST", "/guest-sessions", { status: 201 }))
      .token;
    const otherGuest = (await send("POST", "/guest-sessions", { status: 201 }))
      .token;
    const booking = {
      businessId: b.id,
      kind: "mesa",
      name: "Visitante de teste",
      phone: body.phone,
      start: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      end: "",
      time: "18:00",
      adults: 2,
      children: 0,
      roomId: "",
      notes: "",
    };
    const tableReservationsPath = `/businesses/${b.id}/table-reservations`;
    await send("PATCH", tableReservationsPath, {
      token: second,
      body: { acceptsReservations: false },
      status: 404,
    });
    const disabled = await send("PATCH", tableReservationsPath, {
      token,
      body: { acceptsReservations: false },
    });
    assert.equal(disabled.status, "Aprovado");
    assert.equal(disabled.acceptsReservations, false);
    const publicWithReservationsOff = await send("GET", "/catalog");
    assert.equal(publicWithReservationsOff.businesses[0].id, b.id);
    assert.equal(publicWithReservationsOff.businesses[0].acceptsReservations, false);
    await send("POST", "/reservations", { guest, body: booking, status: 422 });
    const enabled = await send("PATCH", tableReservationsPath, {
      token,
      body: { acceptsReservations: true },
    });
    assert.equal(enabled.acceptsReservations, true);
    await send("POST", "/reservations", {
      guest,
      body: { ...booking, start: "2020-01-01" },
      status: 422,
    });
    const r = reservationSchema.parse(
      await send("POST", "/reservations", {
        guest,
        body: booking,
        key: "booking-1",
        status: 201,
      }),
    );
    assert.equal(
      (
        await send("POST", "/reservations", {
          guest,
          body: booking,
          key: "booking-1",
          status: 201,
        })
      ).id,
      r.id,
    );
    await send("PATCH", tableReservationsPath, {
      token,
      body: { acceptsReservations: false },
    });
    assert.equal(
      (await send("GET", "/reservations", { guest: otherGuest })).length,
      0,
    );
    await send("POST", "/reservations/" + r.id + "/cancel", {
      guest: otherGuest,
      body: {},
      status: 404,
    });
    const response = { status: "Confirmada", reply: "Confirmada em teste" };
    await send("POST", "/reservations/" + r.id + "/respond", {
      token: second,
      body: response,
      status: 404,
    });
    assert.equal(
      (
        await send("POST", "/reservations/" + r.id + "/respond", {
          token,
          body: response,
        })
      ).status,
      "Confirmada",
    );
    assert.equal(
      (await send("GET", "/businesses/" + b.id + "/metrics?days=7", { token }))
        .confirmed,
      1,
    );
    assert.equal(
      (
        await send("POST", "/reservations/" + r.id + "/cancel", {
          guest,
          body: {},
        })
      ).status,
      "Cancelada",
    );
    assert.equal(
      (await send("GET", "/businesses/" + b.id + "/subscription", { token }))
        .amount,
      null,
    );
    await send("DELETE", "/businesses/" + b.id + "/products/" + p.id, {
      token,
      status: 204,
    });
    assert.equal((await send("GET", "/catalog")).products.length, 0);
    const room = {
      id: "room-1",
      name: "Suíte",
      description: "",
      price: 149.95,
      guests: 2,
      photo: "",
    };
    const hotelData = {
      ...data, segment: "Hospedagem", rooms: [room],
      city: "Monteiro Lobato", region: "Serra da Mantiqueira",
    };
    const hotel = await send("POST", "/businesses", {
      token,
      status: 201,
      body: { ...hotelData, lodgingType: "Hotéis" },
    });
    assert.equal(hotel.lodgingType, "Hotéis");
    for (const lodgingType of ["Pousadas", "Airbnb", null, "Hotéis"]) {
      const edited = await send("PATCH", `/businesses/${hotel.id}`, {
        token,
        body: { ...hotelData, lodgingType },
      });
      assert.equal(edited.lodgingType, lodgingType);
    }
    const legacyEdit = await send("PATCH", `/businesses/${hotel.id}`, {
      token,
      body: { ...hotelData, subcategory: null },
    });
    assert.equal(legacyEdit.lodgingType, "Hotéis");

    const serviceData = { ...data, segment: "Serviços", acceptsReservations: false, city: "Paraibuna" };
    const agencyType = "Agência de Publicidade";
    await send("POST", "/businesses", {
      token, status: 422, body: { ...data, serviceType: agencyType },
    });
    await send("POST", "/businesses", {
      token, status: 422, body: { ...serviceData, region: "Litoral Norte" },
    });
    await send("POST", "/businesses", {
      token, status: 422,
      body: { ...serviceData, subcategory: "Estética e Beleza", serviceType: agencyType },
    });
    const agency = await send("POST", "/businesses", {
      token, status: 201, body: { ...serviceData, serviceType: agencyType },
    });
    assert.equal(agency.serviceType, agencyType);
    const previousClientEdit = await send("PATCH", "/businesses/" + agency.id, {
      token, body: { ...serviceData, subcategory: null },
    });
    assert.equal(previousClientEdit.serviceType, agencyType);
    const genericService = await send("PATCH", "/businesses/" + agency.id, {
      token, body: { ...serviceData, serviceType: null },
    });
    assert.equal(genericService.serviceType, null);
    await send("PATCH", "/businesses/" + agency.id, {
      token, body: { ...serviceData, subcategory: "Estética e Beleza" },
    });
    const agencyAgain = await send("PATCH", "/businesses/" + agency.id, {
      token, body: { ...serviceData, serviceType: agencyType },
    });
    assert.equal(agencyAgain.subcategory, undefined);
    await send("POST", "/businesses/" + agency.id + "/submit", { token, body: {} });
    await review("aprovar", agency.id);

    await send("POST", "/businesses/" + hotel.id + "/submit", {
      token,
      body: {},
    });
    await review("aprovar", hotel.id);
    const publicCatalog = await send("GET", "/catalog");
    const approved = catalogSchema.parse(publicCatalog).businesses;
    assert.equal(approved.find(business => business.id === hotel.id)?.city, "Monteiro Lobato");
    assert.equal(approved.find(business => business.id === agency.id)?.city, "Paraibuna");
    assert.equal(
      approved.find((business) => business.id === hotel.id)?.lodgingType,
      "Hotéis",
    );
    const legacyCatalogSchema = catalogSchema.extend({
      businesses: businessSchema.omit({ lodgingType: true, serviceType: true }).array(),
    });
    const legacy = legacyCatalogSchema.parse(publicCatalog).businesses;
    assert.equal(
      legacy.find((business) => business.id === hotel.id)?.segment,
      "Hospedagem",
    );
    assert.equal(approved.find(business => business.id === agency.id)?.serviceType, agencyType);
    assert.equal(legacy.find(business => business.id === agency.id)?.segment, "Serviços");

    const stay = {
      ...booking,
      businessId: hotel.id,
      kind: "hospedagem",
      roomId: room.id,
      time: "",
      end: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
    };
    await send("POST", "/reservations", {
      guest,
      body: { ...stay, children: 1 },
      status: 422,
    });
    const reserved = reservationSchema.parse(
      await send("POST", "/reservations", {
        guest,
        status: 201,
        body: { ...stay, estimate: 0, status: "Confirmada" },
      }),
    );
    assert.equal(reserved.estimate, 299.9);
    assert.equal(reserved.roomName, room.name);
    assert.equal(reserved.status, "Pendente");
  } finally {
    await app?.close();
    await db?.end();
    await Promise.all(clientClosures);
    if (started) await postgres.stop();
    await rm(temp, { recursive: true, force: true });
  }
});
