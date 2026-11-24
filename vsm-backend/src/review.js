import { createPool, rows } from "./db.js";
import { uuid } from "./catalog.js";
import { reviewBusiness, reviewStates } from "./moderation.js";

const [action, id, reason = ""] = process.argv.slice(2);
if (
  action !== "listar" &&
  (!Object.hasOwn(reviewStates, action) ||
    !uuid.test(id || "") ||
    (action === "corrigir" && !reason.trim()))
) {
  console.error(
    'Uso: npm run review -- listar | aprovar ID | corrigir ID "motivo" | recusar ID | desativar ID | reativar ID',
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
    const result = await reviewBusiness(db, { id, action, reason: reason.slice(0, 2000) });
    if (result) console.log(result);
    else {
      console.error("Anúncio ausente ou mudança indisponível no estado atual.");
      process.exitCode = 1;
    }
  }
} finally {
  await db.end();
}
