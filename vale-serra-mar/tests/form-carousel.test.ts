import { afterEach, expect, it, jest } from "@jest/globals";
import React from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";
import { BannerImage, BusinessPhotos, PhotoViewer, bannerAspectRatio } from "../src/components/BusinessPhotos";
import { Tap } from "../src/components/Motion";
import { HighlightCarousel } from "../src/components/HighlightCarousel";
import { AdvertiserRegistrationContext, Chip, Field, Page } from "../src/components/ui";
import { AuthScreen } from "../src/screens/OnboardingBusiness";
import { businesses } from "./fixtures";

const mockScrollTo = jest.fn();
const mockNavigate = jest.fn();
let mockAuthenticated = false;
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
jest.mock("../src/store", () => ({
  useStore: () => ({ state: { authenticated: mockAuthenticated } }),
}));
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
  mockAuthenticated = false;
  mockReducedMotion = false;
  mockScreenFocused = true;
});

it.each([
  [false, "Advertise"],
  [true, "BusinessWelcome"],
])("mantém Anunciar fora da rolagem e encaminha para a etapa correta (sessão %s)", async (authenticated, screen) => {
  mockAuthenticated = authenticated;
  await act(async () => {
    tree = create(React.createElement(Page, { title: "Mapa", children: "Mapa de empresas" }));
  });
  const shortcut = { accessibilityLabel: "Anunciar um estabelecimento" };
  const root = tree!.root;
  expect(root.findByType(ScrollView).findAllByProps(shortcut)).toHaveLength(0);
  await act(async () => root.findByProps(shortcut).props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith(screen);
});

it("mantém a etapa atual ao tocar em Anunciar durante o cadastro", async () => {
  await act(async () => {
    tree = create(React.createElement(AdvertiserRegistrationContext.Provider, {
      value: true,
      children: React.createElement(Page, { title: "Cadastro", children: "Dados" }),
    }));
  });
  await act(async () => tree!.root.findByProps({
    accessibilityLabel: "Anunciar um estabelecimento",
  }).props.onPress());
  expect(mockScrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
  expect(mockNavigate).not.toHaveBeenCalled();
});

const singleBusiness = businesses.slice(0, 1);
const carouselDots = (root: ReactTestInstance) =>
  root.findAll(
    ({ props }) =>
      typeof props.onPress === "function" &&
      typeof props.accessibilityLabel === "string" &&
      props.accessibilityLabel.startsWith("Mostrar slide "),
  );

async function renderCarousel(
  featured = businesses,
  onAdvertise?: () => void,
  width = 320,
) {
  await act(async () => {
    tree = create(
      React.createElement(HighlightCarousel, {
        onAdvertise,
        businesses: featured.map((business) => ({
          ...business,
          photo: `https://example.test/${business.id}.jpg`,
        })),
      }),
    );
  });
  const viewport = tree!.root
    .findAllByType(View)
    .find((view) => view.props.onLayout)!;
  await act(async () => viewport.props.onLayout(layout(width, 180)));
  mockScrollTo.mockClear();
  return tree!.root;
}

it("permite escolher a cidade dos destaques numa busca regional", async () => {
  const other = { ...businesses[0], id: "taubate", name: "Café de Taubaté", city: "Taubaté" };
  const root = await renderCarousel([...businesses, other]);
  const [cacapava, taubate] = root.findAllByType(Chip);
  expect(cacapava.props.title).toBe("Caçapava");
  expect(taubate.props.title).toBe("Taubaté");
  expect(cacapava.props.selected).toBe(true);
  expect(carouselDots(root)).toHaveLength(businesses.length);
  await act(async () => taubate.props.onPress());
  expect(taubate.props.selected).toBe(true);
  expect(carouselDots(root)).toHaveLength(0);
  await act(async () => root.findByProps({ accessibilityLabel: "Abrir " + other.name }).props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith("Business", { businessId: other.id });
});

it("mostra o anúncio antes dos estabelecimentos e inclui o slide na paginação", async () => {
  const advertise = jest.fn();
  const root = await renderCarousel(singleBusiness, advertise);
  const carousel = root.findByType(ScrollView);
  const slides = carousel.findAllByProps({ accessibilityRole: "button" });
  const dots = carouselDots(root);
  expect(slides.map(({ props }) => props.accessibilityLabel)).toEqual([
    "Quero anunciar meu negócio",
    `Abrir ${businesses[0].name}`,
  ]);
  expect(dots.map(({ props }) => props.accessibilityLabel)).toEqual([
    "Mostrar slide 1 de 2",
    "Mostrar slide 2 de 2",
  ]);
  expect(dots[0].props.accessibilityState.selected).toBe(true);
  await act(async () => slides[0].props.onPress());
  expect(advertise).toHaveBeenCalledTimes(1);
  await act(async () => dots[1].props.onPress());
  expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 320, animated: true });
  expect(dots[1].props.accessibilityState.selected).toBe(true);
  expect(dots[0].props.accessibilityState.selected).toBe(false);
  await act(async () => slides[1].props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith("Business", {
    businessId: businesses[0].id,
  });
});

it("exibe o anúncio mesmo quando a cidade não tem destaques", async () => {
  const root = await renderCarousel([], jest.fn());
  expect(
    root.findByProps({ accessibilityLabel: "Quero anunciar meu negócio" }),
  ).toBeDefined();
  expect(carouselDots(root)).toHaveLength(0);
});

it("sincroniza a seleção das bolinhas com a rotação automática e o gesto de arrastar", async () => {
  jest.useFakeTimers();
  const root = await renderCarousel();
  const captions = root.findAllByType(Text).map(({ props }) => props.children);
  expect(captions).toEqual(
    expect.arrayContaining(businesses.map(({ name }) => name)),
  );
  expect(
    root.findAllByType(Image).map(({ props }) => props.resizeMode),
  ).toEqual(businesses.map(() => "contain"));
  expect(bannerAspectRatio).toBe(4 / 3);
  expect(root.findAllByType(BannerImage)).toHaveLength(businesses.length);
  const banner = root.findByProps({
    accessibilityLabel: "Abrir " + businesses[0].name,
  });
  await act(async () => banner.props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith("Business", {
    businessId: businesses[0].id,
  });
  const dots = carouselDots(root);
  expect(dots[0].props.accessibilityState.selected).toBe(true);
  await act(async () => jest.advanceTimersByTime(5000));
  expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 320, animated: true });
  expect(dots[1].props.accessibilityState.selected).toBe(true);
  await act(async () => jest.advanceTimersByTime(5000));
  expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 0, animated: true });
  expect(dots[0].props.accessibilityState.selected).toBe(true);
  await act(async () =>
    root.findByType(ScrollView).props.onScroll({
      nativeEvent: { contentOffset: { x: 320 } },
    }),
  );
  expect(dots[1].props.accessibilityState.selected).toBe(true);
});

it("distribui os 16 marcadores em duas linhas em uma tela estreita", async () => {
  const featured = Array.from({ length: 15 }, (_, index) => ({
    ...businesses[index % businesses.length],
    id: `destaque-${index}`,
  }));
  const width = 280;
  const root = await renderCarousel(featured, jest.fn(), width);
  const dots = carouselDots(root);
  expect(dots).toHaveLength(16);
  const targetStyle = StyleSheet.flatten(dots[0].props.style({ pressed: false }));
  const pagination = StyleSheet.flatten(dots[0].parent!.props.style);
  expect(pagination.width / targetStyle.width).toBe(8);
  expect(pagination.width).toBeLessThanOrEqual(width);
  await act(async () => dots[15].props.onPress());
  expect(mockScrollTo).toHaveBeenLastCalledWith({
    x: 15 * width,
    animated: false,
  });
  expect(dots[15].props.accessibilityState.selected).toBe(true);
});

it.each([
  [1600, 1200, false],
  [1920, 1080, true],
  [1000, 1000, true],
  [900, 1600, true],
  [1920, 720, true],
])(
  "preenche o fundo do banner de %i por %i quando sobram bordas",
  async (width, height, fill) => {
    const root = await renderCarousel(singleBusiness);
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
  const root = await renderCarousel(singleBusiness);
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

it("mantém um único banner sem paginação ou rotação", async () => {
  jest.useFakeTimers();
  const root = await renderCarousel(singleBusiness);
  expect(carouselDots(root)).toHaveLength(0);
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
    tree = create(React.createElement(AuthScreen, {
      route: {
        name: "Auth",
        key: "auth",
        params: { advertiserPlanSelection: { planId: "annual", highlights: [] } },
      },
    }));
  });
  const root = tree!.root;
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

it("organiza quatro miniaturas quadradas por página e abre a foto da página seguinte", async () => {
  const photos = Array.from({ length: 7 }, (_, i) => `https://example.test/foto-${i}.jpg`);
  const onOpen = jest.fn();
  await act(async () => {
    tree = create(React.createElement(BusinessPhotos, { photos, onOpen }));
  });
  const root = tree!.root;
  const viewport = root.findAllByType(View).find(({ props }) => props.testID === "photo-strip")!;
  await act(async () => viewport.props.onLayout(layout(320, 74)));
  const track = root.findByType(ScrollView);
  const pages = React.Children.toArray(track.props.children) as React.ReactElement<{ "aria-hidden": boolean }>[];
  expect(pages).toHaveLength(2);
  expect(pages[0].props["aria-hidden"]).toBe(false);
  expect(pages[1].props["aria-hidden"]).toBe(true);
  const thumbs = root.findAllByType(Tap).filter(
    ({ props }) => props.accessibilityLabel.startsWith("Ver foto "),
  );
  expect(thumbs.slice(0, 4).every((thumb) => thumb.props.focusable)).toBe(true);
  expect(thumbs.slice(4).every((thumb) => !thumb.props.focusable)).toBe(true);
  expect(StyleSheet.flatten(thumbs[0].props.style).aspectRatio).toBe(1);
  const next = root.findAllByType(Tap).find(
    ({ props }) => props.accessibilityLabel === "Próxima página de fotos",
  )!;
  await act(async () => next.props.onPress());
  expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 320, animated: true });
  expect(next.props.disabled).toBe(true);
  expect(thumbs[4].props.focusable).toBe(true);
  await act(async () => thumbs[4].props.onPress());
  expect(onOpen).toHaveBeenCalledWith(5);
});

it("abre o visualizador no índice solicitado e usa as proporções da foto", async () => {
  const photos = Array.from({ length: 8 }, (_, i) => `https://example.test/foto-${i}.jpg`);
  await act(async () => {
    tree = create(React.createElement(PhotoViewer, { photos, initialIndex: 5 }));
  });
  const root = tree!.root;
  const viewport = root.findAllByType(View).find(({ props }) => props.testID === "photo-viewer")!;
  await act(async () => viewport.props.onLayout(layout(320, 480)));
  expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 1600, animated: false });
  const images = root.findAllByType(Image);
  expect(images.map(({ props }) => props.resizeMode)).toEqual(["contain", "contain", "contain"]);
  expect(images[1].props.source).toEqual({ uri: photos[5] });
  expect(images[1].parent?.props["aria-hidden"]).toBe(false);
  const prev = root.findAllByType(Tap).find(({ props }) => props.accessibilityLabel === "Foto anterior")!;
  await act(async () => prev.props.onPress());
  expect(mockScrollTo).toHaveBeenLastCalledWith({ x: 1280, animated: true });
  expect(root.findAllByType(Image)[1].props.source).toEqual({ uri: photos[4] });
});
