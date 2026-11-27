import React, { useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { assets } from "../assets";
import { Tap } from "../components/Motion";
import { Icon, Page } from "../components/ui";
import { cityKey, regionForCity, regions, visitCity } from "../domain/catalog";
import { useNav } from "../navigation";
import { useStore } from "../store";
import { colors as c, styles as s } from "../theme";

export function ChooseCityScreen() {
  const nav = useNav();
  const { state, update, loadError } = useStore();
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const savedRegion = regionForCity(state.city) ?? state.region;
  const savedCityKey = cityKey(state.city);
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

  function selectCity(city: string) {
    update((saved) => visitCity(saved, city));
    if (nav.canGoBack()) nav.goBack();
    else nav.reset({ index: 0, routes: [{ name: "Home" }] });
  }

  return (
    <Page title="Localização" back={nav.canGoBack()} scroll={false}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.intro}>
          <Image
            source={assets.logoFull}
            style={styles.logo}
            resizeMode="contain"
            accessible
            accessibilityLabel="Vale, Serra e Mar"
          />
          <Text accessibilityRole="header" style={styles.title}>
            Escolha sua cidade
          </Text>
          <Text style={styles.hint}>
            Abra uma região e toque na cidade que quer explorar.
          </Text>
        </View>

        <View style={styles.regions}>
          <Text accessibilityRole="header" style={s.eyebrow}>
            Regiões
          </Text>
          {regions.map(({ name, cities, photo }) => {
            const expanded = expandedRegion === name;
            const currentCity = savedRegion === name ? state.city : "";
            return (
              <View
                key={name}
                style={[styles.region, expanded && styles.regionOpen]}
              >
                <Tap
                  accessibilityRole="button"
                  accessibilityLabel={name}
                  accessibilityHint={
                    currentCity ? `${currentCity}, cidade atual` : undefined
                  }
                  aria-expanded={expanded}
                  onPress={() =>
                    setExpandedRegion((current) =>
                      current === name ? null : name,
                    )
                  }
                  style={[
                    styles.regionButton,
                    expanded && styles.regionButtonOpen,
                  ]}
                >
                  <Image
                    source={photo}
                    style={styles.regionPhoto}
                    resizeMode="cover"
                    resizeMethod="resize"
                    accessible={false}
                  />
                  <View style={styles.regionText}>
                    <Text style={styles.regionName}>{name}</Text>
                    {currentCity ? (
                      <View style={styles.current}>
                        <Icon name="map-pin" size={12} />
                        <Text style={styles.currentText}>{currentCity}</Text>
                      </View>
                    ) : (
                      <Text style={styles.detail}>{cities.length} cidades</Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.regionArrow,
                      expanded && styles.regionArrowOpen,
                    ]}
                  >
                    <Icon
                      name={expanded ? "chevron-up" : "chevron-down"}
                      size={20}
                    />
                  </View>
                </Tap>
                {expanded && (
                  <View style={styles.cities}>
                    {cities.map((city) => {
                      const key = cityKey(city);
                      const current = key === savedCityKey;
                      const total = listings.get(key) ?? 0;
                      return (
                        <Tap
                          key={city}
                          accessibilityRole="button"
                          accessibilityLabel={
                            current ? `${city}, cidade atual` : city
                          }
                          accessibilityState={{ selected: current }}
                          onPress={() => selectCity(city)}
                          style={[
                            styles.cityButton,
                            current && styles.cityCurrent,
                          ]}
                        >
                          <View style={styles.cityIcon}>
                            <Icon name="map-pin" size={17} />
                          </View>
                          <View style={styles.cityText}>
                            <Text style={styles.cityName}>{city}</Text>
                            {showListings && (
                              <Text style={styles.detail}>
                                {total === 0
                                  ? "Sem lugares no guia"
                                  : total === 1
                                    ? "1 lugar no guia"
                                    : `${total} lugares no guia`}
                              </Text>
                            )}
                          </View>
                          <Icon
                            name={current ? "check" : "chevron-right"}
                            size={17}
                          />
                        </Tap>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 20,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  intro: { alignItems: "center", gap: 4 },
  logo: { width: 174, height: 174, marginTop: -18, marginBottom: -20 },
  title: { ...s.title, fontSize: 28, lineHeight: 34, textAlign: "center" },
  hint: { ...s.muted, textAlign: "center", maxWidth: 300 },
  regions: { gap: 10 },
  region: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.white,
    overflow: "hidden",
  },
  regionOpen: { borderColor: "#A6CBB9", backgroundColor: c.soft },
  regionButton: { ...s.row, minHeight: 76, padding: 10, gap: 12 },
  regionButtonOpen: { backgroundColor: c.mint },
  regionPhoto: { width: 54, height: 54, borderRadius: 12, flexShrink: 0 },
  regionText: { flex: 1, minWidth: 0, gap: 2 },
  regionName: {
    color: c.dark,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  current: { ...s.row, gap: 4 },
  currentText: {
    color: c.green,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    flexShrink: 1,
  },
  detail: { color: "#536A5F", fontSize: 12, lineHeight: 17 },
  regionArrow: {
    width: 33,
    height: 33,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: c.soft,
  },
  regionArrowOpen: { backgroundColor: c.white },
  cities: { padding: 8, gap: 5 },
  cityButton: {
    ...s.row,
    minHeight: 48,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 11,
    backgroundColor: c.white,
  },
  cityCurrent: { backgroundColor: "#D8EFE2" },
  cityIcon: {
    width: 30,
    height: 30,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: c.mint,
  },
  cityText: { flex: 1, minWidth: 0 },
  cityName: { color: c.dark, fontSize: 14, lineHeight: 19, fontWeight: "600" },
});
