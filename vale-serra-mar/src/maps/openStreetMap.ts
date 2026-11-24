import { cityKey, regions } from "../domain/catalog";
import type { Business } from "../domain/models";
import { leafletCSS, leafletJS } from "./leafletBundle";

type MapArea = {
  city?: string;
  region?: string;
};

export type MapProps = MapArea & {
  businesses: Business[];
  onSelect: (business: Business) => void;
};

type Coordinates = [latitude: number, longitude: number];
type LocatedBusiness = Business & { latitude: number; longitude: number };

// Sedes municipais do IBGE, Localidades do Brasil, Censo 2022.
const cityCenters = {
  Caçapava: [-23.0971, -45.7078],
  Taubaté: [-23.0312, -45.5655],
  "São José dos Campos": [-23.1849, -45.8786],
  Aparecida: [-22.8489, -45.2285],
  Cunha: [-23.076, -44.9593],
  Paraibuna: [-23.3873, -45.6634],
  "Campos do Jordão": [-22.7418, -45.5949],
  "Santo Antônio do Pinhal": [-22.8255, -45.662],
  "São Bento do Sapucaí": [-22.6896, -45.7309],
  "Monteiro Lobato": [-22.9559, -45.8389],
  Ubatuba: [-23.433, -45.0782],
  Caraguatatuba: [-23.6193, -45.4098],
  Ilhabela: [-23.8144, -45.3655],
  "São Sebastião": [-23.8049, -45.4015],
} satisfies Record<string, Coordinates>;

const centersByCity = new Map(
  Object.entries(cityCenters).map(([city, center]) => [cityKey(city), center]),
);

export function locatedBusinesses(businesses: Business[]) {
  return businesses.filter(
    (b): b is LocatedBusiness =>
      b.status === "Aprovado" &&
      typeof b.latitude === "number" &&
      Number.isFinite(b.latitude) &&
      Math.abs(b.latitude) <= 90 &&
      typeof b.longitude === "number" &&
      Number.isFinite(b.longitude) &&
      Math.abs(b.longitude) <= 180,
  );
}

function areaCoordinates({ city = "", region = "" }: MapArea): Coordinates[] {
  const center = centersByCity.get(cityKey(city));
  if (center) return [center];

  const selectedRegion = regions.find(({ name }) => name === region);
  return selectedRegion
    ? selectedRegion.cities
        .map((name) => centersByCity.get(cityKey(name)))
        .filter((center) => center !== undefined)
    : Object.values(cityCenters);
}

export function selectedBusiness(data: string, businesses: Business[]) {
  try {
    const value = JSON.parse(data);
    return value?.type === "select" && typeof value.id === "string"
      ? locatedBusinesses(businesses).find((b) => b.id === value.id)
      : undefined;
  } catch {
    return undefined;
  }
}

export function mapHTML(businesses: Business[], area: MapArea = {}) {
  const points = locatedBusinesses(businesses).map((b) => ({
    id: b.id,
    name: b.name,
    lat: b.latitude,
    lng: b.longitude,
  }));
  const viewport = points.length
    ? points.map(({ lat, lng }) => [lat, lng])
    : areaCoordinates(area);
  const data = JSON.stringify({ points, viewport })
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <style>${leafletCSS}
  html,body,#map{height:100%;width:100%;margin:0}body{font-family:Arial,sans-serif;background:#e8f4ed}
  .leaflet-control-attribution{font-size:10px!important;max-width:calc(100vw - 20px);white-space:normal}
  #status{position:absolute;top:12px;left:55px;right:12px;z-index:1000;padding:10px;border-radius:10px;background:white;color:#163e32;font-size:12px;box-shadow:0 2px 8px #0002}
  #retry{margin-left:8px;color:#1d6b54;border:0;background:#e8f4ed;padding:6px;border-radius:6px}
  </style></head><body><div id="map" aria-label="Mapa dos estabelecimentos"></div><div id="status" role="status">Carregando mapa…</div>
  <script>${leafletJS}\n</script><script>
  const data=${data};
  const status=document.getElementById('status');
  const map=L.map('map',{zoomControl:true,attributionControl:true});
  if(data.viewport.length===1)map.setView(data.viewport[0],14);
  else map.fitBounds(data.viewport,{padding:[32,32],maxZoom:14});
  const layer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    minZoom:3,maxZoom:19,keepBuffer:0,updateWhenIdle:true,
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
  });
  let failed=false;
  let loadTimeout;
  function unavailable(){
    status.hidden=false;
    status.textContent='Não foi possível carregar parte do mapa. Verifique sua conexão.';
    const button=document.createElement('button');
    button.id='retry';
    button.textContent='Tentar novamente';
    button.onclick=()=>{
      status.textContent='Carregando mapa…';
      beginLoading();
      layer.redraw();
    };
    status.appendChild(button);
  }
  function beginLoading(){
    failed=false;
    clearTimeout(loadTimeout);
    loadTimeout=setTimeout(unavailable,15000);
  }
  layer.on('loading',beginLoading);
  layer.on('tileerror',()=>{failed=true;});
  layer.on('load',()=>{
    clearTimeout(loadTimeout);
    if(failed)unavailable();
    else status.hidden=true;
  });
  layer.addTo(map);
  function send(id){const message=JSON.stringify({type:'select',id});
    if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);
    else window.parent.postMessage(message,'*');}
  data.points.forEach(p=>{
    const label=document.createElement('span');label.textContent=p.name;
    const marker=L.circleMarker([p.lat,p.lng],{radius:10,color:'#fff',weight:3,fillColor:'#1d6b54',fillOpacity:1}).addTo(map);
    marker.bindTooltip(label);marker.on('click',()=>send(p.id));
  });
  window.addEventListener('resize',()=>map.invalidateSize());
  </script></body></html>`;
}
