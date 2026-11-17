import type { Business } from "../domain/models";
import { leafletCSS, leafletJS } from "./leafletBundle";

export type MapProps = {
  businesses: Business[];
  onSelect: (business: Business) => void;
  region?: string;
};

export function locatedBusinesses(businesses: Business[]) {
  return businesses.filter(b => b.status === "Aprovado" &&
    typeof b.latitude === "number" && Number.isFinite(b.latitude) && Math.abs(b.latitude) <= 90 &&
    typeof b.longitude === "number" && Number.isFinite(b.longitude) && Math.abs(b.longitude) <= 180);
}

export function mapCenter(region: string): [number, number] {
  if (region === "Serra da Mantiqueira") return [-22.74, -45.59];
  if (region === "Litoral Norte") return [-23.62, -45.3];
  return [-23.10, -45.70];
}

export function selectedBusiness(data: string, businesses: Business[]) {
  try {
    const value = JSON.parse(data);
    return value?.type === "select" && typeof value.id === "string"
      ? locatedBusinesses(businesses).find(b => b.id === value.id) : undefined;
  } catch { return undefined; }
}

export function mapHTML(businesses: Business[], region = "") {
  const points = locatedBusinesses(businesses).map(b => ({ id: b.id, name: b.name, lat: b.latitude, lng: b.longitude }));
  const data = JSON.stringify({ points, center: mapCenter(region) }).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <style>${leafletCSS}
  html,body,#map{height:100%;width:100%;margin:0}body{font-family:Arial,sans-serif;background:#e8f4ed}
  .leaflet-control-attribution{font-size:10px!important;max-width:calc(100vw - 20px);white-space:normal}
  #status{position:absolute;top:12px;left:55px;right:12px;z-index:1000;padding:10px;border-radius:10px;background:white;color:#163e32;font-size:12px;box-shadow:0 2px 8px #0002}
  #retry{margin-left:8px;color:#1d6b54;border:0;background:#e8f4ed;padding:6px;border-radius:6px}
  </style></head><body><div id="map" aria-label="Mapa da região"></div><div id="status" role="status">Carregando mapa…</div>
  <script>${leafletJS}\n</script><script>
  const data=${data};
  const status=document.getElementById('status');
  const map=L.map('map',{zoomControl:true,attributionControl:true}).setView(data.center,10);
  const layer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
    minZoom:3,maxZoom:19,keepBuffer:0,updateWhenIdle:true,
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'
  });
  let failed=false;
  function unavailable(){failed=true;status.hidden=false;status.textContent='Não foi possível carregar parte do mapa. Verifique sua conexão.';
    const button=document.createElement('button');button.id='retry';button.textContent='Tentar novamente';button.onclick=()=>{failed=false;status.hidden=false;status.textContent='Carregando mapa…';layer.redraw();};status.appendChild(button);}
  layer.on('tileerror',unavailable);
  layer.on('tileload',()=>{if(!failed)status.hidden=true;});
  layer.addTo(map);
  setTimeout(()=>{if(!status.hidden&&!failed)unavailable();},15000);
  function send(id){const message=JSON.stringify({type:'select',id});
    if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);
    else window.parent.postMessage(message,'*');}
  const markers=data.points.map(p=>{
    const label=document.createElement('span');label.textContent=p.name;
    const marker=L.circleMarker([p.lat,p.lng],{radius:10,color:'#fff',weight:3,fillColor:'#1d6b54',fillOpacity:1}).addTo(map);
    marker.bindTooltip(label);marker.on('click',()=>send(p.id));return marker;
  });
  if(markers.length===1)map.setView(markers[0].getLatLng(),14);
  else if(markers.length>1)map.fitBounds(L.featureGroup(markers).getBounds(),{padding:[32,32],maxZoom:14});
  window.addEventListener('resize',()=>map.invalidateSize());
  </script></body></html>`;
}
