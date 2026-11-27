import { Alert } from "../components/Dialogs";
import { CollectionState } from "../components/CollectionState";
import { Tap as Pressable } from "../components/Motion";
import React, { useMemo, useRef, useState } from "react";
import { Keyboard, StyleSheet, Text, TextInput, View } from "react-native";
import {
  allCities,
  catalogFiltersFor,
  compareNames,
  emptyCatalogFilters,
  regionForCity,
  regions,
} from "../domain/catalog";
import {
  categoryForSelection,
  exploreCategories,
  foodTypes,
  lodgingTypes,
  serviceTypes,
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
const categoryStyles: Record<
  ExploreCategory,
  { icon: IconName; color: string; accent: string }
> = {
  Alimentação: { icon: "coffee", color: c.peach, accent: "#884321" },
  Comércio: { icon: "shopping-bag", color: c.blue, accent: "#265981" },
  "Estética e Beleza": {
    icon: "scissors",
    color: "#F3E8F7",
    accent: "#69417D",
  },
  Hospedagem: { icon: "home", color: c.mint, accent: c.green },
  Lazer: { icon: "sun", color: c.yellow, accent: c.amber },
  Serviços: { icon: "tool", color: "#E9EEF5", accent: "#45556D" },
};
const categoryColumns = 3;
const categoryRows = Array.from(
  { length: Math.ceil(exploreCategories.length / categoryColumns) },
  (_, row) =>
    exploreCategories.slice(row * categoryColumns, (row + 1) * categoryColumns),
);

function HomeCategories() {
  const nav = useNav();
  const { setCatalogFilters } = useStore();
  return (
    <View testID="home-category-grid" style={homeStyles.categoryGrid}>
      {categoryRows.map((row) => (
        <View key={row[0]} style={homeStyles.categoryRow}>
          {row.map((category) => {
            const { icon, color, accent } = categoryStyles[category];
            return (
              <Pressable
                key={category}
                accessibilityRole="button"
                accessibilityLabel={category}
                style={[homeStyles.categoryCard, { backgroundColor: color }]}
                onPress={() => {
                  setCatalogFilters({ segment: category, query: "" });
                  nav.navigate("Results");
                }}
              >
                <View style={homeStyles.categoryIcon}>
                  <Icon name={icon} size={23} color={accent} />
                </View>
                <Text style={homeStyles.categoryTitle}>{category}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const placesPerPage = 6;

export function HomeScreen() {
  const { state, update } = useStore();
  const nav = useNav();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [query, setQuery] = useState("");
  const [searchEverywhere, setSearchEverywhere] = useState(false);
  const [visibleCount, setVisibleCount] = useState(placesPerPage);
  const [showRecent, setShowRecent] = useState(false);
  const term = query.trim();
  const city = state.city;
  const region = regionForCity(city) ?? state.region;
  const local = useMemo(
    () =>
      filterBusinesses(
        state.businesses,
        { ...emptyCatalogFilters, city },
        "",
        region,
      ),
    [state.businesses, city, region],
  );
  const matches = useMemo(() => {
    if (!term) return local;
    return filterBusinesses(
      state.businesses,
      { ...emptyCatalogFilters, city: searchEverywhere ? "" : city },
      term,
      searchEverywhere ? "" : region,
    );
  }, [state.businesses, city, local, region, searchEverywhere, term]);
  const highlights = useMemo(
    () => highlightedBusinesses(local, "home"),
    [local],
  );
  const startAdvertising = () =>
    nav.navigate(state.authenticated ? "BusinessWelcome" : "Advertise");

  function changeQuery(value: string) {
    setQuery(value);
    setVisibleCount(placesPerPage);
    if (!value.trim()) setSearchEverywhere(false);
  }

  function submitSearch(value: string) {
    const text = value.trim();
    if (!text) {
      input.current?.focus();
      return;
    }
    changeQuery(text);
    setShowRecent(false);
    update((saved) => ({
      ...saved,
      recent: [text, ...saved.recent.filter((item) => item !== text)].slice(
        0,
        6,
      ),
    }));
    Keyboard.dismiss();
  }

  function changeScope(everywhere: boolean) {
    setSearchEverywhere(everywhere);
    setVisibleCount(placesPerPage);
  }

  return (
    <Page brand tab="Home" keyboardAware onAdvertisePress={startAdvertising}>
      <View>
        <Text style={s.eyebrow}>Guia regional · {state.region}</Text>
        <Text accessibilityRole="header" style={s.title}>
          Descubra {city}
        </Text>
      </View>
      <View style={homeStyles.searchSection}>
        <View style={homeStyles.searchBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buscar"
            onPress={() => submitSearch(query)}
            style={homeStyles.searchButton}
          >
            <Icon name="search" size={20} color={c.white} />
          </Pressable>
          <TextInput
            ref={input}
            accessibilityLabel="Buscar no guia"
            placeholder="Nome, categoria ou cidade"
            placeholderTextColor="#586B61"
            style={homeStyles.searchInput}
            value={query}
            onFocus={() => setShowRecent(true)}
            onChangeText={changeQuery}
            returnKeyType="search"
            onSubmitEditing={() => submitSearch(query)}
          />
          {!!query && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Limpar busca"
              style={homeStyles.clearSearch}
              onPress={() => {
                changeQuery("");
                setShowRecent(false);
              }}
            >
              <Icon name="x" size={20} />
            </Pressable>
          )}
        </View>
        {!term && showRecent && state.recent.length > 0 && (
          <View style={homeStyles.searchSection}>
            <Section
              title="Buscas recentes"
              action="Limpar"
              onPress={() => update((saved) => ({ ...saved, recent: [] }))}
            />
            <View style={s.wrap}>
              {state.recent.map((text) => (
                <Chip
                  key={text}
                  title={text}
                  onPress={() => submitSearch(text)}
                />
              ))}
            </View>
          </View>
        )}
        {!!term && (
          <View style={s.wrap}>
            <Chip
              title={city}
              selected={!searchEverywhere}
              onPress={() => changeScope(false)}
            />
            <Chip
              title="Todas as cidades"
              selected={searchEverywhere}
              onPress={() => changeScope(true)}
            />
          </View>
        )}
      </View>
      {term ? (
        <Text
          style={s.heading}
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
        >
          {resultLabel(matches.length)}
        </Text>
      ) : (
        <>
          <HighlightCarousel
            businesses={highlights}
            onAdvertise={startAdvertising}
          />
          <Section title="Categorias" />
          <HomeCategories />
          <Section title="Na sua cidade" />
        </>
      )}
      <CollectionState
        empty={matches.length === 0}
        title={term ? "Nenhum estabelecimento encontrado" : undefined}
        description={
          term
            ? "Tente outro termo ou amplie a busca para todas as cidades."
            : undefined
        }
      />
      {matches.slice(0, visibleCount).map((business) => (
        <BusinessCard key={business.id} business={business} />
      ))}
      {matches.length > visibleCount && (
        <Button
          secondary
          title="Mostrar mais lugares"
          icon="chevron-down"
          onPress={() => setVisibleCount((count) => count + placesPerPage)}
        />
      )}
    </Page>
  );
}

const homeStyles = StyleSheet.create({
  searchSection: { gap: 10 },
  searchBar: {
    ...s.row,
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
    minHeight: 44,
    paddingHorizontal: 7,
    paddingVertical: 8,
    fontSize: 15,
    color: c.dark,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.green,
  },
  clearSearch: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryGrid: { gap: 8 },
  categoryRow: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  categoryCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 94,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    paddingVertical: 9,
    gap: 6,
    borderWidth: 1,
    borderColor: "#143D3114",
    borderRadius: 15,
  },
  categoryIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFFB3",
  },
  categoryTitle: {
    color: c.dark,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    textAlign: "center",
  },
});

const subcategoryTypes: Partial<Record<ExploreCategory, typeof foodTypes>> = {
  Alimentação: foodTypes,
  Hospedagem: lodgingTypes,
  Serviços: serviceTypes,
};

function SubcategoryFilters({
  category,
  value,
  onChange,
}: {
  category: ExploreCategory | undefined;
  value: string;
  onChange: (value: string) => void;
}) {
  if (!category) return null;
  const choices = subcategoryTypes[category];
  if (!choices) return null;

  return (
    <>
      <Section title="Subcategorias" />
      <View style={s.wrap}>
        <Chip
          title="Todas"
          selected={value === category}
          onPress={() => onChange(category)}
        />
        {choices.map(({ label }) => (
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
    : allCities;
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
    <Page
      title={filters.segment || "Estabelecimentos"}
      tab="Home"
      keyboardAware
    >
      <View style={homeStyles.searchSection}>
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
        title="Trocar cidade"
        subtitle={state.city}
        icon="map-pin"
        onPress={() => nav.navigate("ChooseCity")}
      />
      <Row
        title="Configurações"
        subtitle="Dados e gerenciamento da conta"
        icon="settings"
        onPress={() => nav.navigate("Settings")}
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
  const favorites = state.businesses
    .filter((b) => state.favorites.includes(b.id) && b.status === "Aprovado")
    .sort((a, b) => compareNames(a.name, b.name));
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
        Escolha sua região e cidade para encontrar estabelecimentos, consultar
        cardápios e conhecer os serviços disponíveis.
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
