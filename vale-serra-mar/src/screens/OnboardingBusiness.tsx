import { Alert } from "../components/Dialogs";
import { Tap as Pressable } from "../components/Motion";
import React, { useState } from "react";
import { Image, Text, View } from "react-native";
import { assets, photoSource } from "../assets";
import { regions } from "../domain/catalog";
import { businessType, businessTypes } from "../domain/categories";
import { isRestaurant, money, validPhone, validTime } from "../domain/logic";
import type { Business } from "../domain/models";
import { useStore } from "../store";
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
  Row,
  Section,
  Toggle,
} from "../components/ui";
import { pickPhoto } from "../services/photos";
import {
  AdvertiserPlanTotals,
  startBusinessRegistration,
} from "./AdvertiserPlans";
export function AdvertiseScreen() {
  const nav = useNav();
  const { state } = useStore();
  const showPlans = () => nav.navigate("BusinessWelcome");
  return (
    <Page
      title="Anuncie no guia"
      onAdvertisePress={showPlans}
      footer={
        <Button
          title="Ver planos de anúncio"
          icon="arrow-right"
          onPress={showPlans}
        />
      }
    >
      <Image
        source={assets.landscape}
        style={{ width: "100%", height: 148, borderRadius: 18 }}
      />
      <Text style={s.eyebrow}>Para negócios da região</Text>
      <Text style={s.title}>
        Seu negócio na rota{"\n"}de quem explora a região
      </Text>
      <Text style={s.muted}>
        Uma página para apresentar o seu espaço, seus serviços e suas melhores
        experiências.
      </Text>
      <Section title="O que você ganha" />
      <Row
        title="Cardápio digital"
        subtitle="Categorias, preços e fotos dos seus pratos"
        icon="book-open"
        onPress={showPlans}
      />
      <Row
        title="Solicitações de reserva"
        subtitle="Confirme mesas e hospedagens manualmente"
        icon="calendar"
        onPress={showPlans}
      />
      <Row
        title="Indicadores básicos"
        subtitle="Visualizações e solicitações recebidas"
        icon="bar-chart-2"
        onPress={showPlans}
      />
      <Notice>
        Escolha um plano de lançamento antes de preencher o cadastro do seu estabelecimento.
      </Notice>
      <Button
        secondary
        title={state.authenticated ? "Área do anunciante" : "Já sou anunciante"}
        onPress={() => nav.navigate(state.authenticated ? "Dashboard" : "Auth")}
      />
    </Page>
  );
}
export function AuthScreen({ route }: { route?: ScreenProps["route"] }) {
  const { authenticate, state, saveDraft } = useStore(),
    nav = useNav();
  const selection = route?.params?.advertiserPlanSelection;
  const fromSettings = route?.params?.authFromSettings === true;
  const fromProfile = route?.params?.signupFromProfile === true || fromSettings;
  const canCreate = !!selection || fromProfile;
  const [create, setCreate] = useState(canCreate && !fromSettings),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState(""),
    [password, setPassword] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [error, setError] = useState("");
  const selectMode = (next: boolean) => {
    if (next !== create) setShowPassword(false);
    setCreate(next);
    setError("");
  };
  const submit = async () => {
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setError("Informe um e-mail válido.");
    if (!password || (create && password.length < 8))
      return setError("Use uma senha com pelo menos 8 caracteres.");
    if (create && (!name.trim() || !validPhone(phone)))
      return setError("Preencha nome e telefone com DDD.");
    const profile = await authenticate(create ? "register" : "login", {
      email: email.trim().toLowerCase(),
      password,
      ...(create ? { name: name.trim(), phone } : {}),
    });
    if (!nav.isFocused()) return;
    if (selection) {
      startBusinessRegistration(
        nav,
        { state, saveDraft },
        selection,
        profile.phone,
      );
    } else if (fromSettings) {
      nav.popTo("Settings");
    } else if (fromProfile) {
      nav.popTo("Profile");
    } else {
      nav.replace("Dashboard");
    }
  };
  return (
    <Page title={fromProfile ? "Conta" : "Área do anunciante"} keyboardAware>
      {!fromProfile && (
        <Text style={s.eyebrow}>Seu negócio, mais perto das pessoas</Text>
      )}
      <Text style={s.title}>
        {create ? "Crie sua conta" : "Bom ter você de volta"}
      </Text>
      {!fromProfile && (
        <Text style={s.muted}>
          {create
            ? "Preencha seus dados para continuar com o plano escolhido."
            : "Entre para cuidar do seu negócio."}
        </Text>
      )}
      {canCreate && (
        <View style={s.row}>
          <Chip
            title="Entrar"
            selected={!create}
            onPress={() => selectMode(false)}
          />
          <Chip
            title="Criar conta"
            selected={create}
            onPress={() => selectMode(true)}
          />
        </View>
      )}
      {create && (
        <Field
          label="Nome completo"
          value={name}
          onChangeText={setName}
          autoComplete="name"
        />
      )}
      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      {create && (
        <Field
          label="Telefone com DDD"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
      )}
      <Field
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete={create ? "new-password" : "current-password"}
        action={{
          icon: showPassword ? "eye-off" : "eye",
          label: showPassword ? "Ocultar senha" : "Mostrar senha",
          onPress: () => setShowPassword((visible) => !visible),
        }}
      />
      {error && <Notice tone="red">{error}</Notice>}
      <Button
        title={create ? "Criar conta" : "Entrar"}
        icon="arrow-right"
        onPress={submit}
      />
      <Button
        secondary
        title={
          fromProfile
            ? "Voltar ao perfil"
            : selection
              ? "Voltar ao plano"
              : "Continuar explorando"
        }
        onPress={() => {
          if (selection || fromProfile) nav.goBack();
          else if (state.region) nav.navigate("Home");
          else nav.popTo("Welcome");
        }}
      />
    </Page>
  );
}
export function ActivateScreen() {
  const { state, updateProfile } = useStore(),
    nav = useNav();
  const [phone, setPhone] = useState(state.profile?.phone || "");
  return (
    <Page
      title="Área do anunciante"
      footer={
        <Button
          title="Ativar e cadastrar meu negócio"
          onPress={async () => {
            if (!state.profile || !validPhone(phone))
              return Alert.alert(
                "Telefone inválido",
                "Informe o telefone com DDD.",
              );
            await updateProfile({ ...state.profile, phone });
            nav.navigate(state.businessId ? "Dashboard" : "BusinessWelcome");
          }}
        />
      }
    >
      <Text style={s.title}>Use a sua conta{"\n"}para anunciar</Text>
      <Text style={s.muted}>
        Continue explorando o guia e gerencie seu negócio na área do anunciante.
      </Text>
      <View style={[s.card, { backgroundColor: c.soft }]}>
        <Text style={s.heading}>{state.profile?.name}</Text>
        <Text style={s.muted}>{state.profile?.email}</Text>
        <Badge text="Anunciante" />
      </View>
      <Section title="Sua conta passa a ter dois modos" />
      <View style={s.row}>
        <View style={[s.card, s.grow]}>
          <Icon name="user" />
          <Text style={s.label}>Visitante</Text>
          <Text style={s.muted}>Explorar e reservar</Text>
        </View>
        <View style={[s.card, s.grow]}>
          <Icon name="briefcase" />
          <Text style={s.label}>Anunciante</Text>
          <Text style={s.muted}>Gerenciar seu negócio</Text>
        </View>
      </View>
      <Field
        label="WhatsApp do negócio"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
    </Page>
  );
}
export function BusinessFields({
  business: b,
  onChange,
}: {
  business: Business;
  onChange: (patch: Partial<Business>) => void;
}) {
  const hotel = b.segment === "Hospedagem";
  const restaurant = isRestaurant(b.segment);
  const selectedType = businessType(b).label;
  return (
    <>
      <Field
        label="Nome do estabelecimento *"
        value={b.name}
        onChangeText={(name) => onChange({ name })}
        maxLength={90}
      />
      <Section title="Tipo de estabelecimento *" />
      <View style={s.wrap}>
        {businessTypes.map(({ label, segment, subcategory, lodgingType, serviceType }) => (
          <Chip
            key={label}
            title={label}
            selected={selectedType === label}
            onPress={() => {
              const sameReservationType =
                b.segment === segment ||
                (restaurant && isRestaurant(segment));
              onChange({
                segment,
                subcategory: subcategory ?? null,
                lodgingType: lodgingType ?? null,
                serviceType: serviceType ?? null,
                acceptsReservations: sameReservationType
                  ? b.acceptsReservations
                  : segment === "Hospedagem",
              });
            }}
          />
        ))}
      </View>
      <Field
        label="Descrição dos produtos ou serviços *"
        value={b.description}
        onChangeText={(description) => onChange({ description })}
        multiline
        maxLength={500}
      />
      {(hotel || (restaurant && b.status !== "Aprovado")) && (
        <Toggle
          title={hotel ? "Receber solicitações de reserva" : "Aceitar reservas de mesa"}
          subtitle={
            hotel
              ? "Confirmação manual"
              : "Permite que visitantes solicitem uma mesa pelo app."
          }
          value={b.acceptsReservations}
          onChange={(acceptsReservations) => onChange({ acceptsReservations })}
        />
      )}
    </>
  );
}
export function LocationFields({
  business: b,
  onChange,
}: {
  business: Business;
  onChange: (patch: Partial<Business>) => void;
}) {
  return (
    <>
      <Section title="Região" />
      <View style={s.wrap}>
        {regions.map((r) => (
          <Chip
            key={r.name}
            title={r.name}
            selected={r.name === b.region}
            onPress={() => onChange({ region: r.name, city: r.cities[0] })}
          />
        ))}
      </View>
      <Section title="Cidade" />
      <View style={s.wrap}>
        {regions
          .find((r) => r.name === b.region)
          ?.cities.map((city) => (
            <Chip
              key={city}
              title={city}
              selected={city === b.city}
              onPress={() => onChange({ city })}
            />
          ))}
      </View>
      <Field
        label="CEP"
        value={b.cep}
        onChangeText={(cep) => onChange({ cep })}
        keyboardType="number-pad"
        maxLength={9}
      />
      <Field
        label="Endereço *"
        value={b.address}
        onChangeText={(address) => onChange({ address })}
      />
      <View style={s.row}>
        <View style={s.grow}>
          <Field
            label="Número *"
            value={b.number}
            onChangeText={(number) => onChange({ number })}
          />
        </View>
        <View style={s.grow}>
          <Field
            label="Bairro"
            value={b.district}
            onChangeText={(district) => onChange({ district })}
          />
        </View>
      </View>
      <Field
        label="WhatsApp com DDD *"
        value={b.phone}
        onChangeText={(phone) => onChange({ phone })}
        keyboardType="phone-pad"
      />
      <Field
        label="Instagram (opcional)"
        value={b.instagram}
        onChangeText={(instagram) => onChange({ instagram })}
        autoCapitalize="none"
      />
      <Notice>
        Confira o endereço para que seus clientes encontrem você com facilidade.
      </Notice>
    </>
  );
}
export function HoursFields({
  business: b,
  onChange,
}: {
  business: Business;
  onChange: (patch: Partial<Business>) => void;
}) {
  return (
    <>
      {b.hours.map((h, i) => (
        <View style={s.card} key={h.day}>
          <Toggle
            title={h.day}
            value={h.open}
            onChange={(open) =>
              onChange({
                hours: b.hours.map((x, j) => (j === i ? { ...x, open } : x)),
              })
            }
          />
          {h.open && (
            <View style={s.row}>
              <View style={s.grow}>
                <Field
                  label="Abre às"
                  value={h.from}
                  maxLength={5}
                  onChangeText={(from) =>
                    onChange({
                      hours: b.hours.map((x, j) =>
                        j === i ? { ...x, from } : x,
                      ),
                    })
                  }
                  placeholder="11:00"
                />
              </View>
              <View style={s.grow}>
                <Field
                  label="Fecha às"
                  value={h.to}
                  maxLength={5}
                  onChangeText={(to) =>
                    onChange({
                      hours: b.hours.map((x, j) =>
                        j === i ? { ...x, to } : x,
                      ),
                    })
                  }
                  placeholder="22:00"
                />
              </View>
            </View>
          )}
        </View>
      ))}
      <Button
        secondary
        title="Copiar horário de terça para todos os dias abertos"
        onPress={() =>
          onChange({
            hours: b.hours.map((h) => ({
              ...h,
              from: b.hours[2].from,
              to: b.hours[2].to,
            })),
          })
        }
      />
    </>
  );
}
export function PhotosFields({
  business: b,
  onChange,
}: {
  business: Business;
  onChange: (patch: Partial<Business>) => void;
}) {
  return (
    <>
      <Text style={s.muted}>
        Escolha imagens de até 8 MB que apresentem bem o seu espaço.
      </Text>
      <Section title="Capa do anúncio" />
      <Text style={s.muted}>
        Quando seu estabelecimento estiver em destaque, a capa será exibida como banner.
      </Text>
      <Image
        source={photoSource(b.photo)}
        style={{ width: "100%", height: 190, borderRadius: 16 }}
      />
      <Button
        secondary
        title="Trocar foto de capa"
        icon="image"
        onPress={async () => {
          const photo = await pickPhoto();
          if (photo) onChange({ photo });
        }}
      />
      <Section title="Logotipo" />
      {b.logo && (
        <Image
          source={photoSource(b.logo)}
          style={{ width: 80, height: 80, borderRadius: 40 }}
        />
      )}
      <Button
        secondary
        title="Escolher logotipo"
        onPress={async () => {
          const logo = await pickPhoto();
          if (logo) onChange({ logo });
        }}
      />
      <Section title={`Galeria · ${b.gallery.length}/20`} />
      <View style={s.wrap}>
        {b.gallery.map((photo, i) => (
          <View key={i}>
            <Image
              source={photoSource(photo)}
              style={{ width: 94, height: 94, borderRadius: 12 }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remover foto ${i + 1}`}
              onPress={() =>
                onChange({ gallery: b.gallery.filter((_, n) => n !== i) })
              }
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                backgroundColor: c.white,
                borderRadius: 14,
                padding: 4,
              }}
            >
              <Icon name="x" size={16} />
            </Pressable>
          </View>
        ))}
      </View>
      <Button
        secondary
        title="Adicionar foto"
        icon="plus"
        disabled={b.gallery.length >= 20}
        onPress={async () => {
          const photo = await pickPhoto();
          if (photo) onChange({ gallery: [...b.gallery, photo] });
        }}
      />
    </>
  );
}
export function businessErrors(b: Business, step: number) {
  if (step === 0 && (!b.name.trim() || !b.description.trim()))
    return "Preencha nome e descrição do negócio.";
  if (
    step === 1 &&
    (!b.address.trim() || !b.number.trim() || !validPhone(b.phone))
  )
    return "Preencha endereço, número e telefone válido com DDD.";
  if (
    step === 4 &&
    b.segment === "Hospedagem" &&
    (!validTime(b.checkIn) || !validTime(b.checkOut) || b.rooms.length === 0)
  )
    return "Cadastre uma acomodação e informe check-in e check-out no formato HH:MM.";
  if (
    step === 2 &&
    b.hours.some(
      (h) =>
        h.open && (!validTime(h.from) || !validTime(h.to) || h.from === h.to),
    )
  )
    return "Revise os horários. Use HH:MM e horários de abertura e fechamento diferentes.";
  return "";
}
export function BusinessWizardScreen({ route }: ScreenProps) {
  const { state, saveDraft, submitBusiness } = useStore(),
    nav = useNav();
  const [step, setStep] = useState(route.params?.step || 0),
    [error, setError] = useState("");
  const b =
    state.businesses.find(
      (b) => b.id === (route.params?.businessId || state.businessId),
    ) || state.businesses.find((b) => b.id === state.businessId);
  if (!b)
    return (
      <Page title="Cadastro">
        <Button
          title="Começar cadastro"
          onPress={() => nav.replace("BusinessWelcome")}
        />
      </Page>
    );
  const patch = (values: Partial<Business>) => saveDraft({ ...b, ...values });
  const headings = [
    "Sobre o seu negócio",
    "Onde encontrar você",
    "Quando você atende",
    "Mostre seu espaço",
    b.segment === "Hospedagem"
      ? "Suas acomodações"
      : isRestaurant(b.segment)
        ? "Monte seu cardápio"
        : "Seus produtos e serviços",
    "Confira seu anúncio",
  ];
  const next = async () => {
    const message = businessErrors(b, step);
    if (message) return setError(message);
    setError("");
    if (step < 5) {
      setStep(step + 1);
      return;
    }
    const allErrors = [0, 1, 2, 4]
      .map((n) => businessErrors(b, n))
      .find(Boolean);
    if (allErrors) return setError(allErrors);
    const saved = await submitBusiness(b);
    nav.replace("ReviewStatus", { businessId: saved.id });
  };
  return (
    <Page
      key={step}
      title="Cadastro do negócio"
      subtitle="Complete os dados do seu negócio"
      footer={
        <View style={s.row}>
          {step > 0 && (
            <View style={{ flex: 1 }}>
              <Button
                secondary
                title="Voltar"
                onPress={() => {
                  setStep(step - 1);
                  setError("");
                }}
              />
            </View>
          )}
          <View style={{ flex: 2 }}>
            <Button
              title={step === 5 ? "Enviar para análise" : "Continuar"}
              onPress={next}
            />
          </View>
        </View>
      }
    >
      <Text style={s.eyebrow}>Etapa {step + 1} de 6</Text>
      <View style={s.row}>
        {headings.map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i <= step ? c.green : c.border,
            }}
          />
        ))}
      </View>
      <Text style={s.title}>{headings[step]}</Text>
      {step === 0 && <BusinessFields business={b} onChange={patch} />}
      {step === 1 && <LocationFields business={b} onChange={patch} />}
      {step === 2 && <HoursFields business={b} onChange={patch} />}
      {step === 3 && <PhotosFields business={b} onChange={patch} />}
      {step === 4 &&
        (b.segment === "Hospedagem" ? (
          <>
            <Notice>
              Hóspedes enviam solicitações e você confirma manualmente.
            </Notice>
            {b.rooms.map((room) => (
              <Row
                key={room.id}
                title={room.name}
                subtitle={`${money(room.price)}/noite · ${room.guests} hóspedes`}
                icon="home"
                onPress={() =>
                  nav.navigate("EditRoom", {
                    businessId: b.id,
                    roomId: room.id,
                  })
                }
              />
            ))}
            <Button
              title="Adicionar acomodação"
              icon="plus"
              onPress={() => nav.navigate("EditRoom", { businessId: b.id })}
            />
            <Field
              label="Check-in a partir de"
              value={b.checkIn}
              onChangeText={(checkIn) => patch({ checkIn })}
              maxLength={5}
            />
            <Field
              label="Check-out até"
              value={b.checkOut}
              onChangeText={(checkOut) => patch({ checkOut })}
              maxLength={5}
            />
            <Section title="Comodidades" />
            <View style={s.wrap}>
              {[
                "Wi-Fi",
                "Café incluso",
                "Estacionamento",
                "Lareira",
                "Pet friendly",
              ].map((a) => (
                <Chip
                  key={a}
                  title={a}
                  selected={b.amenities.includes(a)}
                  onPress={() =>
                    patch({
                      amenities: b.amenities.includes(a)
                        ? b.amenities.filter((x) => x !== a)
                        : [...b.amenities, a],
                    })
                  }
                />
              ))}
            </View>
          </>
        ) : isRestaurant(b.segment) ? (
          <>
            <Notice>
              Organize categorias, descrições e preços do seu cardápio.
            </Notice>
            {state.products
              .filter((p) => p.businessId === b.id)
              .map((p) => (
                <Row
                  key={p.id}
                  title={p.name}
                  subtitle={money(p.price)}
                  icon="book-open"
                  onPress={() =>
                    nav.navigate("EditProduct", {
                      businessId: b.id,
                      productId: p.id,
                    })
                  }
                />
              ))}
            <Button
              title="Adicionar produto"
              icon="plus"
              onPress={() => nav.navigate("EditProduct", { businessId: b.id })}
            />
          </>
        ) : (
          <>
            <Notice>
              Este segmento usa a página padrão de anúncio com descrição dos
              produtos e serviços.
            </Notice>
            <Field
              label="Produtos e serviços oferecidos"
              value={b.description}
              onChangeText={(description) => patch({ description })}
              multiline
            />
          </>
        ))}
      {step === 5 && (
        <>
          <Image
            source={photoSource(b.photo)}
            style={{ width: "100%", height: 210, borderRadius: 16 }}
          />
          <Text style={s.heading}>{b.name}</Text>
          <Badge text={businessType(b).label} />
          <Text style={s.body}>{b.description}</Text>
          <Text style={s.muted}>
            {b.address}, {b.number} · {b.city}
          </Text>
          {b.draftPlan && <AdvertiserPlanTotals selection={b.draftPlan} />}
          <Button
            secondary
            title="Ver como visitante"
            icon="eye"
            onPress={() =>
              nav.navigate("Business", { businessId: b.id, preview: true })
            }
          />
          <Notice>
            Seu cadastro será analisado antes da publicação. Você poderá
            acompanhar a resposta na sua área.
          </Notice>
        </>
      )}
      {error && <Notice tone="red">{error}</Notice>}
    </Page>
  );
}
