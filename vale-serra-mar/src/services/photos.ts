import { Alert } from "../components/Dialogs";
import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";

const directory = `${FileSystem.documentDirectory}business-photos/`;

export async function clearPickedPhotos() {
  if (Platform.OS !== "web" && FileSystem.documentDirectory)
    await FileSystem.deleteAsync(directory, { idempotent: true });
}

export async function pickPhoto(): Promise<string | null> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.85,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 8 * 1024 * 1024) {
      Alert.alert("Imagem muito grande", "Escolha uma foto de até 8 MB.");
      return null;
    }
    if (Platform.OS === "web") return asset.uri;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const extension = asset.uri.split(".").pop()?.split("?")[0] || "jpg";
    const destination = `${directory}${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    await FileSystem.copyAsync({ from: asset.uri, to: destination });
    return destination;
  } catch {
    Alert.alert(
      "Não foi possível selecionar a foto",
      "Verifique a permissão e tente novamente.",
    );
    return null;
  }
}
