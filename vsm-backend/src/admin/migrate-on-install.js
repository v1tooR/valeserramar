import { readFile } from "node:fs/promises";
import { createPool, transaction } from "../db.js";

let db;
try {
  db = createPool();
  await transaction(db, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(55738401)");
    for (const file of ["002_admin.sql", "003_admin_businesses.sql", "005_business_highlights.sql", "006_admin_advertisers.sql"]) {
      await client.query(await readFile(new URL("../../sql/" + file, import.meta.url), "utf8"));
    }
  });
  console.log("Migração do painel aplicada.");
} catch (error) {
  console.error("Falha na migração do painel.", error.code || error.name);
  process.exitCode = 1;
} finally {
  await db?.end();
}
