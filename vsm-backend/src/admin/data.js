import { uuid } from "../catalog.js";
import { row, rows, transaction } from "../db.js";
import { fail } from "../security.js";
import { businessSchema, reservationSchema } from "../schemas.js";
import { categories } from "./registration.js";

export const businessStatuses = businessSchema.shape.status.options;
export const bookingStatuses = reservationSchema.shape.status.options;
const pageSize = 16;
export const highlightLimit = 15;
export const highlightLock = 55738402;
export const highlightPlacements = {
  home: { label: "Início", column: "home_highlight" },
  explore: { label: "Explorar e categorias", column: "explore_highlight" },
};

export function canHighlight(business) {
  return business.status === "Aprovado" && !business.deleted_at && !business.owner_deleted_at &&
    typeof business.data?.photo === "string" && Boolean(business.data.photo.trim());
}

export function filterText(input) {
  return typeof input === "string" ? input.trim().slice(0, 120) : "";
}

function filterId(input) {
  return typeof input === "string" && uuid.test(input) ? input : "";
}

async function paginate(db, query, values, order, requestedPage) {
  const { total } = await row(
    db, `SELECT count(*)::int AS total FROM (${query}) AS results`, values,
  );
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const number = Number(requestedPage);
  const page = Number.isSafeInteger(number) ? Math.max(1, Math.min(lastPage, number)) : 1;
  const records = await rows(
    db,
    `${query} ORDER BY ${order} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, pageSize, (page - 1) * pageSize],
  );
  return { records, total, page, lastPage };
}

const businessSummary = `b.id, b.status, b.deleted_at, b.home_highlight, b.explore_highlight, b.data->>'name' AS name,
  b.data->>'city' AS city, b.data->>'region' AS region,
  b.data->>'segment' AS segment, b.data->>'serviceType' AS service_type, b.data->>'photo' AS photo`;

const activityQuery = `SELECT r.id, r.business_id, r.reviewer, r.previous_status,
    r.status, r.reason, r.created_at, b.data->>'name' AS name
  FROM vsm.admin_reviews r LEFT JOIN vsm.businesses b ON b.id=r.business_id`;

export async function overview(db) {
  const [counts, queue, activity] = await Promise.all([
    row(db, `SELECT
      count(*) FILTER (WHERE status='Em análise')::int AS pending,
      count(*) FILTER (WHERE status='Aprovado')::int AS published,
      (SELECT count(*)::int FROM vsm.accounts WHERE deleted_at IS NULL) AS accounts,
      (SELECT count(*)::int FROM vsm.bookings WHERE data->>'status'='Pendente') AS bookings
      FROM vsm.businesses b JOIN vsm.accounts a ON a.id=b.owner_id
      WHERE b.deleted_at IS NULL AND a.deleted_at IS NULL`),
    rows(db, `SELECT ${businessSummary} FROM vsm.businesses b
      JOIN vsm.accounts a ON a.id=b.owner_id
      WHERE b.status='Em análise' AND b.deleted_at IS NULL AND a.deleted_at IS NULL
      ORDER BY name,b.id LIMIT 5`),
    rows(db, `${activityQuery} ORDER BY r.id DESC LIMIT 5`),
  ]);
  return { counts, queue, activity };
}

export async function businesses(db, params, deleted = false) {
  const q = filterText(params.q);
  const status = businessStatuses.includes(params.status) ? params.status : "";
  const segment = categories.some(({ label }) => label === params.segment) ? params.segment : "";
  const owner = filterId(params.owner);
  const result = await paginate(
    db,
    `SELECT ${businessSummary}, b.owner_id, a.deleted_at AS owner_deleted_at FROM vsm.businesses b
     LEFT JOIN vsm.accounts a ON a.id=b.owner_id
     WHERE ($1='' OR strpos(lower(concat_ws(' ', b.data->>'name', b.data->>'city',
           b.data->>'region', a.name, a.email)), lower($1))>0)
       AND ($2='' OR b.status=$2)
       AND ($3='' OR $3 IN (b.data->>'segment', b.data->>'subcategory',
           b.data->>'lodgingType', b.data->>'serviceType'))
       AND (NULLIF($4,'') IS NULL OR b.owner_id=NULLIF($4,'')::uuid)
       AND (b.deleted_at IS NOT NULL) = $5::boolean`,
    [q, deleted ? "" : status, segment, owner, deleted],
    "b.deleted_at DESC NULLS LAST, CASE WHEN b.status='Em análise' THEN 0 ELSE 1 END,name,b.id",
    params.page,
  );
  return { ...result, deleted, filters: { q, status: deleted ? "" : status, segment, owner } };
}

export async function businessRecord(db, id) {
  return row(db, `SELECT b.id,b.owner_id,b.status,b.correction,b.deleted_at,b.data,
      b.home_highlight,b.explore_highlight,
      b.xmin::text AS version, a.name AS owner_name, a.email AS owner_email,
      a.phone AS owner_phone, a.deleted_at AS owner_deleted_at
    FROM vsm.businesses b LEFT JOIN vsm.accounts a ON a.id=b.owner_id WHERE b.id=$1`, [id]);
}

export async function businessDetails(db, id) {
  const business = await businessRecord(db, id);
  if (!business) return null;
  const [products, activity, subscription, bookings, highlights] = await Promise.all([
    rows(db, `SELECT id, data->>'name' AS name, data->>'category' AS category,
      data->>'price' AS price, data->>'available'='true' AS available
      FROM vsm.products WHERE business_id=$1 ORDER BY name,id`, [id]),
    rows(db, `${activityQuery} WHERE r.business_id=$1 ORDER BY r.id DESC LIMIT 12`, [id]),
    row(db, "SELECT status,plan,amount,due_date::text AS due_date FROM vsm.subscriptions WHERE business_id=$1", [id]),
    row(db, `SELECT count(*)::int AS total,
      count(*) FILTER(WHERE data->>'status'='Pendente')::int AS pending
      FROM vsm.bookings WHERE business_id=$1`, [id]),
    row(db, `SELECT count(home_highlight)::int AS home,
      count(explore_highlight)::int AS explore FROM vsm.businesses`),
  ]);
  return { business, products, activity, subscription, bookings, highlights };
}

export async function setBusinessHighlight(db, id, placement, enabled) {
  const { column, label } = highlightPlacements[placement];
  await transaction(db, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1)", [highlightLock]);
    const business = await row(client, `SELECT b.*, a.deleted_at AS owner_deleted_at
      FROM vsm.businesses b JOIN vsm.accounts a ON a.id=b.owner_id
      WHERE b.id=$1 AND b.deleted_at IS NULL FOR UPDATE OF b`, [id]);
    if (!business) fail(404, "Estabelecimento não encontrado.");
    if (Boolean(business[column]) === enabled) return;
    if (!enabled) {
      await client.query(`UPDATE vsm.businesses SET ${column}=NULL WHERE id=$1`, [id]);
      return;
    }
    if (business.owner_deleted_at)
      fail(409, "Restaure o anunciante antes de publicar um destaque.");
    if (!canHighlight(business))
      fail(409, "Para publicar o destaque, o estabelecimento precisa estar aprovado e ter uma foto de capa.");
    const updated = await row(client, `
      UPDATE vsm.businesses SET ${column}=slot.number
      FROM (
        SELECT number FROM generate_series(1,$2::int) AS slot(number)
        WHERE NOT EXISTS (SELECT 1 FROM vsm.businesses WHERE ${column}=slot.number)
        ORDER BY number LIMIT 1
      ) AS slot
      WHERE id=$1 RETURNING id
    `, [id, highlightLimit]);
    if (!updated) fail(409, `As ${highlightLimit} vagas de ${label} estão ocupadas.`);
  });
}

const accountSummary = `a.id,a.name,a.email,a.phone,a.deleted_at,
  (SELECT count(*)::int FROM vsm.businesses b WHERE b.owner_id=a.id AND b.deleted_at IS NULL) AS businesses`;

export async function accounts(db, params, deleted = false) {
  const q = filterText(params.q);
  const result = await paginate(
    db,
    `SELECT ${accountSummary} FROM vsm.accounts a
     WHERE (a.deleted_at IS NOT NULL) = $2::boolean
       AND ($1='' OR strpos(lower(concat_ws(' ',a.name,a.email,a.phone)),lower($1))>0)`,
    [q, deleted], "a.deleted_at DESC NULLS LAST,a.name,a.id", params.page,
  );
  return { ...result, deleted, filters: { q } };
}

export async function advertiserRecord(db, id) {
  const account = await row(db, `SELECT ${accountSummary}, a.xmin::text AS version
    FROM vsm.accounts a WHERE a.id=$1`, [id]);
  if (!account) fail(404, "Anunciante não encontrado.");
  return account;
}

export async function advertiserHistory(db, id) {
  return rows(db, `SELECT reviewer, action, created_at FROM vsm.admin_advertiser_events
    WHERE account_id=$1 ORDER BY id DESC LIMIT 12`, [id]);
}

export async function bookings(db, params) {
  const q = filterText(params.q);
  const status = bookingStatuses.includes(params.status) ? params.status : "";
  const business = filterId(params.business);
  const result = await paginate(
    db,
    `SELECT r.id,r.created_at,r.business_id,r.data->>'name' AS guest,
       r.data->>'kind' AS kind,r.data->>'start' AS starts,
       r.data->>'status' AS status,b.data->>'name' AS name,b.deleted_at
     FROM vsm.bookings r JOIN vsm.businesses b ON b.id=r.business_id
     WHERE ($1='' OR strpos(lower(concat_ws(' ',b.data->>'name',r.data->>'name',
           r.data->>'phone')),lower($1))>0)
       AND ($2='' OR r.data->>'status'=$2)
       AND (NULLIF($3,'') IS NULL OR r.business_id=NULLIF($3,'')::uuid)`,
    [q, status, business], "created_at DESC,id", params.page,
  );
  return { ...result, filters: { q, status, business } };
}

export async function bookingDetails(db, id) {
  return row(db, `SELECT r.id,r.business_id,r.data,b.data->>'name' AS name,b.deleted_at
    FROM vsm.bookings r JOIN vsm.businesses b ON b.id=r.business_id WHERE r.id=$1`, [id]);
}

export async function subscriptions(db, params) {
  const q = filterText(params.q);
  const business = filterId(params.business);
  const statuses = (await rows(db, "SELECT DISTINCT status FROM vsm.subscriptions ORDER BY status"))
    .map(({ status }) => status);
  if (!statuses.includes("Não contratada")) statuses.push("Não contratada");
  const status = statuses.includes(params.status) ? params.status : "";
  const result = await paginate(
    db,
    `SELECT b.id,b.data->>'name' AS name,b.deleted_at,s.plan,s.amount,s.due_date::text AS due_date,
        coalesce(s.status,'Não contratada') AS status
     FROM vsm.businesses b LEFT JOIN vsm.subscriptions s ON s.business_id=b.id
     WHERE ($1='' OR strpos(lower(concat_ws(' ',b.data->>'name',s.plan,coalesce(s.status,'Não contratada'))),lower($1))>0)
       AND (NULLIF($2,'') IS NULL OR b.id=NULLIF($2,'')::uuid)
       AND ($3='' OR coalesce(s.status,'Não contratada')=$3)`,
    [q, business, status], "name,id", params.page,
  );
  return { ...result, statuses, filters: { q, business, status } };
}

export async function activities(db, params) {
  const q = filterText(params.q);
  const result = await paginate(
    db, activityQuery + ` WHERE $1='' OR strpos(lower(concat_ws(' ',b.data->>'name',r.reviewer,r.reason)),lower($1))>0`,
    [q], "id DESC", params.page,
  );
  return { ...result, filters: { q } };
}
