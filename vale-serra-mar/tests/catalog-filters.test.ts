import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import React from "react";
import { TextInput } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { BusinessCard } from "../src/components/BusinessCard";
import { BusinessMap } from "../src/components/BusinessMap";
import { HighlightCarousel } from "../src/components/HighlightCarousel";
import { Button, Chip, Page, Section } from "../src/components/ui";
import {
  catalogFiltersFor,
  emptyBusiness,
  initialState,
} from "../src/domain/catalog";
import type { Business, CatalogFilters, State } from "../src/domain/models";
import type { ScreenProps } from "../src/navigation";
import { MapScreen } from "../src/screens/Business";
import {
  HomeScreen,
  PreferencesScreen,
  ResultsScreen,
  SearchScreen,
} from "../src/screens/Discover";

const mockNavigate = jest.fn();
let mockState: State;
const mockUpdate = jest.fn((change: (state: State) => State) => {
  mockState = change(mockState);
});
const mockSetCatalogFilters = jest.fn((change: Partial<CatalogFilters>) => {
  mockState = {
    ...mockState,
    catalogFilters: { ...catalogFiltersFor(mockState), ...change },
  };
});

jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: React.PropsWithChildren) => children,
}));
jest.mock("../src/navigation", () => ({
  useNav: () => ({ navigate: mockNavigate }),
}));
jest.mock("../src/store", () => ({
  useStore: () => ({
    state: mockState,
    update: mockUpdate,
    setCatalogFilters: mockSetCatalogFilters,
    loading: false,
  }),
}));
jest.mock("../src/components/BusinessMap", () => ({ BusinessMap: () => null }));
jest.mock("../src/components/Motion", () => ({
  Entrance: ({ children }: React.PropsWithChildren) => children,
  Tap: ({ children }: React.PropsWithChildren) => children,
  useReducedMotion: () => true,
}));

const local: Business = {
  ...emptyBusiness("local"),
  name: "Soluma Salgados",
  status: "Aprovado",
  region: "Vale do Paraíba",
  city: "Caçapava",
  district: "Vera Cruz",
  latitude: -23.1033708,
  longitude: -45.7154455,
};
const coast: Business = {
  ...emptyBusiness("coast"),
  name: "Porto do Engenho",
  status: "Aprovado",
  region: "Litoral Norte",
  city: "Ilhabela",
  district: "Saco da Capela",
  latitude: -23.790117,
  longitude: -45.362945,
};
const pizza: Business = {
  ...coast,
  id: "pizza",
  name: "Elite Pizzaria",
  segment: "Pizzarias",
};

let tree: ReactTestRenderer | undefined;
let screen: React.ReactElement;

beforeEach(() => {
  mockState = {
    ...initialState,
    region: local.region,
    city: local.city,
    businesses: [
      local,
      coast,
      pizza,
      { ...coast, id: "pending", status: "Em análise" },
    ],
  };
  mockNavigate.mockClear();
  mockUpdate.mockClear();
  mockSetCatalogFilters.mockClear();
});

afterEach(async () => {
  if (tree) await act(async () => tree?.unmount());
  tree = undefined;
});

async function render(element: React.ReactElement) {
  screen = element;
  await act(async () => {
    tree = create(element);
  });
  return tree!.root;
}

function renderCurrent() {
  tree!.update(React.cloneElement(screen));
}

function businessIds() {
  return tree!.root
    .findAllByType(BusinessCard)
    .map(({ props }) => props.business.id);
}

async function select(title: string) {
  const chip = tree!.root
    .findAllByType(Chip)
    .find(({ props }) => props.title === title);
  expect(chip).toBeDefined();
  await act(async () => {
    chip!.props.onPress();
    renderCurrent();
  });
}

it("mantém a busca ao vivo na cidade selecionada e permite buscar em todas as regiões", async () => {
  const root = await render(React.createElement(SearchScreen));
  const input = root.findByType(TextInput);
  await act(async () => {
    input.props.onChangeText("ilhabela   porto");
    renderCurrent();
  });
  expect(businessIds()).toEqual([]);
  await act(async () => {
    mockSetCatalogFilters({ region: "", city: "" });
    renderCurrent();
  });
  expect(businessIds()).toEqual([coast.id]);
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockUpdate).not.toHaveBeenCalled();
});

it("combina região, cidade, categoria e bairro e usa a mesma seleção no mapa", async () => {
  mockSetCatalogFilters({ segment: "Alimentação" });
  const props = {
    route: { name: "Results" },
  } as ScreenProps;
  const root = await render(React.createElement(ResultsScreen, props));
  expect(businessIds()).toEqual([local.id]);
  await select(local.city);
  await select(coast.region);
  expect(businessIds()).toEqual([coast.id, pizza.id]);
  await select(coast.city);
  await select("Restaurante");
  expect(businessIds()).toEqual([coast.id]);
  await select("Mais filtros");
  const district = root
    .findAllByType(TextInput)
    .find(({ props }) => props.accessibilityLabel === "Bairro")!;
  await act(async () => {
    district.props.onChangeText("capéla");
    renderCurrent();
  });
  expect(businessIds()).toEqual([coast.id]);
  await select("Mapa");
  expect(mockNavigate).toHaveBeenCalledWith("Map");
  expect(mockState.catalogFilters).toMatchObject({
    region: coast.region,
    city: coast.city,
    segment: "Restaurante",
    district: "capéla",
  });
  await act(async () => tree!.update(React.createElement(MapScreen)));
  expect(tree!.root.findByType(BusinessMap).props).toMatchObject({
    businesses: [coast],
    city: coast.city,
    region: coast.region,
  });
  await act(async () => renderCurrent());
  await select("Limpar filtros");
  expect(businessIds()).toEqual([local.id]);
  expect(mockUpdate).not.toHaveBeenCalled();
});

it("abre o mapa em Santo Antônio do Pinhal mesmo sem pinos na cidade", async () => {
  const campos = {
    ...local,
    id: "campos",
    name: "Restaurante Rota 77",
    city: "Campos do Jordão",
    region: "Serra da Mantiqueira",
    latitude: -22.743392,
    longitude: -45.595915,
  };
  mockState.businesses.push(campos);
  await render(React.createElement(PreferencesScreen));
  await select("Serra da Mantiqueira");
  await select("Santo Antônio do Pinhal");
  await act(async () => tree!.update(React.createElement(MapScreen)));
  expect(tree!.root.findByType(BusinessMap).props).toMatchObject({
    city: "Santo Antônio do Pinhal",
    region: campos.region,
    businesses: [],
  });
});

it.each([HomeScreen, SearchScreen])(
  "carrossel usa a cidade visível e as vagas do painel",
  async (Screen) => {
    const highlighted = {
      ...coast,
      photo: "https://example.test/cover.jpg",
      highlights: { home: 1, explore: 1 },
    };
    mockState.businesses = [
      local,
      highlighted,
      { ...pizza, photo: highlighted.photo },
    ];
    const root = await render(React.createElement(Screen));
    expect(root.findByType(HighlightCarousel).props.businesses).toEqual([]);
    await act(async () => {
      mockState = { ...mockState, region: coast.region, city: coast.city };
      renderCurrent();
    });
    expect(root.findByType(HighlightCarousel).props.businesses).toEqual([
      highlighted,
    ]);
  },
);

it("mostra as 15 vagas de cada área separadamente e posiciona os destaques antes das categorias no início", async () => {
  const home = Array.from({ length: 15 }, (_, i) => ({
    ...local,
    id: `home-${i}`,
    photo: "https://example.test/capa.png",
    highlights: { home: i + 1, explore: null },
  }));
  const explore = home.map((item, i) => ({
    ...item,
    id: `explore-${i}`,
    highlights: { home: null, explore: i + 1 },
  }));
  mockState.businesses = [...home, ...explore].reverse();
  const root = await render(React.createElement(HomeScreen));
  expect(root.findByType(HighlightCarousel).props.businesses).toEqual(home);
  const content = React.Children.toArray(root.findByType(Page).props.children);
  const highlightIndex = content.findIndex(
    (child) => React.isValidElement(child) && child.type === HighlightCarousel,
  );
  expect(content[highlightIndex + 1]).toMatchObject({
    type: Section,
    props: { title: "Categorias" },
  });
  await act(async () => tree!.update(React.createElement(SearchScreen)));
  expect(tree!.root.findByType(HighlightCarousel).props.businesses).toEqual(explore);
});

it("aplica as preferências na seleção e oferece acesso direto à lista", async () => {
  const root = await render(React.createElement(PreferencesScreen));
  await select(coast.region);
  expect(mockState.region).toBe(coast.region);
  await act(async () => tree!.update(React.createElement(PreferencesScreen)));
  await select(coast.city);
  expect(mockState.city).toBe(coast.city);
  await act(async () => tree!.update(React.createElement(PreferencesScreen)));
  const button = root
    .findAllByType(Button)
    .find(({ props }) => props.title === "Ver estabelecimentos")!;
  await act(async () => button.props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith("Results");
  expect(catalogFiltersFor(mockState)).toMatchObject({
    region: coast.region,
    city: coast.city,
  });
});
