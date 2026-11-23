        import { Alert } from "../components/Dialogs";
import { asaasSandboxEnabled } from "../api/client";
import { repository } from "../api/repository";
import { useRemote, RemoteStatus } from "../components/RemoteStatus";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { uid, useStore } from "../store";
import { useNav, type ScreenProps } from "../navigation";
import { money, isRestaurant, displayDate, dateKey } from "../domain/logic";
import { businessType } from "../domain/categories";
import type { ReviewStatus } from "../domain/models";
import { colors as c, styles as s } from "../theme";
import {
  Badge,
  Button,
  Chip,
  Field,
  Icon,
  Notice,
  Page,
  Row,
  Section,
  Toggle,
} from "../components/ui";
import { Calendar } from "../components/Calendar";
import { SandboxSubscription } from "./SandboxSubscription";
export function ReviewStatusScreen({ route }: ScreenProps) {
  const { state } = useStore(),
    nav = useNav();
  const b = state.businesses.find(
    (b) => b.id === (route.params?.businessId || state.businessId),
  );
  if (!b)
    return (
      <Page title="Status">
        <Button
          title="Cadastrar negócio"
          onPress={() => nav.navigate("BusinessWelcome")}
        />
      </Page>
    );
  return (
    <Page
      title="Status do cadastro"
      subtitle={b.name}
      tab="Dashboard"
      advertiser
    >
      <View style={{ alignItems: "center", gap: 16, paddingVertical: 30 }}>
        <View
          style={{ padding: 26, borderRadius: 50, backgroundColor: c.yellow }}
        >
          <Icon name="file-text" size={36} />
        </View>
        <Text style={[s.title, { textAlign: "center" }]}>
          {b.status === "Em análise" ? "Cadastro em análise" : b.status}
        </Text>
        <Badge text={b.status} />
      </View>
      <Notice tone={b.status === "Correções solicitadas" ? "amber" : "blue"}>
        {b.correction || "Seu cadastro está sendo acompanhado pela plataforma."}
      </Notice>
      <Section title="Etapas do cadastro" />
      {[
        "Dados do estabelecimento",
        "Localização e contatos",
        "Funcionamento",
        "Fotos",
        isRestaurant(b.segment) ? "Cardápio" : "Produtos e serviços",
      ].map((title, step) => (
        <Row
          key={title}
          title={title}
          icon="check-circle"
          onPress={() =>
            nav.navigate("BusinessWizard", { businessId: b.id, step })
          }
        />
      ))}
      <Button
        secondary
        title="Ver prévia do anúncio"
        icon="eye"
        onPress={() =>
          nav.navigate("Business", { businessId: b.id, preview: true })
        }
      />
      {b.status === "Correções solicitadas" && (
        <Button
          title="Corrigir e reenviar"
          onPress={() => nav.navigate("BusinessWizard", { businessId: b.id })}
        />
      )}
    </Page>
  );
}
export function DashboardScreen() {
  const { state, setTableReservations } = useStore(),
    nav = useNav();
  const b = state.businesses.find((b) => b.id === state.businessId);
  if (!b)
    return (
      <Page brand tab="Dashboard" advertiser>
        <Text style={s.title}>Meu negócio</Text>
        <Notice>Comece cadastrando seu estabelecimento.</Notice>
        <Button
          title="Cadastrar meu negócio"
          onPress={() => nav.navigate("BusinessWelcome")}
        />
      </Page>
    );
  if (b.status !== "Aprovado")
    return (
      <ReviewStatusScreen
        route={{
          key: "status",
          name: "ReviewStatus",
          params: { businessId: b.id },
        }}
        navigation={nav}
      />
    );
  const requests = state.reservations.filter((r) => r.businessId === b.id),
    pending = requests.filter((r) => r.status === "Pendente").length;
  return (
    <Page brand tab="Dashboard" advertiser>
      <View>
        <Text style={s.eyebrow}>Painel do anunciante · {businessType(b).label}</Text>
        <Text style={s.title}>{b.name}</Text>
      </View>
      <View style={s.row}>
        <Badge text="Publicado" />
        <Button
          secondary
          title="Ver como visitante"
          onPress={() => nav.navigate("Business", { businessId: b.id })}
        />
      </View>
      {pending > 0 && (
        <Notice tone="amber">
          {pending} solicitações aguardando resposta.
        </Notice>
      )}
      <Section title="Neste aparelho" />
      <View style={s.row}>
        <View style={[s.card, s.grow]}>
          <Icon name="calendar" />
          <Text style={s.title}>{requests.length}</Text>
          <Text style={s.muted}>Solicitações</Text>
        </View>
        <View style={[s.card, s.grow]}>
          <Icon name="check-circle" />
          <Text style={s.title}>
            {requests.filter((r) => r.status === "Confirmada").length}
          </Text>
          <Text style={s.muted}>Confirmadas</Text>
        </View>
      </View>
      <Section title="Gerenciar" />
      {isRestaurant(b.segment) && (
        <View style={s.card}>
          <Toggle
            title="Aceitar reservas de mesa"
            subtitle={
              b.acceptsReservations
                ? "Visitantes podem solicitar uma mesa pelo app."
                : "Reservas de mesa estão desativadas para visitantes."
            }
            value={b.acceptsReservations}
            onChange={(value) => setTableReservations(b.id, value)}
          />
        </View>
      )}
      {isRestaurant(b.segment) && (
        <Row
          title="Cardápio"
          subtitle="Categorias, itens e preços"
          icon="book-open"
          onPress={() => nav.navigate("ManageMenu")}
        />
      )}
      {b.segment === "Hospedagem" && (
        <Row
          title="Acomodações"
          subtitle={`${b.rooms.length} opções de hospedagem`}
          icon="home"
          onPress={() => nav.navigate("ManageRooms")}
        />
      )}
      {(b.acceptsReservations || requests.length > 0) && (
        <Row
          title="Solicitações de reservas"
          subtitle={`${pending} pendentes`}
          icon="calendar"
          onPress={() => nav.navigate("ManageReservations")}
        />
      )}
      <Row
        title="Editar estabelecimento"
        subtitle="Informações, contatos e horários"
        icon="edit-2"
        onPress={() => nav.navigate("EditBusiness")}
      />
      <Row
        title="Fotos"
        subtitle="Capa, logotipo e galeria"
        icon="image"
        onPress={() => nav.navigate("EditBusiness", { step: 3 })}
      />
      <Row
        title="Assinatura"
        subtitle="Situação da participação"
        icon="credit-card"
        onPress={() => nav.navigate("Subscription")}
      />
    </Page>
  );
}
export function ManageReservationsScreen() {
  const { state } = useStore(),
    nav = useNav();
  const b = state.businesses.find((b) => b.id === state.businessId);
  const [status, setStatus] = useState("Pendente"),
    [day, setDay] = useState("");
  const reservations = state.reservations.filter(
    (r) =>
      r.businessId === b?.id &&
      (status === "Todas" || r.status === status) &&
      (!day || (r.start <= day && r.end >= day)),
  );
  return (
    <Page
      title="Solicitações de reserva"
      subtitle={b?.name}
      tab="ManageReservations"
      advertiser
    >
      <Notice>
        Agenda de solicitações com confirmação manual. As datas selecionadas
        filtram os pedidos recebidos.
      </Notice>
      <Calendar
        start={day}
        pastAllowed
        onSelect={(value) => setDay(day === value ? "" : value)}
      />
      {!!day && (
        <Button
          secondary
          title={`Limpar data · ${displayDate(day)}`}
          onPress={() => setDay("")}
        />
      )}
      <View style={s.wrap}>
        {["Todas", "Pendente", "Confirmada", "Recusada", "Cancelada"].map(
          (name) => (
            <Chip
              key={name}
              title={name}
              selected={status === name}
              onPress={() => setStatus(name)}
            />
          ),
        )}
      </View>
      {reservations.map((r) => (
        <Row
          key={r.id}
          title={`${r.name} · ${displayDate(r.start)}`}
          subtitle={`${r.roomName} · ${r.status}`}
          icon="calendar"
          onPress={() =>
            nav.navigate("RespondReservation", { reservationId: r.id })
          }
        />
      ))}
      {reservations.length === 0 && (
        <Notice>
          Nenhuma solicitação com esses filtros. Novas reservas aparecerão aqui
          quando forem recebidas.
        </Notice>
      )}
    </Page>
  );
}
export function RespondReservationScreen({ route }: ScreenProps) {
  const { state, respondReservation } = useStore(),
    nav = useNav();
  const r = state.reservations.find(
    (r) =>
      r.id === route.params?.reservationId && r.businessId === state.businessId,
  );
  const [reply, setReply] = useState(r?.reply || ""),
    [error, setError] = useState("");
  if (!r)
    return (
      <Page title="Solicitação">
        <Notice>Solicitação não encontrada para este negócio.</Notice>
      </Page>
    );
  const respond = async (status: "Confirmada" | "Recusada") => {
    if (status === "Recusada" && !reply.trim())
      return setError("Informe o motivo da recusa para o visitante.");
    await respondReservation(r.id, status, reply.trim());
    nav.goBack();
  };
  return (
    <Page
      title={`Solicitação ${r.id.slice(-6)}`}
      footer={
        r.status === "Pendente" ? (
          <View style={s.row}>
            <View style={s.grow}>
              <Button
                secondary
                title="Recusar"
                onPress={() => respond("Recusada")}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Button
                title="Confirmar reserva"
                onPress={() => respond("Confirmada")}
              />
            </View>
          </View>
        ) : undefined
      }
    >
      <Badge text={r.status} />
      <View style={s.card}>
        <Text style={s.heading}>{r.name}</Text>
        <Text style={s.muted}>{r.phone}</Text>
        <Text style={s.body}>
          {r.adults} adultos · {r.children} crianças
        </Text>
      </View>
      <View style={s.card}>
        <Text style={s.label}>{r.roomName}</Text>
        <Text style={s.body}>
          {displayDate(r.start)}
          {r.kind === "hospedagem"
            ? ` a ${displayDate(r.end)}`
            : ` às ${r.time}`}
        </Text>
        {r.kind === "hospedagem" && (
          <Text style={s.label}>Valor estimado · {money(r.estimate)}</Text>
        )}
        <Text style={s.muted}>{r.notes || "Sem observações."}</Text>
      </View>
      <Notice tone="amber">
        Confira a disponibilidade antes de confirmar. O visitante acompanhará
        sua resposta pelo aplicativo.
      </Notice>
      <Field
        label="Mensagem para o visitante"
        value={reply}
        onChangeText={setReply}
        multiline
        editable={r.status === "Pendente"}
      />
      {error && <Notice tone="red">{error}</Notice>}
    </Page>
  );
}
export function IndicatorsScreen() {
  const { state } = useStore();
  const [period, setPeriod] = useState(30);
  const data = useRemote(
    () => repository.metrics(state.businessId, period),
    [state.businessId, period],
  );
  return (
    <Page brand tab="Indicators" advertiser>
      <Text style={s.title}>Seu negócio em números</Text>
      <View style={s.row}>
        {[7, 30, 90].map((days) => (
          <Chip
            key={days}
            title={`${days} dias`}
            selected={period === days}
            onPress={() => setPeriod(days)}
          />
        ))}
      </View>
      <RemoteStatus resource={data} />
      {data.value && (
        <View style={s.wrap}>
          {[
            ["Visualizações", data.value.views],
            ["Contatos", data.value.contacts],
            ["Solicitações", data.value.requests],
            ["Confirmadas", data.value.confirmed],
          ].map(([label, value]) => (
            <View
              key={label}
              style={[s.card, { width: "47%", backgroundColor: c.soft }]}
            >
              <Text style={s.title}>{value}</Text>
              <Text style={s.muted}>{label}</Text>
            </View>
          ))}
        </View>
      )}
    </Page>
  );
}
export function AccountScreen() {
  const { state, update, logout } = useStore(),
    nav = useNav();
  const businesses = state.businesses.filter((b) => b.owner);
  return (
    <Page brand tab="Account" advertiser>
      <Text style={s.title}>Conta</Text>
      <View style={[s.card, { backgroundColor: c.soft }]}>
        <Text style={s.heading}>{state.profile?.name}</Text>
        <Text style={s.muted}>{state.profile?.email}</Text>
      </View>
      <Section title="Usar o app como" />
      <View style={s.row}>
        <Chip title="Visitante" onPress={() => nav.navigate("Home")} />
        <Chip
          title="Anunciante"
          selected
          onPress={() => nav.navigate("Dashboard")}
        />
      </View>
      <Section title="Meus negócios" />
      {businesses.map((b) => (
        <Row
          key={b.id}
          title={b.name}
          subtitle={b.status}
          icon="briefcase"
          onPress={() => {
            update((s) => ({ ...s, businessId: b.id }));
            nav.navigate("Dashboard");
          }}
        />
      ))}
      <Button
        secondary
        title="Cadastrar outro negócio"
        icon="plus"
        onPress={() => nav.navigate("BusinessWelcome")}
      />
      <Row
        title="Assinatura"
        icon="credit-card"
        onPress={() => nav.navigate("Subscription")}
      />

      <Row
        title="Ajuda para anunciantes"
        icon="help-circle"
        onPress={() => nav.navigate("Help")}
      />
      <Button
        secondary
        title="Sair da conta"
        onPress={async () => {
          await logout();
          nav.reset({ index: 0, routes: [{ name: "Home" }] });
        }}
      />
    </Page>
  );
}
export function SubscriptionScreen() {
  const { state } = useStore();
  return asaasSandboxEnabled ? (
    <SandboxSubscription businessId={state.businessId.startsWith("draft-") ? "" : state.businessId} />
  ) : (
    <SubscriptionDetails businessId={state.businessId} />
  );
}

function SubscriptionDetails({ businessId }: { businessId: string }) {
  const data = useRemote(
    () => repository.subscription(businessId),
    [businessId],
  );
  return (
    <Page title="Assinatura">
      <Text style={s.title}>Sua participação no guia</Text>
      <RemoteStatus resource={data} />
      {data.value && (
        <View style={s.card}>
          <Badge text={data.value.status} />
          <Text style={s.heading}>
            {data.value.plan || "Nenhum plano contratado"}
          </Text>
          {data.value.amount !== null && (
            <Text style={s.title}>{money(data.value.amount)}</Text>
          )}
          {data.value.dueDate && (
            <Text style={s.muted}>
              Vencimento: {displayDate(data.value.dueDate)}
            </Text>
          )}
        </View>
      )}
      <Notice>
        Os pagamentos de produtos e reservas são combinados diretamente com o
        estabelecimento.
      </Notice>
    </Page>
  );
}
