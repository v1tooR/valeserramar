import React, { useEffect, useMemo, useRef } from "react";
import { mapHTML, selectedBusiness, type MapProps } from "../maps/openStreetMap";

export function BusinessMap({ businesses, onSelect, region = "" }: MapProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const html = useMemo(() => mapHTML(businesses, region), [businesses, region]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || typeof event.data !== "string") return;
      const business = selectedBusiness(event.data, businesses);
      if (business) onSelect(business);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [businesses, onSelect]);
  return <iframe ref={frame} title="Mapa dos estabelecimentos" srcDoc={html}
    sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
    referrerPolicy="strict-origin-when-cross-origin"
    style={{ border: 0, width: "100%", height: "100%", flex: 1, minHeight: 0 }} />;
}
