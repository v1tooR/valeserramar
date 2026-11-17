import { CollectionState } from "../components/CollectionState";
import { Tap as Pressable } from "../components/Motion";
import React, { useState } from "react";
import { Image, Share, Text, View, useWindowDimensions } from "react-native";
import { photoSource } from "../assets";
import { useStore } from "../store";
import { useNav, type ScreenProps } from "../navigation";
import { isOpen, isRestaurant, money, filterBusinesses } from "../domain/logic";
import { contact, directions, openExternal } from "../services/external";
import { colors as c, styles as s } from "../theme";
import {
  Badge,
  Button,
  Chip,
  Icon,
  IconButton,
  Notice,
  Page,
  Row,
  Section,
} from "../components/ui";
import { BusinessCard } from "../components/BusinessCard";
import { BusinessMap } from "../components/BusinessMap";
import { locatedBusinesses } from "../maps/openStreetMap";
import { emptyFilters } from "./Discover";
export function MapScreen({ route }: ScreenProps) {
  const { state } = useStore(),
    nav = useNav();
  const { height } = useWindowDimensions();
  const businesses = filterBusinesses(
    state.businesses,
    {
      ...emptyFilters,
      segment: route.params?.category || "",
      ...route.params?.filters,
    },
    route.params?.query || "",
    route.params?.allRegions ? "" : state.region,
  );
  const located = locatedBusinesses(businesses);
  const [selectedId, setSelectedId] = useState("");
  const selected = located.find((b) => b.id === selectedId);
  return (
    <Page title="Mapa de empresas" tab="Map">
      <View
        style={{
          height: Math.max(230, Math.min(400, height * 0.42)),
          borderRadius: 24,
          overflow: "hidden",
          backgroundColor: c.mint,
        }}
      >
        <BusinessMap
          businesses={located}
          region={route.params?.allRegions ? "" : state.region}
          onSelect={(b) => setSelectedId(b.id)}
        />
      </View>
      <View style={s.between}>
        <Text style={s.heading}>{located.length} lugares no mapa</Text>
        <Chip
          title="Ver lista"
          onPress={() => nav.navigate("Results", route.params)}
        />
      </View>
      <CollectionState
        empty={!located.length}
        title="Nenhum estabelecimento com localização disponível"
      />
      {selected && (
        <>
          <BusinessCard business={selected} />
          <Button
            title="Como chegar"
            icon="navigation"
            onPress={() => directions(selected)}
          />
        </>
      )}
    </Page>
  );
}
export function BusinessScreen({ route }: ScreenProps) {
  const { state, update } = useStore(),
    nav = useNav();
  const b = state.businesses.find((b) => b.id === route.params?.businessId);
  const [allHours, setAllHours] = useState(false);
  if (
    !b ||
    (b.status !== "Aprovado" &&
      !(route.params?.preview && state.authenticated && b.owner))
  )
    return (
      <Page title="Estabelecimento">
        <Notice>Este estabelecimento não está disponível.</Notice>
      </Page>
    );
  const hotel = b.segment === "Hospedagem",
    restaurant = isRestaurant(b.segment),
    favorite = state.favorites.includes(b.id);
  return (
    <Page
      title={b.name}
      right={
        <IconButton
          icon="share-2"
          label="Compartilhar"
          onPress={() => {
            Share.share({
              message: `Conheça ${b.name}, em ${b.city}, no Vale, Serra e Mar.`,
            }).catch(() => {});
          }}
        />
      }
      footer={
        route.params?.preview ? undefined : (
          <>
            {restaurant && (
              <Button
                title="Ver cardápio e pedir"
                icon="book-open"
                onPress={() => nav.navigate("Menu", { businessId: b.id })}
              />
            )}
            {b.acceptsReservations && (
              <Button
                title={hotel ? "Solicitar reserva" : "Reservar mesa"}
                icon="calendar"
                secondary={restaurant}
                onPress={() => nav.navigate("Booking", { businessId: b.id })}
              />
            )}
            {!restaurant && !b.acceptsReservations && (
              <Button
                title="Entrar em contato"
                icon="message-circle"
                onPress={() => contact(b)}
              />
            )}
          </>
        )
      }
    >
      {route.params?.preview && (
        <Notice>Prévia do seu anúncio. Publicação depende da aprovação.</Notice>
      )}
      <Pressable
        onPress={() => nav.navigate("Gallery", { businessId: b.id })}
        accessibilityRole="button"
        accessibilityLabel="Ver fotos"
      >
        <Image
          source={photoSource(b.photo)}
          style={{ width: "100%", height: hotel ? 250 : 265, borderRadius: 18 }}
          resizeMode="cover"
        />
      </Pressable>
      <View style={s.between}>
        <View style={s.grow}>
          <Text style={s.eyebrow}>{b.segment}</Text>
          <Text style={s.title}>{b.name}</Text>
          <Text style={s.muted}>
            {b.address}, {b.number} · {b.city}
          </Text>
        </View>
        <IconButton
          icon="heart"
          label={favorite ? "Remover favorito" : "Favoritar"}
          onPress={() =>
            update((s) => ({
              ...s,
              favorites: favorite
                ? s.favorites.filter((x) => x !== b.id)
                : [...s.favorites, b.id],
            }))
          }
        />
      </View>
      <Badge
        text={
          hotel
            ? `Check-in ${b.checkIn} · Check-out ${b.checkOut}`
            : isOpen(b)
              ? "Aberto agora"
              : "Confira os horários"
        }
      />
      <View style={[s.row, { justifyContent: "space-around" }]}>
        {(
          [
            {
              title: "WhatsApp",
              icon: "message-circle",
              action: () => contact(b),
            },
            {
              title: "Ligar",
              icon: "phone",
              action: () =>
                b.phone
                  ? openExternal(`tel:${b.phone.replace(/\D/g, "")}`)
                  : contact(b),
            },
            { title: "Rota", icon: "navigation", action: () => directions(b) },
            {
              title: "Fotos",
              icon: "image",
              action: () => nav.navigate("Gallery", { businessId: b.id }),
            },
          ] as const
        ).map((item) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            onPress={item.action}
            style={{
              alignItems: "center",
              padding: 12,
              borderRadius: 12,
              backgroundColor: c.soft,
              gap: 8,
            }}
          >
            <Icon name={item.icon} />
            <Text style={{ fontSize: 12, color: c.dark }}>{item.title}</Text>
          </Pressable>
        ))}
      </View>
      <Section title="Sobre" />
      <Text style={s.body}>{b.description}</Text>
      <Section title={hotel ? "Comodidades" : "Serviços"} />
      <View style={s.wrap}>
        {b.amenities.map((a) => (
          <Badge key={a} text={a} />
        ))}
      </View>
      {hotel && (
        <>
          <Section title="Acomodações" />
          {b.rooms.map((room) => (
            <Pressable
              key={room.id}
              accessibilityRole="button"
              onPress={() =>
                !route.params?.preview &&
                nav.navigate("Booking", { businessId: b.id, roomId: room.id })
              }
              style={[s.card, s.row]}
            >
              <Image
                source={photoSource(room.photo)}
                style={{ width: 104, height: 86, borderRadius: 12 }}
              />
              <View style={s.grow}>
                <Text style={[s.body, { fontWeight: "700" }]}>{room.name}</Text>
                <Text style={s.muted}>
                  Até {room.guests} hóspedes · {room.description}
                </Text>
                <Text style={[s.body, { color: c.green, fontWeight: "700" }]}>
                  {money(room.price)} / noite
                </Text>
              </View>
            </Pressable>
          ))}
        </>
      )}
      <Section
        title="Funcionamento"
        action={allHours ? "Recolher" : "Ver todos"}
        onPress={() => setAllHours(!allHours)}
      />
      {(allHours ? b.hours : b.hours.slice(0, 1)).map((h) => (
        <View style={s.between} key={h.day}>
          <Text style={s.body}>{h.day}</Text>
          <Text style={s.muted}>
            {h.open ? `${h.from} às ${h.to}` : "Fechado"}
          </Text>
        </View>
      ))}
      <Row
        title="Endereço e mapa"
        subtitle={`${b.address}, ${b.number}, ${b.city}`}
        icon="map-pin"
        onPress={() => directions(b)}
      />
      {b.instagram && (
        <Button
          secondary
          title="Ver Instagram"
          onPress={() =>
            openExternal(
              `https://instagram.com/${b.instagram.replace(/^@/, "")}`,
            )
          }
        />
      )}
    </Page>
  );
}
export function GalleryScreen({ route }: ScreenProps) {
  const { state } = useStore();
  const b = state.businesses.find((b) => b.id === route.params?.businessId);
  return (
    <Page title="Fotos">
      {b &&
        [b.photo, ...b.gallery.filter((p) => p !== b.photo)].map((p, i) => (
          <Image
            key={i}
            source={photoSource(p)}
            style={{ width: "100%", aspectRatio: 1.3, borderRadius: 16 }}
            resizeMode="cover"
          />
        ))}
    </Page>
  );
}
