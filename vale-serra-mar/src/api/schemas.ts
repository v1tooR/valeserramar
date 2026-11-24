import { z } from "zod";
import {
  advertisingAgency,
  businessSubcategories,
  lodgingSubcategories,
} from "../domain/categories";
const photo = z.string();
const highlightSlot = z.number().int().min(1).max(15).nullable().catch(null);
const hours = z.object({
  day: z.string(),
  open: z.boolean(),
  from: z.string(),
  to: z.string(),
});
const room = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number().nonnegative(),
  guests: z.number().int().positive(),
  photo,
});
export const businessSchema = z.object({
  id: z.string(),
  name: z.string(),
  segment: z.enum([
    "Restaurantes",
    "Cafeterias",
    "Pizzarias",
    "Bares e noite",
    "Hospedagem",
    "Serviços",
    "Lazer",
    "Comércio",
  ]),
  subcategory: z.enum(businessSubcategories).nullish(),
  lodgingType: z.enum(lodgingSubcategories).nullish(),
  serviceType: z.literal(advertisingAgency).nullish(),
  region: z.string(),
  city: z.string(),
  district: z.string(),
  description: z.string(),
  address: z.string(),
  cep: z.string(),
  number: z.string(),
  phone: z.string(),
  instagram: z.string(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  photo,
  logo: photo.optional(),
  gallery: z.array(photo),
  hours: z.array(hours).length(7),
  acceptsReservations: z.boolean(),
  amenities: z.array(z.string()),
  rooms: z.array(room),
  checkIn: z.string(),
  checkOut: z.string(),
  status: z.enum([
    "Rascunho",
    "Em análise",
    "Correções solicitadas",
    "Aprovado",
    "Recusado",
    "Desativado",
  ]),
  correction: z.string(),
  owner: z.boolean(),
  highlights: z
    .object({ home: highlightSlot, explore: highlightSlot })
    .nullish()
    .transform((value) => value ?? undefined)
    .catch(undefined),
});
export const productSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  price: z.number().nonnegative(),
  photo,
  available: z.boolean(),
  extras: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      price: z.number().nonnegative(),
    }),
  ),
});
export const reservationSchema = z.object({
  id: z.string(),
  businessId: z.string(),
  kind: z.enum(["mesa", "hospedagem"]),
  name: z.string(),
  phone: z.string(),
  start: z.string(),
  end: z.string(),
  time: z.string(),
  adults: z.number().int().positive(),
  children: z.number().int().nonnegative(),
  roomId: z.string(),
  roomName: z.string(),
  notes: z.string(),
  estimate: z.number().nonnegative(),
  status: z.enum(["Pendente", "Confirmada", "Recusada", "Cancelada"]),
  reply: z.string(),
  createdAt: z.string(),
});
export const profileSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string(),
});
export const catalogSchema = z.object({
  businesses: z.array(businessSchema),
  products: z.array(productSchema),
});
export const workspaceSchema = catalogSchema.extend({
  reservations: z.array(reservationSchema),
});
export const authSchema = z.object({
  token: z.string().min(1),
  profile: profileSchema,
});
export const preferencesSchema = z.object({
  region: z.string(),
  city: z.string(),
  interests: z.array(z.string()),
  favorites: z.array(z.string()),
  recent: z.array(z.string()),
  catalogFilters: z
    .object({
      region: z.string(),
      city: z.string(),
      segment: z.string(),
      district: z.string(),
      openNow: z.boolean(),
      menu: z.boolean(),
      reservations: z.boolean(),
      query: z.string(),
    })
    .nullish()
    .catch(null),
});
