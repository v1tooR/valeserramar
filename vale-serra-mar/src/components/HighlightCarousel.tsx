import React, { useState } from "react";
import {
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import { cityKey, compareNames } from "../domain/catalog";
import type { Business } from "../domain/models";
import { useNav } from "../navigation";
import { colors as c, styles as s } from "../theme";
import { BannerImage, bannerAspectRatio } from "./BusinessPhotos";
import { Tap } from "./Motion";
import { Chip, Icon, Section } from "./ui";
import { usePagedCarousel } from "./usePagedCarousel";

const autoAdvanceMs = 5000;
const dotTargetWidth = 24;
const announcementArtwork: ImageSourcePropType = require("../../assets/inicio-anuncie.jpg");

export function HighlightCarousel({
  businesses,
  onAdvertise,
}: {
  businesses: Business[];
  onAdvertise?: () => void;
}) {
  const nav = useNav();
  const [selectedCity, setSelectedCity] = useState("");
  const groups = new Map<string, { label: string; banners: Business[] }>();
  for (const business of businesses) {
    const key = cityKey(business.city);
    const group = groups.get(key);
    if (group) group.banners.push(business);
    else groups.set(key, { label: business.city, banners: [business] });
  }
  const cities = [...groups].sort(([, a], [, b]) => compareNames(a.label, b.label));
  const city = groups.has(selectedCity) ? selectedCity : cities[0]?.[0] ?? "";
  const banners = groups.get(city)?.banners ?? [];
  const slides = banners.map((business) => business.id).join(",");
  const count = banners.length + (onAdvertise ? 1 : 0);
  const { current, goTo, width, onLayout, scrollProps } = usePagedCarousel(
    count,
    onAdvertise ? `advertise:${slides}` : slides,
    { interval: autoAdvanceMs },
  );

  if (!count) return null;

  const maxDotsPerRow = Math.max(1, Math.floor(width / dotTargetWidth));
  const dotRows = Math.ceil(count / maxDotsPerRow);
  const paginationWidth = Math.ceil(count / dotRows) * dotTargetWidth;

  return (
    <View style={styles.section}>
      {banners.length > 0 && <Section title="Em destaque" />}
      {cities.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityLabel="Cidades dos destaques"
          contentContainerStyle={styles.cities}
        >
          {cities.map(([key, group]) => (
            <Chip
              key={key}
              title={group.label}
              selected={key === city}
              onPress={() => setSelectedCity(key)}
            />
          ))}
        </ScrollView>
      )}
      <View onLayout={onLayout}>
        {width > 0 && (
          <ScrollView {...scrollProps}>
            {onAdvertise && (
              <View
                style={[styles.slide, { width }]}
                accessibilityElementsHidden={current !== 0}
                importantForAccessibility={
                  current === 0 ? "auto" : "no-hide-descendants"
                }
                aria-hidden={current !== 0}
              >
                <Tap
                  accessibilityRole="button"
                  accessibilityLabel="Quero anunciar meu negócio"
                  focusable={current === 0}
                  style={styles.card}
                  onPress={onAdvertise}
                >
                  <View style={styles.surface}>
                    <ImageBackground
                      source={announcementArtwork}
                      style={[styles.letterbox, styles.adArtwork]}
                      resizeMode="cover"
                    >
                      <View pointerEvents="none" style={styles.adShade} />
                      <View style={styles.adBrand}>
                        <Icon name="map-pin" color={c.yellow} size={13} />
                        <Text style={styles.adLabel}>Vale, Serra e Mar</Text>
                      </View>
                      <Text style={styles.adTitle}>Seu negócio{"\n"}no mapa</Text>
                    </ImageBackground>
                    <View style={[styles.caption, styles.adCaption]}>
                      <View style={styles.adAction}>
                        <Text style={styles.adActionLabel}>Quero anunciar</Text>
                        <Icon name="arrow-up-right" color={c.dark} size={16} />
                      </View>
                    </View>
                  </View>
                </Tap>
              </View>
            )}
            {banners.map((business) => (
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
        {width > 0 && count > 1 && (
          <View style={[styles.pagination, { width: paginationWidth }]}>
            {Array.from({ length: count }, (_, index) => (
              <Pressable
                key={index}
                accessibilityRole="button"
                accessibilityLabel={`Mostrar slide ${index + 1} de ${count}`}
                accessibilityState={{ selected: current === index }}
                style={({ pressed }) => [
                  styles.dotTarget,
                  pressed && styles.dotPressed,
                ]}
                onPress={() => goTo(index)}
              >
                <View
                  style={[styles.dot, current === index && styles.activeDot]}
                />
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  cities: { gap: 6, paddingHorizontal: 6 },
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
  adArtwork: {
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 17,
    paddingVertical: 12,
  },
  adShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(8, 36, 29, 0.26)",
  },
  adBrand: { flexDirection: "row", alignItems: "center", gap: 5 },
  adLabel: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: c.yellow,
  },
  adTitle: {
    color: c.white,
    fontSize: 24,
    lineHeight: 27,
    fontWeight: "800",
    textShadowColor: "#102F28",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  caption: {
    flexGrow: 1,
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  adCaption: { alignItems: "flex-start" },
  adAction: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F7CD70",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  adActionLabel: {
    flexShrink: 1,
    color: c.dark,
    fontSize: 13,
    fontWeight: "700",
  },
  location: { flexDirection: "row", alignItems: "center", gap: 5 },
  city: { flexShrink: 1, fontSize: 13, lineHeight: 18, color: "#536D61" },
  pagination: {
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: -6,
  },
  dotTarget: {
    width: dotTargetWidth,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  dotPressed: { opacity: 0.55 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: c.muted,
  },
  activeDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: c.mint,
    backgroundColor: c.green,
  },
});
