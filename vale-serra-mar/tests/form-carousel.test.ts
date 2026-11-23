import { afterEach, expect, it, jest } from "@jest/globals";
import React from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { HighlightCarousel } from "../src/components/HighlightCarousel";
import { Chip, Field } from "../src/components/ui";
import { AuthScreen } from "../src/screens/OnboardingBusiness";
import { businesses } from "./fixtures";

const mockScrollTo = jest.fn();
const mockNavigate = jest.fn();
const mockContent = {};
let mockReducedMotion = false;
let mockScreenFocused = true;

jest.mock("react-native/Libraries/Components/ScrollView/ScrollView", () => {
  const React = require("react") as typeof import("react");
  const ScrollViewport = React.forwardRef(function ScrollViewport(
    props: React.PropsWithChildren,
    ref,
  ) {
    React.useImperativeHandle(ref, () => ({
      getInnerViewRef: () => mockContent,
      scrollTo: mockScrollTo,
    }));
    return props.children;
  });
  return { __esModule: true, default: ScrollViewport };
});
jest.mock("@react-navigation/native", () => ({
  useIsFocused: () => mockScreenFocused,
}));
jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: React.PropsWithChildren) => children,
}));
jest.mock("../src/navigation", () => ({
  useNav: () => ({ navigate: mockNavigate }),
}));
jest.mock("../src/store", () => ({ useStore: () => ({}) }));
jest.mock("../src/components/Motion", () => ({
  Entrance: ({ children }: React.PropsWithChildren) => children,
  Tap: ({ children }: React.PropsWithChildren) => children,
  useReducedMotion: () => mockReducedMotion,
}));

const layout = (width: number, height: number) => ({
  nativeEvent: { layout: { x: 0, y: 0, width, height } },
});
const originalPlatform = Platform.OS;
let tree: ReactTestRenderer | undefined;

afterEach(async () => {
  if (tree) await act(async () => tree?.unmount());
  tree = undefined;
  Object.defineProperty(Platform, "OS", { value: originalPlatform });
  jest.restoreAllMocks();
  jest.useRealTimers();
  mockScrollTo.mockClear();
  mockNavigate.mockClear();
  mockReducedMotion = false;
  mockScreenFocused = true;
});

async function renderCarousel(count = businesses.length) {
  await act(async () => {
    tree = create(
      React.createElement(HighlightCarousel, {
        businesses: businesses.slice(0, count).map((business) => ({
          ...business,
          photo: `https://example.test/${business.id}.jpg`,
        })),
      }),
    );
  });
  const viewport = tree!.root
    .findAllByType(View)
    .find((view) => view.props.onLayout)!;
  await act(async () => viewport.props.onLayout(layout(320, 180)));
  mockScrollTo.mockClear();
  return tree!.root;
}

it("avança sozinho e permite voltar ou avançar nas duas extremidades", async () => {
  jest.useFakeTimers();
  const root = await renderCarousel();
  const captions = root.findAllByType(Text).map(({ props }) => props.children);
  expect(captions).toEqual(
    expect.arrayContaining(businesses.map(({ name }) => name)),
  );
  expect(
    root.findAllByType(Image).map(({ props }) => props.resizeMode),
  ).toEqual(businesses.map(() => "contain"));
  const banner = root.findByProps({
    accessibilityLabel: "Abrir " + businesses[0].name,
  });
  await act(async () => banner.props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith("Business", {
    businessId: businesses[0].id,
  });
  const previous = root.findByProps({
    accessibilityLabel: "Destaque anterior",
  });
  const next = root.findByProps({ accessibilityLabel: "Próximo destaque" });
  expect(previous.props.disabled).toBe(false);
  expect(next.props.disabled).toBe(false);
  await act(async () => jest.advanceTimersByTime(5000));
  expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 320, animated: true });
  await act(async () => next.props.onPress());
  expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 0, animated: true });
  await act(async () => previous.props.onPress());
  expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 320, animated: true });
  await act(async () => jest.advanceTimersByTime(5000));
  expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 0, animated: true });
});

it.each([
  [1920, 1080, false],
  [1000, 1000, true],
  [900, 1600, true],
  [1920, 720, true],
])(
  "preenche o fundo do banner de %i por %i quando sobram bordas",
  async (width, height, fill) => {
    const root = await renderCarousel(1);
    await act(async () => {
      root
        .findByType(Image)
        .props.onLoad({ nativeEvent: { source: { width, height } } });
    });
    const layers = root.findAllByType(Image).map(({ props }) => props);
    expect(layers.map(({ resizeMode }) => resizeMode)).toEqual(
      fill ? ["cover", "contain"] : ["contain"],
    );
    if (fill) {
      expect(layers[0].source).toEqual(layers[1].source);
      expect(layers[0].blurRadius).toBeGreaterThan(5);
    }
  },
);

it("preenche o fundo também quando a plataforma não informa as dimensões", async () => {
  const root = await renderCarousel(1);
  await act(async () =>
    root.findByType(Image).props.onLoad({ nativeEvent: {} }),
  );
  expect(
    root.findAllByType(Image).map(({ props }) => props.resizeMode),
  ).toEqual(["cover", "contain"]);
});

it("pausa a rotação enquanto o usuário arrasta o carrossel", async () => {
  jest.useFakeTimers();
  const root = await renderCarousel();
  const scroll = root.findByType(ScrollView);
  await act(async () => scroll.props.onScrollBeginDrag());
  await act(async () => jest.advanceTimersByTime(10000));
  expect(mockScrollTo).not.toHaveBeenCalled();
  await act(async () => scroll.props.onScrollEndDrag());
  await act(async () => jest.advanceTimersByTime(5000));
  expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 320, animated: true });
});

it("mantém um único banner sem setas ou rotação", async () => {
  jest.useFakeTimers();
  const root = await renderCarousel(1);
  expect(
    root.findAllByProps({ accessibilityLabel: "Destaque anterior" }),
  ).toHaveLength(0);
  expect(
    root.findAllByProps({ accessibilityLabel: "Próximo destaque" }),
  ).toHaveLength(0);
  await act(async () => jest.advanceTimersByTime(10000));
  expect(mockScrollTo).not.toHaveBeenCalled();
});

it.each(["redução de movimento", "outra tela"])(
  "suspende a rotação automática com %s",
  async (condition) => {
    jest.useFakeTimers();
    mockReducedMotion = condition === "redução de movimento";
    mockScreenFocused = condition !== "outra tela";
    await renderCarousel();
    await act(async () => jest.advanceTimersByTime(10000));
    expect(mockScrollTo).not.toHaveBeenCalled();
  },
);

it("abre o cadastro com ajuste nativo de rolagem para o teclado no iOS", async () => {
  Object.defineProperty(Platform, "OS", { value: "ios" });
  await act(async () => {
    tree = create(React.createElement(AuthScreen));
  });
  const root = tree!.root;
  expect(
    root.findByType(ScrollView).props.automaticallyAdjustKeyboardInsets,
  ).toBe(true);
  expect(root.findByType(KeyboardAvoidingView).props.behavior).toBeUndefined();
});

it("rola até o campo de e-mail em foco quando o teclado encolhe o formulário no Android", async () => {
  Object.defineProperty(Platform, "OS", { value: "android" });
  await act(async () => {
    tree = create(React.createElement(AuthScreen));
  });
  const root = tree!.root;
  const createAccount = root
    .findAllByType(Chip)
    .find((chip) => chip.props.title === "Criar conta")!;
  await act(async () => createAccount.props.onPress());
  const email = root
    .findAllByType(Field)
    .find((field) => field.props.label === "E-mail");
  expect(email?.props.keyboardType).toBe("email-address");

  const field = {
    measureLayout: (
      _content: unknown,
      callback: (...coords: number[]) => void,
    ) => callback(20, 380, 290, 48),
  };
  jest
    .spyOn(TextInput.State, "currentlyFocusedInput")
    .mockReturnValue(
      field as ReturnType<typeof TextInput.State.currentlyFocusedInput>,
    );
  const scroll = root.findByType(ScrollView);
  expect(root.findByType(KeyboardAvoidingView).props.behavior).toBe("height");
  await act(async () => scroll.props.onLayout(layout(320, 660)));
  expect(mockScrollTo).not.toHaveBeenCalled();
  await act(async () => scroll.props.onLayout(layout(320, 290)));
  expect(mockScrollTo).toHaveBeenCalledWith({ y: 154, animated: true });
});
