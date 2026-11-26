import { beforeEach, expect, it, jest } from "@jest/globals";
import React from "react";
import { TextInput } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Button, Chip, Icon } from "../src/components/ui";
import type { AdvertiserPlanSelection } from "../src/domain/advertiserPlans";
import { initialState } from "../src/domain/catalog";
import type { State } from "../src/domain/models";
import type { ScreenProps } from "../src/navigation";
import { ProfileScreen } from "../src/screens/Discover";
import { AdvertiseScreen, AuthScreen } from "../src/screens/OnboardingBusiness";
import type { useStore } from "../src/store";

const profile = {
  name: "Anunciante",
  email: "teste@example.com",
  phone: "12999999999",
};
const selection: AdvertiserPlanSelection = {
  planId: "monthly",
  highlights: ["category"],
};
const signupRoute: ScreenProps["route"] = {
  name: "Auth",
  key: "auth",
  params: { advertiserPlanSelection: selection },
};
const mockAuthenticate = jest.fn<ReturnType<typeof useStore>["authenticate"]>();
const mockSaveDraft = jest.fn();
const mockNavigate = jest.fn();
const mockPopTo = jest.fn();
const mockReplace = jest.fn();
const mockReset = jest.fn();
let mockState: State;
jest.mock("../src/store", () => ({
  useStore: () => ({
    state: mockState,
    authenticate: mockAuthenticate,
    saveDraft: mockSaveDraft,
  }),
  uid: () => "anuncio-teste",
}));
jest.mock("../src/navigation", () => ({
  useNav: () => ({
    navigate: mockNavigate,
    popTo: mockPopTo,
    replace: mockReplace,
    reset: mockReset,
    isFocused: () => true,
    getState: () => ({
      routes: [
        { name: "Home" },
        { name: "Advertise" },
        { name: "BusinessWelcome" },
        { name: "BusinessPlanReview" },
        { name: "Auth" },
      ],
    }),
  }),
}));
jest.mock("../src/components/Motion", () => {
  const { Pressable, View } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );
  return { Tap: Pressable, Entrance: View };
});
jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
jest.mock("../src/components/ui", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    ...jest.requireActual<typeof import("../src/components/ui")>(
      "../src/components/ui",
    ),
    Page: ({
      children,
      footer,
    }: React.PropsWithChildren<{ footer?: React.ReactNode }>) =>
      React.createElement(React.Fragment, null, children, footer),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockState = { ...initialState, region: "Vale do Paraíba", city: "Caçapava" };
  mockAuthenticate.mockResolvedValue(profile);
});

it("oferece a consulta de planos e a entrada para quem já é anunciante", async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(React.createElement(AdvertiseScreen));
  });
  try {
    const button = (title: string) =>
      tree.root.findAllByType(Button).find(({ props }) => props.title === title)!;
    await act(async () => button("Ver planos de anúncio").props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith("BusinessWelcome");
    await act(async () => button("Já sou anunciante").props.onPress());
    expect(mockNavigate).toHaveBeenLastCalledWith("Auth");
    expect(mockAuthenticate).not.toHaveBeenCalled();
  } finally {
    await act(async () => tree.unmount());
  }
});

it("entra na conta existente sem exigir a escolha de um plano", async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(React.createElement(AuthScreen));
  });
  try {
    expect(tree.root.findAllByType(Chip)).toHaveLength(0);
    const [email, password] = tree.root.findAllByType(TextInput);
    await act(async () => email.props.onChangeText(profile.email));
    await act(async () => password.props.onChangeText("senha-de-teste"));
    const enter = tree.root.findAllByType(Button).find(({ props }) => props.title === "Entrar")!;
    await act(async () => enter.props.onPress());
    expect(mockAuthenticate).toHaveBeenCalledWith("login", {
      email: profile.email, password: "senha-de-teste",
    });
    expect(mockReplace).toHaveBeenCalledWith("Dashboard");
    expect(mockSaveDraft).not.toHaveBeenCalled();
  } finally {
    await act(async () => tree.unmount());
  }
});

it("cria conta a partir do Perfil e volta ao Perfil depois do cadastro", async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(React.createElement(ProfileScreen));
  });
  const signupButton = () =>
    tree.root.findAllByType(Button).find(({ props }) => props.title === "Criar conta");
  const params = { signupFromProfile: true };
  try {
    await act(async () => signupButton()!.props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith("Auth", params);
    await act(async () => {
      tree.update(React.createElement(AuthScreen, {
        route: { name: "Auth", key: "auth-profile", params },
      }));
    });
    const field = (label: string) =>
      tree.root.findAllByType(TextInput).find(
        ({ props }) => props.accessibilityLabel === label,
      )!;
    await act(async () => {
      field("Nome completo").props.onChangeText(profile.name);
      field("Telefone com DDD").props.onChangeText(profile.phone);
      field("E-mail").props.onChangeText(profile.email);
      field("Senha").props.onChangeText("senha-de-teste");
    });
    await act(async () => signupButton()!.props.onPress());
    expect(mockAuthenticate).toHaveBeenCalledWith("register", {
      ...profile,
      password: "senha-de-teste",
    });
    expect(mockPopTo).toHaveBeenCalledWith("Profile");
    expect(mockSaveDraft).not.toHaveBeenCalled();

    mockState = { ...mockState, authenticated: true, profile };
    await act(async () => tree.update(React.createElement(ProfileScreen)));
    expect(signupButton()).toBeUndefined();
  } finally {
    await act(async () => tree.unmount());
  }
});

it.each(["register", "login"] as const)("retoma o plano e os destaques depois de %s", async (mode) => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(React.createElement(AuthScreen, { route: signupRoute }));
  });
  const chip = (title: string) =>
    tree.root.findAllByType(Chip).find(({ props }) => props.title === title)!;
  const field = (label: string) =>
    tree.root.findAllByType(TextInput).find(({ props }) => props.accessibilityLabel === label)!;
  try {
    expect(chip("Criar conta").props.selected).toBe(true);
    if (mode === "login") {
      await act(async () => chip("Entrar").props.onPress());
    } else {
      await act(async () => {
        field("Nome completo").props.onChangeText(profile.name);
        field("Telefone com DDD").props.onChangeText(profile.phone);
      });
    }
    await act(async () => {
      field("E-mail").props.onChangeText(profile.email);
      field("Senha").props.onChangeText("senha-de-teste");
    });
    const submit = tree.root.findAllByType(Button).find(
      ({ props }) => props.title === (mode === "login" ? "Entrar" : "Criar conta"),
    )!;
    await act(async () => submit.props.onPress());
    expect(mockAuthenticate).toHaveBeenCalledWith(mode, {
      email: profile.email,
      password: "senha-de-teste",
      ...(mode === "register" ? { name: profile.name, phone: profile.phone } : {}),
    });
    expect(mockSaveDraft).toHaveBeenCalledWith(expect.objectContaining({
      id: "draft-anuncio-teste",
      phone: profile.phone,
      draftPlan: selection,
    }));
    expect(mockReset).toHaveBeenCalledWith({
      index: 2,
      routes: [
        { name: "Home" },
        { name: "Advertise" },
        {
          name: "BusinessWizard",
          key: "BusinessWizard-draft-anuncio-teste",
          params: { businessId: "draft-anuncio-teste", step: 0 },
        },
      ],
    });
  } finally {
    await act(async () => tree.unmount());
  }
});

it("mostra e oculta a senha em Entrar e Criar conta, preservando o texto", async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(React.createElement(AuthScreen, { route: signupRoute }));
  });
  const passwordField = () =>
    tree.root.findAllByType(TextInput).find(
      ({ props }) => props.accessibilityLabel === "Senha",
    )!;
  const toggle = (label: "Mostrar senha" | "Ocultar senha") =>
    tree.root.findAll(
      ({ props }) =>
        props.accessibilityLabel === label && typeof props.onPress === "function",
    )[0]!;
  const mode = (title: "Entrar" | "Criar conta") =>
    tree.root.findAllByType(Chip).find(({ props }) => props.title === title)!;

  try {
    await act(async () => mode("Entrar").props.onPress());
    const password = "senha-de-teste";
    expect(passwordField().props.secureTextEntry).toBe(true);
    expect(passwordField().props.autoComplete).toBe("current-password");
    expect(toggle("Mostrar senha").findByType(Icon).props.name).toBe("eye");
    await act(async () => passwordField().props.onChangeText(password));
    await act(async () => toggle("Mostrar senha").props.onPress());
    expect(passwordField().props.secureTextEntry).toBe(false);
    expect(passwordField().props.value).toBe(password);
    expect(toggle("Ocultar senha").findByType(Icon).props.name).toBe("eye-off");
    await act(async () => toggle("Ocultar senha").props.onPress());
    expect(passwordField().props.secureTextEntry).toBe(true);
    expect(passwordField().props.value).toBe(password);

    await act(async () => toggle("Mostrar senha").props.onPress());
    await act(async () => mode("Criar conta").props.onPress());
    expect(passwordField().props.secureTextEntry).toBe(true);
    expect(passwordField().props.autoComplete).toBe("new-password");
    expect(passwordField().props.value).toBe(password);
    await act(async () => toggle("Mostrar senha").props.onPress());
    expect(passwordField().props.secureTextEntry).toBe(false);
    await act(async () => toggle("Ocultar senha").props.onPress());
    expect(passwordField().props.secureTextEntry).toBe(true);
    expect(passwordField().props.value).toBe(password);
  } finally {
    await act(async () => tree.unmount());
  }
});
