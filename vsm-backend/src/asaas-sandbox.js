import { randomUUID } from "node:crypto";
import { owned } from "./catalog.js";
import { row, rows, transaction } from "./db.js";
import { fail, session } from "./security.js";

const asaasApi = "https://api-sandbox.asaas.com/v3";
const asaasCheckout = "https://sandbox.asaas.com";
const expirationMinutes = 30;
const confirmedStatuses = new Set(["CONFIRMED", "RECEIVED"]);
const brazilDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" });
const plans = [
  { code: "mensal", name: "Plano mensal", cycle: "MONTHLY", amountCents: 8700, regularCents: 12200 },
  { code: "anual", name: "Plano anual", cycle: "YEARLY", amountCents: 80000, regularCents: 112000 },
  { code: "destaque-inicio", name: "Destaque na página inicial", cycle: "MONTHLY", amountCents: 10000 },
  { code: "destaque-categoria", name: "Destaque na categoria", cycle: "MONTHLY", amountCents: 7500 },
];
const asaasId = /^[a-zA-Z0-9_-]{1,100}$/;

function checkoutView(checkout) {
  if (!checkout) return { status: "available", url: null };
  if (checkout.payment_id) return { status: "confirmed", url: null };
  if (checkout.expires_at <= Date.now()) return { status: "expired", url: null };
  return { status: "pending", url: checkout.checkout_url };
}

export async function asaasSandboxRoutes(app, {
  db, origin, apiKey, testerEmail, fetcher = globalThis.fetch,
}) {
  const returnUrl = origin + "/asaas-sandbox/retorno";
  const path = "/businesses/:id/asaas-sandbox";

  async function asaas(request, endpoint, body) {
    let response;
    try {
      response = await fetcher(asaasApi + endpoint, {
        method: body ? "POST" : "GET",
        headers: {
          accept: "application/json",
          access_token: apiKey,
          "user-agent": "VilaSerraMarSandbox/1.0",
          ...(body && { "content-type": "application/json" }),
        },
        ...(body && { body: JSON.stringify(body) }),
        redirect: "error",
        signal: AbortSignal.timeout(6000),
      });
      if (response.ok) return await response.json();
    } catch {
      request.log.warn("Falha na comunicação com o Sandbox Asaas");
      fail(502, "Falha na comunicação com o Sandbox Asaas.");
    }
    request.log.warn({ asaasStatus: response.status }, "Solicitação recusada pelo Sandbox Asaas");
    fail(502, "Solicitação recusada pelo Sandbox Asaas.");
  }

  async function businessForTest(client, request, lock = false) {
    const { accountId } = await session(client, request);
    const account = await row(client, "SELECT email FROM vsm.accounts WHERE id=$1", [accountId]);
    if (account?.email !== testerEmail) fail(403, "Use a conta de teste configurada no servidor.");
    return owned(client, request.params.id, accountId, lock);
  }

  function selectedPlan(request) {
    const plan = plans.find(({ code }) => code === request.params.code);
    if (!plan) fail(404, "Plano de teste indisponível.");
    return plan;
  }

  async function paymentStatus(client, request, checkout) {
    if (!checkout || checkout.payment_id) return checkout;
    const search = new URLSearchParams({ checkoutSession: checkout.checkout_id, limit: "20" });
    const result = await asaas(request, "/payments?" + search);
    if (!Array.isArray(result?.data)) fail(502, "Resposta inválida do Sandbox Asaas.");
    const payment = result.data.find((item) =>
      item?.checkoutSession === checkout.checkout_id &&
      confirmedStatuses.has(item.status) &&
      item.billingType === "CREDIT_CARD" &&
      typeof item.value === "number" && Math.round(item.value * 100) === checkout.amount_cents &&
      asaasId.test(item.id ?? "") && asaasId.test(item.subscription ?? ""),
    );
    if (!payment) return checkout;
    return row(client, `
      UPDATE vsm.asaas_sandbox_checkouts SET payment_id=$2, subscription_id=$3
      WHERE checkout_id=$1 RETURNING *
    `, [checkout.checkout_id, payment.id, payment.subscription]);
  }

  async function findCheckout(client, businessId, code) {
    return row(client, `
      SELECT * FROM vsm.asaas_sandbox_checkouts WHERE business_id=$1 AND plan_code=$2
    `, [businessId, code]);
  }

  app.addHook("onRequest", async (_request, reply) => {
    reply.header("cache-control", "no-store");
  });

  app.get(path, async (request) => {
    const business = await businessForTest(db, request);
    const checkouts = await rows(db, "SELECT * FROM vsm.asaas_sandbox_checkouts WHERE business_id=$1", [business.id]);
    return plans.map((plan) => ({ ...plan, ...checkoutView(checkouts.find((c) => c.plan_code === plan.code)) }));
  });

  const limited = { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } };
  app.post(path + "/:code/checkout", limited, (request) => transaction(db, async (client) => {
    const business = await businessForTest(client, request, true);
    const plan = selectedPlan(request);
    const existing = await findCheckout(client, business.id, plan.code);
    const view = checkoutView(existing);
    if (view.status === "pending" || view.status === "confirmed") return view;
    if (existing) {
      const reconciled = checkoutView(await paymentStatus(client, request, existing));
      if (reconciled.status === "confirmed") return reconciled;
    }

    const date = brazilDate.format(new Date());
    const expiresAt = new Date(Date.now() + expirationMinutes * 60_000);
    const result = await asaas(request, "/checkouts", {
      billingTypes: ["CREDIT_CARD"],
      chargeTypes: ["RECURRENT"],
      minutesToExpire: expirationMinutes,
      externalReference: randomUUID(),
      callback: { successUrl: returnUrl, cancelUrl: returnUrl, expiredUrl: returnUrl },
      items: [{ name: plan.name, description: "Vila Serra e Mar — teste Sandbox", quantity: 1, value: plan.amountCents / 100 }],
      subscription: { cycle: plan.cycle, nextDueDate: date },
    });
    const checkoutId = result?.id;
    if (typeof checkoutId !== "string" || !asaasId.test(checkoutId)) {
      request.log.warn("Asaas Sandbox retornou um identificador de checkout inválido");
      fail(502, "Checkout inválido.");
    }
    const checkoutUrl = asaasCheckout + "/checkoutSession/show/" + checkoutId;

    const checkout = await row(client, `
      INSERT INTO vsm.asaas_sandbox_checkouts
        (business_id, plan_code, checkout_id, checkout_url, amount_cents, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (business_id, plan_code) DO UPDATE SET
        checkout_id=EXCLUDED.checkout_id, checkout_url=EXCLUDED.checkout_url,
        amount_cents=EXCLUDED.amount_cents, expires_at=EXCLUDED.expires_at,
        payment_id=NULL, subscription_id=NULL
      RETURNING *
    `, [business.id, plan.code, checkoutId, checkoutUrl, plan.amountCents, expiresAt]);
    return checkoutView(checkout);
  }));

  app.post(path + "/:code/status", limited, (request) => transaction(db, async (client) => {
    const business = await businessForTest(client, request, true);
    const plan = selectedPlan(request);
    const checkout = await findCheckout(client, business.id, plan.code);
    return checkoutView(await paymentStatus(client, request, checkout));
  }));

  app.get("/asaas-sandbox/retorno", async (_request, reply) =>
    reply.type("text/html; charset=utf-8").send(`
      <!doctype html><html lang="pt-BR"><meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Vila Serra e Mar · Sandbox</title>
      <main><h1>Teste de pagamento</h1>
      <p>Volte ao app e toque em Atualizar pagamento para conferir o resultado.</p></main></html>
    `),
  );
}
