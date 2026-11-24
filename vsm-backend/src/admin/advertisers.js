import { row, transaction } from "../db.js";
import { fail } from "../security.js";
import { highlightLock } from "./data.js";

async function lockAdvertiser(client, id, version, inTrash) {
  if (typeof version !== "string" || !/^\d{1,10}$/.test(version))
    fail(422, "Atualize a página e envie o formulário novamente.");
  const account = await row(client, `SELECT email,deleted_at,xmin::text AS version
    FROM vsm.accounts WHERE id=$1 FOR NO KEY UPDATE`, [id]);
  if (!account) fail(404, "Anunciante não encontrado.");
  if (version !== account.version || Boolean(account.deleted_at) !== inTrash)
    fail(409, "O cadastro mudou. Abra a página do anunciante e tente novamente.");
  return account;
}

function recordEvent(client, id, reviewer, action) {
  return client.query(`INSERT INTO vsm.admin_advertiser_events(account_id,reviewer,action)
    VALUES ($1,$2,$3)`, [id, reviewer, action]);
}

export async function editAdvertiser(db, { id, version, profile, reviewer }) {
  await transaction(db, async (client) => {
    const account = await lockAdvertiser(client, id, version, false);
    await client.query("UPDATE vsm.accounts SET name=$2,email=$3,phone=$4 WHERE id=$1",
      [id, profile.name, profile.email, profile.phone]);
    if (account.email !== profile.email)
      await client.query("DELETE FROM vsm.sessions WHERE account_id=$1", [id]);
    await recordEvent(client, id, reviewer, "editado");
  });
}

export async function setAdvertiserInTrash(db, { id, version, removing, reviewer }) {
  await transaction(db, async (client) => {
    if (removing) await client.query("SELECT pg_advisory_xact_lock($1)", [highlightLock]);
    await lockAdvertiser(client, id, version, !removing);
    await client.query(`UPDATE vsm.accounts SET deleted_at=CASE WHEN $2::boolean THEN now() ELSE NULL END
      WHERE id=$1`, [id, removing]);
    if (removing) {
      await client.query("DELETE FROM vsm.sessions WHERE account_id=$1", [id]);
      await client.query(`UPDATE vsm.businesses SET home_highlight=NULL, explore_highlight=NULL
        WHERE owner_id=$1 AND (home_highlight IS NOT NULL OR explore_highlight IS NOT NULL)`, [id]);
    }
    await recordEvent(client, id, reviewer, removing ? "excluido" : "restaurado");
  });
}

export async function deleteAdvertiserPermanently(db, { id, version, confirmation }) {
  await transaction(db, async (client) => {
    const account = await lockAdvertiser(client, id, version, true);
    if (typeof confirmation !== "string" || confirmation.trim().toLowerCase() !== account.email.toLowerCase())
      fail(422, "Digite o e-mail desta conta para confirmar a exclusão.");

    await client.query(`UPDATE vsm.businesses
      SET owner_id=NULL, status='Desativado', deleted_at=COALESCE(deleted_at,now()),
          home_highlight=NULL, explore_highlight=NULL
      WHERE owner_id=$1`, [id]);

    // Deixe cadastros em edição concluírem os uploads antes de bloquear novas referências à conta.
    await client.query("SELECT id FROM vsm.accounts WHERE id=$1 FOR UPDATE", [id]);
    await client.query("UPDATE vsm.media SET owner_id=NULL WHERE owner_id=$1", [id]);
    await client.query("DELETE FROM vsm.requests WHERE scope LIKE $1", [id + ":%"]);
    await client.query("DELETE FROM vsm.admin_advertiser_events WHERE account_id=$1", [id]);
    await client.query("DELETE FROM vsm.accounts WHERE id=$1", [id]);
  });
}
