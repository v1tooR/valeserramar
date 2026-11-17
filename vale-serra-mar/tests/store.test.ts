import { expect, it, jest } from "@jest/globals";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { StoreProvider, useStore } from "../src/store";
import { initialState } from "../src/domain/catalog";
import { repository } from "../src/api/repository";
import type { Reservation } from "../src/domain/models";
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn<() => Promise<null>>().mockResolvedValue(null),
  setItemAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
jest.mock("../src/api/client", () => ({
  apiConfigured: false,
  ensureGuest: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  hasGuestSession: () => false,
  restoreTokens: jest.fn<() => Promise<boolean>>().mockResolvedValue(false),
  setAccessToken: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  setUnauthorizedHandler: jest.fn(),
  errorMessage: () => "Indisponível",
}));
jest.mock("../src/api/repository", () => ({
  repository: { reserve: jest.fn(), auth: jest.fn() },
}));
it("inicia sem estabelecimentos, produtos ou conta pré-criada", () => {
  expect(initialState.businesses).toEqual([]);
  expect(initialState.products).toEqual([]);
  expect(initialState.profile).toBeNull();
  expect(initialState.authenticated).toBe(false);
});
it("não cria conta nem reserva quando o servidor falha", async () => {
  let store!: ReturnType<typeof useStore>;
  function Probe() {
    store = useStore();
    return null;
  }
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      React.createElement(StoreProvider, null, React.createElement(Probe)),
    );
  });
  jest.mocked(repository.auth).mockRejectedValue(new Error("offline"));
  await act(async () => {
    await expect(
      store.authenticate("login", { email: "a@b.com", password: "secret" }),
    ).rejects.toThrow();
  });
  expect(store.state.authenticated).toBe(false);
  jest.mocked(repository.reserve).mockRejectedValue(new Error("offline"));
  await act(async () => {
    await expect(
      store.addReservation({ id: "r" } as Reservation),
    ).rejects.toThrow();
  });
  expect(store.state.reservations).toHaveLength(0);
  await act(async () => tree.unmount());
});
