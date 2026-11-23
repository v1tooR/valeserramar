import { z } from "zod";
import { request } from "./client";

const statusSchema = z.object({
  status: z.enum(["available", "pending", "confirmed", "expired"]),
  url: z.string().startsWith("https://sandbox.asaas.com/checkoutSession/show").nullable(),
});
const planSchema = statusSchema.extend({
  code: z.string(),
  name: z.string(),
  cycle: z.enum(["MONTHLY", "YEARLY"]),
  amountCents: z.number().int().positive(),
  regularCents: z.number().int().positive().optional(),
});

export type SandboxPlan = z.infer<typeof planSchema>;
const plansSchema = z.array(planSchema);
const base = (businessId: string) =>
  "/businesses/" + encodeURIComponent(businessId) + "/asaas-sandbox";

export async function sandboxPlans(businessId: string) {
  return plansSchema.parse(await request(base(businessId)));
}

export async function sandboxAction(
  businessId: string,
  planCode: string,
  action: "checkout" | "status",
) {
  const path = base(businessId) + "/" + encodeURIComponent(planCode) + "/" + action;
  return statusSchema.parse(await request(path, { method: "POST" }));
}
