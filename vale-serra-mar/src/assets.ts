export const assets = {
  logo: require("../assets/asset-03.png"),
  logoFull: require("../assets/asset-00.png"),
  landscape: require("../assets/landscape.png"),
  mountain: require("../assets/mountain.png"),
  valley: require("../assets/asset-01.png"),
};
export const photoSource = (photo: number | string) =>
  typeof photo === "number" ? photo : photo ? { uri: photo } : undefined;
