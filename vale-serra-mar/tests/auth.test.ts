import { expect, it, jest } from "@jest/globals";
import React from "react";
import { TextInput } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Chip, Icon } from "../src/components/ui";
import { AuthScreen } from "../src/screens/OnboardingBusiness";

jest.mock("../src/store", () => ({
  useStore: () => ({ authenticate: jest.fn() }),
}));
jest.mock("../src/navigation", () => ({ useNav: () => ({}) }));
jest.mock("../src/components/Motion", () => {
  const { Pressable, View } = jest.requireActual<typeof import("react-native")>(
    "react-native",
  );
  return { Tap: Pressable, Entrance: View };
});
jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
jest.mock("../src/components/ui", () => ({
  ...jest.requireActual<typeof import("../src/components/ui")>(
    "../src/components/ui",
  ),
  Page: ({ children }: React.PropsWithChildren) => children,
}));

it("mostra e oculta a senha em Entrar e Criar conta, preservando o texto", async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(React.createElement(AuthScreen));
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
