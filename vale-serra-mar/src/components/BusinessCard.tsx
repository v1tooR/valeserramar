import { Tap as Pressable } from "./Motion";
import React from "react";
import { Image, Text, View } from "react-native";
import { photoSource } from "../assets";
import type { Business } from "../domain/models";
import { isOpen, isRestaurant } from "../domain/logic";
import { useStore } from "../store";
import { useNav } from "../navigation";
import { colors as c, styles as s } from "../theme";
import { Icon } from "./ui";
export function BusinessCard({
  business: b,
  compact = false,
}: {
  business: Business;
  compact?: boolean;
}) {
  const nav = useNav(),
    { state, update } = useStore();
  const saved = state.favorites.includes(b.id);
  return (
    <View style={[s.card, { padding: 10 }, compact && { width: 170 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver ${b.name}`}
        onPress={() => nav.navigate("Business", { businessId: b.id })}
        style={compact ? { gap: 8 } : s.row}
      >
        <Image
          source={photoSource(b.photo)}
          style={
            compact ? { width: "100%", height: 100, borderRadius: 12 } : s.thumb
          }
          resizeMode="cover"
        />
        <View style={s.grow}>
          <Text style={s.eyebrow}>{b.segment}</Text>
          <Text style={[s.body, { fontWeight: "700" }]}>{b.name}</Text>
          <Text style={s.muted}>
            {b.district} · {b.city}
          </Text>
          <Text style={{ fontSize: 11, color: isOpen(b) ? c.green : c.amber }}>
            {isOpen(b) ? "● Aberto agora" : "● Confira os horários"}
            {isRestaurant(b.segment) ? " · Cardápio" : ""}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          saved ? `Remover ${b.name} dos favoritos` : `Favoritar ${b.name}`
        }
        onPress={() =>
          update((s) => ({
            ...s,
            favorites: saved
              ? s.favorites.filter((id) => id !== b.id)
              : [...s.favorites, b.id],
          }))
        }
        style={{
          position: "absolute",
          top: 6,
          right: 6,
          padding: 8,
          borderRadius: 18,
          backgroundColor: c.white,
        }}
      >
        <Icon name="heart" size={18} color={saved ? "#C44B48" : c.muted} />
      </Pressable>
    </View>
  );
}
