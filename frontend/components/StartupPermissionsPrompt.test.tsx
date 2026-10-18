import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { notificationService } from "../services/notificationService";
import {
  STARTUP_PERMS_STORAGE_KEY,
  StartupPermissionsPrompt,
} from "./StartupPermissionsPrompt";

describe("StartupPermissionsPrompt Component (#77, #78)", () => {
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
    jest.clearAllMocks();
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  });

  it("renders when forceVisible is true", async () => {
    const { getByTestId, getByText } = await render(
      <StartupPermissionsPrompt forceVisible={true} />,
    );

    expect(getByTestId("startup-permissions-prompt-container")).toBeTruthy();
    expect(
      getByText("Activa las Notificaciones y el Dictado por Voz"),
    ).toBeTruthy();
    expect(getByTestId("btn-grant-startup-permissions")).toBeTruthy();
    expect(getByTestId("btn-dismiss-startup-permissions")).toBeTruthy();
    expect(getByTestId("btn-close-startup-permissions")).toBeTruthy();
  });

  it("handles user granting permissions", async () => {
    const requestNotifSpy = jest
      .spyOn(notificationService, "requestPermissions")
      .mockResolvedValue("granted");

    const onCompleteMock = jest.fn();

    const { getByTestId, findByText } = await render(
      <StartupPermissionsPrompt
        forceVisible={true}
        onComplete={onCompleteMock}
        backendUrl="http://localhost:8000"
        token="test-jwt-token"
      />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("btn-grant-startup-permissions"));
    });

    expect(requestNotifSpy).toHaveBeenCalled();
    expect(
      await findByText("✅ ¡Permisos activados para avisos y voz!"),
    ).toBeTruthy();

    await waitFor(
      () => {
        expect(onCompleteMock).toHaveBeenCalled();
      },
      { timeout: 2500 },
    );

    expect(mockStorage[STARTUP_PERMS_STORAGE_KEY]).toBe("true");
  });

  it("handles user dismissing the prompt with 'Ahora no'", async () => {
    const onCompleteMock = jest.fn();

    const { getByTestId, queryByTestId } = await render(
      <StartupPermissionsPrompt
        forceVisible={true}
        onComplete={onCompleteMock}
      />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("btn-dismiss-startup-permissions"));
    });

    expect(queryByTestId("startup-permissions-prompt-container")).toBeNull();
    expect(onCompleteMock).toHaveBeenCalledTimes(1);
    expect(mockStorage[STARTUP_PERMS_STORAGE_KEY]).toBe("true");
  });

  it("handles user dismissing via quick close '✕' button (#78)", async () => {
    const onCompleteMock = jest.fn();

    const { getByTestId, queryByTestId } = await render(
      <StartupPermissionsPrompt
        forceVisible={true}
        onComplete={onCompleteMock}
      />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("btn-close-startup-permissions"));
    });

    expect(queryByTestId("startup-permissions-prompt-container")).toBeNull();
    expect(onCompleteMock).toHaveBeenCalledTimes(1);
    expect(mockStorage[STARTUP_PERMS_STORAGE_KEY]).toBe("true");
  });

  it("allows dismissing with 'Ahora no' even when request is pending (#78)", async () => {
    jest
      .spyOn(notificationService, "requestPermissions")
      .mockImplementation(() => new Promise(() => {})); // Never resolves

    const onCompleteMock = jest.fn();

    const { getByTestId, queryByTestId } = await render(
      <StartupPermissionsPrompt
        forceVisible={true}
        onComplete={onCompleteMock}
      />,
    );

    // Click grant -> becomes isRequesting
    await act(async () => {
      fireEvent.press(getByTestId("btn-grant-startup-permissions"));
    });

    // Dismiss button must NOT be disabled and can be pressed
    const dismissBtn = getByTestId("btn-dismiss-startup-permissions");
    expect(dismissBtn.props.accessibilityState?.disabled).not.toBe(true);

    await act(async () => {
      fireEvent.press(dismissBtn);
    });

    expect(queryByTestId("startup-permissions-prompt-container")).toBeNull();
    expect(onCompleteMock).toHaveBeenCalledTimes(1);
    expect(mockStorage[STARTUP_PERMS_STORAGE_KEY]).toBe("true");
  });

  it("does not render if already dismissed in localStorage and forceVisible is false", async () => {
    mockStorage[STARTUP_PERMS_STORAGE_KEY] = "true";

    const { queryByTestId } = await render(
      <StartupPermissionsPrompt forceVisible={false} />,
    );

    expect(queryByTestId("startup-permissions-prompt-container")).toBeNull();
  });

  it("does not render if notification permission is already granted", async () => {
    jest
      .spyOn(notificationService, "getPermissionStatus")
      .mockReturnValue("granted");

    const { queryByTestId } = await render(
      <StartupPermissionsPrompt forceVisible={false} />,
    );

    expect(queryByTestId("startup-permissions-prompt-container")).toBeNull();
  });
});
