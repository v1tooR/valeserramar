import { it, expect, jest } from "@jest/globals";
import React from "react";
import { create, act, type ReactTestRenderer } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StyleSheet, Text } from "react-native";
import { StoreProvider } from "../src/store";
import { ChooseCityScreen } from "../src/screens/ChooseCity";
import { Tap } from "../src/components/Motion";
import { BrandHeader } from "../src/components/ui";
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn<() => Promise<null>>().mockResolvedValue(null),
  setItemAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
const mockReset = jest.fn();
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
jest.mock("../src/navigation", () => ({
  useNav: () => ({
    reset: mockReset,
    canGoBack: () => false,
    navigate: mockNavigate,
  }),
}));
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("@expo/vector-icons", () => ({ Feather: "Feather" }));
it("visitante escolhe uma cidade na mesma tela e entra sem conta", async () => {
  await AsyncStorage.clear();
  mockReset.mockClear();
  mockNavigate.mockClear();
  let view!: ReactTestRenderer;
  await act(async () => {
    view = create(
      React.createElement(
        StoreProvider,
        null,
        React.createElement(ChooseCityScreen),
      ),
    );
  });
  const entry = (label: string) =>
    view.root
      .findAllByType(Tap)
      .find(({ props }) => props.accessibilityLabel === label);
  const region = (label: string) => entry(label)!;
  const valley = region("Vale do Paraíba");
  const mountain = region("Serra da Mantiqueira");
  const coast = region("Litoral Norte");
  const buttons = view.root
    .findAllByType(Tap)
    .filter(({ props }) => props["aria-expanded"] !== undefined);
  expect(buttons.map(({ props }) => props.accessibilityLabel)).toEqual([
    "Litoral Norte",
    "Serra da Mantiqueira",
    "Vale do Paraíba",
  ]);
  const readPreferences = async () =>
    JSON.parse((await AsyncStorage.getItem("vale-serra-mar:preferences:v2"))!);

  for (const item of [valley, mountain, coast])
    expect(item.props["aria-expanded"]).toBe(false);
  expect(entry("Aparecida")).toBeUndefined();

  await act(async () => valley.props.onPress());
  expect(valley.props["aria-expanded"]).toBe(true);
  expect(entry("Aparecida")).toBeDefined();
  const valleyCities = [
    "Aparecida",
    "Caçapava",
    "Cunha",
    "Paraibuna",
    "São José dos Campos",
    "Taubaté",
  ];
  expect(
    view.root
      .findAllByType(Tap)
      .map(({ props }) => props.accessibilityLabel)
      .filter((label) => valleyCities.includes(label)),
  ).toEqual(valleyCities);
  expect(entry("Ubatuba")).toBeUndefined();
  await act(async () => valley.props.onPress());
  expect(entry("Aparecida")).toBeUndefined();

  await act(async () => coast.props.onPress());
  expect(entry("Ubatuba")).toBeDefined();
  await act(async () => mountain.props.onPress());
  expect(mountain.props["aria-expanded"]).toBe(true);
  expect(coast.props["aria-expanded"]).toBe(false);
  expect(entry("Ubatuba")).toBeUndefined();
  expect(entry("Caçapava")).toBeUndefined();
  expect(await readPreferences()).toMatchObject({ region: "", city: "" });
  expect(mockReset).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();

  await act(async () => entry("São Bento do Sapucaí")!.props.onPress());
  expect(mockReset).toHaveBeenCalledWith({
    index: 0,
    routes: [{ name: "Home" }],
  });
  const saved = await readPreferences();
  expect(saved.region).toBe("Serra da Mantiqueira");
  expect(saved.city).toBe("São Bento do Sapucaí");
  expect(saved.authenticated).toBeUndefined();
  expect(saved.profile).toBeUndefined();
  await act(async () => view.unmount());
});

it("logo retorna para a Home e limpa a navegação anterior", async () => {
  let view!: ReactTestRenderer;
  await act(async () => {
    view = create(
      React.createElement(
        StoreProvider,
        null,
        React.createElement(BrandHeader),
      ),
    );
  });
  const logo = view.root.findAll(
    (node) =>
      node.props.accessibilityLabel === "Ir para o início" &&
      node.parent?.props.accessibilityLabel !== "Ir para o início",
  )[0];
  await act(async () => {
    logo.props.onPress();
  });
  expect(mockReset).toHaveBeenLastCalledWith({
    index: 0,
    routes: [{ name: "Home" }],
  });
  await act(async () => view.unmount());
});

it("mantém a cidade na linha da logo com reticências e acesso ao seletor", async () => {
  const key = "vale-serra-mar:preferences:v2";
  const city = "Santo Antônio do Pinhal";
  await AsyncStorage.setItem(
    key,
    JSON.stringify({
      city,
      region: "Serra da Mantiqueira",
      interests: [],
      favorites: [],
      recent: [],
    }),
  );
  mockNavigate.mockClear();

  let view: ReactTestRenderer | undefined;
  try {
    await act(async () => {
      view = create(
        React.createElement(
          StoreProvider,
          null,
          React.createElement(BrandHeader),
        ),
      );
    });
    const buttons = view!.root.findAllByType(Tap);
    const logo = buttons.find(
      ({ props }) => props.accessibilityLabel === "Ir para o início",
    )!;
    const location = buttons.find(
      ({ props }) => props.accessibilityLabel === `Alterar cidade, ${city}`,
    )!;
    expect(location.parent).toBe(logo.parent);
    expect(StyleSheet.flatten(location.parent!.props.style)).toMatchObject({
      flexDirection: "row",
      flexWrap: "nowrap",
      alignItems: "center",
    });
    expect(StyleSheet.flatten(logo.props.style)).toMatchObject({
      width: "40%",
      maxWidth: 128,
    });
    expect(StyleSheet.flatten(location.props.style)).toMatchObject({
      flexShrink: 1,
      minWidth: 0,
    });
    const label = location.findByType(Text);
    expect(label.props).toMatchObject({
      children: city,
      numberOfLines: 1,
      ellipsizeMode: "tail",
    });
    await act(async () => location.props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith("ChooseCity");
  } finally {
    await act(async () => view?.unmount());
    await AsyncStorage.removeItem(key);
  }
});
