import { Alert } from "../components/Dialogs";
import { Tap as Pressable } from "../components/Motion";
import React, { useState } from "react";
import { Image, Share, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { photoSource } from "../assets";
import { useStore, uid } from "../store";
import { useNav, type ScreenProps } from "../navigation";
import { cartTotal, money, orderMessage, validateCart } from "../domain/logic";
import { contact } from "../services/external";
import { colors as c, styles as s } from "../theme";
import {
  Button,
  Chip,
  Field,
  Icon,
  IconButton,
  Notice,
  Page,
  Section,
  Stepper,
} from "../components/ui";
export function MenuScreen({ route }: ScreenProps) {
  const { state } = useStore(),
    nav = useNav();
  const id = route.params?.businessId || state.cart[0]?.businessId;
  const b = state.businesses.find((b) => b.id === id);
  const [category, setCategory] = useState("Todas");
  const [query, setQuery] = useState("");
  const products = state.products.filter((p) => p.businessId === id),
    categories = ["Todas", ...new Set(products.map((p) => p.category))];
  return (
    <Page
      title="Cardápio"
      subtitle={b?.name}
      footer={
        state.cart.length > 0 ? (
          <Button
            title={`Ver pedido · ${money(cartTotal(state.cart))}`}
            icon="shopping-bag"
            onPress={() => nav.navigate("Cart")}
          />
        ) : undefined
      }
    >
      <Notice>
        Monte seu pedido aqui e prepare a mensagem para o WhatsApp do
        restaurante.
      </Notice>
      <Field
        label="Buscar no cardápio"
        value={query}
        onChangeText={setQuery}
        placeholder="Nome do prato"
      />
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
            (category === "Todas" || p.category === category) &&
            p.name.toLowerCase().includes(query.toLowerCase()),
        )
        .map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            disabled={!p.available}
            onPress={() => nav.navigate("Product", { productId: p.id })}
            style={[
              s.between,
              {
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderColor: c.border,
                opacity: p.available ? 1 : 0.5,
              },
            ]}
          >
            <View style={s.grow}>
              <Text style={s.heading}>{p.name}</Text>
              <Text style={s.muted}>{p.description}</Text>
              <Text style={[s.body, { fontWeight: "700", marginTop: 8 }]}>
                {money(p.price)}
              </Text>
              {!p.available && (
                <Text style={{ color: c.red }}>Indisponível no momento</Text>
              )}
            </View>
            <View>
              <Image source={photoSource(p.photo)} style={s.thumb} />
              <View
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: -5,
                  borderRadius: 20,
                  backgroundColor: c.white,
                  padding: 6,
                }}
              >
                <Icon name="plus" size={18} />
              </View>
            </View>
          </Pressable>
        ))}
      {products.length === 0 && (
        <Notice>O estabelecimento ainda está preparando o cardápio.</Notice>
      )}
    </Page>
  );
}
export function ProductScreen({ route }: ScreenProps) {
  const { state, update } = useStore(),
    nav = useNav();
  const p = state.products.find((p) => p.id === route.params?.productId);
  const [quantity, setQuantity] = useState(1),
    [extras, setExtras] = useState<string[]>([]),
    [notes, setNotes] = useState("");
  if (!p)
    return (
      <Page title="Produto">
        <Notice>Produto não encontrado.</Notice>
      </Page>
    );
  const selected = p.extras.filter((e) => extras.includes(e.id)),
    total = (p.price + selected.reduce((a, b) => a + b.price, 0)) * quantity;
  const add = () => {
    const commit = (replace: boolean) => {
      update((s) => ({
        ...s,
        cart: [
          ...(replace ? [] : s.cart),
          {
            id: uid(),
            productId: p.id,
            businessId: p.businessId,
            name: p.name,
            unitPrice: p.price,
            quantity,
            extras: selected,
            notes,
          },
        ],
      }));
      nav.navigate("Menu", { businessId: p.businessId });
    };
    if (state.cart.length && state.cart[0].businessId !== p.businessId)
      Alert.alert(
        "Começar outro pedido?",
        "O pedido atual será substituído pelos itens deste estabelecimento.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Substituir", onPress: () => commit(true) },
        ],
      );
    else commit(false);
  };
  return (
    <Page
      title="Seu prato"
      footer={
        <Button
          title={`Adicionar · ${money(total)}`}
          disabled={!p.available}
          onPress={add}
        />
      }
    >
      <Image
        source={photoSource(p.photo)}
        style={{ width: "100%", height: 190, borderRadius: 16 }}
      />
      <View style={s.between}>
        <Text style={[s.heading, s.grow]}>{p.name}</Text>
        <Text style={s.label}>{money(p.price)}</Text>
      </View>
      <Text style={s.muted}>{p.description}</Text>
      <Section title="Adicionais" />
      <Text style={s.muted}>Opcional · escolha até 3</Text>
      {p.extras.map((e) => (
        <Pressable
          key={e.id}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: extras.includes(e.id) }}
          onPress={() =>
            setExtras((xs) =>
              xs.includes(e.id)
                ? xs.filter((x) => x !== e.id)
                : xs.length < 3
                  ? [...xs, e.id]
                  : xs,
            )
          }
          style={[s.between, { paddingVertical: 10 }]}
        >
          <View style={s.row}>
            <Icon name={extras.includes(e.id) ? "check-square" : "square"} />
            <Text style={s.body}>{e.name}</Text>
          </View>
          <Text style={s.body}>+ {money(e.price)}</Text>
        </Pressable>
      ))}
      <Field
        label="Observações"
        placeholder="Ex.: sem coentro, por favor"
        value={notes}
        onChangeText={setNotes}
        multiline
        maxLength={300}
      />
      <Stepper
        label="Quantidade"
        value={quantity}
        onChange={setQuantity}
        min={1}
        max={20}
      />
    </Page>
  );
}
export function CartScreen() {
  const { state, update } = useStore(),
    nav = useNav();
  const [delivery, setDelivery] = useState(false),
    [address, setAddress] = useState(""),
    [notes, setNotes] = useState(""),
    [name, setName] = useState(state.profile?.name || "");
  const b = state.businesses.find((b) => b.id === state.cart[0]?.businessId);
  const review = () => {
    const cartError = validateCart(state.cart, state.products);
    if (cartError) {
      Alert.alert("Revise seu pedido", cartError);
      return;
    }
    if (!name.trim() || (delivery && !address.trim())) {
      Alert.alert(
        "Complete os dados",
        "Informe seu nome e o endereço para entrega.",
      );
      return;
    }
    if (!b) return;
    nav.navigate("OrderReview", {
      businessId: b.id,
      message: orderMessage(
        b,
        state.cart,
        name.trim(),
        delivery,
        address,
        notes,
      ),
    });
  };
  return (
    <Page
      title="Seu pedido"
      subtitle={b?.name}
      footer={
        state.cart.length ? (
          <Button
            title="Revisar mensagem"
            icon="message-circle"
            onPress={review}
          />
        ) : undefined
      }
    >
      {state.cart.map((item) => (
        <View key={item.id} style={s.card}>
          <View style={s.between}>
            <Text style={[s.body, { fontWeight: "700", flex: 1 }]}>
              {item.name}
            </Text>
            <Text style={s.label}>{money(cartTotal([item]))}</Text>
            <IconButton
              icon="trash-2"
              label={`Remover ${item.name}`}
              onPress={() =>
                update((s) => ({
                  ...s,
                  cart: s.cart.filter((x) => x.id !== item.id),
                }))
              }
            />
          </View>
          <Text style={s.muted}>
            {item.extras.map((e) => e.name).join(", ")} {item.notes}
          </Text>
          <Stepper
            label="Quantidade"
            min={1}
            value={item.quantity}
            onChange={(quantity) =>
              update((s) => ({
                ...s,
                cart: s.cart.map((x) =>
                  x.id === item.id ? { ...x, quantity } : x,
                ),
              }))
            }
          />
        </View>
      ))}
      {!state.cart.length ? (
        <>
          <Notice>Seu pedido está vazio.</Notice>
          <Button
            title="Explorar restaurantes"
            onPress={() =>
              nav.navigate("Results", { category: "Restaurantes" })
            }
          />
        </>
      ) : (
        <>
          <Button
            secondary
            title="Adicionar mais itens"
            onPress={() => nav.navigate("Menu", { businessId: b?.id })}
          />
          <Section title="Como você quer receber?" />
          <View style={s.row}>
            <Chip
              title="Retirar no local"
              selected={!delivery}
              onPress={() => setDelivery(false)}
            />
            <Chip
              title="Entrega"
              selected={delivery}
              onPress={() => setDelivery(true)}
            />
          </View>
          <Field label="Seu nome" value={name} onChangeText={setName} />
          {delivery && (
            <Field
              label="Endereço completo"
              value={address}
              onChangeText={setAddress}
              multiline
            />
          )}
          <Field
            label="Observações do pedido"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <View style={s.between}>
            <Text style={s.heading}>Total dos itens</Text>
            <Text style={s.heading}>{money(cartTotal(state.cart))}</Text>
          </View>
          <Notice>
            Entrega, pagamento e confirmação serão combinados diretamente com o
            estabelecimento.
          </Notice>
        </>
      )}
    </Page>
  );
}
export function OrderReviewScreen({ route }: ScreenProps) {
  const { state, update } = useStore(),
    nav = useNav();
  const b = state.businesses.find((b) => b.id === route.params?.businessId),
    message = route.params?.message || "";
  const [busy, setBusy] = useState(false);
  const record = () => {
    update((s) => ({
      ...s,
      orders: [
        ...s.orders,
        {
          id: uid(),
          businessId: b!.id,
          text: message,
          total: cartTotal(s.cart),
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    nav.replace("OrderSent", { businessId: b!.id, message });
  };
  return (
    <Page
      title="Enviar pelo WhatsApp"
      subtitle="Revise antes de enviar"
      footer={
        <Button
          title="Abrir WhatsApp"
          loading={busy}
          icon="message-circle"
          onPress={async () => {
            if (!b || busy) return;
            setBusy(true);
            const opened = await contact(b, message);
            setBusy(false);
            if (opened) record();
          }}
        />
      }
    >
      <Notice tone="blue">
        O WhatsApp será aberto com a mensagem preparada. Confirme o envio dentro
        do WhatsApp.
      </Notice>
      <View style={[s.card, { backgroundColor: "#E5F6D6" }]}>
        <Text selectable style={s.body}>
          {message}
        </Text>
      </View>
      <Button
        secondary
        title="Copiar mensagem"
        onPress={async () => {
          await Clipboard.setStringAsync(message);
          Alert.alert("Copiado", "A mensagem está pronta para colar.");
        }}
      />
      <Button
        secondary
        title="Compartilhar mensagem"
        onPress={() => {
          Share.share({ message }).catch(() =>
            Alert.alert("Não foi possível compartilhar"),
          );
        }}
      />
      {b && !b.phone && (
        <Notice tone="amber">
          Este restaurante é ilustrativo e não tem número cadastrado. Você pode
          copiar a mensagem ou cadastrar seu próprio negócio para testar.
        </Notice>
      )}
    </Page>
  );
}
export function OrderSentScreen({ route }: ScreenProps) {
  const nav = useNav();
  const { state } = useStore();
  const b = state.businesses.find((b) => b.id === route.params?.businessId);
  return (
    <Page
      title="Mensagem preparada"
      footer={
        <Button
          title="Continuar explorando"
          onPress={() => nav.navigate("Home")}
        />
      }
    >
      <View style={{ alignItems: "center", gap: 18, paddingVertical: 40 }}>
        <Icon name="message-circle" size={64} />
        <Text style={s.title}>Conclua no WhatsApp</Text>
        <Text style={[s.muted, { textAlign: "center" }]}>
          O app abriu a conversa. O envio e a confirmação do pedido acontecem no
          WhatsApp.
        </Text>
      </View>
      <Notice>
        O aplicativo não consegue verificar se a mensagem foi enviada ou
        recebida.
      </Notice>
      <Button
        secondary
        title="Voltar ao WhatsApp"
        onPress={() => b && contact(b, route.params?.message)}
      />
    </Page>
  );
}
