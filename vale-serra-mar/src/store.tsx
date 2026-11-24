import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { AppState } from "react-native";
import { catalogFiltersFor, initialState, regionForCity } from "./domain/catalog";
import type {
  Business,
  CatalogFilters,
  Product,
  Reservation,
  Profile,
  State,
} from "./domain/models";
import {
  ApiError,
  apiConfigured,
  asaasSandboxEnabled,
  ensureGuest,
  errorMessage,
  hasGuestSession,
  restoreTokens,
  setAccessToken,
  setUnauthorizedHandler,
} from "./api/client";
import { repository } from "./api/repository";
import { preferencesSchema } from "./api/schemas";
const STORAGE_KEY = asaasSandboxEnabled
  ? "vale-serra-mar:asaas-sandbox:preferences:v2"
  : "vale-serra-mar:preferences:v2";
export const uid = () => Crypto.randomUUID();
type Store = {
  state: State;
  ready: boolean;
  storageError: string;
  loading: boolean;
  loadError: string;
  refresh: () => Promise<void>;
  update: (fn: (s: State) => State) => void;
  setCatalogFilters: (changes: Partial<CatalogFilters>) => void;
  authenticate: (
    mode: "login" | "register",
    data: { email: string; password: string; name?: string; phone?: string },
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (p: Profile) => Promise<void>;
  saveDraft: (b: Business) => void;
  saveBusiness: (b: Business) => Promise<void>;
  setTableReservations: (
    id: string,
    acceptsReservations: boolean,
  ) => Promise<void>;
  submitBusiness: (b: Business) => Promise<Business>;
  saveProduct: (p: Product) => Promise<void>;
  deleteProduct: (p: Product) => Promise<void>;
  addReservation: (r: Reservation) => Promise<Reservation>;
  cancelReservation: (id: string) => Promise<void>;
  respondReservation: (
    id: string,
    status: "Confirmada" | "Recusada",
    reply: string,
  ) => Promise<void>;
};
const Context = createContext<Store | null>(null);
const merge = <T extends { id: string }>(a: T[], b: T[]) => [
  ...a.filter((x) => !b.some((y) => y.id === x.id)),
  ...b,
];
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(initialState),
    [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState(""),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState("");
  const current = useRef(state);
  current.current = state;
  const writes = useRef(Promise.resolve());
  const revision = useRef(0);
  const refreshId = useRef(0);
  const clearPrivate = () => {
    revision.current++;
    current.current = {
      ...current.current,
      authenticated: false,
      profile: null,
    };
    setState((s) => ({
      ...s,
      authenticated: false,
      profile: null,
      businessId: "",
      businesses: s.businesses.filter(
        (b) => !b.owner && b.status === "Aprovado",
      ),
      products: s.products.filter((p) =>
        s.businesses.some((b) => b.id === p.businessId && !b.owner),
      ),
      reservations: [],
      orders: [],
      cart: [],
    }));
  };
  async function refresh() {
    const version = revision.current;
    const requestId = ++refreshId.current;
    if (!apiConfigured) {
      setLoadError(
        "Não foi possível carregar os estabelecimentos. Tente novamente mais tarde.",
      );
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const catalog = await repository.catalog();
      const workspace = current.current.authenticated
        ? await repository.workspace()
        : null;
      const guest = hasGuestSession() ? await repository.reservations() : [];
      if (version !== revision.current || requestId !== refreshId.current)
        return;
      const publicById = new Map(catalog.businesses.map((b) => [b.id, b]));
      setState((s) => {
        const drafts = s.businesses.filter((b) => b.id.startsWith("draft-"));
        const all = merge(
          merge(
            catalog.businesses.map((b) => ({ ...b, owner: false })),
            workspace?.businesses.map((b) => ({
              ...b,
              owner: true,
              highlights: publicById.get(b.id)?.highlights,
            })) || [],
          ),
          drafts,
        );
        return {
          ...s,
          businesses: all,
          products: merge(
            merge(catalog.products, workspace?.products || []),
            s.products.filter((p) => p.id.startsWith("draft-")),
          ),
          reservations: merge(guest, workspace?.reservations || []),
          businessId: all.some((b) => b.owner && b.id === s.businessId)
            ? s.businessId
            : all.find((b) => b.owner)?.id || "",
        };
      });
    } catch (e) {
      if (version === revision.current && requestId === refreshId.current)
        setLoadError(errorMessage(e));
    } finally {
      if (requestId === refreshId.current) setLoading(false);
    }
  }
  useEffect(() => {
    let alive = true;
    setUnauthorizedHandler(clearPrivate);
    (async () => {
      try {
        await AsyncStorage.removeItem("vale-serra-mar:demo:v1");
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const pref = preferencesSchema.safeParse(JSON.parse(raw));
          if (pref.success && alive) {
            const previousCity = "pindamonhangaba";
            const cityWasReplaced = pref.data.city.trim().toLowerCase() === previousCity;
            const savedFilters = pref.data.catalogFilters;
            setState((s) => ({
              ...s,
              ...pref.data,
              city: cityWasReplaced ? "Aparecida" : pref.data.city,
              region: cityWasReplaced ? "Vale do Paraíba" : pref.data.region,
              catalogFilters: savedFilters
                ? {
                    ...savedFilters,
                    region: regionForCity(savedFilters.city) ?? savedFilters.region,
                  }
                : null,
              recent: pref.data.recent.filter(
                (query) => !query.toLowerCase().includes(previousCity),
              ),
            }));
          }
        }
        const hasToken = await restoreTokens();
        if (hasToken && apiConfigured) {
          const profile = await repository.profile();
          if (alive) {
            current.current = {
              ...current.current,
              authenticated: true,
              profile,
            };
            setState((s) => ({ ...s, authenticated: true, profile }));
          }
        }
      } catch {
        if (alive)
          setStorageError(
            "Não foi possível restaurar sua sessão ou preferências.",
          );
      } finally {
        if (alive) {
          setReady(true);
          await refresh();
        }
      }
    })();
    return () => {
      alive = false;
      revision.current++;
      setUnauthorizedHandler(() => {});
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const { region, city, interests, favorites, recent, catalogFilters } = state;
    const raw = JSON.stringify({ region, city, interests, favorites, recent, catalogFilters });
    writes.current = writes.current
      .then(() => AsyncStorage.setItem(STORAGE_KEY, raw))
      .catch(() =>
        setStorageError(
          "Não foi possível salvar suas preferências no aparelho.",
        ),
      );
  }, [
    state.region,
    state.city,
    state.interests,
    state.favorites,
    state.recent,
    state.catalogFilters,
    ready,
  ]);
  useEffect(() => {
    if (!ready) return;
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      if (previous !== "active" && next === "active") void refresh();
      previous = next;
    });
    return () => subscription.remove();
  }, [ready]);
  const saveDraft = (b: Business) =>
    setState((s) => ({
      ...s,
      businessId: b.id,
      businesses: merge(s.businesses, [b]),
    }));
  function requireCurrent(version: number) {
    if (version !== revision.current)
      throw new ApiError("Sua sessão mudou. Entre novamente.");
  }
  async function saveBusiness(b: Business) {
    const version = revision.current;
    if (b.id.startsWith("draft-")) {
      saveDraft(b);
      return;
    }
    const saved = await repository.saveBusiness(b, false);
    requireCurrent(version);
    saveDraft(saved);
  }
  async function submitBusiness(b: Business) {
    const version = revision.current;
    const creating = b.id.startsWith("draft-");
    const saved = await repository.saveBusiness(b, creating);
    requireCurrent(version);
    const draftProducts = current.current.products.filter(
      (p) => p.businessId === b.id,
    );
    if (creating) {
      setState((s) => ({
        ...s,
        businessId: saved.id,
        businesses: merge(
          s.businesses.filter((x) => x.id !== b.id),
          [saved],
        ),
        products: s.products.map((p) =>
          p.businessId === b.id ? { ...p, businessId: saved.id } : p,
        ),
      }));
    }
    for (const p of draftProducts) {
      if (p.id.startsWith("draft-")) {
        const uploaded = await repository.saveProduct(
          { ...p, businessId: saved.id },
          true,
        );
        requireCurrent(version);
        setState((s) => ({
          ...s,
          products: merge(
            s.products.filter((x) => x.id !== p.id),
            [uploaded],
          ),
        }));
      }
    }
    const submitted = await repository.submit(saved.id);
    requireCurrent(version);
    saveDraft(submitted);
    return submitted;
  }
  async function saveProduct(p: Product) {
    const version = revision.current;
    if (p.businessId.startsWith("draft-")) {
      setState((s) => ({ ...s, products: merge(s.products, [p]) }));
      return;
    }
    const saved = await repository.saveProduct(p, p.id.startsWith("draft-"));
    requireCurrent(version);
    setState((s) => ({
      ...s,
      products: merge(
        s.products.filter((x) => x.id !== p.id),
        [saved],
      ),
    }));
  }
  const replaceReservation = (r: Reservation) =>
    setState((s) => ({ ...s, reservations: merge(s.reservations, [r]) }));
  return (
    <Context.Provider
      value={{
        state,
        ready,
        storageError,
        loading,
        loadError,
        refresh,
        update: setState,
        setCatalogFilters: (changes) => setState((current) => ({
          ...current,
          catalogFilters: { ...catalogFiltersFor(current), ...changes },
        })),
        saveDraft,
        saveBusiness,
        setTableReservations: async (id, acceptsReservations) => {
          const version = revision.current;
          const saved = await repository.setTableReservations(
            id,
            acceptsReservations,
          );
          requireCurrent(version);
          setState((s) => ({
            ...s,
            businesses: s.businesses.map((b) =>
              b.id === id
                ? { ...b, acceptsReservations: saved.acceptsReservations }
                : b,
            ),
          }));
          await refresh();
        },
        submitBusiness,
        saveProduct,
        authenticate: async (mode, data) => {
          const result = await repository.auth(mode, data);
          await setAccessToken(result.token);
          revision.current++;
          current.current = {
            ...current.current,
            authenticated: true,
            profile: result.profile,
          };
          setState((s) => ({
            ...s,
            authenticated: true,
            profile: result.profile,
          }));
          await refresh();
        },
        logout: async () => {
          try {
            await repository.logout();
          } catch {}
          await setAccessToken("");
          clearPrivate();
          current.current = { ...current.current, authenticated: false };
          await refresh();
        },
        updateProfile: async (p) => {
          const version = revision.current;
          const profile = await repository.updateProfile(p);
          requireCurrent(version);
          setState((s) => ({ ...s, profile }));
        },
        deleteProduct: async (p) => {
          const version = revision.current;
          if (!p.businessId.startsWith("draft-"))
            await repository.deleteProduct(p);
          requireCurrent(version);
          setState((s) => ({
            ...s,
            products: s.products.filter((x) => x.id !== p.id),
            cart: s.cart.filter((x) => x.productId !== p.id),
          }));
        },
        addReservation: async (r) => {
          const version = revision.current;
          await ensureGuest();
          const saved = await repository.reserve(r);
          requireCurrent(version);
          replaceReservation(saved);
          return saved;
        },
        cancelReservation: async (id) => {
          const version = revision.current;
          const result = await repository.cancel(id);
          requireCurrent(version);
          replaceReservation(result);
        },
        respondReservation: async (id, status, reply) => {
          const version = revision.current;
          const result = await repository.respond(id, status, reply);
          requireCurrent(version);
          replaceReservation(result);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const store = useContext(Context);
  if (!store) throw new Error("StoreProvider ausente");
  return store;
}
