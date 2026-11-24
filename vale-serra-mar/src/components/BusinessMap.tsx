import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { Button } from "./ui";
import { openExternal } from "../services/external";
import {
  mapHTML,
  selectedBusiness,
  type MapProps,
} from "../maps/openStreetMap";

export function BusinessMap({ businesses, onSelect, city, region }: MapProps) {
  const html = useMemo(
    () => mapHTML(businesses, { city, region }),
    [businesses, city, region],
  );
  const source = useMemo(() => ({ html }), [html]);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 20, gap: 12 }}>
        <Text>Não foi possível abrir o mapa.</Text>
        <Button
          title="Tentar novamente"
          onPress={() => {
            setFailed(false);
            setAttempt((n) => n + 1);
          }}
        />
      </View>
    );
  return (
    <WebView
      key={attempt}
      source={source}
      style={{ flex: 1, backgroundColor: "#e8f4ed" }}
      originWhitelist={["*"]}
      userAgent="ValeSerraMar/0.2 (br.com.valeserramar.guia)"
      javaScriptEnabled
      cacheEnabled
      incognito={false}
      mixedContentMode="never"
      setSupportMultipleWindows={false}
      geolocationEnabled={false}
      onError={() => setFailed(true)}
      onRenderProcessGone={() => setFailed(true)}
      onContentProcessDidTerminate={() => setFailed(true)}
      onShouldStartLoadWithRequest={(request) => {
        if (
          request.url === "about:blank" ||
          request.url.startsWith("about:blank#")
        )
          return true;
        if (
          request.url === "https://www.openstreetmap.org/copyright" ||
          request.url.startsWith("https://leafletjs.com")
        )
          void openExternal(request.url);
        return false;
      }}
      onMessage={(event) => {
        const business = selectedBusiness(event.nativeEvent.data, businesses);
        if (business) onSelect(business);
      }}
    />
  );
}
