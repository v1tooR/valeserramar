import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  View,
  type AlertButton,
  type AlertOptions,
} from "react-native";
import { colors as c, styles as s } from "../theme";
type Dialog = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
};
let present: ((value: Dialog) => void) | null = null;
export const Alert = {
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions,
  ) => present?.({ title, message, buttons, options }),
};
export function Dialogs() {
  const [queue, setQueue] = useState<Dialog[]>([]);
  useEffect(() => {
    present = (value) => setQueue((items) => [...items, value]);
    return () => {
      present = null;
    };
  }, []);
  const dialog = queue[0];
  const close = () => setQueue((items) => items.slice(1));
  return (
    <Modal
      visible={!!dialog}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (dialog?.options?.cancelable !== false) {
          close();
          dialog?.options?.onDismiss?.();
        }
      }}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#082B2266",
          padding: 24,
        }}
        accessibilityViewIsModal
      >
        <View
          style={{
            width: "100%",
            maxWidth: 380,
            borderRadius: 24,
            padding: 24,
            backgroundColor: c.white,
            gap: 16,
          }}
        >
          <Text style={s.heading}>{dialog?.title}</Text>
          {!!dialog?.message && <Text style={s.body}>{dialog.message}</Text>}
          <View style={{ gap: 10 }}>
            {(dialog?.buttons?.length ? dialog.buttons : [{ text: "OK" }]).map(
              (button, index) => (
                <Pressable
                  key={index}
                  accessibilityRole="button"
                  onPress={() => {
                    close();
                    button.onPress?.();
                  }}
                  style={({ pressed }) => ({
                    padding: 14,
                    borderRadius: 14,
                    alignItems: "center",
                    backgroundColor:
                      button.style === "cancel"
                        ? c.soft
                        : button.style === "destructive"
                          ? c.red
                          : c.green,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontWeight: "700",
                      color: button.style === "cancel" ? c.green : c.white,
                    }}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              ),
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
