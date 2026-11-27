import type {
  Business,
  CartItem,
  Filters,
  HighlightPlacement,
  Reservation,
  Product,
} from "./models";
import { businessType, exploreCategories } from "./categories";
import { cityKey, regionForCity } from "./catalog";
export const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export const isRestaurant = (segment: string) =>
  ["Restaurantes", "Cafeterias", "Pizzarias", "Bares e noite"].includes(
    segment,
  );
export const canReserve = (business: Business) =>
  business.acceptsReservations &&
  (business.segment === "Hospedagem" || isRestaurant(business.segment));
export function activeOffer(product: Product, now = Date.now()) {
  const offer = product.offer;
  if (product.available && offer && offer.price < product.price &&
      Date.parse(offer.expiresAt) > now) return offer;
}
export const productPrice = (product: Product, now = Date.now()) =>
  activeOffer(product, now)?.price ?? product.price;

export const cartTotal = (items: CartItem[]) =>
  items.reduce(
    (sum, item) =>
      sum +
      (item.unitPrice + item.extras.reduce((v, extra) => v + extra.price, 0)) *
        item.quantity,
    0,
  );
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d, 12);
  return dateKey(date) === value ? date : null;
}
export function nights(start: string, end: string) {
  const a = parseDate(start),
    b = parseDate(end);
  if (!a || !b) return 0;
  return Math.round(
    (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
      Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) /
      86400000,
  );
}
export function displayDate(value: string) {
  return (
    parseDate(value)?.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    }) || value
  );
}
export function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}
export function validPhone(value: string) {
  return /^(?:55)?\d{10,11}$/.test(phoneDigits(value));
}
const businessClock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export function isOpen(business: Business, now = new Date()) {
  const parts = businessClock.formatToParts(now);
  const value = (type: string) =>
    parts.find((p) => p.type === type)?.value || "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    value("weekday"),
  );
  const minutes = Number(value("hour")) * 60 + Number(value("minute"));
  const toMinutes = (t: string) =>
    Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const today = business.hours[day],
    yesterday = business.hours[(day + 6) % 7];
  const from = toMinutes(today.from),
    to = toMinutes(today.to);
  const previousNight =
    yesterday.open &&
    toMinutes(yesterday.to) < toMinutes(yesterday.from) &&
    minutes < toMinutes(yesterday.to);
  return (
    previousNight ||
    (today.open &&
      (to < from ? minutes >= from : minutes >= from && minutes < to))
  );
}
export function highlightedBusinesses(
  businesses: Business[],
  placement: HighlightPlacement,
) {
  const occupiedSlots = new Set<string>();
  return businesses
    .flatMap((business) => {
      const slot = business.highlights?.[placement];
      if (
        business.status !== "Aprovado" ||
        typeof business.photo !== "string" ||
        !business.photo.trim() ||
        typeof slot !== "number" ||
        !Number.isInteger(slot) ||
        slot < 1 ||
        slot > 15
      ) return [];
      const city = cityKey(business.city);
      const key = `${city}:${slot}`;
      if (!city || occupiedSlots.has(key)) return [];
      occupiedSlots.add(key);
      return [{ business, slot }];
    })
    .sort((a, b) => a.slot - b.slot)
    .map(({ business }) => business);
}

export function filterBusinesses(
  businesses: Business[],
  filters: Filters,
  query: string,
  region: string,
  now = new Date(),
) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const district = normalize(filters.district);
  const city = cityKey(filters.city);
  const regionKey = normalize(region);
  const selectedCategory = exploreCategories.find(
    (category) => category === filters.segment,
  );
  return businesses.filter((b) => {
    if (
      b.status !== "Aprovado" ||
      (city && cityKey(b.city) !== city) ||
      (regionKey && normalize(regionForCity(b.city) ?? b.region) !== regionKey) ||
      (district && !normalize(b.district).includes(district)) ||
      (filters.menu && !isRestaurant(b.segment)) ||
      (filters.reservations && !canReserve(b))
    )
      return false;

    if (filters.segment || terms.length) {
      const type = businessType(b);
      const matchesCategory = selectedCategory
        ? type.category === selectedCategory
        : b.segment === filters.segment || type.label === filters.segment;
      if (filters.segment && !matchesCategory) return false;
      if (terms.length) {
        const searchable = normalize(
          `${b.name} ${b.segment} ${type.label} ${type.category ?? ""} ${b.description} ${b.city} ${b.district}`,
        );
        if (!terms.every((term) => searchable.includes(term))) return false;
      }
    }
    return !filters.openNow || isOpen(b, now);
  });
}
export function validateReservation(
  r: Omit<Reservation, "id" | "createdAt" | "status" | "reply">,
  now = new Date(),
) {
  if (!r.name.trim() || !validPhone(r.phone))
    return "Informe seu nome e um telefone válido com DDD.";
  if (!parseDate(r.start) || r.start < dateKey(now))
    return "Escolha uma data a partir de hoje.";
  if (r.adults < 1 || !Number.isInteger(r.adults) || r.children < 0)
    return "Informe a quantidade de pessoas.";
  if (r.kind === "hospedagem" && nights(r.start, r.end) < 1)
    return "O check-out deve ser depois do check-in.";
  if (r.kind === "hospedagem" && !r.roomId) return "Escolha uma acomodação.";
  if (
    r.kind === "mesa" &&
    (!validTime(r.time) || new Date(`${r.start}T${r.time}:00`) <= now)
  )
    return "Escolha um horário futuro válido.";
  return "";
}
export function orderMessage(
  business: Business,
  items: CartItem[],
  name: string,
  delivery: boolean,
  address: string,
  notes: string,
) {
  return `Olá, ${business.name}! Quero fazer um pedido pelo Vale, Serra e Mar.\n\n${items.map((i) => `${i.quantity}x ${i.name} — ${money((i.unitPrice + i.extras.reduce((v, e) => v + e.price, 0)) * i.quantity)}${i.extras.length ? "\nAdicionais: " + i.extras.map((e) => e.name).join(", ") : ""}${i.notes ? "\nObservação: " + i.notes : ""}`).join("\n\n")}\n\nTotal dos itens: ${money(cartTotal(items))}\n${delivery ? "Entrega: " + address : "Retirada no local"}\nTaxa, pagamento e confirmação a combinar com o estabelecimento.\nNome: ${name}${notes ? "\nObservações: " + notes : ""}`;
}

export function validateCart(items: CartItem[], products: Product[]) {
  if (!items.length) return "Seu pedido está vazio.";
  for (const item of items) {
    const current = products.find(
      (product) =>
        product.id === item.productId && product.businessId === item.businessId,
    );
    if (!current || !current.available)
      return `${item.name} não está disponível. Remova o item para continuar.`;
    if (
      productPrice(current) !== item.unitPrice ||
      item.extras.some(
        (extra) =>
          !current.extras.some(
            (value) => value.id === extra.id && value.price === extra.price,
          ),
      )
    )
      return `O preço de ${item.name} mudou. Remova e adicione o item novamente.`;
  }
  return "";
}
