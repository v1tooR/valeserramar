import type { BusinessSubcategory, LodgingType, ServiceType } from "./categories";
import type { AdvertiserPlanSelection } from "./advertiserPlans";

export type Segment =
  | "Restaurantes"
  | "Cafeterias"
  | "Pizzarias"
  | "Bares e noite"
  | "Hospedagem"
  | "Serviços"
  | "Lazer"
  | "Comércio";
export type ReviewStatus =
  | "Rascunho"
  | "Em análise"
  | "Correções solicitadas"
  | "Aprovado"
  | "Recusado"
  | "Desativado";
export type BookingStatus =
  "Pendente" | "Confirmada" | "Recusada" | "Cancelada";
export type Photo = number | string;
export interface Hours {
  day: string;
  open: boolean;
  from: string;
  to: string;
}
export interface Extra {
  id: string;
  name: string;
  price: number;
}
export interface Product {
  id: string;
  businessId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  photo: Photo;
  available: boolean;
  extras: Extra[];
  offer?: { price: number; expiresAt: string };
}
export interface OfferInput {
  durationHours: number;
  products: { productId: string; priceCents: number }[];
}
export interface Room {
  id: string;
  name: string;
  description: string;
  price: number;
  guests: number;
  photo: Photo;
}
export type HighlightPlacement = "home" | "explore";

export interface Business {
  draftPlan?: AdvertiserPlanSelection;
  id: string;
  name: string;
  segment: Segment;
  subcategory?: BusinessSubcategory | null;
  lodgingType?: LodgingType | null;
  serviceType?: ServiceType | null;
  region: string;
  city: string;
  district: string;
  description: string;
  address: string;
  cep: string;
  number: string;
  phone: string;
  publicInfo?: { cnpj?: string; email?: string };
  instagram: string;
  latitude: number | null;
  longitude: number | null;
  photo: Photo;
  logo?: Photo;
  gallery: Photo[];
  hours: Hours[];
  acceptsReservations: boolean;
  amenities: string[];
  rooms: Room[];
  checkIn: string;
  checkOut: string;
  status: ReviewStatus;
  correction: string;
  owner: boolean;
  highlights?: Record<HighlightPlacement, number | null>;
}
export interface Reservation {
  id: string;
  businessId: string;
  kind: "mesa" | "hospedagem";
  name: string;
  phone: string;
  start: string;
  end: string;
  time: string;
  adults: number;
  children: number;
  roomId: string;
  roomName: string;
  notes: string;
  estimate: number;
  status: BookingStatus;
  reply: string;
  createdAt: string;
}
export interface CartItem {
  id: string;
  productId: string;
  businessId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  extras: Extra[];
  notes: string;
}
export interface Profile {
  name: string;
  email: string;
  phone: string;
}
export interface Order {
  id: string;
  businessId: string;
  text: string;
  total: number;
  createdAt: string;
}
export interface Filters {
  city: string;
  segment: string;
  district: string;
  openNow: boolean;
  menu: boolean;
  reservations: boolean;
}
export interface CatalogFilters extends Filters {
  region: string;
  query: string;
}
export interface State {
  schema: 1;
  region: string;
  city: string;
  catalogFilters: CatalogFilters | null;
  interests: string[];
  favorites: string[];
  recent: string[];
  profile: Profile | null;
  authenticated: boolean;
  businessId: string;
  businesses: Business[];
  products: Product[];
  reservations: Reservation[];
  cart: CartItem[];
  orders: Order[];
}
