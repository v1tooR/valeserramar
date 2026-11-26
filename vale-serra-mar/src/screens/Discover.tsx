import { Alert } from "../components/Dialogs";
import { CollectionState } from "../components/CollectionState";
import { Tap as Pressable } from "../components/Motion";
import React, { useMemo, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { assets } from "../assets";
import {
  catalogFiltersFor,
  emptyCatalogFilters,
  regionForCity,
  regions,
  segments,
} from "../domain/catalog";
import {
  advertisingAgency,
  categoryForSelection,
  exploreCategories,
  foodTypes,
  lodgingTypes,
  type ExploreCategory,
} from "../domain/categories";
import { filterBusinesses, highlightedBusinesses } from "../domain/logic";
import type { Filters } from "../domain/models";
import { useStore } from "../store";
import { useNav, type ScreenProps } from "../navigation";
import { colors as c, styles as s } from "../theme";
import {
  Button,
  Chip,
  Field,
  Icon,
  Notice,
  Page,
  Row,
  Section,
  Toggle,
  type IconName,
} from "../components/ui";
import { BusinessCard } from "../components/BusinessCard";
import { HighlightCarousel } from "../components/HighlightCarousel";
const welcomePhotos: Record<string, number> = {
  "Serra da Mantiqueira": require("../../assets/regiao-serra.png"),
  "Vale do Paraíba": require("../../assets/regiao-vale.png"),
  "Litoral Norte": require("../../assets/regiao-litoral.png"),
};
export function WelcomeScreen() {
  const { state, update } = useStore(),
    nav = useNav();
  const [region, setRegion] = useState(state.region || regions[0].name);
  return (
    <Page
      title="Escolha sua região"
      back={false}
      scroll={false}
      footer={
        <>
          <Button
            title="Começar a explorar"
            icon="arrow-right"
            onPress={() => {
              update((s) => ({
                ...s,
                region,
                city: regions.find((r) => r.name === region)!.cities[0],
              }));
              nav.reset({ index: 0, routes: [{ name: "Home" }] });
            }}
          />
          <Text style={[s.muted, { textAlign: "center", fontSize: 12 }]}>
            Grátis para explorar. Sem precisar de conta.
          </Text>
        </>
      }
    >
      <ScrollView
        style={{ flex: 1 }}
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 20,
          paddingVertical: 10,
          gap: 10,
        }}
      >
        <View style={{ flex: 1, minHeight: 78, maxHeight: 170 }}>
          <Image
            source={assets.logoFull}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
        </View>
        <Text style={[s.title, { textAlign: "center", fontSize: 24, lineHeight: 28 }]}>
          Descubra o melhor{"\n"}da nossa região
        </Text>
        <Text style={[s.muted, { textAlign: "center" }]}>
          Restaurantes, hospedagens e serviços do Vale, da Serra e do Mar em um só
          lugar.
        </Text>
        {regions.map((r) => (
          <Pressable
            key={r.name}
            accessibilityRole="radio"
            accessibilityState={{ selected: region === r.name }}
            onPress={() => setRegion(r.name)}
            style={[
              s.card,
              s.row,
              {
                padding: 10,
                borderColor: region === r.name ? c.green : c.border,
                backgroundColor: region === r.name ? c.soft : c.white,
              },
            ]}
          >
            <Image
              source={welcomePhotos[r.name]}
              style={{ width: 58, height: 58, borderRadius: 12, flexShrink: 0 }}
              resizeMode="cover"
            />
            <View style={s.grow}>
              <Text style={[s.body, { fontWeight: "700" }]}>{r.name}</Text>
              <Text numberOfLines={2} style={[s.muted, { fontSize: 12, lineHeight: 16 }]}>
                {r.cities.slice(0, 3).join(", ")}
              </Text>
            </View>
            <Icon
              name={region === r.name ? "check-circle" : "circle"}
              size={21}
            />
          </Pressable>
        ))}
      </ScrollView>
    </Page>
  );
}
const categoryStyles: Record<
  ExploreCategory,
  { icon: IconName; color: string; accent: string }
> = {
  [advertisingAgency]: {
    icon: "target",
    color: "#FCE9EA",
    accent: "#8A3547",
  },
  Alimentação: {
    icon: "coffee",
    color: c.peach,
    accent: "#884321",
  },
  Comércio: {
    icon: "shopping-bag",
    color: c.blue,
    accent: "#265981",
  },
  "Estética e Beleza": {
    icon: "scissors",
    color: "#F3E8F7",
    accent: "#69417D",
  },
  Hospedagem: {
    icon: "home",
    color: c.mint,
    accent: c.green,
  },
  Lazer: {
    icon: "sun",
    color: c.yellow,
    accent: c.amber,
  },
  Serviços: {
    icon: "tool",
    color: "#E9EEF5",
    accent: "#45556D",
  },
};
const categoryColumns = 2;
const categoryRows = Array.from(
  { length: Math.ceil(exploreCategories.length / categoryColumns) },
  (_, row) =>
    exploreCategories.slice(row * categoryColumns, (row + 1) * categoryColumns),
);
const homeCategories = [
  { label: "Alimentação", category: "Alimentação" },
  { label: "Hospedagem", category: "Hospedagem" },
  { label: "Comércio", category: "Comércio" },
  { label: "Serviço", category: "Serviços" },
] as const satisfies readonly { label: string; category: ExploreCategory }[];
function HomeCategories() {
  const nav = useNav();
  const { setCatalogFilters } = useStore();
  return (
    <View style={[s.row, { alignItems: "flex-start", gap: 6 }]}>
      {homeCategories.map(({ label, category }) => {
        const { icon, color } = categoryStyles[category];
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            key={category}
            onPress={() => {
              setCatalogFilters({ segment: category, query: "" });
              nav.navigate("Results");
            }}
            style={{
              alignItems: "center",
              gap: 8,
              flex: 1,
              minWidth: 0,
              paddingVertical: 6,
            }}
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 15,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: color,
              }}
            >
              <Icon name={icon} size={25} />
            </View>
            <Text
              style={{
                fontSize: 11,
                color: c.dark,
                fontWeight: "600",
                textAlign: "center",
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
export function HomeScreen() {
  const { state } = useStore(),
    nav = useNav();
  const local = filterBusinesses(
    state.businesses,
    { ...emptyCatalogFilters, city: state.city },
    "",
    regionForCity(state.city) ?? state.region,
  );
  const sorted = [...local].sort(
    (a, b) =>
      Number(state.interests.includes(b.segment)) -
      Number(state.interests.includes(a.segment)),
  );
  const highlights = highlightedBusinesses(local, "home");
  return (
    <Page brand tab="Home">
      <View>
        <Text style={s.eyebrow}>Guia regional · {state.region}</Text>
        <Text style={s.title}>Descubra {state.city}</Text>
      </View>
      <Row
        title="Buscar lugares, pratos e serviços"
        icon="search"
        onPress={() => nav.navigate("Search")}
      />
      <HighlightCarousel businesses={highlights} />
      <Section
        title="Categorias"
        action="Ver todas"
        onPress={() => nav.navigate("Search")}
      />
      <HomeCategories />
      <CollectionState empty={!sorted.length && !highlights.length} />
      {sorted.length > 0 && <Section title="Na sua cidade" />}
      {sorted.slice(0, 3).map((b) => (
        <BusinessCard key={b.id} business={b} />
      ))}
    </Page>
  );
}
export function SearchScreen() {
  const { state, update, setCatalogFilters, loading, loadError } = useStore(),
    nav = useNav();
  const filters = catalogFiltersFor(state);
  const { query, city, region } = filters;
  const term = query.trim();
  const matches = useMemo(
    () => filterBusinesses(state.businesses, filters, term, region),
    [state.businesses, filters, term, region],
  );
  const search = (text: string) => {
    const value = text.trim();
    if (value) {
      setCatalogFilters({ query: value });
      update((s) => ({
        ...s,
        recent: [value, ...s.recent.filter((x) => x !== value)].slice(0, 6),
      }));
    }
    nav.navigate("Results");
  };
  const searchBar = (
    <View style={explore.section}>
      <Text accessibilityRole="header" style={s.title}>
        Explorar
      </Text>
      <View style={[s.row, explore.searchBar]}>
        <TextInput
          accessibilityLabel="Buscar no guia"
          placeholder="Nome, categoria ou cidade"
          placeholderTextColor="#586B61"
          style={explore.searchInput}
          value={query}
          onChangeText={(query) => setCatalogFilters({ query })}
          returnKeyType="search"
          onSubmitEditing={() => search(query)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buscar"
          style={explore.searchButton}
          onPress={() => search(query)}
        >
          <Icon name="search" size={22} color={c.white} />
        </Pressable>
      </View>
      <View style={s.wrap}>
        <Chip
          title={city || region || "Todas as regiões"}
          selected
          onPress={() => nav.navigate("Filters")}
        />
        <Chip title="Filtros" onPress={() => nav.navigate("Results")} />
      </View>
    </View>
  );
  if (term) {
    return (
      <Page tab="Search">
        {searchBar}
        <Section
          title={resultLabel(matches.length)}
          action="Ver lista"
          onPress={() => search(query)}
        />
        <CollectionState
          empty={matches.length === 0}
          title="Nenhum estabelecimento encontrado"
          description="Experimente outro nome, categoria ou cidade."
        />
        {matches.length === 0 && !loading && !loadError && region && (
          <Button
            secondary
            title="Buscar em todas as regiões"
            onPress={() => setCatalogFilters({ region: "", city: "" })}
          />
        )}
        {matches.slice(0, 6).map((business) => (
          <BusinessCard key={business.id} business={business} />
        ))}
      </Page>
    );
  }
  return (
    <Page tab="Search">
      {searchBar}
      <HighlightCarousel
        businesses={highlightedBusinesses(matches, "explore")}
      />
      <View style={explore.section}>
        <Section
          title="Buscar por categoria"
          action="Ver lista"
          onPress={() => nav.navigate("Results")}
        />
        <View style={explore.categoryGrid}>
          {categoryRows.map((row) => (
            <View key={row[0]} style={explore.categoryRow}>
              {row.map((category) => {
                const { icon, color, accent } = categoryStyles[category];
                return (
                  <Pressable
                    key={category}
                    accessibilityRole="button"
                    accessibilityLabel={category}
                    style={[explore.categoryCard, { backgroundColor: color }]}
                    onPress={() => {
                      setCatalogFilters({ segment: category });
                      nav.navigate("Results");
                    }}
                  >
                    <View style={explore.categoryCardTop}>
                      <View style={explore.categoryIcon}>
                        <Icon name={icon} size={36} color={accent} />
                      </View>
                      <Icon name="chevron-right" size={19} color={accent} />
                    </View>
                    <Text style={explore.categoryTitle}>{category}</Text>
                  </Pressable>
                );
              })}
              {row.length < categoryColumns && (
                <View style={explore.categorySpacer} />
              )}
            </View>
          ))}
        </View>
      </View>
      {state.recent.length > 0 && (
        <View style={explore.section}>
          <Section
            title="Buscas recentes"
            action="Limpar"
            onPress={() => update((s) => ({ ...s, recent: [] }))}
          />
          {state.recent.map((text) => (
            <Row
              key={text}
              title={text}
              icon="clock"
              onPress={() => search(text)}
            />
          ))}
        </View>
      )}
      <View style={explore.section}>
        <Section title="Buscar por cidade" />
        <View style={s.wrap}>
          {regions.flatMap((region) =>
            region.cities.map((city) => (
              <Chip
                key={city}
                title={city}
                selected={filters.city === city}
                onPress={() => {
                  setCatalogFilters({ city, region: region.name });
                  nav.navigate("Results");
                }}
              />
            )),
          )}
        </View>
      </View>
    </Page>
  );
}
const explore = StyleSheet.create({
  section: { gap: 12 },
  searchBar: {
    gap: 4,
    padding: 5,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    backgroundColor: c.soft,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    color: c.dark,
  },
  searchButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.green,
  },
  categoryGrid: { gap: 12 },
  categoryRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
  },
  categorySpacer: { flex: 1 },
  categoryCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 138,
    padding: 12,
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderColor: "#143D3114",
    borderRadius: 18,
  },
  categoryCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 6,
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFFB3",
  },
  categoryTitle: {
    minHeight: 42,
    color: c.dark,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
  },
});
function SubcategoryFilters({
  category,
  value,
  onChange,
}: {
  category: ExploreCategory | undefined;
  value: string;
  onChange: (value: string) => void;
}) {
  if (category !== "Alimentação" && category !== "Hospedagem") return null;
  const types = category === "Alimentação" ? foodTypes : lodgingTypes;

  return (
    <>
      <Section title="Subcategorias" />
      <View style={s.wrap}>
        <Chip
          title="Todas"
          selected={value === category}
          onPress={() => onChange(category)}
        />
        {types.map(({ label }) => (
          <Chip
            key={label}
            title={label}
            selected={value === label}
            onPress={() => onChange(label)}
          />
        ))}
      </View>
    </>
  );
}
function resultLabel(count: number) {
  return count === 1 ? "1 lugar encontrado" : `${count} lugares encontrados`;
}

type FilterGroup = "location" | "category" | "more";

export function ResultsScreen({ route }: ScreenProps) {
  const { state, loading, loadError, setCatalogFilters } = useStore(),
    nav = useNav();
  const filters = catalogFiltersFor(state);
  const { query, region } = filters;
  const [group, setGroup] = useState<FilterGroup | null>(
    route.name === "Filters" ? "location" : null,
  );
  const category = categoryForSelection(filters.segment);
  const results = filterBusinesses(state.businesses, filters, query, region);
  const availableCities = region
    ? (regions.find((item) => item.name === region)?.cities ?? [])
    : regions.flatMap((item) => item.cities);
  const hasMore = Boolean(
    filters.district.trim() || filters.menu || filters.reservations,
  );
  const defaultRegion = regionForCity(state.city) ?? state.region;
  const canClear =
    filters.city !== state.city ||
    region !== defaultRegion ||
    Boolean(filters.segment || filters.openNow || hasMore);

  const changeFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setCatalogFilters({ [key]: value });
  };
  const toggleGroup = (next: FilterGroup) => {
    setGroup((current) => (current === next ? null : next));
  };
  const chooseRegion = (nextRegion: string) => {
    setCatalogFilters({ region: nextRegion, city: "" });
  };
  const chooseCity = (city: string) => {
    setCatalogFilters({ city, region: regionForCity(city) ?? region });
    setGroup(null);
  };
  const chooseCategory = (segment: string) => {
    changeFilter("segment", segment);
    setGroup(null);
  };

  return (
    <Page title={category || "Estabelecimentos"} tab="Search" keyboardAware>
      <View style={explore.section}>
        <Field
          label="Busca"
          placeholder="Nome, categoria ou cidade"
          value={query}
          onChangeText={(query) => setCatalogFilters({ query })}
          action={
            query
              ? {
                  icon: "x",
                  label: "Limpar busca",
                  onPress: () => setCatalogFilters({ query: "" }),
                }
              : undefined
          }
        />
        <View style={s.wrap}>
          <Chip
            title={filters.city || region || "Todas as regiões"}
            selected={group === "location" || Boolean(filters.city || region)}
            onPress={() => toggleGroup("location")}
          />
          <Chip
            title={category || "Categoria"}
            selected={group === "category" || Boolean(filters.segment)}
            onPress={() => toggleGroup("category")}
          />
          <Chip
            title="Aberto agora"
            selected={filters.openNow}
            onPress={() => changeFilter("openNow", !filters.openNow)}
          />
          <Chip
            title="Mais filtros"
            selected={group === "more" || hasMore}
            onPress={() => toggleGroup("more")}
          />
        </View>
        <View style={s.between}>
          <Text style={s.label} accessibilityLiveRegion="polite">
            {resultLabel(results.length)}
          </Text>
          {canClear && (
            <Chip
              title="Limpar filtros"
              onPress={() => {
                setCatalogFilters({
                  ...emptyCatalogFilters,
                  city: state.city,
                  region: defaultRegion,
                  query,
                });
                setGroup(null);
              }}
            />
          )}
        </View>
        {group === "location" && (
          <View style={[s.card, { backgroundColor: c.soft }]}>
            <Section title="Região" />
            <View style={s.wrap}>
              <Chip
                title="Todas as regiões"
                selected={!region}
                onPress={() => chooseRegion("")}
              />
              {regions.map(({ name }) => (
                <Chip
                  key={name}
                  title={name}
                  selected={region === name}
                  onPress={() => chooseRegion(name)}
                />
              ))}
            </View>
            <Section title="Cidade" />
            <View style={s.wrap}>
              <Chip
                title="Todas as cidades"
                selected={!filters.city}
                onPress={() => chooseCity("")}
              />
              {availableCities.map((city) => (
                <Chip
                  key={city}
                  title={city}
                  selected={filters.city === city}
                  onPress={() => chooseCity(city)}
                />
              ))}
            </View>
          </View>
        )}
        {group === "category" && (
          <View style={[s.card, { backgroundColor: c.soft }]}>
            <Section title="Categoria" />
            <View style={s.wrap}>
              <Chip
                title="Todas as categorias"
                selected={!filters.segment}
                onPress={() => chooseCategory("")}
              />
              {exploreCategories.map((name) => (
                <Chip
                  key={name}
                  title={name}
                  selected={category === name}
                  onPress={() => chooseCategory(name)}
                />
              ))}
            </View>
          </View>
        )}
        {group === "more" && (
          <View style={[s.card, { backgroundColor: c.soft }]}>
            <Field
              label="Bairro"
              value={filters.district}
              onChangeText={(district) => changeFilter("district", district)}
            />
            <Toggle
              title="Cardápio digital"
              value={filters.menu}
              onChange={(menu) => changeFilter("menu", menu)}
            />
            <Toggle
              title="Aceita reservas"
              value={filters.reservations}
              onChange={(reservations) =>
                changeFilter("reservations", reservations)
              }
            />
          </View>
        )}
        <SubcategoryFilters
          category={category}
          value={filters.segment}
          onChange={(segment) => changeFilter("segment", segment)}
        />
      </View>
      <View style={s.row}>
        <Chip title="Lista" selected onPress={() => {}} />
        <Chip title="Mapa" onPress={() => nav.navigate("Map")} />
      </View>
      {category && (
        <HighlightCarousel
          businesses={highlightedBusinesses(results, "explore")}
        />
      )}
      {results.map((b) => (
        <BusinessCard key={b.id} business={b} />
      ))}
      <CollectionState
        empty={results.length === 0}
        title="Nenhum estabelecimento encontrado"
        description="Tente outro termo ou ajuste os filtros."
      />
      {results.length === 0 && !loading && !loadError && region && (
        <Button
          secondary
          title="Buscar em todas as regiões"
          onPress={() => {
            chooseRegion("");
            setGroup(null);
          }}
        />
      )}
    </Page>
  );
}
export function PreferencesScreen() {
  const { state, update } = useStore(),
    nav = useNav();
  const region =
    regions.find((item) => item.name === state.region) ?? regions[0];
  const city = region.cities.includes(state.city)
    ? state.city
    : region.cities[0];
  const chooseLocation = (region: (typeof regions)[number], city?: string) => {
    update((current) => {
      const nextCity =
        city ??
        (region.cities.includes(current.city)
          ? current.city
          : region.cities[0]);
      return {
        ...current,
        region: region.name,
        city: nextCity,
        catalogFilters: current.catalogFilters
          ? {
              ...current.catalogFilters,
              region: region.name,
              city: nextCity,
            }
          : null,
      };
    });
  };
  return (
    <Page
      title="Região e interesses"
      footer={
        <Button
          title="Ver estabelecimentos"
          onPress={() => nav.navigate("Results")}
        />
      }
    >
      <Section title="Sua região" />
      {regions.map((r) => (
        <Chip
          key={r.name}
          title={r.name}
          selected={r.name === region.name}
          onPress={() => chooseLocation(r)}
        />
      ))}
      <Section title="Cidade" />
      <View style={s.wrap}>
        {region.cities.map((name) => (
          <Chip
            key={name}
            title={name}
            selected={name === city}
            onPress={() => chooseLocation(region, name)}
          />
        ))}
      </View>
      <Section title="O que você gosta de explorar?" />
      <Text style={s.muted}>Escolha quantas opções quiser.</Text>
      <View style={s.wrap}>
        {segments.map((name) => (
          <Chip
            key={name}
            title={name}
            selected={state.interests.includes(name)}
            onPress={() =>
              update((current) => ({
                ...current,
                interests: current.interests.includes(name)
                  ? current.interests.filter((item) => item !== name)
                  : [...current.interests, name],
              }))
            }
          />
        ))}
      </View>
    </Page>
  );
}
export function ProfileScreen() {
  const { state } = useStore(),
    nav = useNav();
  return (
    <Page brand tab="Profile">
      <Text style={s.title}>Perfil</Text>
      <View style={[s.card, { backgroundColor: c.soft }]}>
        <Text style={s.heading}>
          {state.profile?.name || "Olá, visitante!"}
        </Text>
        <Text style={s.muted}>Explore livremente · {state.city}</Text>
        {!state.authenticated && (
          <Button
            title="Criar conta"
            icon="user-plus"
            onPress={() => nav.navigate("Auth", { signupFromProfile: true })}
          />
        )}
      </View>
      <Row
        title="Minhas reservas"
        subtitle={`${state.reservations.length} solicitações`}
        icon="calendar"
        onPress={() => nav.navigate("Reservations")}
      />
      <Row
        title="Favoritos"
        subtitle={`${state.favorites.length} lugares salvos`}
        icon="heart"
        onPress={() => nav.navigate("Favorites")}
      />
      <Row
        title="Região e interesses"
        subtitle={state.region}
        icon="map-pin"
        onPress={() => nav.navigate("Preferences")}
      />
      {state.authenticated && (
        <Row
          title="Área do anunciante"
          icon="briefcase"
          onPress={() => nav.navigate("Dashboard")}
        />
      )}
      <Row
        title="Ajuda e contato"
        icon="help-circle"
        onPress={() => nav.navigate("Help")}
      />
    </Page>
  );
}
export function FavoritesScreen() {
  const { state } = useStore();
  const favorites = state.businesses.filter(
    (b) => state.favorites.includes(b.id) && b.status === "Aprovado",
  );
  return (
    <Page title="Favoritos" tab="Profile">
      {favorites.length ? (
        favorites.map((b) => <BusinessCard key={b.id} business={b} />)
      ) : (
        <Notice>
          Toque no coração de um estabelecimento para salvar aqui.
        </Notice>
      )}
    </Page>
  );
}
export function HelpScreen() {
  return (
    <Page title="Ajuda">
      <Text style={s.title}>Como podemos ajudar?</Text>
      <Section title="Explore sem criar conta" />
      <Text style={s.body}>
        Escolha sua região para encontrar estabelecimentos, consultar cardápios
        e conhecer os serviços disponíveis.
      </Text>
      <Section title="Reservas com confirmação" />
      <Text style={s.body}>
        Sua solicitação fica pendente até o estabelecimento confirmar. Acompanhe
        a resposta em Minhas reservas.
      </Text>
      <Section title="Divulgue seu negócio" />
      <Text style={s.body}>
        Crie sua conta de anunciante, preencha os dados do negócio e envie para
        análise. Acompanhe o status na sua área.
      </Text>
      <Section title="Pedidos pelo WhatsApp" />
      <Text style={s.body}>
        Confira a mensagem e conclua o envio no WhatsApp. Pagamento e entrega
        são combinados com o estabelecimento.
      </Text>
    </Page>
  );
}
