import { assets } from "../assets";
import type { Business, CatalogFilters, Hours, Segment, State } from "./models";
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
    photo: assets.valley,
  },
  {
    name: "Serra da Mantiqueira",
    cities: [
      "Campos do Jordão",
      "Santo Antônio do Pinhal",
      "São Bento do Sapucaí",
      "Monteiro Lobato",
    ],
    photo: assets.mountain,
  },
  {
    name: "Litoral Norte",
    cities: ["Ubatuba", "Caraguatatuba", "Ilhabela", "São Sebastião"],
    photo: assets.landscape,
  },
];
export const cityKey = (city: string) =>
  city.normalize("NFD").replace(/[\u0300-\u036f\s]/g, "").toLowerCase();

const regionByCity = new Map(
  regions.flatMap(({ name, cities }) =>
    cities.map((city) => [cityKey(city), name] as const),
  ),
);

export function regionForCity(city: string) {
  return regionByCity.get(cityKey(city));
}

export const emptyCatalogFilters: CatalogFilters = {
  region: "",
  city: "",
  segment: "",
  district: "",
  openNow: false,
  menu: false,
  reservations: false,
  query: "",
};

export function catalogFiltersFor({
  catalogFilters,
  city,
  region,
}: State): CatalogFilters {
  if (catalogFilters) return catalogFilters;
  return { ...emptyCatalogFilters, city, region: regionForCity(city) ?? region };
}

export const segments: Segment[] = [
  "Restaurantes",
  "Cafeterias",
  "Pizzarias",
  "Bares e noite",
  "Hospedagem",
  "Serviços",
  "Lazer",
  "Comércio",
];
export const hours = (): Hours[] =>
  ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"].map(
    (day, i) => ({
      day,
      open: false,
      from: "09:00",
      to: "18:00",
    }),
  );
export function emptyBusiness(id: string): Business {
  return {
    id,
    name: "",
    segment: "Restaurantes",
    region: regions[0].name,
    city: "Caçapava",
    district: "",
    description: "",
    address: "",
    cep: "",
    number: "",
    phone: "",
    instagram: "",
    latitude: null,
    longitude: null,
    photo: "",
    gallery: [],
    hours: hours(),
    acceptsReservations: false,
    amenities: [],
    rooms: [],
    checkIn: "14:00",
    checkOut: "12:00",
    status: "Rascunho",
    correction: "",
    owner: true,
  };
}
export const initialState: State = {
  schema: 1,
  region: "",
  city: "",
  catalogFilters: null,
  interests: [],
  favorites: [],
  recent: [],
  profile: null,
  authenticated: false,
  businessId: "",
  businesses: [],
  products: [],
  reservations: [],
  cart: [],
  orders: [],
};
