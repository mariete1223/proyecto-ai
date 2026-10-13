import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { AuthModal } from "./AuthModal";

describe("AuthModal", () => {
  it("renders login inputs and title correctly", async () => {
    const { getByText, getByPlaceholderText } = await render(
      <AuthModal
        visible={true}
        baseUrl="http://localhost:8000"
        onSuccess={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(getByText("Tus recuerdos y tareas se guardan de forma 100% privada y aislada en tu cuenta personal.")).toBeTruthy();
    expect(getByPlaceholderText("tu@email.com")).toBeTruthy();
    expect(getByPlaceholderText("Mínimo 8 caracteres")).toBeTruthy();
  });

  it("switches to registration mode", async () => {
    const { getAllByText, getByText } = await render(
      <AuthModal
        visible={true}
        baseUrl="http://localhost:8000"
        onSuccess={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    const registerTab = getByText("Registrarse");
    fireEvent.press(registerTab);

    await waitFor(() => {
      expect(getAllByText("Crear Cuenta").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("validates empty email", async () => {
    const { getByText } = await render(
      <AuthModal
        visible={true}
        baseUrl="http://localhost:8000"
        onSuccess={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    const submitBtn = getByText("Acceder");
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(getByText("Por favor, introduce un correo electrónico válido.")).toBeTruthy();
    });
  });
});
