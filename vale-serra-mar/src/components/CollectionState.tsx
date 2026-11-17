import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Button, Icon } from "./ui";
import { useStore } from "../store";
import { colors as c, styles as s } from "../theme";
export function CollectionState({
  empty,
  title = "Novos lugares estão chegando",
  description = "Explore as categorias ou escolha outra região para continuar.",
}: {
  empty: boolean;
  title?: string;
  description?: string;
}) {
  const { loading, loadError, refresh } = useStore();
  if (!loading && !loadError && !empty) return null;
  return (
    <View
      style={[
        s.card,
        { backgroundColor: c.soft, alignItems: "center", padding: 24, gap: 12 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.green} />
      ) : (
        <View
          style={{ padding: 18, borderRadius: 40, backgroundColor: c.mint }}
        >
          <Icon name={loadError ? "wifi-off" : "compass"} size={28} />
        </View>
      )}
      <Text style={[s.heading, { textAlign: "center" }]}>
        {loading
          ? "Encontrando lugares para você"
          : loadError
            ? "Não foi possível carregar"
            : title}
      </Text>
      <Text style={[s.muted, { textAlign: "center" }]}>
        {loading ? "Só um instante." : loadError || description}
      </Text>
      {!loading && loadError && (
        <Button
          secondary
          title="Tentar novamente"
          icon="refresh-cw"
          onPress={refresh}
        />
      )}
    </View>
  );
}
