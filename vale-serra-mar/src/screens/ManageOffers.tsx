import React, { useRef, useState } from "react";
import { Text, View } from "react-native";
import { errorMessage } from "../api/client";
import { Tap } from "../components/Motion";
import {
  Button,
  Chip,
  Field,
  Icon,
  Notice,
  Page,
  Section,
} from "../components/ui";
import { activeOffer, money, normalize } from "../domain/logic";
import type { OfferInput } from "../domain/models";
import { useNav, type ScreenProps } from "../navigation";
import { uid, useStore } from "../store";
import { colors as c, styles as s } from "../theme";

const expiryFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});

export function ManageOffersScreen({ route }: ScreenProps) {
  const nav = useNav();
  const { state, createOffers } = useStore();
  const businessId = route.params?.businessId || state.businessId;
  const business = state.businesses.find((item) => item.id === businessId);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [duration, setDuration] = useState("1");
  const [unit, setUnit] = useState<"horas" | "dias">("dias");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const attempted = useRef<{ body: string; key: string } | null>(null);
  const products = state.products
    .filter(
      (product) =>
        product.businessId === businessId &&
        product.available &&
        product.price > 0 &&
        !product.id.startsWith("draft-"),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const selection = products.filter((product) =>
    Object.hasOwn(prices, product.id),
  );
  const term = normalize(query);
  const visibleProducts = products.filter((product) =>
    normalize(product.name).includes(term),
  );

  async function publish() {
    setSuccess("");
    setError("");
    const durationHours = Number(duration) * (unit === "dias" ? 24 : 1);
    if (
      !/^\d+$/.test(duration.trim()) ||
      durationHours < 1 ||
      durationHours > 2147483647
    )
      return setError("Informe uma duração válida em horas ou dias inteiros.");
    const data: OfferInput = { durationHours, products: [] };
    for (const product of selection) {
      const value = prices[product.id].trim();
      const cents = Math.round(Number(value.replace(",", ".")) * 100);
      if (!/^\d+(?:[,.]\d{1,2})?$/.test(value) || cents / 100 >= product.price)
        return setError(
          `Informe um preço válido e menor que o normal para ${product.name}.`,
        );
      data.products.push({ productId: product.id, priceCents: cents });
    }
    if (!data.products.length) return;

    const body = JSON.stringify(data);
    if (attempted.current?.body !== body)
      attempted.current = { body, key: uid() };
    try {
      const updated = await createOffers(
        businessId,
        data,
        attempted.current.key,
      );
      const expiresAt = updated[0]?.offer?.expiresAt;
      setSuccess(
        expiresAt
          ? `Oferta publicada até ${expiryFormat.format(new Date(expiresAt))}.`
          : "Oferta publicada.",
      );
      attempted.current = null;
      setPrices({});
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  if (!products.length)
    return (
      <Page title="Ofertas" subtitle={business?.name}>
        <Notice>
          Cadastre um produto disponível com preço para criar uma oferta.
        </Notice>
        <Button
          title="Gerenciar produtos"
          onPress={() => nav.navigate("ManageMenu", { businessId })}
        />
      </Page>
    );

  return (
    <Page
      title="Ofertas"
      subtitle={business?.name}
      keyboardAware
      footer={
        <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
          {!!error && <Notice tone="red">{error}</Notice>}
          {!!success && <Notice>{success}</Notice>}
          <Button
            title={
              selection.length
                ? `Publicar oferta · ${selection.length}`
                : "Publicar oferta"
            }
            icon="tag"
            disabled={!selection.length}
            onPress={publish}
          />
        </View>
      }
    >
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={s.title}>
          Criar oferta
        </Text>
        <Text style={s.muted}>
          Selecione os produtos e informe o preço promocional de cada item. Uma
          nova oferta substitui a anterior dos produtos selecionados.
        </Text>
      </View>
      <Field label="Buscar produto" value={query} onChangeText={setQuery} />
      <View style={{ gap: 10 }}>
        {visibleProducts.map((product) => {
          const selected = Object.hasOwn(prices, product.id);
          const offer = activeOffer(product);
          return (
            <View
              key={product.id}
              style={[
                s.card,
                selected && { borderColor: c.green, backgroundColor: c.soft },
              ]}
            >
              <Tap
                accessibilityRole="checkbox"
                accessibilityLabel={`Selecionar ${product.name}`}
                accessibilityState={{ checked: selected }}
                onPress={() => {
                  setPrices((current) => {
                    if (!Object.hasOwn(current, product.id))
                      return { ...current, [product.id]: "" };
                    const next = { ...current };
                    delete next[product.id];
                    return next;
                  });
                }}
                style={[s.row, { minHeight: 44 }]}
              >
                <Icon name={selected ? "check-square" : "square"} />
                <View style={s.grow}>
                  <Text style={s.heading}>{product.name}</Text>
                  <Text style={s.muted}>
                    Preço normal · {money(product.price)}
                  </Text>
                  {offer && (
                    <Text style={s.label}>
                      {money(offer.price)} até{" "}
                      {expiryFormat.format(new Date(offer.expiresAt))}
                    </Text>
                  )}
                </View>
              </Tap>
              {selected && (
                <Field
                  label={`Preço em oferta · ${product.name}`}
                  placeholder="0,00"
                  keyboardType="decimal-pad"
                  value={prices[product.id]}
                  onChangeText={(price) =>
                    setPrices((current) => ({
                      ...current,
                      [product.id]: price,
                    }))
                  }
                />
              )}
            </View>
          );
        })}
        {!visibleProducts.length && <Notice>Nenhum produto encontrado.</Notice>}
      </View>
      <View style={[s.card, { gap: 12 }]}>
        <Section title="Duração" />
        <View style={s.wrap}>
          <Chip
            title="Horas"
            selected={unit === "horas"}
            onPress={() => setUnit("horas")}
          />
          <Chip
            title="Dias"
            selected={unit === "dias"}
            onPress={() => setUnit("dias")}
          />
        </View>
        <Field
          label={`Duração em ${unit}`}
          keyboardType="number-pad"
          value={duration}
          onChangeText={setDuration}
        />
        <Text style={s.muted}>
          O prazo começa na publicação. Ao terminar, o preço normal volta
          automaticamente.
        </Text>
      </View>
    </Page>
  );
}
