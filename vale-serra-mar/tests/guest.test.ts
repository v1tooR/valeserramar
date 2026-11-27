import { it, expect, jest } from "@jest/globals";
import React from "react";
import { ScrollView, View } from "react-native";
import { create, act, type ReactTestRenderer } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StoreProvider } from "../src/store";
import { WelcomeScreen } from "../src/screens/Discover";
import { ChooseCityScreen } from "../src/screens/ChooseCity";
import { Button } from "../src/components/ui";
import type { ScreenProps } from "../src/navigation";
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
const mockScrollTo = jest.fn();
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
jest.mock("../src/navigation", () => ({
  useNav: () => ({
    reset: mockReset,
    canGoBack: () => false,
    navigate: mockNavigate,
  }),
}));
jest.mock("react-native/Libraries/Components/ScrollView/ScrollView", () => {
  const React = require("react") as typeof import("react");
  const Viewport = React.forwardRef(function Viewport(
    props: React.PropsWithChildren,
    ref,
  ) {
    React.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
    return props.children;
  });
  return { __esModule: true, default: Viewport };
});
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("@expo/vector-icons", () => ({ Feather: "Feather" }));
it("visitante escolhe região e cidade, desliza ou toca nas bolinhas e entra sem conta", async () => {
  await AsyncStorage.clear();
  mockReset.mockClear();
  mockNavigate.mockClear();
  let view!: ReactTestRenderer;
  await act(async () => {
    view = create(
      React.createElement(
        StoreProvider,
        null,
        React.createElement(WelcomeScreen),
      ),
    );
  });
  const radios = view.root.findAll(
    (node) =>
      node.props.accessibilityRole === "radio" &&
      node.parent?.props.accessibilityRole !== "radio",
  );
  expect(radios).toHaveLength(3);
  await act(async () => {
    radios[1].props.onPress();
  });
  const start = view.root
    .findAllByType(Button)
    .find((node) => node.props.title === "Escolher cidade")!;
  await act(async () => {
    start.props.onPress();
  });
  const params = { locationRegion: "Serra da Mantiqueira" };
  expect(mockNavigate).toHaveBeenCalledWith("ChooseCity", params);
  expect(mockReset).not.toHaveBeenCalled();
  const readPreferences = async () =>
    JSON.parse((await AsyncStorage.getItem("vale-serra-mar:preferences:v2"))!);
  expect(await readPreferences()).toMatchObject({ region: "", city: "" });

  await act(async () => {
    view.update(
      React.createElement(
        StoreProvider,
        null,
        React.createElement(ChooseCityScreen, {
          route: { name: "ChooseCity", params },
        } as ScreenProps),
      ),
    );
  });
  const root = view.root;
  const viewport = root
    .findAllByType(View)
    .find(({ props }) => props.testID === "city-carousel")!;
  await act(async () =>
    viewport.props.onLayout({ nativeEvent: { layout: { width: 340 } } }),
  );
  const carousel = root
    .findAllByType(ScrollView)
    .find(({ props }) => props.horizontal)!;
  expect(carousel.props.snapToInterval).toBe(292);
  await act(async () =>
    carousel.props.onScroll({ nativeEvent: { contentOffset: { x: 292 } } }),
  );
  expect(root.findByType(Button).props.title).toBe(
    "Explorar Santo Antônio do Pinhal",
  );
  expect(
    root.findAllByProps({ accessibilityLabel: "Mostrar Caçapava" }),
  ).toHaveLength(0);
  const dot = root.findAllByProps({
    accessibilityLabel: "Mostrar São Bento do Sapucaí",
  })[0];
  await act(async () => dot.props.onPress());
  expect(dot.props.accessibilityState.selected).toBe(true);
  expect(mockScrollTo).toHaveBeenLastCalledWith(
    expect.objectContaining({ x: 584 }),
  );
  expect(await readPreferences()).toMatchObject({ region: "", city: "" });

  const explore = root.findByType(Button);
  expect(explore.props.title).toBe("Explorar São Bento do Sapucaí");
  await act(async () => explore.props.onPress());
  expect(mockReset).toHaveBeenCalledWith({
    index: 0,
    routes: [{ name: "Home" }],
  });
  const saved = await readPreferences();
  expect(saved.region).toBe("Serra da Mantiqueira");
  expect(saved.city).toBe("São Bento do Sapucaí");
  expect(saved.authenticated).toBeUndefined();
  expect(saved.profile).toBeUndefined();
  await act(async () => {
    view.unmount();
  });
});

it("logo retorna para a Home e limpa a navegação anterior", async () => {
  const { BrandHeader } = require("../src/components/ui");
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
