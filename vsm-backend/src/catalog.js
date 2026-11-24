import { randomUUID } from "node:crypto";
import { row, rows, transaction } from "./db.js";
import { checkGalleryLimit } from "./media.js";
import { fail, hash, parse, session } from "./security.js";
import {
  businessInput,
  diningSegments,
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
const productView = (record) => ({
  ...record.data,
  id: record.id,
  businessId: record.business_id,
});

export async function owned(db, id, accountId, lock = false) {
  const business = await row(
    db,
    "SELECT * FROM vsm.businesses WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL" +
      (lock ? " FOR UPDATE" : ""),
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
      "SELECT * FROM vsm.businesses WHERE status='Aprovado' AND deleted_at IS NULL ORDER BY id",
    );
    const products = await rows(
      db,
      "SELECT p.* FROM vsm.products p JOIN vsm.businesses b ON b.id=p.business_id WHERE b.status='Aprovado' AND b.deleted_at IS NULL AND p.data->>'available'='true' ORDER BY p.id",
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
      "SELECT p.* FROM vsm.products p JOIN vsm.businesses b ON b.id=p.business_id WHERE b.owner_id=$1 AND b.deleted_at IS NULL ORDER BY p.id",
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
      if (!diningSegments.includes(business.data.segment))
        fail(422, "Cardápio indisponível para este segmento.");
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
      return productView(product);
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
