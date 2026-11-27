import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
const base = (process.env.EXPO_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
export const apiConfigured = Boolean(base);
const accessKey = "vsm.access";
const guestKey = "vsm.guest";
let accessToken = "";
let guestToken = "";
let onUnauthorized = () => {};
const vault = {
  get: async (key: string) =>
    Platform.OS === "web" ? null : SecureStore.getItemAsync(key),
  set: async (key: string, value: string) => {
    if (Platform.OS !== "web") await SecureStore.setItemAsync(key, value);
  },
  remove: async (key: string) => {
    if (Platform.OS !== "web") await SecureStore.deleteItemAsync(key);
  },
};
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}
export async function restoreTokens() {
  accessToken = (await vault.get(accessKey)) || "";
  guestToken = (await vault.get(guestKey)) || "";
  return Boolean(accessToken);
}
export async function setAccessToken(token: string) {
  if (!token) {
    accessToken = "";
    await vault.remove(accessKey);
    return;
  }
  await vault.set(accessKey, token);
  accessToken = token;
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!base)
    throw new ApiError(
      "O serviço está indisponível no momento. Tente novamente mais tarde.",
    );
  if (!base.startsWith("https://") && !__DEV__)
    throw new ApiError("Não foi possível estabelecer uma conexão segura.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const authenticatedRequest = accessToken;
  try {
    const response = await fetch(`${base}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(guestToken ? { "X-Guest-Token": guestToken } : {}),
        ...options.headers,
      },
    });
    if (
      response.status === 401 &&
      authenticatedRequest &&
      authenticatedRequest === accessToken
    ) {
      await setAccessToken("");
      onUnauthorized();
    }
    if (!response.ok)
      throw new ApiError(
        response.status === 401
          ? "Sua sessão expirou. Entre novamente."
          : response.status === 409
            ? "Os dados foram atualizados. Atualize a tela e tente novamente."
            : response.status === 422
              ? "Confira os dados preenchidos e tente novamente."
              : "Não foi possível concluir. Tente novamente.",
        response.status,
      );
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "Não foi possível conectar. Confira sua internet e tente novamente.",
    );
  } finally {
    clearTimeout(timer);
  }
}
let creatingGuest: Promise<void> | null = null;
export async function ensureGuest() {
  if (guestToken) return;
  if (!creatingGuest)
    creatingGuest = (async () => {
      const result = await request<{ token: string }>("/guest-sessions", {
        method: "POST",
      });
      if (!result.token || typeof result.token !== "string")
        throw new ApiError("Resposta inválida do serviço.");
      await vault.set(guestKey, result.token);
      guestToken = result.token;
    })().finally(() => {
      creatingGuest = null;
    });
  await creatingGuest;
}
export const hasGuestSession = () => Boolean(guestToken);
export const errorMessage = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : "Não foi possível concluir esta ação. Tente novamente.";
