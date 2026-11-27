import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ApiError, errorMessage } from "../api/client";
import { Alert } from "../components/Dialogs";
import { Button, Field, Icon, Notice, Page, Row } from "../components/ui";
import { validPhone } from "../domain/logic";
import type { Profile } from "../domain/models";
import { useNav } from "../navigation";
import { useStore } from "../store";
import { colors as c, styles as s } from "../theme";

export function SettingsScreen() {
  const { state } = useStore();
  const nav = useNav();
  return (
    <Page title="Configurações" keyboardAware>
      {state.profile ? (
        <AccountDetails profile={state.profile} />
      ) : (
        <View style={[s.card, styles.details]}>
          <Text accessibilityRole="header" style={s.heading}>
            Sua conta
          </Text>
          <Text style={s.body}>
            Entre para editar seus dados e gerenciar a conta.
          </Text>
          <Button
            title="Entrar"
            icon="log-in"
            onPress={() => nav.navigate("Auth", { authFromSettings: true })}
          />
        </View>
      )}
    </Page>
  );
}

function AccountDetails({ profile }: { profile: Profile }) {
  const nav = useNav();
  const { updateProfile } = useStore();
  const [draft, setDraft] = useState(profile);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const next = {
    name: draft.name.trim(),
    email: draft.email.trim().toLowerCase(),
    phone: draft.phone.trim(),
  };
  const changed =
    next.name !== profile.name ||
    next.email !== profile.email ||
    next.phone !== profile.phone;

  function edit(field: keyof Profile, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setMessage("");
    setError("");
  }

  async function save() {
    if (!next.name) return setError("Informe seu nome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email))
      return setError("Informe um e-mail válido.");
    if (next.phone !== profile.phone && next.phone && !validPhone(next.phone))
      return setError("Informe um telefone com DDD.");
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await updateProfile(next);
      setDraft(next);
      setMessage("Alterações salvas.");
    } catch (error) {
      setError(
        error instanceof ApiError && error.status === 409
          ? "Este e-mail já está em uso."
          : errorMessage(error),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <View style={[s.card, styles.details]}>
        <View style={s.row}>
          <View style={styles.iconBox}>
            <Icon name="user" size={21} />
          </View>
          <Text accessibilityRole="header" style={s.heading}>
            Dados da conta
          </Text>
        </View>
        <Field
          label="Nome completo"
          value={draft.name}
          onChangeText={(name) => edit("name", name)}
          autoComplete="name"
          maxLength={160}
          editable={!saving}
        />
        <Field
          label="E-mail"
          value={draft.email}
          onChangeText={(email) => edit("email", email)}
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={254}
          editable={!saving}
        />
        <Field
          label="Telefone com DDD"
          value={draft.phone}
          onChangeText={(phone) => edit("phone", phone)}
          keyboardType="phone-pad"
          autoComplete="tel"
          maxLength={40}
          editable={!saving}
        />
        {error ? (
          <Text accessibilityLiveRegion="polite" style={styles.error}>
            {error}
          </Text>
        ) : null}
        {message ? (
          <Text accessibilityLiveRegion="polite" style={styles.success}>
            {message}
          </Text>
        ) : null}
        <Button
          title="Salvar alterações"
          icon="check"
          onPress={save}
          disabled={!changed}
          loading={saving}
        />
      </View>
      <Row
        title="Excluir conta"
        subtitle="Remover a conta e seus dados"
        icon="trash-2"
        onPress={() => nav.navigate("DeleteAccount")}
      />
    </>
  );
}

export function DeleteAccountScreen() {
  const nav = useNav();
  const { state, deleteAccount } = useStore();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function confirm() {
    setDeleting(true);
    setError("");
    try {
      await deleteAccount(password);
      if (nav.isFocused()) {
        nav.reset({ index: 0, routes: [{ name: "Profile" }] });
        Alert.alert(
          "Conta excluída",
          "Você pode continuar usando o guia como visitante.",
        );
      }
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setPassword("");
      setVisible(false);
      setDeleting(false);
    }
  }

  if (!state.profile)
    return (
      <Page title="Excluir conta">
        <Notice>Entre na sua conta para confirmar a exclusão.</Notice>
      </Page>
    );

  return (
    <Page title="Excluir conta" keyboardAware>
      <View style={[s.card, styles.details, styles.warning]}>
        <View style={s.row}>
          <Icon name="alert-circle" size={23} color={c.red} />
          <Text accessibilityRole="header" style={[s.heading, s.grow]}>
            Exclusão definitiva
          </Text>
        </View>
        <Text style={s.body}>
          A conta e os anúncios vinculados serão removidos. As reservas de
          visitantes continuam no histórico.
        </Text>
      </View>
      <Field
        label="Confirme sua senha"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setError("");
        }}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        maxLength={128}
        editable={!deleting}
        action={{
          icon: visible ? "eye-off" : "eye",
          label: visible ? "Ocultar senha" : "Mostrar senha",
          onPress: () => setVisible(!visible),
        }}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Button
        title="Excluir definitivamente"
        icon="trash-2"
        danger
        onPress={confirm}
        disabled={password.length < 8}
        loading={deleting}
      />
      <Button
        title="Cancelar"
        secondary
        disabled={deleting}
        onPress={() => nav.goBack()}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  details: { gap: 16 },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: c.mint,
    alignItems: "center",
    justifyContent: "center",
  },
  warning: { backgroundColor: "#FFF3F0", borderColor: "#F0D2CD" },
  error: { ...s.body, color: c.red },
  success: { ...s.body, color: c.green },
});
