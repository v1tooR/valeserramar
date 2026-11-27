import React, { useMemo } from "react";
import {
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { assets } from "../assets";
import { Tap } from "../components/Motion";
import { Button, Icon, Page } from "../components/ui";
import { usePagedCarousel } from "../components/usePagedCarousel";
import { cityKey, regions, visitCity } from "../domain/catalog";
import { useNav, type ScreenProps } from "../navigation";
import { useStore } from "../store";
import { colors as c, styles as s } from "../theme";

export function ChooseCityScreen({ route }: ScreenProps) {
  const nav = useNav();
  const { state, update, loadError } = useStore();
  const regionName = route.params?.locationRegion ?? state.region;
  const region = regions.find(({ name }) => name === regionName) ?? regions[0];
  const changing = route.params?.changeLocation === true;
  const { cities } = region;
  const { current, width, goTo, onLayout, scrollProps } = usePagedCarousel(
    cities.length,
    region.name,
    {
      initialIndex: cities.findIndex(
        (name) => cityKey(name) === cityKey(state.city),
      ),
      sideInset: 24,
    },
  );
  const city = cities[current];
  const listings = useMemo(() => {
    const totals = new Map<string, number>();
    for (const business of state.businesses) {
      if (business.status !== "Aprovado") continue;
      const key = cityKey(business.city);
      totals.set(key, (totals.get(key) ?? 0) + 1);
    }
    return totals;
  }, [state.businesses]);
  const showListings = listings.size > 0 && !loadError;

  function confirmLocation() {
    update((saved) => visitCity(saved, city));
    if (changing) nav.goBack();
    else nav.reset({ index: 0, routes: [{ name: "Home" }] });
  }

  return (
    <Page
      title="Localização"
      scroll={false}
      footer={
        <Button
          title={changing ? "Confirmar cidade" : `Explorar ${city}`}
          icon={changing ? "check" : "arrow-right"}
          onPress={confirmLocation}
        />
      }
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.intro}>
          <Image
            source={assets.logo}
            style={styles.logo}
            resizeMode="contain"
            accessible={false}
          />
          <View style={styles.steps}>
            <View style={styles.step}>
              <Icon name="check" size={14} />
              <Text style={styles.stepLabel}>Região</Text>
            </View>
            <Icon name="chevron-right" size={14} color={c.muted} />
            <View style={[styles.step, styles.stepCurrent]}>
              <Icon name="map-pin" size={14} />
              <Text style={[styles.stepLabel, styles.stepCurrentLabel]}>
                Cidade
              </Text>
            </View>
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            Escolha sua cidade
          </Text>
        </View>

        <View style={styles.panel}>
          <ImageBackground
            source={region.photo}
            style={styles.cover}
            resizeMode="cover"
            resizeMethod="resize"
            imageStyle={styles.coverImage}
          >
            <View style={styles.shade} />
            <View style={styles.region}>
              <Icon name="map" size={15} color={c.white} />
              <Text style={styles.regionLabel}>{region.name}</Text>
            </View>
          </ImageBackground>
          <View testID="city-carousel" onLayout={onLayout} style={styles.viewport}>
            {width > 0 && (
              <ScrollView {...scrollProps} keyboardShouldPersistTaps="handled">
                {cities.map((name, index) => {
                  const selected = index === current;
                  const total = listings.get(cityKey(name)) ?? 0;
                  return (
                    <View
                      key={name}
                      style={[styles.slide, { width }]}
                      accessibilityElementsHidden={!selected}
                      importantForAccessibility={
                        selected ? "auto" : "no-hide-descendants"
                      }
                      aria-hidden={!selected}
                    >
                      <Tap
                        accessibilityRole="radio"
                        accessibilityLabel={name}
                        accessibilityState={{ checked: selected, selected }}
                        focusable={selected}
                        onPress={() => goTo(index)}
                        style={[
                          styles.cityCard,
                          selected && styles.cityCardSelected,
                        ]}
                      >
                        <View style={styles.cityIcon}>
                          <Icon name="map-pin" size={21} />
                        </View>
                        <View style={styles.cityInfo}>
                          <Text style={styles.cityName}>{name}</Text>
                          {showListings && (
                            <Text style={styles.cityDetail}>
                              {total === 0
                                ? "Sem estabelecimentos listados"
                                : total === 1
                                  ? "1 lugar no guia"
                                  : `${total} lugares no guia`}
                            </Text>
                          )}
                        </View>
                        <Icon
                          name={selected ? "check-circle" : "circle"}
                          size={20}
                        />
                      </Tap>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
          <View style={styles.pagination}>
            {cities.map((name, index) => (
              <Tap
                key={name}
                accessibilityRole="button"
                accessibilityLabel={`Mostrar ${name}`}
                accessibilityState={{ selected: current === index }}
                onPress={() => goTo(index)}
                style={styles.dotTarget}
              >
                <View
                  style={[styles.dot, current === index && styles.dotActive]}
                />
              </Tap>
            ))}
          </View>
        </View>
        <Text style={styles.hint}>
          Deslize ou toque nas bolinhas para ver as cidades.
        </Text>
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  intro: { alignItems: "center", gap: 10, marginBottom: 4 },
  logo: { width: 168, height: 56, marginBottom: 2 },
  steps: { ...s.row, gap: 7 },
  step: {
    ...s.row,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: c.soft,
  },
  stepCurrent: { backgroundColor: c.mint },
  stepLabel: { color: "#50665C", fontSize: 12, fontWeight: "600" },
  stepCurrentLabel: { color: c.green, fontWeight: "700" },
  title: { ...s.title, fontSize: 29, lineHeight: 34, textAlign: "center" },
  panel: {
    backgroundColor: c.soft,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: c.border,
    paddingBottom: 3,
    overflow: "hidden",
  },
  cover: {
    aspectRatio: 1.95,
    maxHeight: 220,
    justifyContent: "flex-end",
    alignItems: "flex-start",
    backgroundColor: c.dark,
    padding: 13,
  },
  coverImage: { backgroundColor: c.mint },
  shade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(11, 42, 32, 0.12)",
  },
  region: {
    ...s.row,
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "rgba(20, 61, 49, 0.94)",
  },
  regionLabel: {
    color: c.white,
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  viewport: { minHeight: 86 },
  slide: { paddingHorizontal: 5, paddingTop: 12, paddingBottom: 2 },
  cityCard: {
    ...s.row,
    flexGrow: 1,
    minHeight: 78,
    paddingHorizontal: 11,
    paddingVertical: 11,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 17,
    backgroundColor: c.white,
  },
  cityCardSelected: { borderColor: c.green, backgroundColor: "#FAFDFA" },
  cityIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: c.mint,
    justifyContent: "center",
    alignItems: "center",
  },
  cityInfo: { flex: 1, minWidth: 0, gap: 4 },
  cityName: { fontSize: 19, lineHeight: 23, fontWeight: "700", color: c.dark },
  cityDetail: { fontSize: 12, lineHeight: 16, color: "#50665C" },
  pagination: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  dotTarget: {
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 7, height: 7, borderRadius: 5, backgroundColor: "#93A89C" },
  dotActive: { width: 18, height: 8, backgroundColor: c.green },
  hint: { ...s.muted, color: "#50665C", textAlign: "center" },
});
