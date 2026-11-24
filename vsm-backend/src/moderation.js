import { row, transaction } from "./db.js";
import { fail } from "./security.js";

export const reviewStates = Object.freeze({
  aprovar: "Aprovado",
  corrigir: "Correções solicitadas",
  recusar: "Recusado",
  desativar: "Desativado",
  reativar: "Em análise",
});

export function canReview(action, status) {
  if (!Object.hasOwn(reviewStates, action)) return false;
  if (action === "desativar") return status !== "Desativado";
  return status === (action === "reativar" ? "Desativado" : "Em análise");
}

export async function recordBusinessActivity(db, { id, reviewer, previousStatus, status, reason }) {
  if (!reviewer) return;
  await db.query(
    `INSERT INTO vsm.admin_reviews(business_id,reviewer,previous_status,status,reason)
     VALUES($1,$2,$3,$4,$5)`,
    [id, reviewer, previousStatus, status, reason],
  );
}

export async function reviewBusiness(db, { id, action, reason, reviewer, version }) {
  return transaction(db, async (client) => {
    const current = await row(
      client,
      `SELECT b.status,b.data,b.deleted_at,b.xmin::text AS version,a.deleted_at AS owner_deleted_at
       FROM vsm.businesses b JOIN vsm.accounts a ON a.id=b.owner_id WHERE b.id=$1 FOR UPDATE OF b`,
      [id],
    );
    if (
      !current || current.deleted_at ||
      (version !== undefined && version !== current.version) ||
      !canReview(action, current.status)
    )
      return null;

    if (action === "aprovar" && current.owner_deleted_at)
      fail(409, "Restaure o anunciante antes de publicar o estabelecimento.");

    if (action === "aprovar" && !["name", "address", "city", "description", "phone"].every(field =>
      typeof current.data[field] === "string" && current.data[field].trim()))
      fail(422, "Complete nome, endereço, cidade, descrição e telefone antes de publicar.");

    const updated = await row(
      client,
      "UPDATE vsm.businesses SET status=$2, correction=$3 WHERE id=$1 RETURNING id,status",
      [id, reviewStates[action], reason],
    );
    await recordBusinessActivity(client, { id, reviewer, previousStatus: current.status, status: updated.status, reason });
    return updated;
  });
}

export async function setBusinessInTrash(db, { id, version, removing, reviewer }) {
  return transaction(db, async (client) => {
    const current = await row(client, `SELECT owner_id, status, deleted_at, xmin::text AS version
      FROM vsm.businesses WHERE id=$1 FOR UPDATE`, [id]);
    if (!current || current.version !== version || Boolean(current.deleted_at) === removing)
      return null;
    if (!removing && !current.owner_id)
      fail(409, "O anunciante foi excluído definitivamente. Este estabelecimento está arquivado para consulta.");

    const status = removing ? "Desativado" : "Em análise";
    const updated = await row(client, `UPDATE vsm.businesses
      SET status=$2, deleted_at=CASE WHEN $3::boolean THEN now() ELSE NULL END,
          correction=CASE WHEN $3::boolean THEN correction ELSE '' END
      WHERE id=$1 RETURNING id,status`, [id, status, removing]);
    await recordBusinessActivity(client, {
      id, reviewer,
      previousStatus: removing ? current.status : "Na lixeira",
      status: removing ? "Na lixeira" : status,
      reason: removing ? "Estabelecimento movido para a lixeira." : "Estabelecimento restaurado para análise.",
    });
    return updated;
  });
}
