import { Alert } from "../components/Dialogs";
import { errorMessage } from "../api/client";
import React, { useState } from "react";
import { Image, Text, View } from "react-native";
import { photoSource, assets } from "../assets";
import { uid, useStore } from "../store";
import { useNav, type ScreenProps } from "../navigation";
import { money, isRestaurant, validTime } from "../domain/logic";
import type { Product, Room } from "../domain/models";
import { colors as c, styles as s } from "../theme";
import {
  Badge,
  Button,
  Chip,
  Field,
  IconButton,
  Notice,
  Page,
  Row,
  Section,
  Stepper,
  Toggle,
} from "../components/ui";
import {
  BusinessFields,
  LocationFields,
  HoursFields,
  PhotosFields,
  businessErrors,
} from "./OnboardingBusiness";
import { pickPhoto } from "../services/photos";
export function EditBusinessScreen({ route }: ScreenProps) {
  const { state, saveBusiness } = useStore(),
    nav = useNav();
  const original = state.businesses.find(
    (b) => b.id === (route.params?.businessId || state.businessId),
  );
  const [draft, setDraft] = useState(original),
    [tab, setTab] = useState(route.params?.step || 0),
    [error, setError] = useState("");
  if (!draft)
    return (
      <Page title="Editar">
        <Notice>Cadastre seu negócio primeiro.</Notice>
      </Page>
    );
  const save = async () => {
    const error = [0, 1, 2, 4]
      .map((n) => businessErrors(draft, n))
      .find(Boolean);
    if (error) return setError(error);
    await saveBusiness(draft);
    Alert.alert("Alterações salvas", "Seu cadastro foi atualizado.");
    nav.goBack();
  };
  const patch = (values: Partial<typeof draft>) =>
    setDraft({ ...draft, ...values });
  return (
    <Page
      title="Editar estabelecimento"
      subtitle={draft.name}
      footer={<Button title="Salvar alterações" onPress={save} />}
    >
      <View style={s.wrap}>
        {["Informações", "Local", "Horários", "Fotos"].map((name, i) => (
          <Chip
            key={name}
            title={name}
            selected={tab === i}
            onPress={() => setTab(i)}
          />
        ))}
      </View>
      {tab === 0 && <BusinessFields business={draft} onChange={patch} />}
      {tab === 1 && <LocationFields business={draft} onChange={patch} />}
      {tab === 2 && <HoursFields business={draft} onChange={patch} />}
      {tab === 3 && <PhotosFields business={draft} onChange={patch} />}
      {error && <Notice tone="red">{error}</Notice>}
      <Notice tone="blue">
        Mudanças no nome, categoria e fotos passam por nova análise antes da
        publicação.
      </Notice>
    </Page>
  );
}
export function ManageMenuScreen({ route }: ScreenProps) {
  const { state, saveProduct } = useStore(),
    nav = useNav();
  const businessId = route.params?.businessId || state.businessId;
  const business = state.businesses.find((b) => b.id === businessId);
  const restaurant = !business || isRestaurant(business.segment);
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("Todas");
  const products = state.products.filter((p) => p.businessId === businessId);
  const categories = ["Todas", ...new Set(products.map((p) => p.category))];
  return (
    <Page
      title={restaurant ? "Cardápio" : "Produtos e serviços"}
      subtitle={`${products.length} produtos`}
      footer={
        <Button
          title="Adicionar produto"
          icon="plus"
          onPress={() => nav.navigate("EditProduct", { businessId })}
        />
      }
    >
      <Field label="Buscar produto" value={query} onChangeText={setQuery} />
      <View style={s.wrap}>
        {categories.map((name) => (
          <Chip
            key={name}
            title={name}
            selected={category === name}
            onPress={() => setCategory(name)}
          />
        ))}
      </View>
      {products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(query.toLowerCase()) &&
            (category === "Todas" || p.category === category),
        )
        .map((p) => (
          <View key={p.id} style={s.card}>
            <View style={s.row}>
              <Image
                source={photoSource(p.photo)}
                style={{ width: 68, height: 68, borderRadius: 12 }}
              />
              <View style={s.grow}>
                <Text style={s.heading}>{p.name}</Text>
                <Text style={s.label}>
                  {money(p.price)} · {p.category}
                </Text>
              </View>
              <IconButton
                icon="edit-2"
                label={`Editar ${p.name}`}
                onPress={() =>
                  nav.navigate("EditProduct", { businessId, productId: p.id })
                }
              />
            </View>
            <Toggle
              title={restaurant ? "Disponível no cardápio" : "Disponível para ofertas"}
              value={p.available}
              onChange={(available) => saveProduct({ ...p, available })}
            />
          </View>
        ))}
      {products.length === 0 && (
        <Notice>
          Adicione seu primeiro produto. A categoria é definida ao cadastrar
          cada item.
        </Notice>
      )}
    </Page>
  );
}
export function EditProductScreen({ route }: ScreenProps) {
  const { state, saveProduct, deleteProduct } = useStore(),
    nav = useNav();
  const businessId = route.params?.businessId || state.businessId;
  const business = state.businesses.find((b) => b.id === businessId);
  const restaurant = !business || isRestaurant(business.segment);
  const original = state.products.find((p) => p.id === route.params?.productId);
  const [draft, setDraft] = useState<Product>(
    original || {
      id: `draft-${uid()}`,
      businessId,
      name: "",
      description: "",
      category: restaurant ? "Pratos da casa" : "Geral",
      price: 0,
      photo: "",
      available: true,
      extras: [],
    },
  );
  const [price, setPrice] = useState(
      original ? original.price.toFixed(2).replace(".", ",") : "",
    ),
    [error, setError] = useState("");
  const [extraName, setExtraName] = useState(""),
    [extraPrice, setExtraPrice] = useState("");
  const number = (v: string) => Number(v.replace(",", "."));
  const save = async () => {
    const value = number(price);
    if (
      !draft.name.trim() ||
      !draft.category.trim() ||
      !Number.isFinite(value) ||
      value <= 0
    )
      return setError("Preencha nome, categoria e preço maior que zero.");
    await saveProduct({
      ...draft,
      name: draft.name.trim(),
      price: Math.round(value * 100) / 100,
    });
    nav.goBack();
  };
  return (
    <Page
      title={original ? "Editar produto" : "Novo produto"}
      right={
        original ? (
          <IconButton
            icon="trash-2"
            label="Excluir produto"
            onPress={() =>
              Alert.alert(
                "Excluir produto?",
                restaurant ? "O produto será removido do cardápio." : "O produto será removido do anúncio.",
                [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Excluir",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        await deleteProduct(draft);
                        nav.goBack();
                      } catch (e) {
                        Alert.alert(
                          "Não foi possível excluir",
                          errorMessage(e),
                        );
                      }
                    },
                  },
                ],
              )
            }
          />
        ) : undefined
      }
      footer={<Button title="Salvar produto" onPress={save} />}
    >
      <Image
        source={photoSource(draft.photo)}
        style={{ width: "100%", height: 170, borderRadius: 16 }}
      />
      <Button
        secondary
        title="Trocar foto"
        onPress={async () => {
          const photo = await pickPhoto();
          if (photo) setDraft((d) => ({ ...d, photo }));
        }}
      />
      <Field
        label="Nome"
        value={draft.name}
        onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
      />
      <Field
        label="Categoria"
        value={draft.category}
        onChangeText={(category) => setDraft((d) => ({ ...d, category }))}
      />
      <Field
        label="Preço (R$)"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
      />
      <Field
        label="Descrição"
        value={draft.description}
        onChangeText={(description) => setDraft((d) => ({ ...d, description }))}
        multiline
      />
      <Toggle
        title={restaurant ? "Disponível no cardápio" : "Disponível para ofertas"}
        value={draft.available}
        onChange={(available) => setDraft((d) => ({ ...d, available }))}
      />
      <Section title="Adicionais" />
      {draft.extras.map((e) => (
        <View key={e.id} style={s.between}>
          <Text style={[s.body, s.grow]}>
            {e.name} · {money(e.price)}
          </Text>
          <IconButton
            icon="trash-2"
            label={`Excluir ${e.name}`}
            onPress={() =>
              setDraft((d) => ({
                ...d,
                extras: d.extras.filter((x) => x.id !== e.id),
              }))
            }
          />
        </View>
      ))}
      <Field
        label="Nome do adicional"
        value={extraName}
        onChangeText={setExtraName}
      />
      <Field
        label="Preço do adicional (R$)"
        value={extraPrice}
        onChangeText={setExtraPrice}
        keyboardType="decimal-pad"
      />
      <Button
        secondary
        title="Adicionar opção"
        onPress={() => {
          const value = number(extraPrice);
          if (
            !extraName.trim() ||
            !extraPrice.trim() ||
            !Number.isFinite(value) ||
            value < 0
          )
            return setError("Informe nome e preço válido para o adicional.");
          setDraft((d) => ({
            ...d,
            extras: [
              ...d.extras,
              {
                id: `draft-${uid()}`,
                name: extraName.trim(),
                price: Math.round(value * 100) / 100,
              },
            ],
          }));
          setExtraName("");
          setExtraPrice("");
          setError("");
        }}
      />
      {error && <Notice tone="red">{error}</Notice>}
    </Page>
  );
}
export function ManageRoomsScreen({ route }: ScreenProps) {
  const { state, saveBusiness } = useStore(),
    nav = useNav();
  const b = state.businesses.find(
    (b) => b.id === (route.params?.businessId || state.businessId),
  );
  const [checkIn, setCheckIn] = useState(b?.checkIn || "14:00"),
    [checkOut, setCheckOut] = useState(b?.checkOut || "12:00");
  if (!b)
    return (
      <Page title="Acomodações">
        <Notice>Negócio não encontrado.</Notice>
      </Page>
    );
  return (
    <Page
      title="Acomodações"
      footer={
        <Button
          title="Adicionar acomodação"
          icon="plus"
          onPress={() => nav.navigate("EditRoom", { businessId: b.id })}
        />
      }
    >
      {b.rooms.map((room) => (
        <Row
          key={room.id}
          title={room.name}
          subtitle={`${money(room.price)}/noite · até ${room.guests} hóspedes`}
          icon="home"
          onPress={() =>
            nav.navigate("EditRoom", { businessId: b.id, roomId: room.id })
          }
        />
      ))}
      {!b.rooms.length && <Notice>Cadastre sua primeira acomodação.</Notice>}
      <Section title="Horários da estadia" />
      <Field
        label="Check-in"
        value={checkIn}
        onChangeText={setCheckIn}
        maxLength={5}
      />
      <Field
        label="Check-out"
        value={checkOut}
        onChangeText={setCheckOut}
        maxLength={5}
      />
      {(!validTime(checkIn) || !validTime(checkOut)) && (
        <Notice tone="red">Use o formato HH:MM.</Notice>
      )}
      <Button
        title="Salvar horários"
        disabled={!validTime(checkIn) || !validTime(checkOut)}
        onPress={() => saveBusiness({ ...b, checkIn, checkOut })}
      />
      <Notice>
        As solicitações de hospedagem são confirmadas manualmente. Consulte a
        agenda de solicitações para responder aos hóspedes.
      </Notice>
      <Button
        secondary
        title="Ver solicitações de reserva"
        onPress={() => nav.navigate("ManageReservations")}
      />
    </Page>
  );
}
export function EditRoomScreen({ route }: ScreenProps) {
  const { state, saveBusiness } = useStore(),
    nav = useNav();
  const b = state.businesses.find(
    (b) => b.id === (route.params?.businessId || state.businessId),
  );
  const original = b?.rooms.find((r) => r.id === route.params?.roomId);
  const [draft, setDraft] = useState<Room>(
    original || {
      id: `draft-${uid()}`,
      name: "",
      description: "",
      price: 0,
      guests: 2,
      photo: "",
    },
  );
  const [price, setPrice] = useState(original ? String(original.price) : ""),
    [error, setError] = useState("");
  if (!b)
    return (
      <Page title="Acomodação">
        <Notice>Negócio não encontrado.</Notice>
      </Page>
    );
  return (
    <Page
      title={original ? "Editar acomodação" : "Nova acomodação"}
      footer={
        <Button
          title="Salvar acomodação"
          onPress={async () => {
            const value = Number(price.replace(",", "."));
            if (!draft.name.trim() || !Number.isFinite(value) || value <= 0)
              return setError("Preencha nome e diária maior que zero.");
            const room = { ...draft, price: Math.round(value * 100) / 100 };
            await saveBusiness({
              ...b,
              rooms: original
                ? b.rooms.map((r) => (r.id === room.id ? room : r))
                : [...b.rooms, room],
            });
            nav.goBack();
          }}
        />
      }
    >
      <Image
        source={photoSource(draft.photo)}
        style={{ width: "100%", height: 180, borderRadius: 16 }}
      />
      <Button
        secondary
        title="Trocar foto"
        onPress={async () => {
          const photo = await pickPhoto();
          if (photo) setDraft((d) => ({ ...d, photo }));
        }}
      />
      <Field
        label="Nome da acomodação"
        value={draft.name}
        onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
      />
      <Field
        label="Descrição e comodidades"
        value={draft.description}
        onChangeText={(description) => setDraft((d) => ({ ...d, description }))}
        multiline
      />
      <Field
        label="Diária estimada (R$)"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
      />
      <Stepper
        label="Máximo de hóspedes"
        min={1}
        max={12}
        value={draft.guests}
        onChange={(guests) => setDraft((d) => ({ ...d, guests }))}
      />
      {error && <Notice tone="red">{error}</Notice>}
      {original && (
        <Button
          secondary
          title="Excluir acomodação"
          onPress={() =>
            Alert.alert(
              "Excluir acomodação?",
              "Solicitações anteriores serão mantidas.",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Excluir",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await saveBusiness({
                        ...b,
                        rooms: b.rooms.filter((r) => r.id !== draft.id),
                      });
                      nav.goBack();
                    } catch (e) {
                      Alert.alert("Não foi possível excluir", errorMessage(e));
                    }
                  },
                },
              ],
            )
          }
        />
      )}
    </Page>
  );
}
