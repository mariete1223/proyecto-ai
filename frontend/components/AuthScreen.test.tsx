import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { AuthScreen } from "./AuthScreen";

describe("AuthScreen Component", () => {
  it("renders branding, login title, and input fields", async () => {
    const { getByText, getByPlaceholderText, getByTestId } = await render(
      <AuthScreen baseUrl="http://localhost:8000" onSuccess={jest.fn()} />,
    );

    expect(getByTestId("auth-screen")).toBeTruthy();
    expect(getByText("Proyecto AI")).toBeTruthy();
    expect(getByText("Personal Knowledge Hub")).toBeTruthy();
    expect(getByPlaceholderText("tu@email.com")).toBeTruthy();
    expect(getByPlaceholderText("Mínimo 8 caracteres")).toBeTruthy();
    expect(getByText("Acceder")).toBeTruthy();
  });

  it("switches to registration mode", async () => {
    const { getAllByText, getByText } = await render(
      <AuthScreen baseUrl="http://localhost:8000" onSuccess={jest.fn()} />,
    );

    const registerTab = getByText("Registrarse");
    fireEvent.press(registerTab);

    await waitFor(() => {
      expect(getAllByText("Crear Cuenta").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("validates empty or invalid email", async () => {
    const { getByText } = await render(
      <AuthScreen baseUrl="http://localhost:8000" onSuccess={jest.fn()} />,
    );

    const submitBtn = getByText("Acceder");
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(
        getByText("Por favor, introduce un correo electrónico válido."),
      ).toBeTruthy();
    });
  });
});
