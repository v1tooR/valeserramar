import React, { useState } from "react";
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { photoSource } from "../assets";
import type { Business } from "../domain/models";
import { useNav } from "../navigation";
import { colors as c, styles as s } from "../theme";
import { Tap } from "./Motion";
import { Icon, Section } from "./ui";
import { usePagedCarousel } from "./usePagedCarousel";

const autoAdvanceMs = 5000;
const bannerAspectRatio = 16 / 9;

function BannerImage({ photo }: { photo: Business["photo"] }) {
  const source = photoSource(photo);
  const [fillBackground, setFillBackground] = useState(false);

  return (
    <View style={styles.letterbox}>
      {fillBackground && (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={StyleSheet.absoluteFill}
        >
          <Image
            source={source}
            style={styles.backdrop}
            resizeMode="cover"
            resizeMethod="resize"
            blurRadius={22}
          />
          <View style={styles.shade} />
        </View>
      )}
      <Image
        source={source}
        style={styles.image}
        resizeMode="contain"
        onLoad={({ nativeEvent }) => {
          const { width, height } = nativeEvent.source ?? {};
          setFillBackground(
            !width ||
              !height ||
              width !== Math.round(height * bannerAspectRatio),
          );
        }}
      />
    </View>
  );
}

export function HighlightCarousel({ businesses }: { businesses: Business[] }) {
  const nav = useNav();
  const slides = businesses.map((business) => business.id).join(",");
  const count = businesses.length;
  const { current, move, width, onLayout, scrollProps } = usePagedCarousel(
    count,
    slides,
    autoAdvanceMs,
  );

  if (!count) return null;

  return (
    <View style={styles.section}>
      <Section title="Em destaque" />
      <View onLayout={onLayout}>
        {width > 0 && (
          <ScrollView {...scrollProps}>
            {businesses.map((business) => (
              <View key={business.id} style={[styles.slide, { width }]}>
                <Tap
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir ${business.name}`}
                  style={styles.card}
                  onPress={() =>
                    nav.navigate("Business", { businessId: business.id })
                  }
                >
                  <View style={styles.surface}>
                    <BannerImage key={business.photo} photo={business.photo} />
                    <View style={styles.caption}>
                      <Text style={s.heading} numberOfLines={2}>
                        {business.name}
                      </Text>
                      {!!business.city && (
                        <View style={styles.location}>
                          <Icon name="map-pin" size={14} />
                          <Text style={styles.city} numberOfLines={1}>
                            {business.city}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Tap>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
      {count > 1 && (
        <View style={styles.controls}>
          <Tap
            accessibilityRole="button"
            accessibilityLabel="Destaque anterior"
            disabled={!width}
            style={styles.arrow}
            onPress={() => move(-1)}
          >
            <Icon name="chevron-left" size={20} />
          </Tap>
          <Text style={styles.counter}>
            {current + 1} de {count}
          </Text>
          <Tap
            accessibilityRole="button"
            accessibilityLabel="Próximo destaque"
            disabled={!width}
            style={styles.arrow}
            onPress={() => move(1)}
          >
            <Icon name="chevron-right" size={20} />
          </Tap>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  slide: { paddingHorizontal: 6, paddingTop: 3, paddingBottom: 18 },
  card: {
    flexGrow: 1,
    borderRadius: 20,
    backgroundColor: c.white,
    ...Platform.select({
      android: { elevation: 5, shadowColor: c.dark },
      ios: {
        shadowColor: c.dark,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 10,
      },
      web: { boxShadow: "0px 7px 16px rgba(20, 61, 49, 0.16)" },
    }),
  },
  surface: {
    flexGrow: 1,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: c.white,
  },
  letterbox: {
    width: "100%",
    aspectRatio: bannerAspectRatio,
    overflow: "hidden",
    backgroundColor: "#172F28",
  },
  image: { width: "100%", height: "100%" },
  backdrop: {
    width: "100%",
    height: "100%",
    transform: [{ scale: 1.12 }],
  },
  shade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15, 39, 31, 0.24)",
  },
  caption: {
    flexGrow: 1,
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  location: { flexDirection: "row", alignItems: "center", gap: 5 },
  city: { flexShrink: 1, fontSize: 13, lineHeight: 18, color: "#536D61" },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  counter: {
    minWidth: 64,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: c.soft,
    color: c.dark,
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.white,
  },
});
