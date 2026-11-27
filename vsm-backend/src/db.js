import { readFile } from "node:fs/promises";
import pg from "pg";

export function createPool() {
  if (!process.env.DATABASE_URL) throw new Error("Configure DATABASE_URL.");
  const connection = new URL(process.env.DATABASE_URL);
  const production = process.env.NODE_ENV === "production";
  const ca = process.env.DATABASE_CA_BASE64?.trim();
  if (production || ca) {
    for (const parameter of [
      "sslmode",
      "sslcert",
      "sslkey",
      "sslrootcert",
      "ssl",
    ]) {
      connection.searchParams.delete(parameter);
    }
  }
  return new pg.Pool({
    connectionString: connection.href,
    ...(production || ca
      ? {
          ssl: {
            rejectUnauthorized: true,
            ...(ca ? { ca: Buffer.from(ca, "base64").toString("utf8") } : {}),
          },
        }
      : {}),
    max: 5,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  });
}

export async function migrate(db) {
  await transaction(db, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(55738401)");
    for (const migration of [
      "001_initial.sql",
      "002_admin.sql",
      "003_admin_businesses.sql",
      "005_business_highlights.sql",
      "006_admin_advertisers.sql",
      "007_advertiser_permanent_deletion.sql",
      "008_product_offers.sql",
      "009_highlights_by_city.sql",
    ]) {
      await client.query(
        await readFile(new URL("../sql/" + migration, import.meta.url), "utf8"),
      );
    }
  });
}

export async function transaction(db, work) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function rows(db, sql, values) {
  return (await db.query(sql, values)).rows;
}

export async function row(db, sql, values) {
  return (await rows(db, sql, values))[0];
}
