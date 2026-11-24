import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Icon, Notice, Page, Toggle } from "../components/ui";
import {
  advertiserHighlights,
  advertiserPlans,
  quoteAdvertiserPlan,
  type AdvertiserHighlightId,
  type AdvertiserPlanSelection,
} from "../domain/advertiserPlans";
import { emptyBusiness, regions } from "../domain/catalog";
import { money } from "../domain/logic";
import { useNav, type ScreenProps } from "../navigation";
import { uid, useStore } from "../store";
import { colors as c, styles as s } from "../theme";

const price = (cents: number, interval: string) =>
  `${money(cents / 100)} / ${interval}`;

export function AdvertiserPlansScreen() {
  const nav = useNav();
  return (
    <Page title="Planos de anúncio">
      <View style={styles.hero}>
        <View style={styles.launchPill}>
          <Icon name="tag" size={14} color={c.dark} />
          <Text style={styles.launchLabel}>Promoção de lançamento</Text>
        </View>
        <Text accessibilityRole="header" style={styles.heroTitle}>
          Anuncie seu negócio no guia
        </Text>
        <Text style={styles.heroCopy}>
          Escolha um plano para cadastrar seu estabelecimento.
        </Text>
      </View>
      {Object.values(advertiserPlans).map((plan) => (
        <View
          key={plan.id}
          style={[
            s.card,
            styles.plan,
            plan.id === "annual" && styles.annualPlan,
          ]}
        >
          <View style={styles.planHeading}>
            <Text accessibilityRole="header" style={s.heading}>
              Plano {plan.label.toLowerCase()}
            </Text>
            <Text style={styles.savings}>
              Economize {money((plan.regularCents - plan.launchCents) / 100)}
            </Text>
          </View>
          <Text style={styles.oldPrice}>
            {price(plan.regularCents, plan.interval)}
          </Text>
          <View style={s.wrap}>
            <Text style={styles.promotionalPrice}>
              {money(plan.launchCents / 100)}
            </Text>
            <Text style={styles.interval}>/ {plan.interval}</Text>
          </View>
          <Button
            title={`Assinar plano ${plan.label.toLowerCase()}`}
            icon="arrow-right"
            secondary={plan.id === "monthly"}
            onPress={() =>
              nav.navigate("BusinessPlanReview", { advertiserPlanId: plan.id })
            }
          />
        </View>
      ))}
    </Page>
  );
}

export function AdvertiserPlanTotals({
  selection,
}: {
  selection: AdvertiserPlanSelection;
}) {
  const { plan, highlights, totalCents } = quoteAdvertiserPlan(selection);
  const annualWithHighlights = plan.id === "annual" && highlights.length > 0;
  return (
    <View style={[s.card, styles.summary]} accessibilityLiveRegion="polite">
      <Text accessibilityRole="header" style={s.heading}>
        Resumo do plano
      </Text>
      <View style={styles.line}>
        <Text style={[s.body, s.grow]}>
          Plano {plan.label.toLowerCase()} promocional
        </Text>
        <Text style={s.body}>{price(plan.launchCents, plan.interval)}</Text>
      </View>
      {highlights.map((highlight) => (
        <View key={highlight.id} style={styles.line}>
          <Text style={[s.body, s.grow]}>{highlight.label}</Text>
          <Text style={s.body}>{price(highlight.monthlyCents, "mês")}</Text>
        </View>
      ))}
      <View style={s.divider} />
      <Text style={styles.totalLabel}>
        {annualWithHighlights
          ? "Total estimado em 12 meses"
          : "Total promocional"}
      </Text>
      <Text style={styles.promotionalPrice}>
        {annualWithHighlights
          ? money(totalCents / 100)
          : price(totalCents, plan.interval)}
      </Text>
      {annualWithHighlights && (
        <Text style={s.muted}>
          Inclui o plano anual e 12 meses dos destaques selecionados.
        </Text>
      )}
    </View>
  );
}

export function BusinessPlanReviewScreen({ route }: ScreenProps) {
  const nav = useNav();
  const { state, saveDraft } = useStore();
  const [highlights, setHighlights] = useState<AdvertiserHighlightId[]>([]);
  const planId = route.params?.advertiserPlanId;
  const plan =
    planId && Object.hasOwn(advertiserPlans, planId)
      ? advertiserPlans[planId]
      : null;
  if (!plan)
    return (
      <Page title="Planos de anúncio">
        <Button
          title="Escolher plano"
          onPress={() => nav.replace("BusinessWelcome")}
        />
      </Page>
    );

  const selection = { planId: plan.id, highlights };

  function beginRegistration() {
    const business = {
      ...emptyBusiness(`draft-${uid()}`),
      phone: state.profile?.phone || "",
      region: state.region || regions[0].name,
      city: state.city || "Caçapava",
      draftPlan: selection,
    };
    saveDraft(business);
    const stack = nav.getState();
    const { routes } = stack;
    const previousRoutes = routes.slice(
      0,
      routes.at(-2)?.name === "BusinessWelcome" ? -2 : -1,
    );
    nav.reset({
      ...stack,
      index: previousRoutes.length,
      routes: [
        ...previousRoutes,
        {
          key: `BusinessWizard-${business.id}`,
          name: "BusinessWizard",
          params: { businessId: business.id, step: 0 },
        },
      ],
    });
  }

  return (
    <Page
      title="Plano e destaques"
      footer={
        <Button
          title="Continuar para o cadastro"
          icon="arrow-right"
          onPress={beginRegistration}
        />
      }
    >
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={s.title}>
          Destaques opcionais
        </Text>
        <Text style={s.muted}>
          Escolha onde destacar seu anúncio. Cada destaque tem valor mensal.
        </Text>
      </View>
      <View style={styles.options}>
        {advertiserHighlights.map((highlight) => (
          <View
            key={highlight.id}
            style={[
              s.card,
              highlights.includes(highlight.id) && styles.selected,
            ]}
          >
            <Toggle
              title={highlight.label}
              subtitle={price(highlight.monthlyCents, "mês")}
              value={highlights.includes(highlight.id)}
              onChange={(enabled) =>
                setHighlights((current) =>
                  enabled
                    ? [...current, highlight.id]
                    : current.filter((id) => id !== highlight.id),
                )
              }
            />
          </View>
        ))}
      </View>
      <AdvertiserPlanTotals selection={selection} />
      <Notice tone="blue">
        Pagamentos em breve. Nesta versão, você pode seguir com o cadastro sem
        cobrança.
      </Notice>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: c.dark, borderRadius: 22, padding: 20, gap: 9 },
  launchPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    backgroundColor: c.yellow,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  launchLabel: { color: c.dark, fontSize: 12, fontWeight: "700" },
  heroTitle: {
    color: c.white,
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 32,
  },
  heroCopy: { color: c.mint, fontSize: 14, lineHeight: 20 },
  plan: { gap: 7 },
  annualPlan: { borderColor: c.green, backgroundColor: c.soft },
  planHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  savings: {
    backgroundColor: c.yellow,
    color: "#714D08",
    borderRadius: 10,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  oldPrice: {
    color: c.muted,
    textDecorationLine: "line-through",
    fontSize: 14,
  },
  promotionalPrice: {
    color: c.dark,
    fontSize: 25,
    fontWeight: "800",
    lineHeight: 32,
    fontVariant: ["tabular-nums"],
  },
  interval: { color: c.muted, fontWeight: "600", alignSelf: "center" },
  intro: { gap: 6 },
  options: { gap: 10 },
  selected: { backgroundColor: c.soft, borderColor: c.green },
  summary: { backgroundColor: c.soft, gap: 10 },
  line: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 8,
  },
  totalLabel: { color: c.green, fontWeight: "700", fontSize: 14 },
});
