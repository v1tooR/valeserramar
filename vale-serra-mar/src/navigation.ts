import type { Filters } from "./domain/models";
import { useNavigation } from "@react-navigation/native";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
export type ScreenName =
  | "Welcome"
  | "Home"
  | "Search"
  | "Results"
  | "Filters"
  | "Map"
  | "Business"
  | "Menu"
  | "Product"
  | "Cart"
  | "OrderReview"
  | "OrderSent"
  | "Booking"
  | "BookingDetail"
  | "Reservations"
  | "Profile"
  | "Preferences"
  | "Favorites"
  | "Advertise"
  | "Auth"
  | "Activate"
  | "BusinessWelcome"
  | "BusinessWizard"
  | "ReviewStatus"
  | "Dashboard"
  | "EditBusiness"
  | "ManageMenu"
  | "EditProduct"
  | "ManageRooms"
  | "EditRoom"
  | "ManageReservations"
  | "RespondReservation"
  | "Indicators"
  | "Account"
  | "Subscription"
  | "Gallery"
  | "Help";
export type Params =
  | {
      businessId?: string;
      productId?: string;
      reservationId?: string;
      roomId?: string;
      step?: number;
      message?: string;
      query?: string;
      category?: string;
      preview?: boolean;
      filters?: Filters;
      allRegions?: boolean;
    }
  | undefined;
export type Routes = { [K in ScreenName]: Params };
export type ScreenProps = NativeStackScreenProps<Routes, ScreenName>;
export const useNav = () =>
  useNavigation<NativeStackNavigationProp<Routes, ScreenName>>();
