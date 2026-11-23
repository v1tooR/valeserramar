import { Alert } from "./Dialogs";
import { errorMessage } from "../api/client";
import { Tap as Pressable } from "./Motion";
import { CommonActions } from "@react-navigation/native";
import React, { useState, useRef } from "react";
import { Entrance } from "./Motion";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors as c, styles as s } from "../theme";
import { assets } from "../assets";
import { useNav, type ScreenName } from "../navigation";
import { useStore } from "../store";
export type IconName = React.ComponentProps<typeof Feather>["name"];
export function Icon({
  name,
  size = 21,
  color = c.green,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Feather name={name} size={size} color={color} />;
}
export function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={u.iconButton}
    >
      <Icon name={icon} />
    </Pressable>
  );
}
export function Button({
  title,
  onPress,
  secondary,
  danger,
  disabled,
  icon,
  loading,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  icon?: IconName;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        u.button,
        secondary && u.secondary,
        danger && { backgroundColor: c.red },
        { opacity: disabled || loading ? 0.45 : pressed ? 0.75 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.white} />
      ) : (
        <>
          {icon && (
            <Icon name={icon} size={18} color={secondary ? c.green : c.white} />
          )}
          <Text
            style={{
              color: secondary ? c.green : c.white,
              fontSize: 15,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
export function Chip({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        u.chip,
        selected && { backgroundColor: c.green, borderColor: c.green },
      ]}
    >
      <Text
        style={{
          color: selected ? c.white : c.muted,
          fontSize: 13,
          fontWeight: selected ? "600" : "400",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  error,
  action,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  action?: { icon: IconName; label: string; onPress: () => void };
}) {
  const input = (
    <TextInput
      accessibilityLabel={label}
      placeholderTextColor="#8B9890"
      {...props}
      style={[
        s.field,
        props.multiline && { minHeight: 92, textAlignVertical: "top" },
        props.style,
        action && u.fieldWithAction,
      ]}
    />
  );
  return (
    <View style={{ gap: 4 }}>
      <Text style={s.label}>{label}</Text>
      {action ? (
        <View>
          {input}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            style={u.fieldAction}
          >
            <Icon name={action.icon} size={20} />
          </Pressable>
        </View>
      ) : input}
      {error && <Text style={{ color: c.red }}>{error}</Text>}
    </View>
  );
}
export function Notice({
  children,
  tone = "green",
}: {
  children: React.ReactNode;
  tone?: "green" | "amber" | "blue" | "red";
}) {
  return (
    <View
      style={{
        borderRadius: 14,
        padding: 14,
        backgroundColor:
          tone === "amber"
            ? c.yellow
            : tone === "blue"
              ? c.blue
              : tone === "red"
                ? "#FDEBE8"
                : c.mint,
      }}
    >
      <Text
        style={[
          s.body,
          { fontSize: 13, color: tone === "red" ? c.red : c.dark },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}
export function Badge({ text }: { text: string }) {
  const pending = /análise|Pendente|Correções|Rascunho/.test(text);
  const bad = /Recus|Cancel|Desativ/.test(text);
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: bad ? "#FDEBE8" : pending ? c.yellow : c.mint,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 20,
      }}
    >
      <Text
        style={{
          fontSize: 11,
          color: bad ? c.red : pending ? c.amber : c.green,
          fontWeight: "600",
        }}
      >
        ● {text}
      </Text>
    </View>
  );
}
export function Section({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={s.between}>
      <Text style={s.heading}>{title}</Text>
      {action && (
        <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10}>
          <Text style={{ color: c.green, fontSize: 12, fontWeight: "600" }}>
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
export function Row({
  title,
  subtitle,
  icon = "chevron-right",
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[s.card, s.row]}
    >
      <View style={u.smallIcon}>
        <Icon name={icon} size={18} />
      </View>
      <View style={s.grow}>
        <Text style={[s.body, { fontWeight: "600" }]}>{title}</Text>
        {subtitle && <Text style={s.muted}>{subtitle}</Text>}
      </View>
      <Icon name="chevron-right" size={18} color={c.muted} />
    </Pressable>
  );
}
export function Toggle({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  return (
    <View style={s.between}>
      <View style={s.grow}>
        <Text style={[s.body, { fontWeight: "600" }]}>{title}</Text>
        {subtitle && <Text style={s.muted}>{subtitle}</Text>}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        disabled={saving}
        onValueChange={async (value) => {
          if (pending.current) return;
          pending.current = true;
          setSaving(true);
          try {
            await onChange(value);
          } catch (e) {
            Alert.alert("Não foi possível salvar", errorMessage(e));
          } finally {
            pending.current = false;
            setSaving(false);
          }
        }}
        trackColor={{ false: "#CFD8D2", true: c.green }}
        thumbColor={c.white}
      />
    </View>
  );
}
export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 20,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <View style={s.between}>
      <Text style={[s.body, { flex: 1 }]}>{label}</Text>
      <View style={s.row}>
        <IconButton
          icon="minus"
          label={`Diminuir ${label}`}
          onPress={() => onChange(Math.max(min, value - 1))}
        />
        <Text
          style={[
            s.body,
            { fontWeight: "700", minWidth: 20, textAlign: "center" },
          ]}
        >
          {value}
        </Text>
        <IconButton
          icon="plus"
          label={`Aumentar ${label}`}
          onPress={() => onChange(Math.min(max, value + 1))}
        />
      </View>
    </View>
  );
}
export function BrandHeader() {
  const nav = useNav(),
    { state } = useStore();
  return (
    <View style={[s.between, { paddingVertical: 8 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ir para o início"
        onPress={() => nav.reset({ index: 0, routes: [{ name: "Home" }] })}
        style={{ flexShrink: 1 }}
      >
        <Image
          source={assets.logo}
          style={{ width: 168, height: 54 }}
          resizeMode="contain"
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Alterar região"
        style={u.location}
        onPress={() => nav.navigate("Preferences")}
      >
        <Icon name="map-pin" size={13} />
        <Text style={{ color: c.green, fontSize: 12, fontWeight: "600" }}>
          {state.city || "Região"}
        </Text>
        <Icon name="chevron-down" size={13} />
      </Pressable>
    </View>
  );
}
export function Tabs({
  active = "Home",
  advertiser = false,
}: {
  active?: ScreenName;
  advertiser?: boolean;
}) {
  const nav = useNav();
  const items: [ScreenName, string, IconName][] = advertiser
    ? [
        ["Dashboard", "Negócio", "briefcase"],
        ["ManageReservations", "Reservas", "list"],
        ["Indicators", "Indicadores", "bar-chart-2"],
        ["Account", "Conta", "user"],
      ]
    : [
        ["Home", "Início", "home"],
        ["Search", "Explorar", "search"],
        ["Map", "Mapa", "map"],
        ["Profile", "Perfil", "user"],
      ];
  return (
    <SafeAreaView
      edges={Platform.OS === "android" ? ["bottom"] : []}
      style={u.tabs}
    >
      {items.map(([screen, title, icon]) => (
        <Pressable
          key={screen}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === screen }}
          onPress={() => nav.dispatch(CommonActions.navigate({ name: screen }))}
          style={u.tab}
        >
          <Icon
            name={icon}
            size={22}
            color={active === screen ? c.green : c.muted}
          />
          <Text
            style={{
              fontSize: 11,
              color: active === screen ? c.green : c.muted,
              fontWeight: active === screen ? "700" : "400",
            }}
          >
            {title}
          </Text>
          <View
            style={{
              width: 34,
              height: 2,
              backgroundColor: active === screen ? c.green : "transparent",
            }}
          />
        </Pressable>
      ))}
    </SafeAreaView>
  );
}
export function Page({
  children,
  title,
  subtitle,
  footer,
  tab,
  advertiser,
  brand,
  right,
  scroll = true,
  keyboardAware = false,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  tab?: ScreenName;
  advertiser?: boolean;
  brand?: boolean;
  right?: React.ReactNode;
  scroll?: boolean;
  keyboardAware?: boolean;
}) {
  const nav = useNav(),
    { storageError, loading, refresh } = useStore();
  const formScroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const formHeight = useRef(0);
  const androidForm = keyboardAware && Platform.OS === "android";
  const iosForm = keyboardAware && Platform.OS === "ios";
  const keyboardBehavior = androidForm
    ? "height"
    : Platform.OS === "ios" && !iosForm
      ? "padding"
      : undefined;

  function onFormLayout({ nativeEvent: { layout } }: LayoutChangeEvent) {
    const shrank = layout.height < formHeight.current;
    formHeight.current = layout.height;
    if (!shrank || layout.height <= 0) return;

    const viewport = formScroll.current;
    const content = viewport?.getInnerViewRef();
    const field = TextInput.State.currentlyFocusedInput();
    if (!content || !field || !viewport) return;

    field.measureLayout(content, (_x, top, _width, height) => {
      if (TextInput.State.currentlyFocusedInput() !== field) return;
      const offset = top + height + 16 - formHeight.current;
      if (offset > 0) viewport.scrollTo({ y: offset, animated: true });
    });
  }

  const content = (
    <Entrance style={{ padding: 20, gap: 20 }}>
      {brand && <BrandHeader />}
      {children}
    </Entrance>
  );
  return (
    <SafeAreaView
      style={{ flex: 1, minHeight: 0, backgroundColor: c.white }}
      edges={tab && Platform.OS === "android" ? ["top"] : ["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, minHeight: 0 }}
        behavior={keyboardBehavior}
      >
        {title && (
          <View style={u.header}>
            <IconButton
              icon="chevron-left"
              label="Voltar"
              onPress={() =>
                nav.canGoBack() ? nav.goBack() : nav.navigate("Home")
              }
            />
            <View style={s.grow}>
              <Text
                style={{
                  textAlign: "center",
                  fontSize: 17,
                  fontWeight: "700",
                  color: c.dark,
                }}
              >
                {title}
              </Text>
              {subtitle && (
                <Text style={[s.muted, { textAlign: "center", fontSize: 12 }]}>
                  {subtitle}
                </Text>
              )}
            </View>
            {right || <View style={{ width: 40 }} />}
          </View>
        )}
        {!!storageError && <Notice tone="red">{storageError}</Notice>}
        {scroll ? (
          <ScrollView
            ref={androidForm ? formScroll : undefined}
            style={{ flex: 1, minHeight: 0 }}
            automaticallyAdjustKeyboardInsets={iosForm}
            onLayout={androidForm ? onFormLayout : undefined}
            refreshControl={
              tab ? (
                <RefreshControl
                  refreshing={loading}
                  onRefresh={refresh}
                  tintColor={c.green}
                />
              ) : undefined
            }
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1 }}
          >
            {content}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            {children}
          </View>
        )}
        {footer && <View style={u.footer}>{footer}</View>}
        {tab && <Tabs active={tab} advertiser={advertiser} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const u = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 13,
    backgroundColor: c.green,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  secondary: {
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.border,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.white,
  },
  fieldWithAction: { paddingRight: 52 },
  fieldAction: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.white,
  },
  smallIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: c.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  location: {
    flexDirection: "row",
    gap: 3,
    backgroundColor: c.mint,
    borderRadius: 20,
    padding: 9,
    maxWidth: 166,
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabs: {
    flexShrink: 0,
    backgroundColor: c.white,
    zIndex: 10,
    elevation: 8,
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: c.border,
    paddingTop: 9,
  },
  tab: {
    flex: 1,
    minHeight: Platform.OS === "android" ? 50 : 58,
    alignItems: "center",
    gap: 4,
  },
  footer: {
    flexShrink: 0,
    backgroundColor: c.white,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: c.border,
    gap: 9,
  },
});
