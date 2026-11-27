import { row, rows, transaction } from "./db.js";
import { credentials } from "./schemas.js";
import { checkPassword, fail, parse, session } from "./security.js";

const confirmation = credentials.pick({ password: true });

export async function deleteAccountData(client, id, { eraseContent = false } = {}) {
  const businesses = await rows(client, `UPDATE vsm.businesses
    SET owner_id=NULL, status='Desativado', deleted_at=COALESCE(deleted_at,now()),
        home_highlight=NULL, explore_highlight=NULL
    WHERE owner_id=$1 RETURNING id`, [id]);

  // Deixe edições de anúncios concluírem uploads antes de bloquear novas referências à conta.
  await client.query("SELECT id FROM vsm.accounts WHERE id=$1 FOR UPDATE", [id]);

  let media = [];
  if (eraseContent) {
    const ids = businesses.map((business) => business.id);
    if (ids.length) {
      await client.query("DELETE FROM vsm.products WHERE business_id=ANY($1::uuid[])", [ids]);
      await client.query("DELETE FROM vsm.subscriptions WHERE business_id=ANY($1::uuid[])", [ids]);
      await client.query("DELETE FROM vsm.admin_reviews WHERE business_id=ANY($1::uuid[])", [ids]);
      await client.query(`DELETE FROM vsm.businesses b WHERE b.id=ANY($1::uuid[])
        AND NOT EXISTS (SELECT 1 FROM vsm.bookings r WHERE r.business_id=b.id)`, [ids]);

      // As reservas de visitantes ainda referenciam o estabelecimento no histórico.
      await client.query(`UPDATE vsm.businesses SET correction='',
        data=jsonb_build_object('name', 'Estabelecimento removido')
        WHERE id=ANY($1::uuid[])`, [ids]);
    }
    media = await rows(client, "DELETE FROM vsm.media WHERE owner_id=$1 RETURNING id", [id]);
  } else {
    await client.query("UPDATE vsm.media SET owner_id=NULL WHERE owner_id=$1", [id]);
  }

  await client.query("DELETE FROM vsm.requests WHERE scope LIKE $1", [id + ":%"]);
  await client.query("DELETE FROM vsm.admin_advertiser_events WHERE account_id=$1", [id]);
  await client.query("DELETE FROM vsm.accounts WHERE id=$1", [id]);
  return media;
}

export async function deleteOwnAccount(db, request) {
  const { accountId } = await session(db, request);
  const { password } = parse(confirmation, request.body);
  const account = await row(db, `SELECT password_hash FROM vsm.accounts
    WHERE id=$1 AND deleted_at IS NULL`, [accountId]);
  if (!account) fail(401, "Sessão inválida ou expirada.");
  if (!(await checkPassword(password, account.password_hash)))
    fail(403, "Senha incorreta. Confira e tente novamente.");

  return transaction(db, async (client) => {
    const confirmed = await row(client, `SELECT id FROM vsm.accounts
      WHERE id=$1 AND deleted_at IS NULL AND password_hash=$2 FOR NO KEY UPDATE`,
    [accountId, account.password_hash]);
    if (!confirmed) fail(401, "Sessão inválida ou expirada.");
    await session(client, request);
    return deleteAccountData(client, accountId, { eraseContent: true });
  });
}
