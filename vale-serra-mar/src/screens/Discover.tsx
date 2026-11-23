import { Alert } from "../components/Dialogs";
import { CollectionState } from "../components/CollectionState";
import { Tap as Pressable } from "../components/Motion";
import React, { useState } from "react";
import {
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { assets, photoSource } from "../assets";
import { regionForCity, regions, segments } from "../domain/catalog";
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
  Badge,
  Button,
  Chip,
  Field,
  Icon,
  IconButton,
  Notice,
  Page,
  Row,
  Section,
  Toggle,
  type IconName,
} from "../components/ui";
import { BusinessCard } from "../components/BusinessCard";
import { HighlightCarousel } from "../components/HighlightCarousel";
export const emptyFilters: Filters = {
  city: "",
  segment: "",
  district: "",
  openNow: false,
  menu: false,
  reservations: false,
};
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
      <View style={{ flex: 1, minHeight: 0, paddingHorizontal: 20, paddingVertical: 8, gap: 10 }}>
      <View style={{ flex: 1, minHeight: 0, maxHeight: 170 }}>
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
      <Text style={{ fontSize: 17, lineHeight: 22, fontWeight: "700", color: c.dark }}>Qual região vamos explorar?</Text>
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
            <Text numberOfLines={2} style={[s.muted, { fontSize: 12, lineHeight: 16 }]}>{r.cities.slice(0, 3).join(", ")}</Text>
          </View>
          <Icon
            name={region === r.name ? "check-circle" : "circle"}
            size={21}
          />
        </Pressable>
      ))}
      </View>
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
  return (
    <View style={[s.row, { alignItems: "flex-start", gap: 6 }]}>
      {homeCategories.map(({ label, category }) => {
        const { icon, color } = categoryStyles[category];
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            key={category}
            onPress={() => nav.navigate("Results", { category })}
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
  const local = state.businesses.filter(
    (b) =>
      b.status === "Aprovado" &&
      b.region === state.region &&
      (!state.city || b.city === state.city),
  );
  const sorted = [...local].sort(
    (a, b) =>
      Number(state.interests.includes(b.segment)) -
      Number(state.interests.includes(a.segment)),
  );
  const highlights = highlightedBusinesses(state.businesses, "home");
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
      <Pressable
        accessibilityRole="button"
        onPress={() => nav.navigate("Results")}
      >
        <ImageBackground
          source={
            regions.find((r) => r.name === state.region)?.photo || assets.valley
          }
          style={{
            width: "100%",
            height: 210,
            justifyContent: "flex-end",
            overflow: "hidden",
            borderRadius: 18,
          }}
          resizeMode="cover"
          imageStyle={{ borderRadius: 18, width: "100%", height: "100%" }}
        >
          <View style={{ padding: 14, backgroundColor: "#104B38CC" }}>
            <Text style={{ color: "white", fontSize: 17, fontWeight: "700" }}>
              Explore {state.region} →
            </Text>
          </View>
        </ImageBackground>
      </Pressable>
      <Section
        title="Categorias"
        action="Ver todas"
        onPress={() => nav.navigate("Search")}
      />
      <HomeCategories />
      <HighlightCarousel businesses={highlights} />
      <CollectionState empty={!sorted.length && !highlights.length} />
      {sorted.length > 0 && <Section title="Na sua cidade" />}
      {sorted.slice(0, 3).map((b) => (
        <BusinessCard key={b.id} business={b} />
      ))}
    </Page>
  );
}
export function SearchScreen() {
  const { state, update } = useStore(),
    nav = useNav();
  const [query, setQuery] = useState("");
  const search = (text: string) => {
    if (text.trim())
      update((s) => ({
        ...s,
        recent: [
          text.trim(),
          ...s.recent.filter((x) => x !== text.trim()),
        ].slice(0, 6),
      }));
    nav.navigate("Results", { query: text });
  };
  return (
    <Page tab="Search">
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
            onChangeText={setQuery}
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
      </View>
      <HighlightCarousel businesses={highlightedBusinesses(state.businesses, "explore")} />
      <View style={explore.section}>
        <Section title="Buscar por categoria" />
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
                    onPress={() => nav.navigate("Results", { category })}
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
              {row.length < categoryColumns && <View style={explore.categorySpacer} />}
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
                selected={state.city === city}
                onPress={() => {
                  update((s) => ({ ...s, city, region: region.name }));
                  nav.navigate("Results", { filters: { ...emptyFilters, city } });
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
export function ResultsScreen({ route }: ScreenProps) {
  const { state, loading, loadError } = useStore(),
    nav = useNav();
  const [query, setQuery] = useState(route.params?.query || "");
  const [filters, setFilters] = useState<Filters>({
    ...emptyFilters,
    segment: route.params?.category || "",
    ...route.params?.filters,
  });
  const [showFilters, setShowFilters] = useState(route.name === "Filters");
  const [allRegions, setAllRegions] = useState(
    route.params?.allRegions || false,
  );
  const category = categoryForSelection(filters.segment);
  const region = regionForCity(filters.city) ?? state.region;
  const results = filterBusinesses(
    state.businesses,
    filters,
    query,
    allRegions ? "" : region,
  );
  if (showFilters)
    return (
      <FilterForm
        filters={filters}
        setFilters={setFilters}
        onDone={() => setShowFilters(false)}
        count={results.length}
      />
    );
  return (
    <Page
      title={category || "Explorar"}
      tab="Search"
      right={
        <IconButton
          icon="sliders"
          label="Filtros"
          onPress={() => setShowFilters(true)}
        />
      }
    >
      <Field
        label="Busca"
        placeholder="Nome, categoria ou cidade"
        value={query}
        onChangeText={setQuery}
      />
      <SubcategoryFilters
        category={category}
        value={filters.segment}
        onChange={(segment) => setFilters((f) => ({ ...f, segment }))}
      />
      <View style={s.row}>
        <Chip title="Lista" selected onPress={() => {}} />
        <Chip
          title="Mapa"
          onPress={() =>
            nav.navigate("Map", {
              query,
              category: filters.segment,
              filters,
              allRegions,
            })
          }
        />
      </View>
      <View style={s.wrap}>
        <Chip
          title={allRegions ? "Todas as regiões" : region}
          selected
          onPress={() => setAllRegions(!allRegions)}
        />
        <Chip
          title="Aberto agora"
          selected={filters.openNow}
          onPress={() => setFilters((f) => ({ ...f, openNow: !f.openNow }))}
        />
      </View>
      {category && (
        <HighlightCarousel businesses={highlightedBusinesses(results, "explore")} />
      )}
      <Text style={s.label}>{results.length} lugares encontrados</Text>
      {results.map((b) => (
        <BusinessCard key={b.id} business={b} />
      ))}
      <CollectionState empty={false} />
      {results.length === 0 && !loading && !loadError && (
        <>
          <View style={{ alignItems: "center", paddingVertical: 30, gap: 14 }}>
            <Icon name="search" size={48} />
            <Text style={s.heading}>Nada encontrado</Text>
            <Text style={[s.muted, { textAlign: "center" }]}>
              Tente outra palavra, remova os filtros ou procure em cidades
              próximas.
            </Text>
          </View>
          <Button
            title="Remover filtros"
            onPress={() => {
              setFilters(emptyFilters);
              setQuery("");
            }}
          />
          <Button
            secondary
            title="Buscar em todas as regiões"
            onPress={() => setAllRegions(true)}
          />
          {!category && (
            <>
              <Section title="Talvez você goste" />
              {state.businesses
                .filter((b) => b.status === "Aprovado")
                .slice(0, 2)
                .map((b) => (
                  <BusinessCard key={b.id} business={b} />
                ))}
            </>
          )}
        </>
      )}
    </Page>
  );
}
function FilterForm({
  filters,
  setFilters,
  onDone,
  count,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  onDone: () => void;
  count: number;
}) {
  const category = categoryForSelection(filters.segment);
  return (
    <Page
      title="Filtros"
      right={
        <Pressable onPress={() => setFilters(emptyFilters)}>
          <Text style={s.label}>Limpar</Text>
        </Pressable>
      }
      footer={<Button title={`Ver ${count} resultados`} onPress={onDone} />}
    >
      <Section title="Cidade" />
      <View style={s.wrap}>
        <Chip
          title="Todas"
          selected={!filters.city}
          onPress={() => setFilters((f) => ({ ...f, city: "" }))}
        />
        {regions
          .flatMap((r) => r.cities)
          .map((city) => (
            <Chip
              key={city}
              title={city}
              selected={filters.city === city}
              onPress={() => setFilters((f) => ({ ...f, city }))}
            />
          ))}
      </View>
      <Section title="Categoria" />
      <View style={s.wrap}>
        <Chip
          title="Todas"
          selected={!filters.segment}
          onPress={() => setFilters((f) => ({ ...f, segment: "" }))}
        />
        {exploreCategories.map((name) => (
          <Chip
            key={name}
            title={name}
            selected={category === name}
            onPress={() => setFilters((f) => ({ ...f, segment: name }))}
          />
        ))}
      </View>
      <SubcategoryFilters
        category={category}
        value={filters.segment}
        onChange={(segment) => setFilters((f) => ({ ...f, segment }))}
      />
      <Field
        label="Bairro (opcional)"
        value={filters.district}
        onChangeText={(district) => setFilters((f) => ({ ...f, district }))}
      />
      <Toggle
        title="Aberto agora"
        value={filters.openNow}
        onChange={(openNow) => setFilters((f) => ({ ...f, openNow }))}
      />
      <Toggle
        title="Cardápio digital"
        value={filters.menu}
        onChange={(menu) => setFilters((f) => ({ ...f, menu }))}
      />
      <Toggle
        title="Aceita reservas"
        value={filters.reservations}
        onChange={(reservations) => setFilters((f) => ({ ...f, reservations }))}
      />
    </Page>
  );
}
export function PreferencesScreen() {
  const { state, update } = useStore(),
    nav = useNav();
  const [region, setRegion] = useState(state.region || regions[0].name),
    [city, setCity] = useState(state.city || "Caçapava"),
    [interests, setInterests] = useState(state.interests);
  return (
    <Page
      title="Região e interesses"
      footer={
        <Button
          title="Salvar preferências"
          onPress={() => {
            update((s) => ({ ...s, region, city, interests }));
            nav.navigate("Home");
          }}
        />
      }
    >
      <Section title="Sua região" />
      {regions.map((r) => (
        <Chip
          key={r.name}
          title={r.name}
          selected={r.name === region}
          onPress={() => {
            setRegion(r.name);
            setCity(r.cities[0]);
          }}
        />
      ))}
      <Section title="Cidade" />
      <View style={s.wrap}>
        {regions
          .find((r) => r.name === region)!
          .cities.map((name) => (
            <Chip
              key={name}
              title={name}
              selected={name === city}
              onPress={() => setCity(name)}
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
            selected={interests.includes(name)}
            onPress={() =>
              setInterests((a) =>
                a.includes(name) ? a.filter((x) => x !== name) : [...a, name],
              )
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
      <View style={[s.card, { backgroundColor: c.green }]}>
        <Text style={[s.heading, { color: c.white }]}>
          Tem um negócio{"\n"}na região?
        </Text>
        <Text style={{ color: c.white }}>
          Apareça para quem explora a região e receba solicitações de reservas.
        </Text>
        <Button
          secondary
          title="Anunciar meu negócio"
          icon="briefcase"
          onPress={() =>
            nav.navigate(state.authenticated ? "Activate" : "Advertise")
          }
        />
      </View>
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
