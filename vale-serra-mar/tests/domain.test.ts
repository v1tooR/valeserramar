import { it, expect } from "@jest/globals";
import {
  cartTotal,
  validateCart,
  parseDate,
  nights,
  validateReservation,
  filterBusinesses,
  isOpen,
  orderMessage,
} from "../src/domain/logic";
import { businesses, products } from "./fixtures";
import type { CartItem, Reservation, Filters } from "../src/domain/models";
const item: CartItem = {
  id: "1",
  productId: "moqueca",
  businessId: "quintal",
  name: "Moqueca",
  unitPrice: 89.9,
  quantity: 2,
  extras: [{ id: "farofa", name: "Farofa", price: 6 }],
  notes: "",
};
const booking: Omit<Reservation, "id" | "createdAt" | "status" | "reply"> = {
  businessId: "ipe",
  kind: "hospedagem",
  name: "Teste",
  phone: "12999999999",
  start: "2030-06-10",
  end: "2030-06-12",
  time: "",
  adults: 2,
  children: 0,
  roomId: "jardim",
  roomName: "Chalé",
  notes: "",
  estimate: 840,
};
const filters: Filters = {
  city: "",
  segment: "",
  district: "",
  openNow: false,
  menu: false,
  reservations: false,
};
it("soma quantidade e adicionais sem cobrar reserva", () =>
  expect(cartTotal([item])).toBeCloseTo(191.8));
it("rejeita item removido, indisponível ou com preço alterado", () => {
  expect(validateCart([item], products)).toBe("");
  expect(validateCart([item], [])).not.toBe("");
  expect(
    validateCart(
      [item],
      products.map((p) => ({ ...p, available: false })),
    ),
  ).not.toBe("");
  expect(validateCart([{ ...item, unitPrice: 80 }], products)).not.toBe("");
});
it("rejeita datas impossíveis e calcula noites no calendário", () => {
  expect(parseDate("2030-02-30")).toBeNull();
  expect(parseDate("2032-02-29")).not.toBeNull();
  expect(nights("2030-06-10", "2030-06-12")).toBe(2);
});
it("valida hóspede, telefone, acomodação e check-out", () => {
  const now = new Date("2030-06-01T12:00:00");
  expect(validateReservation(booking, now)).toBe("");
  for (const invalid of [
    { end: booking.start },
    { roomId: "" },
    { phone: "123" },
    { adults: 0 },
    { start: "2020-01-01" },
  ])
    expect(validateReservation({ ...booking, ...invalid }, now)).not.toBe("");
});
it("rejeita reserva de mesa no passado", () =>
  expect(
    validateReservation(
      { ...booking, kind: "mesa", start: "2030-06-01", time: "10:00" },
      new Date("2030-06-01T12:00:00"),
    ),
  ).not.toBe(""));
it("busca ignora acentos e esconde anúncios não aprovados", () => {
  expect(
    filterBusinesses(businesses, filters, "cafe", "Vale do Paraíba").map(
      (b) => b.id,
    ),
  ).toEqual(["cafe"]);
  expect(
    filterBusinesses(
      businesses.map((b) => ({ ...b, status: "Em análise" })),
      filters,
      "",
      "",
    ),
  ).toEqual([]);
  expect(
    filterBusinesses(
      businesses,
      { ...filters, segment: "Hospedagem" },
      "",
      "Vale do Paraíba",
    ),
  ).toEqual([]);
});
it("filtra categorias e separa subcategorias com o mesmo segmento", () => {
  const lodging = { ...businesses[0], segment: "Hospedagem" as const };
  const places = [
    ...businesses,
    { ...businesses[1], id: "doceria", subcategory: "Doceria" as const },
    { ...businesses[0], id: "lanches", subcategory: "Lanches" as const },
    { ...lodging, id: "hotel", lodgingType: "Hotéis" as const },
    { ...lodging, id: "pousada", lodgingType: "Pousadas" as const },
    { ...lodging, id: "airbnb", lodgingType: "Airbnb" as const },
    { ...lodging, id: "hospedagem-antiga" },
    { ...businesses[0], id: "lazer", segment: "Lazer" as const },
    { ...businesses[0], id: "servico", segment: "Serviços" as const },
    {
      ...businesses[0],
      id: "salao",
      segment: "Serviços" as const,
      subcategory: "Estética e Beleza" as const,
    },
  ];
  const ids = (segment: string) =>
    filterBusinesses(places, { ...filters, segment }, "", "").map((b) => b.id);

  expect(ids("Alimentação")).toEqual(["quintal", "cafe", "doceria", "lanches"]);
  expect(ids("Restaurante")).toEqual(["quintal"]);
  expect(ids("Cafeteria")).toEqual(["cafe"]);
  expect(ids("Doceria")).toEqual(["doceria"]);
  expect(ids("Lanches")).toEqual(["lanches"]);
  expect(ids("Hospedagem")).toEqual([
    "hotel",
    "pousada",
    "airbnb",
    "hospedagem-antiga",
  ]);
  expect(ids("Hotéis")).toEqual(["hotel"]);
  expect(ids("Pousadas")).toEqual(["pousada"]);
  expect(ids("Airbnb")).toEqual(["airbnb"]);
  expect(ids("Lazer")).toEqual(["lazer"]);
  expect(ids("Serviços")).toEqual(["servico"]);
  expect(ids("Estética e Beleza")).toEqual(["salao"]);
});
it("considera expediente atravessando meia-noite no fuso de São Paulo", () => {
  const b = {
    ...businesses[0],
    hours: businesses[0].hours.map((h) => ({
      ...h,
      open: true,
      from: "20:00",
      to: "02:00",
    })),
  };
  expect(isOpen(b, new Date("2030-06-02T04:00:00Z"))).toBe(true);
  expect(isOpen(b, new Date("2030-06-02T15:00:00Z"))).toBe(false);
});
it("mensagem deixa confirmação e taxa sob responsabilidade do estabelecimento", () => {
  const text = orderMessage(businesses[0], [item], "Ana", false, "", "");
  expect(text).toContain("2x Moqueca");
  expect(text).toContain("Retirada no local");
  expect(text).toContain("confirmação a combinar");
});
