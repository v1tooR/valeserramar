import { Alert } from "../components/Dialogs";
import { errorMessage } from "../api/client";
import { Tap as Pressable } from "../components/Motion";
import React, { useRef, useState } from "react";
import { Image, Text, View } from "react-native";
import { photoSource } from "../assets";
import {
  dateKey,
  displayDate,
  money,
  nights,
  validateReservation,
} from "../domain/logic";
import type { Reservation } from "../domain/models";
import { uid, useStore } from "../store";
import { useNav, type ScreenProps } from "../navigation";
import { colors as c, styles as s } from "../theme";
import {
  Badge,
  Button,
  Chip,
  Field,
  Icon,
  Notice,
  Page,
  Section,
  Stepper,
} from "../components/ui";
import { Calendar } from "../components/Calendar";
import { contact, directions } from "../services/external";
export function BookingScreen({ route }: ScreenProps) {
  const { state, addReservation } = useStore(),
    nav = useNav(),
    submitted = useRef(false);
  const requestKey = useRef({ fingerprint: "", id: uid() });
  const b = state.businesses.find((b) => b.id === route.params?.businessId);
  const [start, setStart] = useState(dateKey(new Date())),
    [end, setEnd] = useState(""),
    [choosingEnd, setChoosingEnd] = useState(false);
  const [adults, setAdults] = useState(2),
    [children, setChildren] = useState(0),
    [time, setTime] = useState("19:00");
  const [roomId, setRoomId] = useState(
      route.params?.roomId || b?.rooms[0]?.id || "",
    ),
    [name, setName] = useState(state.profile?.name || ""),
    [phone, setPhone] = useState(state.profile?.phone || ""),
    [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  if (!b || b.status !== "Aprovado" || !b.acceptsReservations)
    return (
      <Page title="Reservar">
        <Notice>
          Este estabelecimento não recebe reservas pelo aplicativo.
        </Notice>
      </Page>
    );
  const hotel = b.segment === "Hospedagem",
    room = b.rooms.find((r) => r.id === roomId),
    estimate = hotel ? Math.max(0, nights(start, end)) * (room?.price || 0) : 0;
  const send = async () => {
    const draft = {
      businessId: b.id,
      kind: hotel ? ("hospedagem" as const) : ("mesa" as const),
      start,
      end: hotel ? end : start,
      time: hotel ? "" : time,
      adults,
      children,
      roomId: room?.id || "",
      roomName: room?.name || "Mesa",
      name: name.trim(),
      phone,
      notes,
      estimate,
    };
    const validation = validateReservation(draft);
    if (validation) {
      setError(validation);
      return;
    }
    if (hotel && room && adults + children > room.guests) {
      setError(
        `Esta acomodação recebe até ${room.guests} hóspedes. Escolha outra opção ou ajuste a quantidade.`,
      );
      return;
    }
    if (submitted.current) return;
    submitted.current = true;
    const fingerprint = JSON.stringify(draft);
    if (requestKey.current.fingerprint !== fingerprint)
      requestKey.current = { fingerprint, id: uid() };
    const reservation: Reservation = {
      ...draft,
      id: requestKey.current.id,
      createdAt: new Date().toISOString(),
      status: "Pendente",
      reply: "",
    };
    try {
      const saved = await addReservation(reservation);
      nav.replace("BookingDetail", { reservationId: saved.id });
    } finally {
      submitted.current = false;
    }
  };
  return (
    <Page
      title={hotel ? "Solicitar reserva" : "Reservar mesa"}
      subtitle={b.name}
      footer={
        <>
          <Text style={s.label}>
            {hotel
              ? `${Math.max(0, nights(start, end))} noites · ${money(estimate)} estimado`
              : "Confirmação manual pelo restaurante"}
          </Text>
          <Button title="Solicitar reserva" icon="send" onPress={send} />
        </>
      }
    >
      <Notice tone="amber">
        A solicitação precisa ser confirmada pelo estabelecimento. Nenhum
        pagamento será cobrado agora.
      </Notice>
      <View style={s.row}>
        <Chip
          title={
            hotel
              ? `Check-in · ${displayDate(start)}`
              : `Data · ${displayDate(start)}`
          }
          selected={!choosingEnd}
          onPress={() => setChoosingEnd(false)}
        />
        {hotel && (
          <Chip
            title={`Check-out · ${end ? displayDate(end) : "Escolher"}`}
            selected={choosingEnd}
            onPress={() => setChoosingEnd(true)}
          />
        )}
      </View>
      <Calendar
        start={start}
        end={hotel ? end : ""}
        onSelect={(day) => {
          setError("");
          if (hotel && choosingEnd) {
            setEnd(day);
          } else {
            setStart(day);
            if (day >= end) setEnd("");
            setChoosingEnd(hotel);
          }
        }}
      />
      {!hotel && (
        <Field
          label="Horário (HH:MM)"
          value={time}
          onChangeText={setTime}
          placeholder="19:00"
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
      )}
      <Stepper
        label={hotel ? "Adultos" : "Pessoas"}
        value={adults}
        onChange={setAdults}
        min={1}
      />
      {hotel && (
        <>
          <Stepper label="Crianças" value={children} onChange={setChildren} />
          <Section title="Acomodação" />
          {b.rooms.map((r) => (
            <Pressable
              key={r.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: roomId === r.id }}
              onPress={() => setRoomId(r.id)}
              style={[
                s.card,
                s.row,
                { borderColor: roomId === r.id ? c.green : c.border },
              ]}
            >
              <Icon name={roomId === r.id ? "check-circle" : "circle"} />
              <View style={s.grow}>
                <Text style={s.label}>{r.name}</Text>
                <Text style={s.muted}>Até {r.guests} hóspedes</Text>
              </View>
              <Text style={s.label}>{money(r.price)}/noite</Text>
            </Pressable>
          ))}
        </>
      )}
      <Field
        label="Seu nome"
        value={name}
        onChangeText={setName}
        autoComplete="name"
      />
      <Field
        label="Telefone com DDD"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
      />
      <Field
        label="Observações (opcional)"
        multiline
        value={notes}
        onChangeText={setNotes}
        maxLength={500}
      />
      {!!error && <Notice tone="red">{error}</Notice>}
      <Text style={s.muted}>
        O estabelecimento avaliará sua solicitação. Os valores de hospedagem são
        estimados e combinados diretamente com a pousada.
      </Text>
    </Page>
  );
}
export function BookingDetailScreen({ route }: ScreenProps) {
  const { state, cancelReservation } = useStore(),
    nav = useNav();
  const r = state.reservations.find(
      (r) => r.id === route.params?.reservationId,
    ),
    b = state.businesses.find((b) => b.id === r?.businessId);
  if (!r || !b)
    return (
      <Page title="Reserva">
        <Notice>Solicitação não encontrada neste aparelho.</Notice>
      </Page>
    );
  const pending = r.status === "Pendente";
  return (
    <Page
      title="Sua solicitação"
      footer={
        <Button
          title="Ver minhas reservas"
          onPress={() => nav.navigate("Reservations")}
        />
      }
    >
      <View style={{ alignItems: "center", gap: 14, paddingVertical: 25 }}>
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pending ? c.yellow : c.mint,
          }}
        >
          <Icon
            name={pending ? "clock" : r.status === "Confirmada" ? "check" : "x"}
            size={42}
          />
        </View>
        <Text style={s.title}>
          {pending
            ? "Solicitação registrada"
            : `Reserva ${r.status.toLowerCase()}`}
        </Text>
        <Text style={[s.muted, { textAlign: "center" }]}>
          {pending
            ? "Aguardando uma resposta manual do estabelecimento."
            : "Confira abaixo os detalhes da sua reserva."}
        </Text>
      </View>
      <View style={s.card}>
        <View style={s.row}>
          <Image
            source={photoSource(b.photo)}
            style={{ width: 68, height: 68, borderRadius: 12 }}
          />
          <View style={s.grow}>
            <Text style={s.heading}>{b.name}</Text>
            <Text style={s.muted}>Solicitação {r.id.slice(-6)}</Text>
            <Badge text={r.status} />
          </View>
        </View>
        <View style={s.divider} />
        <Text style={s.body}>
          Datas · {displayDate(r.start)}
          {r.kind === "hospedagem"
            ? ` a ${displayDate(r.end)} · ${nights(r.start, r.end)} noites`
            : ` às ${r.time}`}
        </Text>
        <Text style={s.body}>
          {r.roomName} · {r.adults} adultos
          {r.children > 0 ? ` e ${r.children} crianças` : ""}
        </Text>
        {r.kind === "hospedagem" && (
          <Text style={s.label}>
            {money(r.estimate)} estimado · pago à pousada
          </Text>
        )}
        <Text style={s.muted}>{r.notes}</Text>
      </View>
      {r.reply && <Notice>{r.reply}</Notice>}
      <Notice tone="amber">
        Acompanhe sua solicitação por aqui. A confirmação depende do
        estabelecimento.
      </Notice>
      <Button
        secondary
        title="Como chegar"
        icon="navigation"
        onPress={() => directions(b)}
      />
      <Button
        secondary
        title="Falar com o estabelecimento"
        onPress={() => contact(b)}
      />
      {(pending || r.status === "Confirmada") && (
        <Button
          secondary
          title="Cancelar solicitação"
          onPress={() =>
            Alert.alert(
              "Cancelar solicitação?",
              "O estabelecimento será informado do cancelamento.",
              [
                { text: "Voltar", style: "cancel" },
                {
                  text: "Cancelar solicitação",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await cancelReservation(r.id);
                    } catch (e) {
                      Alert.alert("Não foi possível cancelar", errorMessage(e));
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
export function ReservationsScreen() {
  const { state } = useStore(),
    nav = useNav();
  const [status, setStatus] = useState("Todas");
  const reservations = state.reservations.filter(
    (r) => status === "Todas" || r.status === status,
  );
  return (
    <Page brand tab="Profile">
      <Text style={s.title}>Minhas reservas</Text>
      <View style={s.wrap}>
        {["Todas", "Pendente", "Confirmada", "Recusada", "Cancelada"].map(
          (name) => (
            <Chip
              key={name}
              title={name}
              selected={name === status}
              onPress={() => setStatus(name)}
            />
          ),
        )}
      </View>
      {reservations.length === 0 && (
        <Notice>
          Nenhuma solicitação nesta categoria. Explore os estabelecimentos para
          fazer uma reserva.
        </Notice>
      )}
      {reservations.map((r) => {
        const b = state.businesses.find((b) => b.id === r.businessId);
        return (
          <Pressable
            key={r.id}
            style={[s.card, s.row]}
            accessibilityRole="button"
            onPress={() =>
              nav.navigate("BookingDetail", { reservationId: r.id })
            }
          >
            {b && (
              <Image
                source={photoSource(b.photo)}
                style={{ width: 68, height: 68, borderRadius: 12 }}
              />
            )}
            <View style={s.grow}>
              <Text style={s.label}>{b?.name}</Text>
              <Text style={s.muted}>
                {r.roomName} · {displayDate(r.start)}
              </Text>
              <Badge text={r.status} />
            </View>
            <Icon name="chevron-right" />
          </Pressable>
        );
      })}
      <Section title="Mensagens preparadas" />
      {state.orders.length === 0 && (
        <Text style={s.muted}>Nenhuma mensagem de pedido preparada ainda.</Text>
      )}
      {state.orders.map((o) => (
        <Pressable
          key={o.id}
          style={s.card}
          onPress={() =>
            nav.navigate("OrderSent", {
              businessId: o.businessId,
              message: o.text,
            })
          }
        >
          <Text style={s.label}>
            {state.businesses.find((b) => b.id === o.businessId)?.name} ·{" "}
            {money(o.total)}
          </Text>
          <Text style={s.muted}>WhatsApp aberto · envio não verificado</Text>
        </Pressable>
      ))}
    </Page>
  );
}
