export const advertiserPlans = {
  annual: {
    id: "annual",
    label: "Anual",
    interval: "ano",
    months: 12,
    regularCents: 112000,
    launchCents: 80000,
  },
  monthly: {
    id: "monthly",
    label: "Mensal",
    interval: "mês",
    months: 1,
    regularCents: 12200,
    launchCents: 8700,
  },
} as const;

export const advertiserHighlights = [
  { id: "home", label: "Página inicial", monthlyCents: 10000 },
  { id: "category", label: "Página da categoria", monthlyCents: 7500 },
] as const;

export type AdvertiserPlanId = keyof typeof advertiserPlans;
export type AdvertiserHighlightId = (typeof advertiserHighlights)[number]["id"];
export type AdvertiserPlanSelection = {
  planId: AdvertiserPlanId;
  highlights: AdvertiserHighlightId[];
};

export function quoteAdvertiserPlan(selection: AdvertiserPlanSelection) {
  const plan = advertiserPlans[selection.planId];
  const highlights = advertiserHighlights.filter(({ id }) =>
    selection.highlights.includes(id),
  );
  const highlightsMonthlyCents = highlights.reduce(
    (sum, highlight) => sum + highlight.monthlyCents,
    0,
  );
  return {
    plan,
    highlights,
    highlightsMonthlyCents,
    totalCents: plan.launchCents + highlightsMonthlyCents * plan.months,
  };
}
