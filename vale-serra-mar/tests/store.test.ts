import { expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { StoreProvider, useStore } from "../src/store";
import { catalogFiltersFor, emptyBusiness, initialState } from "../src/domain/catalog";
import { setAccessToken } from "../src/api/client";
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
  repository: { reserve: jest.fn(), auth: jest.fn(), deleteAccount: jest.fn() },
}));
jest.mock("../src/services/photos", () => ({
  clearPickedPhotos: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
it("inicia sem estabelecimentos, produtos ou conta pré-criada", () => {
  expect(initialState.businesses).toEqual([]);
  expect(initialState.products).toEqual([]);
  expect(initialState.profile).toBeNull();
  expect(initialState.authenticated).toBe(false);
});
it("reabre o app com os mesmos filtros e preserva a opção todas as regiões", async () => {
  const key = "vale-serra-mar:preferences:v2";
  await AsyncStorage.setItem(
    key,
    JSON.stringify({
      region: "Vale do Paraíba",
      city: "Caçapava",
      interests: ["Restaurantes"],
      favorites: ["favorito"],
      recent: ["sushi"],
    }),
  );
  let store!: ReturnType<typeof useStore>;
  let tree!: ReactTestRenderer;
  function Probe() {
    store = useStore();
    return null;
  }
  async function reopen() {
    await act(async () => {
      tree = create(
        React.createElement(StoreProvider, null, React.createElement(Probe)),
      );
    });
  }
  await reopen();
  expect(catalogFiltersFor(store.state)).toMatchObject({
    city: "Caçapava",
    region: "Vale do Paraíba",
  });
  const selection = {
    city: "Ilhabela",
    region: "Litoral Norte",
    query: "porto",
    segment: "Restaurante",
    district: "Saco",
    openNow: true,
    menu: true,
    reservations: true,
  };
  await act(async () => store.setCatalogFilters(selection));
  await act(async () => tree.unmount());
  await reopen();
  expect(catalogFiltersFor(store.state)).toEqual(selection);
  expect(store.state.favorites).toEqual(["favorito"]);
  await act(async () => store.setCatalogFilters({ city: "", region: "" }));
  await act(async () => tree.unmount());
  await reopen();
  expect(catalogFiltersFor(store.state)).toEqual({
    ...selection,
    region: "",
    city: "",
  });
  expect(store.state.city).toBe("Caçapava");
  await act(async () => tree.unmount());
  await AsyncStorage.removeItem(key);
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
it("encerra a sessão e limpa os dados locais após confirmar a exclusão no servidor", async () => {
  const profile = { name: "Conta", email: "conta@example.com", phone: "12999999999" };
  const owned = emptyBusiness("draft-private");
  const visible = { ...owned, id: "public", status: "Aprovado" as const, owner: false };
  let store!: ReturnType<typeof useStore>;
  let tree!: ReactTestRenderer;
  function Probe() { store = useStore(); return null; }
  await act(async () => { tree = create(React.createElement(StoreProvider, null, React.createElement(Probe))); });
  try {
    await act(async () => store.update((current) => ({ ...current,
      authenticated: true, profile, region: "Vale do Paraíba", city: "Caçapava",
      businesses: [owned, visible], businessId: owned.id, favorites: [visible.id], recent: ["restaurante"],
    })));
    jest.mocked(repository.deleteAccount).mockRejectedValueOnce(new Error("offline"));
    await act(async () => { await expect(store.deleteAccount("senha-atual")).rejects.toThrow("offline"); });
    expect(store.state.profile).toEqual(profile);
    jest.mocked(repository.deleteAccount).mockResolvedValueOnce(undefined);
    await act(async () => store.deleteAccount("senha-atual"));
    expect(setAccessToken).toHaveBeenLastCalledWith("");
    expect(store.state).toMatchObject({ profile: null, authenticated: false, city: "Caçapava", favorites: [], recent: [], businesses: [visible] });
  } finally {
    await act(async () => tree.unmount());
    await AsyncStorage.removeItem("vale-serra-mar:preferences:v2");
  }
});
