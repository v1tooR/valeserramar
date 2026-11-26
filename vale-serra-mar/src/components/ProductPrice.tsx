import React from "react";
import { Text, View } from "react-native";
import { activeOffer, money } from "../domain/logic";
import type { Product } from "../domain/models";
import { colors as c, styles as s } from "../theme";
import { Badge } from "./ui";

export function ProductPrice({ product }: { product: Product }) {
  const offer = activeOffer(product);
  return (
    <View style={[s.wrap, { alignItems: "center" }]}>
      {offer && (
        <Text style={[s.muted, { textDecorationLine: "line-through" }]}>
          {money(product.price)}
        </Text>
      )}
      <Text style={[s.body, { fontWeight: "700", color: c.green }]}>
        {money(offer?.price ?? product.price)}
      </Text>
      {offer && <Badge text="Oferta" />}
    </View>
  );
}
