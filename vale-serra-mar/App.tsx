import { useReducedMotion } from "./src/components/Motion";
import { Dialogs } from "./src/components/Dialogs";
import React from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { StoreProvider, useStore } from "./src/store";
import { colors } from "./src/theme";
import type { Routes, ScreenName, ScreenProps } from "./src/navigation";
import { Button, Notice, Page } from "./src/components/ui";
import {
  WelcomeScreen,
  HomeScreen,
  SearchScreen,
  ResultsScreen,
  ProfileScreen,
  PreferencesScreen,
  FavoritesScreen,
  HelpScreen,
} from "./src/screens/Discover";
import {
  BusinessScreen,
  GalleryScreen,
  MapScreen,
} from "./src/screens/Business";
import {
  MenuScreen,
  ProductScreen,
  CartScreen,
  OrderReviewScreen,
  OrderSentScreen,
} from "./src/screens/Menu";
import {
  BookingScreen,
  BookingDetailScreen,
  ReservationsScreen,
} from "./src/screens/Bookings";
import {
  AdvertiseScreen,
  AuthScreen,
  ActivateScreen,
  BusinessWelcomeScreen,
  BusinessWizardScreen,
} from "./src/screens/OnboardingBusiness";
import {
  EditBusinessScreen,
  ManageMenuScreen,
  EditProductScreen,
  ManageRoomsScreen,
  EditRoomScreen,
} from "./src/screens/ManageBusiness";
import {
  ReviewStatusScreen,
  DashboardScreen,
  ManageReservationsScreen,
  RespondReservationScreen,
  IndicatorsScreen,
  AccountScreen,
  SubscriptionScreen,
} from "./src/screens/Advertiser";
const Stack = createNativeStackNavigator<Routes>();
const screens: Record<ScreenName, React.ComponentType<ScreenProps>> = {
  Welcome: WelcomeScreen,
  Home: HomeScreen,
  Search: SearchScreen,
  Results: ResultsScreen,
  Filters: ResultsScreen,
  Map: MapScreen,
  Business: BusinessScreen,
  Menu: MenuScreen,
  Product: ProductScreen,
  Cart: CartScreen,
  OrderReview: OrderReviewScreen,
  OrderSent: OrderSentScreen,
  Booking: BookingScreen,
  BookingDetail: BookingDetailScreen,
  Reservations: ReservationsScreen,
  Profile: ProfileScreen,
  Preferences: PreferencesScreen,
  Favorites: FavoritesScreen,
  Advertise: AdvertiseScreen,
  Auth: AuthScreen,
  Activate: ActivateScreen,
  BusinessWelcome: BusinessWelcomeScreen,
  BusinessWizard: BusinessWizardScreen,
  ReviewStatus: ReviewStatusScreen,
  Dashboard: DashboardScreen,
  EditBusiness: EditBusinessScreen,
  ManageMenu: ManageMenuScreen,
  EditProduct: EditProductScreen,
  ManageRooms: ManageRoomsScreen,
  EditRoom: EditRoomScreen,
  ManageReservations: ManageReservationsScreen,
  RespondReservation: RespondReservationScreen,
  Indicators: IndicatorsScreen,
  Account: AccountScreen,
  Subscription: SubscriptionScreen,
  Gallery: GalleryScreen,
  Help: HelpScreen,
};
const protectedScreens: ScreenName[] = [
  "Activate",
  "BusinessWelcome",
  "BusinessWizard",
  "ReviewStatus",
  "Dashboard",
  "EditBusiness",
  "ManageMenu",
  "EditProduct",
  "ManageRooms",
  "EditRoom",
  "ManageReservations",
  "RespondReservation",
  "Indicators",
  "Account",
  "Subscription",
];
const approvedOnly: ScreenName[] = [
  "ManageReservations",
  "RespondReservation",
  "Indicators",
];
function RoutedScreen(props: ScreenProps) {
  const { state } = useStore();
  const { route, navigation } = props;
  if (protectedScreens.includes(route.name) && !state.authenticated)
    return (
      <Page title="Área do anunciante">
        <Notice>Entre na sua conta para gerenciar seu negócio.</Notice>
        <Button
          title="Entrar ou criar conta"
          onPress={() => navigation.navigate("Auth")}
        />
      </Page>
    );
  const id = route.params?.businessId || state.businessId;
  const b = state.businesses.find((b) => b.id === id);
  if (
    b &&
    protectedScreens.includes(route.name) &&
    !b.owner &&
    !["Activate", "BusinessWelcome"].includes(route.name)
  )
    return (
      <Page title="Meu negócio">
        <Notice>Você não tem acesso a este negócio.</Notice>
        <Button title="Voltar" onPress={() => navigation.navigate("Account")} />
      </Page>
    );
  if (approvedOnly.includes(route.name) && b?.status !== "Aprovado")
    return (
      <Page title="Aguardando aprovação">
        <Notice>
          O painel de gestão ficará disponível após a aprovação do negócio.
        </Notice>
        <Button
          title="Acompanhar análise"
          onPress={() => navigation.navigate("ReviewStatus")}
        />
      </Page>
    );
  const Component = screens[route.name];
  return <Component {...props} />;
}
function Navigator() {
  const reducedMotion = useReducedMotion();
  const { state, ready } = useStore();
  if (!ready)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
        }}
      >
        <ActivityIndicator color={colors.green} />
        <Text>Preparando seu guia…</Text>
      </View>
    );
  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: colors.white,
          primary: colors.green,
        },
      }}
    >
      <Stack.Navigator
        initialRouteName={state.region ? "Home" : "Welcome"}
        screenOptions={{
          headerShown: false,
          animation: reducedMotion ? "none" : "slide_from_right",
          contentStyle: { backgroundColor: colors.white },
        }}
      >
        {(Object.keys(screens) as ScreenName[]).map((name) => (
          <Stack.Screen key={name} name={name} component={RoutedScreen} />
        ))}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.white,
            ...(Platform.OS === "web"
              ? ({ width: "100%", maxWidth: 480, alignSelf: "center" } as const)
              : {}),
          }}
        >
          <Dialogs />
          <StatusBar style="dark" />
          <Navigator />
        </View>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
