import type { Business, Segment } from "./models";

export const exploreCategories = [
  "Alimentação",
  "Comércio",
  "Estética e Beleza",
  "Hospedagem",
  "Lazer",
  "Serviços",
] as const;

export type ExploreCategory = (typeof exploreCategories)[number];

export const lodgingSubcategories = ["Hotéis", "Pousadas", "Airbnb"] as const;
export type LodgingType = (typeof lodgingSubcategories)[number];

const subcategorySegments = {
  Lanches: "Restaurantes",
  Doceria: "Cafeterias",
  Lanchonetes: "Restaurantes",
  Padaria: "Cafeterias",
  "Estética e Beleza": "Serviços",
} as const satisfies Record<string, Segment>;

export type BusinessSubcategory = keyof typeof subcategorySegments;
export const businessSubcategories = Object.keys(
  subcategorySegments,
) as BusinessSubcategory[];

type BusinessType = {
  label: string;
  segment: Segment;
  category?: ExploreCategory;
  subcategory?: BusinessSubcategory;
  lodgingType?: LodgingType;
};

function subcategoryType(
  subcategory: BusinessSubcategory,
  category: ExploreCategory,
): BusinessType {
  return {
    label: subcategory,
    segment: subcategorySegments[subcategory],
    category,
    subcategory,
  };
}

export const foodTypes: readonly BusinessType[] = [
  { label: "Pizzaria", segment: "Pizzarias", category: "Alimentação" },
  { label: "Restaurante", segment: "Restaurantes", category: "Alimentação" },
  subcategoryType("Lanches", "Alimentação"),
  { label: "Cafeteria", segment: "Cafeterias", category: "Alimentação" },
  subcategoryType("Doceria", "Alimentação"),
  subcategoryType("Lanchonetes", "Alimentação"),
  { label: "Bares e noite", segment: "Bares e noite", category: "Alimentação" },
  subcategoryType("Padaria", "Alimentação"),
];

export const lodgingTypes: readonly BusinessType[] =
  lodgingSubcategories.map((lodgingType) => ({
    label: lodgingType,
    segment: "Hospedagem",
    category: "Hospedagem",
    lodgingType,
  }));

export const businessTypes: readonly BusinessType[] = [
  ...foodTypes,
  { label: "Comércio", segment: "Comércio", category: "Comércio" },
  subcategoryType("Estética e Beleza", "Estética e Beleza"),
  ...lodgingTypes,
  { label: "Lazer", segment: "Lazer", category: "Lazer" },
  { label: "Serviços", segment: "Serviços", category: "Serviços" },
];

export function businessType(
  business: Pick<Business, "segment" | "subcategory" | "lodgingType">,
): BusinessType {
  return (
    businessTypes.find(
      (type) =>
        type.segment === business.segment &&
        type.subcategory === (business.subcategory ?? undefined) &&
        type.lodgingType === (business.lodgingType ?? undefined),
    ) ?? {
      label: business.segment,
      segment: business.segment,
      category: business.segment === "Hospedagem" ? "Hospedagem" : undefined,
    }
  );
}

export function categoryForSelection(selection: string) {
  return (
    exploreCategories.find((category) => category === selection) ??
    businessTypes.find(
      (type) =>
        type.label === selection ||
        (!type.subcategory && type.segment === selection),
    )?.category
  );
}
