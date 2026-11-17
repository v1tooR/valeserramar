import { Alert } from "../components/Dialogs";
import { Linking } from "react-native";
import { phoneDigits } from "../domain/logic";
import type { Business } from "../domain/models";
export async function openExternal(url: string) {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert(
      "Não foi possível abrir",
      "Verifique se há um aplicativo compatível instalado e tente novamente.",
    );
    return false;
  }
}
export function contact(b: Business, text = "") {
  if (!b.phone) {
    Alert.alert(
      "Contato indisponível",
      "O estabelecimento ainda não informou um telefone de contato.",
    );
    return Promise.resolve(false);
  }
  const phone = phoneDigits(b.phone);
  return openExternal(
    `https://wa.me/${phone.length <= 11 ? "55" : ""}${phone}?text=${encodeURIComponent(text)}`,
  );
}
export function directions(b: Business) {
  return openExternal(
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.address}, ${b.number}, ${b.city}, SP`)}`,
  );
}
