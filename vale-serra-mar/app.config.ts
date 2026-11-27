import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Vale, Serra e Mar",
  slug: "vale-serra-mar",
  owner: "eduudevv",
  extra: {
    eas: {
      projectId: "b1199a5a-fb4f-4903-a1e8-c51618547354",
    },
  },
  version: "0.2.18",
  icon: "./assets/app-icon.png",
  orientation: "portrait",
  userInterfaceStyle: "light",
  scheme: "valeserramar",
  android: {
    package: "br.com.valeserramar.guia",
    versionCode: 19,
    adaptiveIcon: {
      foregroundImage: "./assets/app-icon-foreground.png",
      backgroundColor: "#08392F",
    },
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY || "",
      },
    },
  },
  ios: {
    bundleIdentifier: "br.com.valeserramar.guia",
    supportsTablet: true,
  },
  plugins: [
    "expo-secure-store",
    [
      "expo-image-picker",
      {
        photosPermission: "Escolha fotos para o anúncio do seu negócio.",
        microphonePermission: false,
      },
    ],
  ],
};

export default config;
