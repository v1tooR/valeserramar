import { z } from "zod";
const photo = z.string();
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
export const regions = [
  {
    name: "Vale do Paraíba",
    cities: [
      "Caçapava",
      "Taubaté",
      "São José dos Campos",
      "Aparecida",
      "Cunha",
    ],
  },
  {
    name: "Serra da Mantiqueira",
    cities: [
      "Campos do Jordão",
      "Santo Antônio do Pinhal",
      "São Bento do Sapucaí",
    ],
  },
  {
    name: "Litoral Norte",
    cities: ["Ubatuba", "Caraguatatuba", "Ilhabela", "São Sebastião"],
  },
];

const image = z
  .string()
  .max(1024)
  .refine((value) => !value || /^https:\/\//.test(value));
export const businessInput = businessSchema
  .omit({ id: true, owner: true, status: true, correction: true })
  .extend({
    photo: image,
    logo: image.optional(),
    gallery: z.array(image).max(30),
    rooms: z
      .array(
        room.extend({
          photo: image,
          guests: z.number().int().min(1).max(100),
          price: z.number().min(0).max(1e6),
        }),
      )
      .max(100),
  })
  .refine((b) =>
    regions.some((r) => r.name === b.region && r.cities.includes(b.city)),
  )
  .refine((b) => new Set(b.rooms.map((r) => r.id)).size === b.rooms.length);
export const productInput = productSchema.omit({ id: true }).extend({
  photo: image,
  name: z.string().trim().min(1).max(160),
  price: z.number().min(0).max(1e6),
});
export const bookingInput = reservationSchema
  .omit({
    id: true,
    status: true,
    reply: true,
    createdAt: true,
    estimate: true,
    roomName: true,
  })
  .extend({
    name: z.string().trim().min(1).max(160),
    phone: z
      .string()
      .max(40)
      .refine((v) => /^\d{10,13}$/.test(v.replace(/\D/g, ""))),
    notes: z.string().max(2000),
    adults: z.number().int().min(1).max(100),
    children: z.number().int().min(0).max(100),
  });
export const credentials = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(128),
});
export const profileInput = profileSchema.extend({
  email: credentials.shape.email,
  name: z.string().trim().min(1).max(160),
  phone: z.string().max(40),
});
export const registration = profileInput.extend({
  password: credentials.shape.password,
});
