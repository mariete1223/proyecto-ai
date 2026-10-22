import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { AuthScreen } from "./AuthScreen";
import * as authService from "../services/authService";

describe("AuthScreen Component", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("renders branding, login title, and input fields", async () => {
    const { getByText, getByPlaceholderText, getByTestId } = await render(
      <AuthScreen baseUrl="http://localhost:8000" onSuccess={jest.fn()} />,
    );

    expect(getByTestId("auth-screen")).toBeTruthy();
    expect(getByText("VoxDaily")).toBeTruthy();
    expect(getByText("Voice Journal & Calendar")).toBeTruthy();
    expect(getByPlaceholderText("tu@email.com")).toBeTruthy();
    expect(getByPlaceholderText("Mínimo 8 caracteres")).toBeTruthy();
    expect(getByText("Acceder")).toBeTruthy();
  });

  it("switches to registration mode", async () => {
    const { getAllByText, getByTestId } = await render(
      <AuthScreen baseUrl="http://localhost:8000" onSuccess={jest.fn()} />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("tab-auth-register"));
    });

    await waitFor(() => {
      expect(getAllByText("Crear Cuenta").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("validates empty or invalid email", async () => {
    const { getByText, getByTestId } = await render(
      <AuthScreen baseUrl="http://localhost:8000" onSuccess={jest.fn()} />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("auth-btn-submit"));
    });

    await waitFor(() => {
      expect(
        getByText("Por favor, introduce un correo electrónico válido."),
      ).toBeTruthy();
    });
  });

  it("shows confirmation instruction banner upon successful registration", async () => {
    const registerSpy = jest
      .spyOn(authService, "registerUser")
      .mockResolvedValueOnce({
        success: true,
        message:
          "Cuenta creada con éxito. Por favor, revisa tu correo electrónico para verificar tu cuenta antes de iniciar sesión.",
      });

    const { getByText, getByPlaceholderText, getByTestId } = await render(
      <AuthScreen baseUrl="http://localhost:8000" onSuccess={jest.fn()} />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("tab-auth-register"));
    });

    const emailInput = getByPlaceholderText("tu@email.com");
    const passwordInput = getByPlaceholderText("Mínimo 8 caracteres");

    await act(async () => {
      fireEvent.changeText(emailInput, "newuser@example.com");
      fireEvent.changeText(passwordInput, "StrongPassword123!");
    });

    await act(async () => {
      fireEvent.press(getByTestId("auth-btn-submit"));
    });

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalled();
      expect(getByTestId("auth-info-banner")).toBeTruthy();
      expect(getByText(/revisa tu correo electrónico/i)).toBeTruthy();
      expect(getByTestId("auth-input-verify-token")).toBeTruthy();
    });
  });

  it("displays unverified error banner and resend button when account is not verified", async () => {
    const loginSpy = jest
      .spyOn(authService, "loginUser")
      .mockResolvedValueOnce({
        success: false,
        error: "Email address is not verified. Please check your inbox.",
        isUnverified: true,
      });
    const resendSpy = jest
      .spyOn(authService, "resendVerification")
      .mockResolvedValueOnce({
        success: true,
        message: "Correo de confirmación enviado.",
      });

    const { getByPlaceholderText, getByTestId } = await render(
      <AuthScreen baseUrl="http://localhost:8000" onSuccess={jest.fn()} />,
    );

    const emailInput = getByPlaceholderText("tu@email.com");
    const passwordInput = getByPlaceholderText("Mínimo 8 caracteres");

    await act(async () => {
      fireEvent.changeText(emailInput, "unverified@example.com");
      fireEvent.changeText(passwordInput, "ValidPassword123!");
    });

    await act(async () => {
      fireEvent.press(getByTestId("auth-btn-submit"));
    });

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalled();
      expect(getByTestId("auth-error-banner")).toBeTruthy();
      expect(getByTestId("btn-resend-verification")).toBeTruthy();
      expect(getByTestId("auth-input-verify-token")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-resend-verification"));
    });

    await waitFor(() => {
      expect(resendSpy).toHaveBeenCalledWith(
        "http://localhost:8000",
        "unverified@example.com",
      );
      expect(getByTestId("auth-info-banner")).toBeTruthy();
    });
  });

  it("does not render a verify tab in the top tab bar", async () => {
    const { queryByTestId, getByTestId } = await render(
      <AuthScreen baseUrl="http://localhost:8000" onSuccess={jest.fn()} />,
    );

    expect(getByTestId("tab-auth-login")).toBeTruthy();
    expect(getByTestId("tab-auth-register")).toBeTruthy();
    expect(queryByTestId("tab-auth-verify")).toBeNull();
  });

  it("allows opening verification modal and verifying a token", async () => {
    const verifySpy = jest
      .spyOn(authService, "verifyEmail")
      .mockResolvedValueOnce({
        success: true,
        message: "Cuenta verificada exitosamente.",
      });

    const { getByPlaceholderText, getByTestId } = await render(
      <AuthScreen baseUrl="http://localhost:8000" onSuccess={jest.fn()} />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("btn-open-verify-modal"));
    });

    let tokenInput: any;
    await waitFor(() => {
      tokenInput = getByTestId("auth-input-verify-token");
      expect(tokenInput).toBeTruthy();
    });

    await act(async () => {
      fireEvent.changeText(tokenInput, "valid-token-123");
    });

    await act(async () => {
      fireEvent.press(getByTestId("auth-btn-verify-token"));
    });

    await waitFor(() => {
      expect(verifySpy).toHaveBeenCalledWith(
        "http://localhost:8000",
        "valid-token-123",
      );
    });
  });

  it("does not render an offline button on the screen", async () => {
    const { queryByTestId } = await render(
      <AuthScreen baseUrl="http://localhost:8000" onSuccess={jest.fn()} />,
    );

    expect(queryByTestId("btn-continue-offline")).toBeNull();
  });

  it("calls onOfflineDetected when a network connection error occurs during login", async () => {
    const offlineMock = jest.fn();
    jest
      .spyOn(authService, "loginUser")
      .mockRejectedValueOnce(new Error("Failed to fetch"));

    const { getByPlaceholderText, getByTestId } = await render(
      <AuthScreen
        baseUrl="http://localhost:8000"
        onSuccess={jest.fn()}
        onOfflineDetected={offlineMock}
      />,
    );

    await act(async () => {
      fireEvent.changeText(
        getByPlaceholderText("tu@email.com"),
        "offline@example.com",
      );
      fireEvent.changeText(
        getByPlaceholderText("Mínimo 8 caracteres"),
        "password123",
      );
    });

    await act(async () => {
      fireEvent.press(getByTestId("auth-btn-submit"));
    });

    await waitFor(() => {
      expect(offlineMock).toHaveBeenCalledTimes(1);
    });
  });

  it("completes full flow: registration opens modal, user can dismiss it, and unverified login reopens it", async () => {
    jest.spyOn(authService, "registerUser").mockResolvedValueOnce({
      success: true,
      message: "Cuenta creada exitosamente. Revisa tu correo.",
    });

    const screen = await render(
      <AuthScreen baseUrl="http://localhost:8000" onSuccess={jest.fn()} />,
    );

    // Switch to register tab
    await act(async () => {
      fireEvent.press(screen.getByTestId("tab-auth-register"));
    });

    const emailInput = screen.getByPlaceholderText("tu@email.com");
    const passwordInput = screen.getByPlaceholderText("Mínimo 8 caracteres");

    await act(async () => {
      fireEvent.changeText(emailInput, "flowuser@example.com");
      fireEvent.changeText(passwordInput, "SecretPassword123!");
    });

    // Submit registration
    await act(async () => {
      fireEvent.press(screen.getByTestId("auth-btn-submit"));
    });

    // 1. Modal opens upon registration
    await waitFor(() => {
      expect(screen.getByTestId("verification-modal-card")).toBeTruthy();
      expect(screen.getByText("Verifica tu cuenta")).toBeTruthy();
    });

    // 2. User dismisses the modal ("si la cierra y no lo hace, perfecto")
    await act(async () => {
      fireEvent.press(screen.getByTestId("btn-dismiss-verification"));
    });

    await waitFor(() => {
      expect(screen.queryByTestId("verification-modal-card")).toBeNull();
    });

    // 3. User attempts to login without having verified
    jest.spyOn(authService, "loginUser").mockResolvedValueOnce({
      success: false,
      error: "Cuenta no verificada.",
      isUnverified: true,
    });

    const loginPasswordInput = screen.getByPlaceholderText(
      "Mínimo 8 caracteres",
    );
    await act(async () => {
      fireEvent.changeText(loginPasswordInput, "SecretPassword123!");
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId("auth-btn-submit"));
    });

    // 4. Modal reopens automatically
    await waitFor(() => {
      expect(screen.getByTestId("verification-modal-card")).toBeTruthy();
      expect(screen.getByText("Verifica tu cuenta")).toBeTruthy();
    });

    screen.unmount();
  });
});
