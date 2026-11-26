import React from "react";
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import { colors as c } from "../theme";
import { Tap } from "./Motion";
import { Icon } from "./ui";
import { usePagedCarousel } from "./usePagedCarousel";

const announcementArtwork: ImageSourcePropType = require("../../assets/inicio-anuncie.jpg");
const tabs = ["Estabelecimentos", "Anúncio"];

export function HomeBannerCarousel({
  region,
  regionPhoto,
  onDiscover,
  onAdvertise,
}: {
  region: string;
  regionPhoto: ImageSourcePropType;
  onDiscover: () => void;
  onAdvertise: () => void;
}) {
  const { current, goTo, width, onLayout, scrollProps } = usePagedCarousel(
    tabs.length,
    region,
  );

  return (
    <View>
      <View style={styles.viewport} onLayout={onLayout}>
        {width > 0 && (
          <ScrollView {...scrollProps} style={styles.track}>
            <View
              style={{ width }}
              accessibilityElementsHidden={current !== 0}
              importantForAccessibility={
                current === 0 ? "auto" : "no-hide-descendants"
              }
              aria-hidden={current !== 0}
            >
              <Tap
                accessibilityRole="button"
                accessibilityLabel="Ver estabelecimentos"
                focusable={current === 0}
                style={styles.card}
                onPress={onDiscover}
              >
                <ImageBackground
                  source={regionPhoto}
                  style={styles.catalogArtwork}
                  resizeMode="cover"
                >
                  <View style={styles.catalogAction}>
                    <Text style={styles.catalogLabel}>
                      Ver estabelecimentos
                    </Text>
                    <Icon name="arrow-right" color={c.white} size={19} />
                  </View>
                </ImageBackground>
              </Tap>
            </View>
            <View
              style={{ width }}
              accessibilityElementsHidden={current !== 1}
              importantForAccessibility={
                current === 1 ? "auto" : "no-hide-descendants"
              }
              aria-hidden={current !== 1}
            >
              <Tap
                accessibilityRole="button"
                accessibilityLabel="Quero anunciar meu negócio"
                focusable={current === 1}
                style={styles.card}
                onPress={onAdvertise}
              >
                <ImageBackground
                  source={announcementArtwork}
                  style={styles.adArtwork}
                  resizeMode="cover"
                >
                  <View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, styles.adShade]}
                  />
                  <View style={styles.adContent}>
                    <View style={styles.adBrand}>
                      <Icon name="map-pin" color={c.yellow} size={13} />
                      <Text style={styles.adLabel}>Vale, Serra e Mar</Text>
                    </View>
                    <Text style={styles.adTitle}>Seu negócio{"\n"}no mapa</Text>
                    <View style={styles.adAction}>
                      <Text style={styles.adActionLabel}>Quero anunciar</Text>
                      <Icon name="arrow-up-right" color={c.dark} size={16} />
                    </View>
                  </View>
                </ImageBackground>
              </Tap>
            </View>
          </ScrollView>
        )}
      </View>
      <View style={styles.pager}>
        {tabs.map((tab, index) => (
          <Tap
            key={tab}
            accessibilityRole="button"
            accessibilityLabel={`Mostrar ${tab.toLowerCase()}`}
            accessibilityState={{ selected: index === current }}
            disabled={!width}
            style={styles.selector}
            onPress={() => goTo(index)}
          >
            <View
              style={[styles.selection, index === current && styles.selected]}
            >
              <View
                style={[styles.dot, index === current && styles.activeDot]}
              />
              <Text
                style={[
                  styles.selectorLabel,
                  index === current && styles.selectedLabel,
                ]}
              >
                {tab}
              </Text>
            </View>
          </Tap>
        ))}
      </View>
    </View>
  );
}

const cardHeight = 210;
const styles = StyleSheet.create({
  viewport: {
    minHeight: cardHeight,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: c.dark,
  },
  track: { flexGrow: 0 },
  card: { flex: 1, backgroundColor: c.dark },
  catalogArtwork: {
    minHeight: cardHeight,
    flex: 1,
    justifyContent: "flex-end",
  },
  catalogAction: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: "rgba(15, 57, 44, 0.94)",
  },
  catalogLabel: {
    flexShrink: 1,
    color: c.white,
    fontSize: 16,
    fontWeight: "700",
  },
  adArtwork: { minHeight: cardHeight, flex: 1, justifyContent: "center" },
  adShade: {
    backgroundColor: "rgba(8, 36, 29, 0.26)",
  },
  adContent: {
    paddingHorizontal: 17,
    paddingVertical: 16,
    alignItems: "flex-start",
    gap: 9,
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
    fontSize: 26,
    lineHeight: 28,
    fontWeight: "800",
    textShadowColor: "#102F28",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
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
  pager: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    columnGap: 2,
  },
  selector: { minHeight: 44, justifyContent: "center", paddingHorizontal: 2 },
  selection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
  },
  selected: { backgroundColor: c.mint },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#75897E" },
  activeDot: { backgroundColor: c.green },
  selectorLabel: { fontSize: 12, color: "#536D61", fontWeight: "500" },
  selectedLabel: { color: c.dark, fontWeight: "700" },
});
