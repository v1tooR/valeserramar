import { emptyBusiness } from "../src/domain/catalog";
import type { Business, Product } from "../src/domain/models";
export const businesses: Business[] = [
  {
    ...emptyBusiness("quintal"),
    name: "Negócio A",
    status: "Aprovado",
    owner: false,
  },
  {
    ...emptyBusiness("cafe"),
    name: "Café",
    segment: "Cafeterias",
    status: "Aprovado",
    owner: false,
  },
];
export const products: Product[] = [
  {
    id: "moqueca",
    businessId: "quintal",
    name: "Item A",
    description: "",
    category: "Pratos",
    price: 89.9,
    photo: "",
    available: true,
    extras: [{ id: "farofa", name: "Adicional", price: 6 }],
  },
];
