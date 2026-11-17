import { Tap as Pressable } from "./Motion";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { dateKey, parseDate } from "../domain/logic";
import { colors as c, styles as s } from "../theme";
import { IconButton } from "./ui";
export function Calendar({
  start,
  end = "",
  onSelect,
  pastAllowed = false,
}: {
  start: string;
  end?: string;
  onSelect: (day: string) => void;
  pastAllowed?: boolean;
}) {
  const [month, setMonth] = useState(() => {
    const d = parseDate(start) || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const slots = Array.from(
    { length: month.getDay() + days },
    (_, i) => i - month.getDay() + 1,
  );
  return (
    <View style={{ gap: 12 }}>
      <View style={s.between}>
        <Text
          style={[s.body, { fontWeight: "700", textTransform: "capitalize" }]}
        >
          {month.toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          })}
        </Text>
        <View style={s.row}>
          <IconButton
            icon="chevron-left"
            label="Mês anterior"
            onPress={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          />
          <IconButton
            icon="chevron-right"
            label="Próximo mês"
            onPress={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          />
        </View>
      </View>
      <View style={{ flexDirection: "row" }}>
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <Text
            key={i}
            style={[s.muted, { width: "14.2857%", textAlign: "center" }]}
          >
            {d}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {slots.map((day, i) => {
          if (day < 1)
            return <View key={i} style={{ width: "14.2857%", height: 44 }} />;
          const value = dateKey(
              new Date(month.getFullYear(), month.getMonth(), day),
            ),
            disabled = !pastAllowed && value < dateKey(new Date());
          const selected = value === start || value === end,
            range = end && value > start && value < end;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={value}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onSelect(value)}
              style={{ width: "14.2857%", height: 44, padding: 2 }}
            >
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  backgroundColor: selected
                    ? c.green
                    : range
                      ? c.mint
                      : c.white,
                }}
              >
                <Text
                  style={{
                    color: disabled ? "#CFD8D2" : selected ? c.white : c.dark,
                  }}
                >
                  {day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
