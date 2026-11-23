import React, { useRef, useState } from "react";
import { Text, View } from "react-native";
import { sandboxAction, sandboxPlans, type SandboxPlan } from "../api/asaasSandbox";
import { errorMessage } from "../api/client";
import { RemoteStatus, useRemote } from "../components/RemoteStatus";
import { Button, Notice, Page } from "../components/ui";
import { money } from "../domain/logic";
import { openExternal } from "../services/external";
import { styles as s } from "../theme";

const statusLabel: Record<SandboxPlan["status"], string> = {
  available: "Disponível para teste",
  pending: "Aguardando pagamento",
  confirmed: "Pagamento de teste confirmado",
  expired: "Checkout expirado",
};

export function SandboxSubscription({ businessId }: { businessId: string }) {
  const plans = useRemote(() => businessId ? sandboxPlans(businessId) : Promise.resolve([]), [businessId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const actionInProgress = useRef(false);

  async function act(plan: SandboxPlan, action: "checkout" | "status") {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await sandboxAction(businessId, plan.code, action);
      await plans.reload();
      if (action === "checkout" && result.url) await openExternal(result.url);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      actionInProgress.current = false;
      setBusy(false);
    }
  }

  return (
    <Page title="Assinatura">
      <Notice tone="blue">Ambiente Sandbox do Asaas. Use dados fictícios de pagamento.</Notice>
      {!businessId && <Notice>Envie o cadastro do estabelecimento de teste para análise.</Notice>}
      <RemoteStatus resource={plans} />
      {!!error && <Notice tone="red">{error}</Notice>}
      {plans.value?.map((plan) => (
        <View key={plan.code} style={[s.card, { gap: 8 }]}>
          <Text style={s.heading}>{plan.name}</Text>
          {plan.regularCents !== undefined && (
            <Text style={s.muted}>Preço normal {money(plan.regularCents / 100)}</Text>
          )}
          <Text style={s.label}>
            {plan.regularCents !== undefined && "Promoção de lançamento · "}
            {money(plan.amountCents / 100)} por {plan.cycle === "YEARLY" ? "ano" : "mês"}
          </Text>
          <Text accessibilityLiveRegion="polite" style={s.muted}>{statusLabel[plan.status]}</Text>
          {plan.status !== "confirmed" && (
            <Button
              title={plan.status === "pending" ? "Abrir checkout" : "Testar pagamento"}
              onPress={() => act(plan, "checkout")}
              disabled={busy}
            />
          )}
          {(plan.status === "pending" || plan.status === "expired") && (
            <Button
              title="Atualizar pagamento"
              onPress={() => act(plan, "status")}
              disabled={busy}
              secondary
            />
          )}
        </View>
      ))}
    </Page>
  );
}
