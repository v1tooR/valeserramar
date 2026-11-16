import { createPool, migrate } from "./db.js";
const db = createPool();
try {
  await migrate(db);
  console.log("Schema vsm pronto.");
} finally {
  await db.end();
}
