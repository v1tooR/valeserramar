import { afterAll, beforeEach, expect, it, jest } from "@jest/globals";
import { emptyBusiness } from "../src/domain/catalog";
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn<() => Promise<null>>().mockResolvedValue(null),
  setItemAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));
process.env.EXPO_PUBLIC_API_URL = "https://api.invalid";
const { request, setAccessToken, setUnauthorizedHandler } =
  require("../src/api/client") as typeof import("../src/api/client");
const fetchMock = jest.spyOn(globalThis, "fetch");
beforeEach(() => {
  fetchMock.mockReset();
});
afterAll(() => fetchMock.mockRestore());
it("envia o cadastro sem a seleção local de plano ou destaque", async () => {
  const { repository } = require("../src/api/repository") as typeof import("../src/api/repository");
  const business = emptyBusiness("draft-test");
  fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ ...business, id: "server-id" }) } as Response);
  await repository.saveBusiness({ ...business, draftPlan: { planId: "annual", highlights: ["home"] } }, true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("https://api.invalid/businesses");
  expect(JSON.parse(String(options?.body))).not.toHaveProperty("draftPlan");
});
it("envia JSON e token recebido do servidor", async () => {
  await setAccessToken("session");
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ok: true }),
  } as Response);
  await expect(request("/me")).resolves.toEqual({ ok: true });
  expect(fetchMock).toHaveBeenCalledWith(
    "https://api.invalid/me",
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer session" }),
    }),
  );
});
it("limpa sessão expirada em 401 sem aceitar sucesso", async () => {
  const expired = jest.fn();
  setUnauthorizedHandler(expired);
  await setAccessToken("expired");
  fetchMock.mockResolvedValue({ ok: false, status: 401 } as Response);
  await expect(request("/me")).rejects.toMatchObject({ status: 401 });
  expect(expired).toHaveBeenCalledTimes(1);
});
it("falha de rede é um erro e não um resultado fabricado", async () => {
  fetchMock.mockRejectedValue(new TypeError("network"));
  await expect(request("/catalog")).rejects.toThrow(
    "Não foi possível conectar",
  );
});
it("resposta 204 é aceita sem tentar ler JSON", async () => {
  fetchMock.mockResolvedValue({ ok: true, status: 204 } as Response);
  await expect(
    request("/products/1", { method: "DELETE" }),
  ).resolves.toBeUndefined();
});

it("solicita um catálogo atualizado ao recarregar os estabelecimentos", async () => {
  const { repository } = require("../src/api/repository") as typeof import("../src/api/repository");
  const catalog = { businesses: [], products: [] };
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => catalog } as Response);
  await expect(repository.catalog()).resolves.toEqual(catalog);
  expect(fetchMock).toHaveBeenCalledWith(
    "https://api.invalid/catalog",
    expect.objectContaining({ cache: "no-store" }),
  );
});
