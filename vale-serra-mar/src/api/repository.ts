import { Platform } from "react-native";
import type {
  Business,
  OfferInput,
  Product,
  Profile,
  Reservation,
  Photo,
} from "../domain/models";
import { ApiError, request } from "./client";
import {
  authSchema,
  businessSchema,
  catalogSchema,
  productSchema,
  profileSchema,
  reservationSchema,
  workspaceSchema,
} from "./schemas";
import { z } from "zod";
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError(
      "Não foi possível ler os dados recebidos. Tente atualizar.",
    );
  return result.data;
}
async function get<T>(path: string, schema: z.ZodType<T>) {
  return parse(schema, await request(path));
}
async function send<T>(
  path: string,
  method: string,
  body: unknown,
  schema: z.ZodType<T>,
  key?: string,
) {
  return parse(
    schema,
    await request(path, {
      method,
      body: JSON.stringify(body),
      ...(key ? { headers: { "Idempotency-Key": key } } : {}),
    }),
  );
}
export async function uploadPhoto(photo: Photo): Promise<string> {
  if (!photo) return "";
  if (typeof photo !== "string")
    throw new ApiError("Escolha uma imagem para seu anúncio.");
  if (/^https:\/\//.test(photo)) return photo;
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await (await fetch(photo)).blob();
    form.append(
      "file",
      blob,
      blob.type === "image/png" ? "photo.png" : "photo.jpg",
    );
  } else {
    const extension =
      photo.split("?")[0].split(".").pop()?.toLowerCase() || "jpg";
    const types: Record<string, string> = {
      png: "image/png",
      webp: "image/webp",
      heic: "image/heic",
      heif: "image/heif",
    };
    form.append("file", {
      uri: photo,
      name: `photo.${extension}`,
      type: types[extension] || "image/jpeg",
    } as unknown as Blob);
  }
  const result = await request<{ url: string }>("/media", {
    method: "POST",
    body: form,
  });
  if (!result.url?.startsWith("https://"))
    throw new ApiError("Não foi possível salvar a imagem.");
  return result.url;
}
async function businessBody(b: Business) {
  const { owner, status, correction, id, highlights, draftPlan, ...fields } = b;
  return {
    ...fields,
    subcategory: b.subcategory ?? null,
    photo: await uploadPhoto(b.photo),
    logo: b.logo ? await uploadPhoto(b.logo) : undefined,
    gallery: await Promise.all(b.gallery.map(uploadPhoto)),
    rooms: await Promise.all(
      b.rooms.map(async (room) => ({
        ...room,
        photo: await uploadPhoto(room.photo),
      })),
    ),
  };
}
export const repository = {
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  catalog: () => get("/catalog", catalogSchema),
  profile: () => get("/me", profileSchema),
  workspace: () => get("/me/workspace", workspaceSchema),
  reservations: () => get("/reservations", z.array(reservationSchema)),
  auth: (
    mode: "login" | "register",
    data: { email: string; password: string; name?: string; phone?: string },
  ) => send(`/auth/${mode}`, "POST", data, authSchema),
  updateProfile: (data: Profile) => send("/me", "PATCH", data, profileSchema),
  saveBusiness: async (b: Business, creating: boolean) =>
    send(
      creating ? "/businesses" : `/businesses/${encodeURIComponent(b.id)}`,
      creating ? "POST" : "PATCH",
      await businessBody(b),
      businessSchema,
      creating ? b.id : undefined,
    ),
  setTableReservations: (id: string, acceptsReservations: boolean) =>
    send(
      `/businesses/${encodeURIComponent(id)}/table-reservations`,
      "PATCH",
      { acceptsReservations },
      businessSchema,
    ),
  submit: (id: string) =>
    send(
      `/businesses/${encodeURIComponent(id)}/submit`,
      "POST",
      {},
      businessSchema,
      undefined,
    ),
  saveProduct: async (p: Product, creating: boolean) => {
    const { id, offer, ...data } = p;
    return send(
      `/businesses/${encodeURIComponent(p.businessId)}/products${creating ? "" : `/${encodeURIComponent(id)}`}`,
      creating ? "POST" : "PATCH",
      { ...data, photo: await uploadPhoto(p.photo) },
      productSchema,
      creating ? id : undefined,
    );
  },
  deleteProduct: (p: Product) =>
    request<void>(
      `/businesses/${encodeURIComponent(p.businessId)}/products/${encodeURIComponent(p.id)}`,
      { method: "DELETE" },
    ),
  createOffers: async (businessId: string, data: OfferInput, key: string) =>
    (await send(
      `/businesses/${encodeURIComponent(businessId)}/offers`,
      "POST",
      data,
      z.object({ products: z.array(productSchema) }),
      key,
    )).products,
  reserve: (r: Reservation) => {
    const { id, status, reply, createdAt, estimate, roomName, ...data } = r;
    return send("/reservations", "POST", data, reservationSchema, id);
  },
  respond: (id: string, status: "Confirmada" | "Recusada", reply: string) =>
    send(
      `/reservations/${encodeURIComponent(id)}/respond`,
      "POST",
      { status, reply },
      reservationSchema,
    ),
  cancel: (id: string) =>
    send(
      `/reservations/${encodeURIComponent(id)}/cancel`,
      "POST",
      {},
      reservationSchema,
    ),
  metrics: (id: string, days: number) =>
    get(
      `/businesses/${encodeURIComponent(id)}/metrics?days=${days}`,
      z.object({
        views: z.number().nonnegative(),
        contacts: z.number().nonnegative(),
        requests: z.number().nonnegative(),
        confirmed: z.number().nonnegative(),
      }),
    ),
  subscription: (id: string) =>
    get(
      `/businesses/${encodeURIComponent(id)}/subscription`,
      z.object({
        status: z.string(),
        plan: z.string().nullable(),
        amount: z.number().nullable(),
        dueDate: z.string().nullable(),
      }),
    ),
};
