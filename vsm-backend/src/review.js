import { createPool, row, rows } from "./db.js";
import { uuid } from "./catalog.js";

const [action, id, reason = ""] = process.argv.slice(2);
const states = {
  aprovar: "Aprovado",
  corrigir: "Correções solicitadas",
  recusar: "Recusado",
  desativar: "Desativado",
};
if (
  action !== "listar" &&
  (!Object.hasOwn(states, action) ||
    !uuid.test(id || "") ||
    (action === "corrigir" && !reason.trim()))
) {
  console.error(
    'Uso: npm run review -- listar | aprovar ID | corrigir ID "motivo" | recusar ID | desativar ID',
  );
  process.exit(1);
}
const db = createPool();
try {
  if (action === "listar") {
    console.table(
      await rows(
        db,
        "SELECT id,status,data->>'name' AS nome,data->>'city' AS cidade FROM vsm.businesses WHERE status='Em análise' ORDER BY id",
      ),
    );
  } else {
    const result = await row(
      db,
      "UPDATE vsm.businesses SET status=$2,correction=$3 WHERE id=$1 AND CASE WHEN $2='Desativado' THEN status<>'Desativado' ELSE status='Em análise' END RETURNING id,status",
      [id, states[action], reason.slice(0, 2000)],
    );
    if (result) console.log(result);
    else {
      console.error("Anúncio ausente ou mudança indisponível no estado atual.");
      process.exitCode = 1;
    }
  }
} finally {
  await db.end();
}
