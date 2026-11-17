import { it, expect, jest } from "@jest/globals";
import React from "react";
import { create, act, type ReactTestRenderer } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StoreProvider } from "../src/store";
import { WelcomeScreen } from "../src/screens/Discover";
import { Button } from "../src/components/ui";
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn<() => Promise<null>>().mockResolvedValue(null),
  setItemAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
const mockReset = jest.fn();
jest.mock("../src/navigation", () => ({
  useNav: () => ({
    reset: mockReset,
    canGoBack: () => false,
    navigate: jest.fn(),
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
it("visitante escolhe região e entra sem criar uma conta", async () => {
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
    .find((node) => node.props.title === "Começar a explorar")!;
  await act(async () => {
    start.props.onPress();
  });
  expect(mockReset).toHaveBeenCalledWith({
    index: 0,
    routes: [{ name: "Home" }],
  });
  const saved = JSON.parse(
    (await AsyncStorage.getItem("vale-serra-mar:preferences:v2"))!,
  );
  expect(saved.region).toBe("Serra da Mantiqueira");
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
