import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { row } from "./db.js";

const derive = promisify(scrypt);
export const hash = (value) => createHash("sha256").update(value).digest("hex");

export function fail(statusCode, message) {
  throw Object.assign(new Error(message), { statusCode });
}

export function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) fail(422, "Confira os dados preenchidos.");
  return result.data;
}

export async function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const value = await derive(password, salt, 64);
  return salt + ":" + value.toString("hex");
}

export async function checkPassword(
  password,
  stored = "00000000000000000000000000000000:" + "0".repeat(128),
) {
  const [salt, expected] = stored.split(":");
  return timingSafeEqual(
    await derive(password, salt, 64),
    Buffer.from(expected, "hex"),
  );
}

export async function issueSession(db, accountId) {
  const token = randomBytes(32).toString("base64url");
  const days = accountId ? 30 : 365;
  await db.query("INSERT INTO vsm.sessions VALUES ($1,$2,$3)", [
    hash(token),
    accountId,
    new Date(Date.now() + days * 86400000),
  ]);
  return token;
}

export async function session(db, request, guest = false) {
  const token = guest
    ? request.headers["x-guest-token"]
    : request.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
  if (typeof token !== "string" || !/^[\w-]{43}$/.test(token))
    fail(401, "Sessão inválida.");
  const digest = hash(token);
  const result = await row(
    db,
    "SELECT account_id FROM vsm.sessions WHERE token_hash=$1 AND expires_at>now()",
    [digest],
  );
  if (!result || guest !== (result.account_id === null))
    fail(401, "Sessão inválida ou expirada.");
  return { accountId: result.account_id, digest };
}
