import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { AuthModal } from "./AuthModal";
import * as authService from "../services/authService";

describe("AuthModal", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("renders login inputs and title correctly", async () => {
    const { getByText, getByPlaceholderText } = await render(
      <AuthModal
        visible={true}
        baseUrl="http://localhost:8000"
        onSuccess={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(
      getByText(
        "Tus recuerdos y tareas se guardan de forma 100% privada y aislada en tu cuenta personal.",
      ),
    ).toBeTruthy();
    expect(getByPlaceholderText("tu@email.com")).toBeTruthy();
    expect(getByPlaceholderText("Mínimo 8 caracteres")).toBeTruthy();
  });

  it("switches to registration mode", async () => {
    const { getAllByText, getByTestId } = await render(
      <AuthModal
        visible={true}
        baseUrl="http://localhost:8000"
        onSuccess={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("modal-tab-register"));
    });

    await waitFor(() => {
      expect(getAllByText("Crear Cuenta").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("validates empty email", async () => {
    const { getByText, getByTestId } = await render(
      <AuthModal
        visible={true}
        baseUrl="http://localhost:8000"
        onSuccess={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("modal-btn-submit"));
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
      <AuthModal
        visible={true}
        baseUrl="http://localhost:8000"
        onSuccess={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.press(getByTestId("modal-tab-register"));
    });

    const emailInput = getByPlaceholderText("tu@email.com");
    const passwordInput = getByPlaceholderText("Mínimo 8 caracteres");

    await act(async () => {
      fireEvent.changeText(emailInput, "modaluser@example.com");
      fireEvent.changeText(passwordInput, "StrongPassword123!");
    });

    await act(async () => {
      fireEvent.press(getByTestId("modal-btn-submit"));
    });

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalled();
      expect(getByText(/revisa tu correo electrónico/i)).toBeTruthy();
      expect(getByTestId("modal-input-verify-token")).toBeTruthy();
    });
  });

  it("shows unverified error and handles resend verification", async () => {
    const loginSpy = jest
      .spyOn(authService, "loginUser")
      .mockResolvedValueOnce({
        success: false,
        error: "Email address is not verified.",
        isUnverified: true,
      });
    const resendSpy = jest
      .spyOn(authService, "resendVerification")
      .mockResolvedValueOnce({
        success: true,
        message: "Correo reenviado.",
      });

    const { getByText, getByPlaceholderText, getByTestId } = await render(
      <AuthModal
        visible={true}
        baseUrl="http://localhost:8000"
        onSuccess={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    const emailInput = getByPlaceholderText("tu@email.com");
    const passwordInput = getByPlaceholderText("Mínimo 8 caracteres");

    await act(async () => {
      fireEvent.changeText(emailInput, "unverified@example.com");
      fireEvent.changeText(passwordInput, "Password123!");
    });

    await act(async () => {
      fireEvent.press(getByTestId("modal-btn-submit"));
    });

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalled();
      expect(getByTestId("btn-resend-verification")).toBeTruthy();
      expect(getByTestId("modal-input-verify-token")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-resend-verification"));
    });

    await waitFor(() => {
      expect(resendSpy).toHaveBeenCalledWith(
        "http://localhost:8000",
        "unverified@example.com",
      );
      expect(getByText(/Correo reenviado/i)).toBeTruthy();
    });
  });

  it("calls onContinueOffline when guest/offline button is pressed in AuthModal", async () => {
    const offlineMock = jest.fn();
    const { getByTestId } = await render(
      <AuthModal
        visible={true}
        baseUrl="http://localhost:8000"
        onSuccess={jest.fn()}
        onClose={jest.fn()}
        onContinueOffline={offlineMock}
      />,
    );

    const guestBtn = getByTestId("modal-btn-continue-offline");
    expect(guestBtn).toBeTruthy();

    await act(async () => {
      fireEvent.press(guestBtn);
    });

    expect(offlineMock).toHaveBeenCalledTimes(1);
  });
});
