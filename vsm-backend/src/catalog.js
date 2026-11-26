import { randomUUID } from "node:crypto";
import { row, rows, transaction } from "./db.js";
import { checkGalleryLimit } from "./media.js";
import { fail, hash, parse, session } from "./security.js";
import {
  businessInput,
  diningSegments,
  offerInput,
  productInput,
  tableReservationsInput,
} from "./schemas.js";

export const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function requireId(id) {
  if (!uuid.test(id)) fail(404, "Registro não encontrado.");
  return id;
}
export const businessView = (record, owner) => ({
  ...record.data,
  id: record.id,
  status: record.status,
  correction: owner ? record.correction : "",
  owner,
  highlights: record.home_highlight || record.explore_highlight
    ? { home: record.home_highlight ?? null, explore: record.explore_highlight ?? null }
    : undefined,
});
const offerColumns = "o.price_cents AS offer_price_cents, o.expires_at AS offer_expires_at";
const activeOfferJoin = `LEFT JOIN vsm.product_offers o
  ON o.product_id=p.id AND o.expires_at>statement_timestamp()`;
const productView = (record) => ({
  ...record.data,
  id: record.id,
  businessId: record.business_id,
  offer: record.data.available && Number.isInteger(record.offer_price_cents)
    && record.offer_price_cents / 100 < record.data.price
    ? {
        price: record.offer_price_cents / 100,
        expiresAt: record.offer_expires_at.toISOString(),
      }
    : undefined,
});

export async function owned(db, id, accountId, lock = false) {
  const business = await row(
    db,
    `SELECT b.* FROM vsm.businesses b JOIN vsm.accounts a ON a.id=b.owner_id
     WHERE b.id=$1 AND b.owner_id=$2 AND b.deleted_at IS NULL AND a.deleted_at IS NULL` +
      (lock ? " FOR UPDATE OF b" : ""),
    [requireId(id), accountId],
  );
  if (!business) fail(404, "Estabelecimento não encontrado.");
  return business;
}

export async function idempotent(db, request, scope, body, work) {
  const key = request.headers["idempotency-key"];
  if (
    key !== undefined &&
    (typeof key !== "string" || !/^[\w.-]{1,128}$/.test(key))
  )
    fail(422, "Chave de operação inválida.");
  return transaction(db, async (client) => {
    if (!key) return work(client);
    const digest = hash(JSON.stringify(body));
    const added = await row(
      client,
      "INSERT INTO vsm.requests(scope,key,hash) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING key",
      [scope, key, digest],
    );
    if (!added) {
      const existing = await row(
        client,
        "SELECT hash,response FROM vsm.requests WHERE scope=$1 AND key=$2",
        [scope, key],
      );
      if (existing.hash !== digest)
        fail(409, "Chave de operação reutilizada com outros dados.");
      return existing.response;
    }
    const result = await work(client);
    await client.query(
      "UPDATE vsm.requests SET response=$3 WHERE scope=$1 AND key=$2",
      [scope, key, result],
    );
    return result;
  });
}

async function checkImages(db, urls, accountId, origin) {
  for (const image of new Set(urls.filter(Boolean))) {
    let url;
    try {
      url = new URL(image);
    } catch {
      fail(422, "Imagem inválida.");
    }
    const id = url.pathname.split("/").at(-1);
    if (
      url.origin !== origin ||
      url.pathname !== "/media/" + id ||
      url.search ||
      url.hash ||
      !uuid.test(id)
    )
      fail(422, "Envie uma imagem pelo aplicativo.");
    if (
      !(await row(db, "SELECT id FROM vsm.media WHERE id=$1 AND owner_id=$2", [
        id,
        accountId,
      ]))
    )
      fail(422, "Imagem indisponível.");
  }
}

export function catalogRoutes(app, db, origin) {
  app.get("/catalog", async () => {
    const businesses = await rows(
      db,
      `SELECT b.* FROM vsm.businesses b JOIN vsm.accounts a ON a.id=b.owner_id
       WHERE b.status='Aprovado' AND b.deleted_at IS NULL AND a.deleted_at IS NULL ORDER BY b.id`,
    );
    const products = await rows(
      db,
      `SELECT p.*, ${offerColumns} FROM vsm.products p
       ${activeOfferJoin}
       WHERE p.business_id=ANY($1::uuid[]) AND p.data->>'available'='true' ORDER BY p.id`,
      [businesses.map(({ id }) => id)],
    );
    return {
      businesses: businesses.map((b) => businessView(b, false)),
      products: products.map(productView),
    };
  });
  app.get("/me/workspace", async (req) => {
    const { accountId } = await session(db, req);
    const businesses = await rows(
      db,
      "SELECT * FROM vsm.businesses WHERE owner_id=$1 AND deleted_at IS NULL ORDER BY id",
      [accountId],
    );
    const products = await rows(
      db,
      `SELECT p.*, ${offerColumns}
       FROM vsm.products p JOIN vsm.businesses b ON b.id=p.business_id
       ${activeOfferJoin} AND b.status='Aprovado'
       WHERE b.owner_id=$1 AND b.deleted_at IS NULL ORDER BY p.id`,
      [accountId],
    );
    const reservations = await rows(
      db,
      "SELECT r.data FROM vsm.bookings r JOIN vsm.businesses b ON b.id=r.business_id WHERE b.owner_id=$1 AND b.deleted_at IS NULL ORDER BY r.created_at DESC",
      [accountId],
    );
    return {
      businesses: businesses.map((b) => businessView(b, true)),
      products: products.map(productView),
      reservations: reservations.map((r) => r.data),
    };
  });
  const saveBusiness = async (req, reply) => {
    const { accountId } = await session(db, req);
    const data = parse(businessInput, req.body);
    const images = [
      data.photo,
      data.logo,
      ...data.gallery,
      ...data.rooms.map((r) => r.photo),
    ];
    if (req.params.id)
      return transaction(db, async (client) => {
        const b = await owned(client, req.params.id, accountId, true);
        if (["Em análise", "Desativado"].includes(b.status))
          fail(409, "O anúncio não pode ser editado neste estado.");
        checkGalleryLimit(data.gallery, b.data.gallery ?? []);
        await checkImages(client, images, accountId, origin);
        if (data.segment === b.data.segment) {
          if (data.subcategory === undefined && !data.serviceType)
            data.subcategory = b.data.subcategory;
          if (data.lodgingType === undefined)
            data.lodgingType = b.data.lodgingType;
          if (data.serviceType === undefined && !data.subcategory)
            data.serviceType = b.data.serviceType;
        }
        const changed = await row(
          client,
          "UPDATE vsm.businesses SET data=$2, status=CASE WHEN status='Aprovado' THEN 'Rascunho' ELSE status END WHERE id=$1 RETURNING *",
          [b.id, data],
        );
        return businessView(changed, true);
      });
    const created = await idempotent(
      db,
      req,
      accountId + ":business",
      data,
      async (client) => {
        const owner = await row(client, "SELECT id FROM vsm.accounts WHERE id=$1 AND deleted_at IS NULL FOR SHARE", [accountId]);
        if (!owner) fail(401, "Sessão inválida ou expirada.");
        checkGalleryLimit(data.gallery);
        await checkImages(client, images, accountId, origin);
        return businessView(
          await row(
            client,
            "INSERT INTO vsm.businesses(id,owner_id,data) VALUES($1,$2,$3) RETURNING *",
            [randomUUID(), accountId, data],
          ),
          true,
        );
      },
    );
    return reply.code(201).send(created);
  };
  app.post("/businesses", saveBusiness);
  app.patch("/businesses/:id", saveBusiness);
  app.patch("/businesses/:id/table-reservations", async (req) => {
    const { accountId } = await session(db, req);
    const { acceptsReservations } = parse(tableReservationsInput, req.body);
    return transaction(db, async (client) => {
      const business = await owned(client, req.params.id, accountId, true);
      if (business.status !== "Aprovado")
        fail(
          409,
          "O anúncio deve estar publicado para alterar reservas de mesa.",
        );
      if (!diningSegments.includes(business.data.segment))
        fail(422, "Este tipo de estabelecimento não recebe reservas de mesa.");
      const updated = await row(
        client,
        "UPDATE vsm.businesses SET data=$2 WHERE id=$1 RETURNING *",
        [business.id, { ...business.data, acceptsReservations }],
      );
      return businessView(updated, true);
    });
  });
  app.post("/businesses/:id/submit", async (req) => {
    const { accountId } = await session(db, req);
    return transaction(db, async (client) => {
      const b = await owned(client, req.params.id, accountId, true);
      if (["Em análise", "Aprovado"].includes(b.status))
        return businessView(b, true);
      if (!["Rascunho", "Correções solicitadas", "Recusado"].includes(b.status))
        fail(409, "O anúncio não pode ser enviado.");
      if (
        ![
          b.data.name,
          b.data.address,
          b.data.city,
          b.data.description,
          b.data.phone,
        ].every((v) => v.trim())
      )
        fail(422, "Complete os dados do anúncio.");
      return businessView(
        await row(
          client,
          "UPDATE vsm.businesses SET status='Em análise',correction='' WHERE id=$1 RETURNING *",
          [b.id],
        ),
        true,
      );
    });
  });
  const saveProduct = async (req, reply) => {
    const { accountId } = await session(db, req);
    const id = requireId(req.params.id);
    const data = parse(productInput, req.body);
    if (data.businessId !== id) fail(422, "Estabelecimento inválido.");
    const work = async (client) => {
      const business = await owned(client, id, accountId, true);
      if (!diningSegments.includes(business.data.segment) && business.status !== "Aprovado")
        fail(422, "Aguarde a aprovação para gerenciar produtos e serviços.");
      if (["Em análise", "Desativado"].includes(business.status))
        fail(409, "O anúncio está bloqueado para edição.");
      await checkImages(client, [data.photo], accountId, origin);
      const product = req.params.productId
        ? await row(
            client,
            "UPDATE vsm.products SET data=$3 WHERE id=$1 AND business_id=$2 RETURNING *",
            [requireId(req.params.productId), id, data],
          )
        : await row(
            client,
            "INSERT INTO vsm.products VALUES($1,$2,$3) RETURNING *",
            [randomUUID(), id, data],
          );
      if (!product) fail(404, "Produto não encontrado.");
      const offer = req.params.productId && business.status === "Aprovado"
        ? await row(client, `SELECT ${offerColumns} FROM vsm.products p
           ${activeOfferJoin} WHERE p.id=$1`, [product.id])
        : undefined;
      return productView({ ...product, ...offer });
    };
    if (req.params.productId) return transaction(db, work);
    return reply
      .code(201)
      .send(
        await idempotent(db, req, accountId + ":product:" + id, data, work),
      );
  };
  app.post("/businesses/:id/products", saveProduct);
  app.patch("/businesses/:id/products/:productId", saveProduct);
  app.delete("/businesses/:id/products/:productId", async (req, reply) => {
    const { accountId } = await session(db, req);
    await transaction(db, async (client) => {
      const b = await owned(client, req.params.id, accountId, true);
      if (["Em análise", "Desativado"].includes(b.status))
        fail(409, "O anúncio está bloqueado para edição.");
      await client.query(
        "DELETE FROM vsm.products WHERE id=$1 AND business_id=$2",
        [requireId(req.params.productId), b.id],
      );
    });
    return reply.code(204).send();
  });
  app.post("/businesses/:id/offers", async (req, reply) => {
    const { accountId } = await session(db, req);
    const id = requireId(req.params.id).toLowerCase();
    const data = parse(offerInput, req.body);
    const ids = data.products.map(({ productId }) => productId);
    const saved = await idempotent(
      db, req, `${accountId}:offer:${id}`, data,
      async (client) => {
        const business = await owned(client, id, accountId, true);
        if (business.status !== "Aprovado")
          fail(409, "O anúncio precisa estar aprovado para publicar ofertas.");

        const products = await rows(client,
          `SELECT * FROM vsm.products WHERE business_id=$1
           AND id=ANY($2::uuid[]) AND data->>'available'='true' FOR UPDATE`,
          [id, ids],
        );
        if (products.length !== ids.length)
          fail(422, "Selecione produtos disponíveis deste estabelecimento.");
        const byId = new Map(products.map((product) => [product.id, product]));
        for (const { productId, priceCents } of data.products) {
          if (!(priceCents / 100 < byId.get(productId).data.price))
            fail(422, "O preço em oferta deve ser menor que o preço normal.");
        }

        const offers = await rows(client,
          `INSERT INTO vsm.product_offers(product_id,price_cents,expires_at)
           SELECT product_id, price_cents, statement_timestamp() + $3::int * interval '1 hour'
           FROM unnest($1::uuid[], $2::int[]) AS item(product_id, price_cents)
           ON CONFLICT (product_id) DO UPDATE
             SET price_cents=EXCLUDED.price_cents, expires_at=EXCLUDED.expires_at
           RETURNING product_id, price_cents AS offer_price_cents, expires_at AS offer_expires_at`,
          [ids, data.products.map(({ priceCents }) => priceCents), data.durationHours],
        );
        return {
          products: offers.map((offer) =>
            productView({ ...byId.get(offer.product_id), ...offer }),
          ),
        };
      },
    );
    return reply.code(201).send(saved);
  });
  app.get("/businesses/:id/metrics", async (req) => {
    const { accountId } = await session(db, req);
    const b = await owned(db, req.params.id, accountId);
    const days = Number(req.query.days || "30");
    if (![7, 30, 90].includes(days)) fail(422, "Período inválido.");
    const counts = await row(
      db,
      "SELECT count(*)::int AS requests,count(*) FILTER(WHERE data->>'status'='Confirmada')::int AS confirmed FROM vsm.bookings WHERE business_id=$1 AND created_at>=now()-$2::int*interval '1 day'",
      [b.id, days],
    );
    return { views: 0, contacts: 0, ...counts };
  });
  app.get("/businesses/:id/subscription", async (req) => {
    const { accountId } = await session(db, req);
    const b = await owned(db, req.params.id, accountId);
    return (
      (await row(
        db,
        'SELECT status,plan,amount::float8 AS amount,due_date::text AS "dueDate" FROM vsm.subscriptions WHERE business_id=$1',
        [b.id],
      )) ?? {
        status: "Não contratada",
        plan: null,
        amount: null,
        dueDate: null,
      }
    );
  });
}
