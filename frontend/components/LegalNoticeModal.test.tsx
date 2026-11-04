import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { LegalNoticeModal } from "./LegalNoticeModal";

describe("LegalNoticeModal", () => {
  test("renders privacy policy and terms and switches tabs", async () => {
    const handleClose = jest.fn();
    const { getByTestId, getByText } = await render(
      <LegalNoticeModal visible={true} onClose={handleClose} />,
    );

    expect(getByTestId("legal-notice-modal")).toBeTruthy();
    expect(getByText("🛡️ Política de Privacidad")).toBeTruthy();
    expect(getByText(/Compromiso de Privacidad/)).toBeTruthy();

    // Switch to Terms of Service tab
    await act(async () => {
      fireEvent.press(getByTestId("tab-legal-terms"));
    });
    expect(getByText("📜 Términos del Servicio")).toBeTruthy();
    expect(getByText(/Aceptación de los Términos/)).toBeTruthy();

    // Switch back to Privacy tab
    await act(async () => {
      fireEvent.press(getByTestId("tab-legal-privacy"));
    });
    expect(getByText("🛡️ Política de Privacidad")).toBeTruthy();

    // Close modal
    await act(async () => {
      fireEvent.press(getByTestId("btn-accept-legal-modal"));
    });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
