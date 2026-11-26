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
export const diningSegments = [
  "Restaurantes",
  "Cafeterias",
  "Pizzarias",
  "Bares e noite",
];
export const subcategorySegments = {
  Lanches: "Restaurantes",
  Doceria: "Cafeterias",
  Lanchonetes: "Restaurantes",
  Padaria: "Cafeterias",
  "Estética e Beleza": "Serviços",
};
export const advertisingAgency = "Agência de Publicidade";

export const businessSchema = z.object({
  id: z.string(),
  name: z.string(),
  segment: z.enum([
    ...diningSegments,
    "Hospedagem",
    "Serviços",
    "Lazer",
    "Comércio",
  ]),
  subcategory: z.enum(Object.keys(subcategorySegments)).nullish(),
  lodgingType: z.enum(["Hotéis", "Pousadas", "Airbnb"]).nullish(),
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
  highlights: z.object({
    home: z.number().int().min(1).max(15).nullable(),
    explore: z.number().int().min(1).max(15).nullable(),
  }).optional(),
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
  offer: z.object({
    price: z.number().nonnegative(),
    expiresAt: z.string().refine((value) => Number.isFinite(Date.parse(value))),
  }).optional(),
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
      "Paraibuna",
    ],
  },
  {
    name: "Serra da Mantiqueira",
    cities: [
      "Campos do Jordão",
      "Santo Antônio do Pinhal",
      "São Bento do Sapucaí",
      "Monteiro Lobato",
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
export const tableReservationsInput = z.strictObject({
  acceptsReservations: z.boolean(),
});
export const businessInput = businessSchema
  .omit({ id: true, owner: true, status: true, correction: true, highlights: true })
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
  .refine(
    (b) => !b.subcategory || subcategorySegments[b.subcategory] === b.segment,
  )
  .refine((b) => !b.lodgingType || b.segment === "Hospedagem")
  .refine((b) => !b.serviceType || (b.segment === "Serviços" && !b.subcategory))
  .refine((b) =>
    regions.some((r) => r.name === b.region && r.cities.includes(b.city)),
  )
  .refine((b) => new Set(b.rooms.map((r) => r.id)).size === b.rooms.length);
export const productInput = productSchema.omit({ id: true, offer: true }).extend({
  photo: image,
  name: z.string().trim().min(1).max(160),
  price: z.number().min(0).max(1e6),
});
export const offerInput = z.object({
  durationHours: z.number().int().positive().max(2147483647),
  products: z.array(z.object({
    productId: z.uuid().transform((id) => id.toLowerCase()),
    priceCents: z.number().int().min(0).max(100000000),
  })).min(1).refine(
    (products) => new Set(products.map(({ productId }) => productId)).size === products.length,
    "Selecione cada produto uma única vez.",
  ),
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
