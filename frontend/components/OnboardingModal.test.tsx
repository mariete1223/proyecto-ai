import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  OnboardingModal,
  isOnboardingCompleted,
  setOnboardingCompleted,
} from "./OnboardingModal";

describe("OnboardingModal Component (#66)", () => {
  const userId = "test-user-456";
  const mockStorage: Record<string, string> = {};

  beforeAll(() => {
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => mockStorage[k] ?? null,
        setItem: (k: string, v: string) => {
          mockStorage[k] = String(v);
        },
        removeItem: (k: string) => {
          delete mockStorage[k];
        },
        clear: () => {
          Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
        },
      },
    };
  });

  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  });

  it("renders step 1 with title, badge and description when visible", async () => {
    const onCloseMock = jest.fn();
    const { getByTestId, getByText } = await render(
      <OnboardingModal visible={true} onClose={onCloseMock} userId={userId} />,
    );

    expect(getByTestId("onboarding-modal")).toBeTruthy();
    expect(getByTestId("onboarding-card")).toBeTruthy();
    expect(getByText("🎙️ DICTADO INTELIGENTE")).toBeTruthy();
    expect(getByTestId("onboarding-step-title").props.children).toBe(
      "Captura rápida con tu voz",
    );
    expect(getByTestId("btn-skip-onboarding")).toBeTruthy();
    expect(getByTestId("btn-next-onboarding")).toBeTruthy();
  });

  it("navigates forward through all 4 steps and displays finish button on step 4", async () => {
    const onCloseMock = jest.fn();
    const { getByTestId, queryByTestId, getByText } = await render(
      <OnboardingModal visible={true} onClose={onCloseMock} userId={userId} />,
    );

    // Step 0: Dictado
    expect(getByText("🎙️ DICTADO INTELIGENTE")).toBeTruthy();
    expect(queryByTestId("btn-prev-onboarding")).toBeNull();

    // Go to Step 1: Calendario
    fireEvent.press(getByTestId("btn-next-onboarding"));
    await waitFor(() => {
      expect(getByText("📅 CALENDARIO Y AGENDA")).toBeTruthy();
      expect(getByTestId("btn-prev-onboarding")).toBeTruthy();
    });

    // Go to Step 2: Tareas
    fireEvent.press(getByTestId("btn-next-onboarding"));
    await waitFor(() => {
      expect(getByText("✅ TAREAS Y PRIORIDADES")).toBeTruthy();
    });

    // Go to Step 3: Avisos (final step)
    fireEvent.press(getByTestId("btn-next-onboarding"));
    await waitFor(() => {
      expect(getByText("🔔 AVISOS Y NOTIFICACIONES")).toBeTruthy();
      expect(getByTestId("btn-finish-onboarding")).toBeTruthy();
      expect(queryByTestId("btn-next-onboarding")).toBeNull();
    });

    // Click finish
    fireEvent.press(getByTestId("btn-finish-onboarding"));
    await waitFor(() => {
      expect(onCloseMock).toHaveBeenCalled();
      expect(isOnboardingCompleted(userId)).toBe(true);
    });
  });

  it("navigates back using the Anterior button", async () => {
    const onCloseMock = jest.fn();
    const { getByTestId, getByText } = await render(
      <OnboardingModal visible={true} onClose={onCloseMock} userId={userId} />,
    );

    // Go to Step 1
    fireEvent.press(getByTestId("btn-next-onboarding"));
    await waitFor(() => {
      expect(getByText("📅 CALENDARIO Y AGENDA")).toBeTruthy();
    });

    // Go back to Step 0
    fireEvent.press(getByTestId("btn-prev-onboarding"));
    await waitFor(() => {
      expect(getByText("🎙️ DICTADO INTELIGENTE")).toBeTruthy();
    });
  });

  it("jumps to step directly via pagination dots", async () => {
    const onCloseMock = jest.fn();
    const { getByTestId, getByText } = await render(
      <OnboardingModal visible={true} onClose={onCloseMock} userId={userId} />,
    );

    fireEvent.press(getByTestId("pagination-dot-2"));
    await waitFor(() => {
      expect(getByText("✅ TAREAS Y PRIORIDADES")).toBeTruthy();
    });

    fireEvent.press(getByTestId("pagination-dot-0"));
    await waitFor(() => {
      expect(getByText("🎙️ DICTADO INTELIGENTE")).toBeTruthy();
    });
  });

  it("skips onboarding when pressing Saltar and marks it completed in storage", async () => {
    const onCloseMock = jest.fn();
    const { getByTestId } = await render(
      <OnboardingModal visible={true} onClose={onCloseMock} userId={userId} />,
    );

    fireEvent.press(getByTestId("btn-skip-onboarding"));
    await waitFor(() => {
      expect(onCloseMock).toHaveBeenCalled();
      expect(isOnboardingCompleted(userId)).toBe(true);
    });
  });

  it("does not render when visible is false", async () => {
    const onCloseMock = jest.fn();
    const { queryByTestId } = await render(
      <OnboardingModal visible={false} onClose={onCloseMock} userId={userId} />,
    );

    expect(queryByTestId("onboarding-modal")).toBeNull();
  });
});
