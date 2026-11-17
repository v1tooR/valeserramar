import type {
  Business,
  CartItem,
  Filters,
  Reservation,
  Product,
} from "./models";
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
export function isOpen(business: Business, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
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
export function filterBusinesses(
  businesses: Business[],
  filters: Filters,
  query: string,
  region: string,
  now = new Date(),
) {
  const term = normalize(query);
  return businesses.filter(
    (b) =>
      b.status === "Aprovado" &&
      (!region || b.region === region) &&
      (!filters.city || b.city === filters.city) &&
      (!filters.segment || b.segment === filters.segment) &&
      (!filters.district || b.district === filters.district) &&
      (!filters.openNow || isOpen(b, now)) &&
      (!filters.menu || isRestaurant(b.segment)) &&
      (!filters.reservations || b.acceptsReservations) &&
      (!term ||
        normalize(`${b.name} ${b.segment} ${b.description} ${b.city}`).includes(
          term,
        )),
  );
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
      current.price !== item.unitPrice ||
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
