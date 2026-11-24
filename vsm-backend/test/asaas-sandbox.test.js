import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { createApp } from "../src/app.js";
import { asaasSandboxRoutes } from "../src/asaas-sandbox.js";
import { migrate } from "../src/db.js";
import { issueSession } from "../src/security.js";

test("Sandbox Asaas cria checkouts recorrentes e confere a confirmação no provedor", async (t) => {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const { port } = probe.address();
  await new Promise((resolve) => probe.close(resolve));
  const temp = await mkdtemp(join(tmpdir(), "vsm-asaas-test-"));
  t.after(() => rm(temp, { recursive: true, force: true }));
  const config = { user: "postgres", password: "sandbox-fixture-local", port };
  const postgres = new EmbeddedPostgres({
    ...config, databaseDir: join(temp, "pg"), persistent: false,
    initdbFlags: ["--encoding=UTF8"],
    postgresFlags: ["-c", "unix_socket_directories="], onLog: () => {},
  });
  await postgres.initialise();
  await postgres.start();
  const db = new pg.Pool({ ...config, host: "127.0.0.1" });
  const connections = [];
  db.on("connect", client => connections.push(new Promise(resolve => client.once("end", resolve))));
  let app;
  try {
    await migrate(db);
    await db.query(await readFile(new URL("../sql/004_asaas_sandbox.sql", import.meta.url), "utf8"));
    const origin = "https://test.example.test";
    const testerEmail = "teste@example.test";
    const apiKey = "fake-sandbox-key";
    const businessId = randomUUID();
    const otherBusiness = randomUUID();
    const owner = randomUUID();
    const other = randomUUID();
    for (const [id, email] of [[owner, testerEmail], [other, "outro@example.test"]]) {
      await db.query(`
        INSERT INTO vsm.accounts(id,email,name,phone,password_hash) VALUES ($1,$2,'Teste','12999999999','')
      `, [id, email]);
    }
    await db.query(`
      INSERT INTO vsm.businesses(id,owner_id,data) VALUES($1,$2,'{}'), ($3,$4,'{}')
    `, [businessId, owner, otherBusiness, other]);
    const token = await issueSession(db, owner);
    const otherToken = await issueSession(db, other);
    const checkouts = [];
    let providerPayments = [];
    let linkOrigin = "https://sandbox.asaas.com";
    let omitCheckoutId = false;
    let failures = 0;
    const fetcher = async (url, options) => {
      const endpoint = new URL(url);
      assert.equal(endpoint.origin, "https://api-sandbox.asaas.com");
      assert.equal(options.headers.access_token, apiKey);
      if (failures > 0) {
        failures -= 1;
        return Response.json({}, { status: 502 });
      }
      if (endpoint.pathname === "/v3/checkouts") {
        assert.equal(options.method, "POST");
        const body = JSON.parse(options.body);
        const id = randomUUID();
        checkouts.push({ id, body });
        const link = linkOrigin + "/checkoutSession/show/" + id;
        return Response.json({ ...(!omitCheckoutId && { id }), link });
      }
      assert.equal(options.method, "GET");
      assert.equal(endpoint.pathname, "/v3/payments");
      assert.ok(checkouts.some(({ id }) => endpoint.searchParams.get("checkoutSession") === id));
      return Response.json({ data: providerPayments });
    };
    app = await createApp({ db, origin, mediaDir: join(temp, "media") });
    await app.register(asaasSandboxRoutes, { db, origin, apiKey, testerEmail, fetcher });
    const base = "/businesses/" + businessId + "/asaas-sandbox";
    async function request(method, url, statusCode, bearer = token) {
      const response = await app.inject({
        method, url, headers: bearer ? { authorization: "Bearer " + bearer } : {},
      });
      assert.equal(response.statusCode, statusCode, response.body);
      return response;
    }
    await request("GET", base, 401, "");
    await request("GET", base, 403, otherToken);
    await request("GET", "/businesses/" + otherBusiness + "/asaas-sandbox", 404);
    await request("POST", base + "/desconhecido/checkout", 404);
    const listed = (await request("GET", base, 200)).json();
    assert.deepEqual(listed.map(({ amountCents, regularCents, cycle }) => [amountCents, regularCents, cycle]), [
      [8700, 12200, "MONTHLY"], [80000, 112000, "YEARLY"],
      [10000, undefined, "MONTHLY"], [7500, undefined, "MONTHLY"],
    ]);
    assert.ok(listed.every(({ status }) => status === "available"));
    const [first, same] = await Promise.all([
      request("POST", base + "/mensal/checkout", 200),
      request("POST", base + "/mensal/checkout", 200),
    ]);
    assert.deepEqual(first.json(), same.json());
    assert.equal(first.json().status, "pending");
    assert.equal(first.json().url, "https://sandbox.asaas.com/checkoutSession/show/" + checkouts[0].id);
    assert.equal(checkouts.length, 1);
    assert.equal(checkouts[0].body.items[0].value, 87);
    assert.deepEqual(checkouts[0].body.billingTypes, ["CREDIT_CARD"]);
    assert.deepEqual(checkouts[0].body.chargeTypes, ["RECURRENT"]);
    assert.match(checkouts[0].body.subscription.nextDueDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(checkouts[0].body.callback.successUrl, origin + "/asaas-sandbox/retorno");

    omitCheckoutId = true;
    await request("POST", base + "/anual/checkout", 500);
    omitCheckoutId = false;
    failures = 1;
    await request("POST", base + "/anual/checkout", 500);
    linkOrigin = "https://asaas.com";
    const annual = await request("POST", base + "/anual/checkout", 200);
    assert.equal(annual.json().url, "https://sandbox.asaas.com/checkoutSession/show/" + checkouts.at(-1).id);
    assert.equal(checkouts.at(-1).body.subscription.cycle, "YEARLY");
    assert.equal(checkouts.at(-1).body.items[0].value, 800);
    for (const [code, amount] of [["destaque-inicio", 100], ["destaque-categoria", 75]]) {
      await request("POST", base + "/" + code + "/checkout", 200);
      assert.equal(checkouts.at(-1).body.subscription.cycle, "MONTHLY");
      assert.equal(checkouts.at(-1).body.items[0].value, amount);
    }

    await request("GET", "/asaas-sandbox/retorno", 200);
    const pending = await request("POST", base + "/mensal/status", 200);
    assert.equal(pending.json().status, "pending");
    const payment = {
      id: "pay_teste", subscription: "sub_teste", checkoutSession: checkouts[0].id,
      value: 87, billingType: "CREDIT_CARD", status: "CONFIRMED",
    };
    providerPayments = [
      { ...payment, checkoutSession: checkouts[1].id },
      { ...payment, value: 88 },
      { ...payment, status: "PENDING" },
    ];
    assert.equal((await request("POST", base + "/mensal/status", 200)).json().status, "pending");
    await db.query("UPDATE vsm.asaas_sandbox_checkouts SET expires_at=now() WHERE checkout_id=$1", [checkouts[0].id]);
    providerPayments = [payment];
    assert.equal((await request("POST", base + "/mensal/checkout", 200)).json().status, "confirmed");
    assert.equal((await request("POST", base + "/mensal/status", 200)).json().status, "confirmed");
    assert.equal((await request("GET", base, 200)).json()[0].status, "confirmed");
    assert.deepEqual((await db.query("SELECT * FROM vsm.subscriptions")).rows, []);
    assert.equal((await db.query(`
      SELECT count(*)::int AS total FROM vsm.businesses
      WHERE home_highlight IS NOT NULL OR explore_highlight IS NOT NULL
    `)).rows[0].total, 0);
  } finally {
    await app?.close();
    await db.end();
    await Promise.all(connections);
    await postgres.stop();
  }
});
