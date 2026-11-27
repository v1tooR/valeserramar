import { afterEach, beforeEach, expect, it, jest } from "@jest/globals";
import React from "react";
import { TextInput } from "react-native";
import { advertisingAgency } from "../src/domain/categories";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { BusinessCard } from "../src/components/BusinessCard";
import { BusinessMap } from "../src/components/BusinessMap";
import { PhotoViewer } from "../src/components/BusinessPhotos";
import { HighlightCarousel } from "../src/components/HighlightCarousel";
import { Tap } from "../src/components/Motion";
import { Chip, Row, Section } from "../src/components/ui";
import {
  catalogFiltersFor,
  emptyBusiness,
  initialState,
} from "../src/domain/catalog";
import type { Business, CatalogFilters, State } from "../src/domain/models";
import type { ScreenProps } from "../src/navigation";
import {
  BusinessScreen,
  GalleryScreen,
  MapScreen,
} from "../src/screens/Business";
import { ChooseCityScreen } from "../src/screens/ChooseCity";
import {
  HomeScreen,
  ProfileScreen,
  ResultsScreen,
} from "../src/screens/Discover";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
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
  useNav: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    canGoBack: () => true,
  }),
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
  mockGoBack.mockClear();
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

function cityControl(label: string) {
  const control = tree!.root
    .findAllByType(Tap)
    .find(({ props }) => props.accessibilityLabel === label);
  expect(control).toBeDefined();
  return control!;
}

async function selectCity(region: string, city: string) {
  await act(async () => cityControl(region).props.onPress());
  expect(mockUpdate).not.toHaveBeenCalled();
  await act(async () => cityControl(city).props.onPress());
  expect(mockGoBack).toHaveBeenCalledTimes(1);
}

it("busca no Início em tempo real e amplia para todas as cidades sem navegar", async () => {
  const root = await render(React.createElement(HomeScreen));
  const input = root.findByType(TextInput);
  await act(async () => input.props.onChangeText("ilhabela   porto"));
  expect(businessIds()).toEqual([]);
  await select("Todas as cidades");
  expect(businessIds()).toEqual([coast.id]);
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockSetCatalogFilters).not.toHaveBeenCalled();
  await act(async () => input.props.onSubmitEditing());
  expect(mockState.recent).toEqual(["ilhabela   porto"]);
  await act(async () => cityControl("Limpar busca").props.onPress());
  expect(businessIds()).toEqual([local.id]);
});

it("exibe só as seis categorias em ordem alfabética e inclui agências em Serviços", async () => {
  const agency: Business = {
    ...local,
    id: "agency",
    name: "Átomo Comunicação",
    segment: "Serviços",
    serviceType: advertisingAgency,
  };
  const technician: Business = {
    ...agency,
    id: "tech",
    name: "Zurique",
    serviceType: null,
  };
  mockState.businesses.push(technician, agency);

  const root = await render(React.createElement(HomeScreen));
  const labels = [
    "Alimentação",
    "Comércio",
    "Estética e Beleza",
    "Hospedagem",
    "Lazer",
    "Serviços",
  ];
  const grid = root.findAllByProps({ testID: "home-category-grid" })[0];
  const tiles = grid.findAllByType(Tap);
  expect(tiles.map(({ props }) => props.accessibilityLabel)).toEqual(labels);
  expect(new Set(tiles.map((tile) => tile.parent)).size).toBe(2);
  expect(tiles[0].parent).toBe(tiles[2].parent);
  expect(tiles[3].parent).toBe(tiles[5].parent);
  expect(
    root
      .findAllByType(Section)
      .find(({ props }) => props.title === "Categorias")?.props.action,
  ).toBeUndefined();
  expect(
    root.findAllByProps({ accessibilityLabel: advertisingAgency }),
  ).toHaveLength(0);
  expect(businessIds()).toEqual([agency.id, local.id, technician.id]);
  await act(async () => cityControl("Serviços").props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith("Results");
  const result = React.createElement(ResultsScreen, {
    route: { name: "Results" },
  } as ScreenProps);
  await act(async () => tree!.update(result));
  expect(businessIds()).toEqual([agency.id, technician.id]);
  const type = tree!.root
    .findAllByType(Chip)
    .find(({ props }) => props.title === advertisingAgency)!;
  await act(async () => {
    type.props.onPress();
    tree!.update(React.cloneElement(result));
  });
  expect(businessIds()).toEqual([agency.id]);
});

it("abre o visualizador na foto tocada e usa o banner como primeira imagem", async () => {
  const cover = "https://example.test/banner.jpg";
  const first = "https://example.test/primeira.jpg";
  mockState.businesses = [
    { ...local, photo: cover, gallery: [cover, first, ""] },
  ];
  const props = {
    route: { name: "Business", params: { businessId: local.id } },
  } as ScreenProps;
  await render(React.createElement(BusinessScreen, props));
  await act(async () => cityControl("Ver banner completo").props.onPress());
  expect(mockNavigate).toHaveBeenLastCalledWith(
    "Gallery",
    expect.objectContaining({ businessId: local.id, photoIndex: 0 }),
  );
  await act(async () => cityControl("Ver foto 1 completa").props.onPress());
  expect(mockNavigate).toHaveBeenLastCalledWith(
    "Gallery",
    expect.objectContaining({ businessId: local.id, photoIndex: 1 }),
  );
  const gallery = {
    route: { name: "Gallery", params: { businessId: local.id, photoIndex: 1 } },
  } as ScreenProps;
  await act(async () =>
    tree!.update(React.createElement(GalleryScreen, gallery)),
  );
  expect(tree!.root.findByType(PhotoViewer).props).toMatchObject({
    photos: [cover, first],
    initialIndex: 1,
  });
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
  expect(businessIds()).toEqual([pizza.id, coast.id]);
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
  await render(React.createElement(ChooseCityScreen));
  await selectCity(campos.region, "Santo Antônio do Pinhal");
  await act(async () => tree!.update(React.createElement(MapScreen)));
  expect(tree!.root.findByType(BusinessMap).props).toMatchObject({
    city: "Santo Antônio do Pinhal",
    region: campos.region,
    businesses: [],
  });
});

it("troca o carrossel do Início junto com a cidade", async () => {
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
  const root = await render(React.createElement(HomeScreen));
  expect(root.findByType(HighlightCarousel).props.businesses).toEqual([]);
  await act(async () => {
    mockState = { ...mockState, region: coast.region, city: coast.city };
    renderCurrent();
  });
  expect(root.findByType(HighlightCarousel).props.businesses).toEqual([
    highlighted,
  ]);
});

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
  const sections = root.findAll(
    (node) =>
      node.type === HighlightCarousel ||
      (node.type === Section && node.props.title === "Categorias"),
  );
  expect(sections.map((node) => node.type)).toEqual([
    HighlightCarousel,
    Section,
  ]);
  mockSetCatalogFilters({ segment: "Alimentação" });
  const results = { route: { name: "Results" } } as ScreenProps;
  await act(async () =>
    tree!.update(React.createElement(ResultsScreen, results)),
  );
  expect(tree!.root.findByType(HighlightCarousel).props.businesses).toEqual(
    explore,
  );
});

it("abre o mesmo seletor pelo botão de cidade e aplica a escolha sem perder os demais filtros", async () => {
  mockState.catalogFilters = {
    ...catalogFiltersFor(mockState),
    district: local.district,
    segment: "Alimentação",
  };
  await render(React.createElement(HomeScreen));
  await act(async () =>
    cityControl(`Alterar cidade, ${local.city}`).props.onPress(),
  );
  expect(mockNavigate).toHaveBeenCalledWith("ChooseCity");

  await act(async () => tree!.update(React.createElement(ChooseCityScreen)));
  expect(cityControl(local.region).props.accessibilityHint).toContain(
    local.city,
  );
  await act(async () => cityControl(local.region).props.onPress());
  expect(
    cityControl(`${local.city}, cidade atual`).props.accessibilityState
      .selected,
  ).toBe(true);
  expect(mockState.city).toBe(local.city);

  await selectCity(coast.region, coast.city);
  expect(mockState.region).toBe(coast.region);
  expect(mockState.city).toBe(coast.city);
  expect(catalogFiltersFor(mockState)).toMatchObject({
    region: coast.region,
    city: coast.city,
    district: "",
    segment: "Alimentação",
  });
});

it("Perfil abre o seletor de cidades diretamente", async () => {
  const root = await render(React.createElement(ProfileScreen));
  const row = root
    .findAllByType(Row)
    .find(({ props }) => props.title === "Trocar cidade");
  expect(row?.props.subtitle).toBe(local.city);
  await act(async () => row!.props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith("ChooseCity");
});
