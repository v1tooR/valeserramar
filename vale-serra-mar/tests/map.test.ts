import { expect, it } from "@jest/globals";
import { emptyBusiness, regions } from "../src/domain/catalog";
import type { Business } from "../src/domain/models";
import { mapHTML, selectedBusiness } from "../src/maps/openStreetMap";

function mapData(businesses: Business[], area?: Parameters<typeof mapHTML>[1]) {
  const embeddedData = mapHTML(businesses, area).match(/^ +const data=(.*);$/m);
  if (!embeddedData)
    throw new Error("O mapa não contém os dados de localização.");
  return JSON.parse(embeddedData[1]) as {
    viewport: [number, number][];
    points: { id: string; lat: number; lng: number }[];
  };
}

it("enquadra cada cidade sem pinos no próprio centro e respeita a região", () => {
  const allCenters = regions.flatMap(({ name, cities }) => {
    const centers = cities.map((city) => {
      const { points, viewport } = mapData([], { city, region: name });
      expect(points).toEqual([]);
      expect(viewport).toHaveLength(1);
      return viewport[0];
    });
    expect(mapData([], { region: name }).viewport).toEqual(centers);
    return centers;
  });
  expect(new Set(allCenters.map((center) => center.join(","))).size).toBe(
    allCenters.length,
  );
  const viewport = mapData([]).viewport;
  expect(viewport).toHaveLength(allCenters.length);
  expect(viewport).toEqual(expect.arrayContaining(allCenters));
  expect(mapData([], { city: "santo antonio do pinhal" }).viewport).toEqual([
    [-22.8255, -45.662],
  ]);
});

it("enquadra e abre os pinos de estabelecimentos aprovados com coordenadas válidas", () => {
  const local: Business = {
    ...emptyBusiness("local"),
    name: "Soluma Salgados",
    status: "Aprovado",
    latitude: -23.1033708,
    longitude: -45.7154455,
  };
  const coast = {
    ...local,
    id: "coast",
    name: "Porto do Engenho",
    city: "Ilhabela",
    latitude: -23.790117,
    longitude: -45.362945,
  };
  const pending = {
    ...emptyBusiness("pending"),
    latitude: -23,
    longitude: -45,
  };
  const invalid = { ...local, id: "invalid", latitude: 91 };
  expect(mapData([local], { city: local.city }).viewport).toEqual([
    [local.latitude, local.longitude],
  ]);
  const businesses = [local, coast, pending, invalid];
  const data = mapData(businesses);
  expect(data.viewport).toEqual([
    [local.latitude, local.longitude],
    [coast.latitude, coast.longitude],
  ]);
  expect(data.points.map(({ id }) => id)).toEqual([local.id, coast.id]);
  expect(
    selectedBusiness(
      JSON.stringify({ type: "select", id: coast.id }),
      businesses,
    ),
  ).toBe(coast);
  expect(
    selectedBusiness(
      JSON.stringify({ type: "select", id: invalid.id }),
      businesses,
    ),
  ).toBeUndefined();
});
