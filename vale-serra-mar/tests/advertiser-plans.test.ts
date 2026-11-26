import { expect, it, jest } from "@jest/globals";
import React from "react";
import { Text } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Button, Toggle } from "../src/components/ui";
import {
  quoteAdvertiserPlan,
  type AdvertiserHighlightId,
  type AdvertiserPlanId,
} from "../src/domain/advertiserPlans";
import type { Business } from "../src/domain/models";
import type { ScreenProps } from "../src/navigation";
import {
  AdvertiserPlansScreen,
  BusinessPlanReviewScreen,
} from "../src/screens/AdvertiserPlans";

const mockNavigate = jest.fn();
const mockReset = jest.fn();
const mockSaveDraft = jest.fn<(business: Business) => void>();
let mockAuthenticated = false;
jest.mock("../src/navigation", () => ({
  useNav: () => ({
    navigate: mockNavigate,
    reset: mockReset,
    getState: () => ({
      routes: [
        { name: "Dashboard" },
        { name: "BusinessWelcome" },
        { name: "BusinessPlanReview" },
      ],
    }),
  }),
}));
jest.mock("../src/store", () => ({
  useStore: () => ({
    state: {
      authenticated: mockAuthenticated,
      profile: mockAuthenticated ? { phone: "12999999999" } : null,
    },
    saveDraft: mockSaveDraft,
  }),
  uid: () => "plano-teste",
}));
jest.mock("../src/components/ui", () => ({
  Page: ({
    children,
    footer,
  }: React.PropsWithChildren<{ footer?: React.ReactNode }>) => [
    children,
    footer,
  ],
  Notice: ({ children }: React.PropsWithChildren) => children,
  Button: () => null,
  Toggle: () => null,
  Icon: () => null,
}));

const cases: [AdvertiserPlanId, AdvertiserHighlightId[], number][] = [
  ["annual", [], 80000],
  ["annual", ["home"], 200000],
  ["annual", ["category"], 170000],
  ["annual", ["home", "category"], 290000],
  ["monthly", [], 8700],
  ["monthly", ["home"], 18700],
  ["monthly", ["category"], 16200],
  ["monthly", ["home", "category"], 26200],
];

it.each(cases)(
  "calcula o plano %s com destaques %j em %i centavos",
  (planId, highlights, expected) => {
    expect(quoteAdvertiserPlan({ planId, highlights }).totalCents).toBe(
      expected,
    );
  },
);

it.each([false, true])("abre plano e destaques e encaminha ao assinar (autenticado: %s)", async (authenticated) => {
  jest.clearAllMocks();
  mockAuthenticated = authenticated;
  let plans!: ReactTestRenderer;
  let review!: ReactTestRenderer;
  try {
    await act(async () => {
      plans = create(React.createElement(AdvertiserPlansScreen));
    });
    const annual = plans.root
      .findAllByType(Button)
      .find((button) => button.props.title === "Ver plano anual")!;
    await act(async () => {
      annual.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith("BusinessPlanReview", {
      advertiserPlanId: "annual",
    });
    expect(mockSaveDraft).not.toHaveBeenCalled();

    const props = {
      route: {
        key: "plan",
        name: "BusinessPlanReview",
        params: { advertiserPlanId: "annual" },
      },
    } as ScreenProps;
    await act(async () => {
      review = create(React.createElement(BusinessPlanReviewScreen, props));
    });
    for (const toggle of review.root.findAllByType(Toggle)) {
      await act(async () => {
        toggle.props.onChange(true);
      });
    }
    expect(
      review.root
        .findAllByType(Text)
        .some((label) => String(label.props.children).includes("2.900,00")),
    ).toBe(true);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockSaveDraft).not.toHaveBeenCalled();
    const selection = { planId: "annual", highlights: ["home", "category"] };
    const subscribe = review.root.findByType(Button);
    expect(subscribe.props.title).toBe("Assinar plano anual");
    await act(async () => {
      subscribe.props.onPress();
    });
    if (!authenticated) {
      expect(mockNavigate).toHaveBeenLastCalledWith("Auth", {
        advertiserPlanSelection: selection,
      });
      expect(mockSaveDraft).not.toHaveBeenCalled();
      expect(mockReset).not.toHaveBeenCalled();
      return;
    }
    expect(mockSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "draft-plano-teste",
        draftPlan: selection,
      }),
    );
    expect(mockReset).toHaveBeenCalledWith({
      index: 1,
      routes: [
        { name: "Dashboard" },
        {
          key: "BusinessWizard-draft-plano-teste",
          name: "BusinessWizard",
          params: { businessId: "draft-plano-teste", step: 0 },
        },
      ],
    });
  } finally {
    await act(async () => {
      plans?.unmount();
      review?.unmount();
    });
  }
});
