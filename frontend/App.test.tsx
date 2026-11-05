import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import React from "react";
import App from "./App";
import { authStorage } from "./services/authService";
import * as syncEngineModule from "./services/syncEngine";
import * as webApi from "./services/webApi";

describe("App", () => {
  beforeEach(() => {
    jest.spyOn(webApi, "checkBackendHealth").mockResolvedValue(true);
    authStorage.saveSession({
      token: "test-mock-token",
      email: "tester@voxdaily.com",
      userId: "user-test-app",
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    authStorage.clearSession();
  });

  it("renders the starter screen", async () => {
    const { findByText } = await render(<App />);

    expect(await findByText("VoxDaily")).toBeTruthy();
  });

  it("navigates to calendar tab after manual entry is created (#87)", async () => {
    const { getByText, getByTestId, findByTestId, queryByTestId } =
      await render(<App />);

    // Tap writing/manual entry button from mobile home
    const manualBtn = await findByTestId("btn-mobile-manual-entry");
    await act(async () => {
      fireEvent.press(manualBtn);
    });

    // Entry form modal should be visible
    expect(await findByTestId("entry-form-container")).toBeTruthy();

    // Wait for categories to finish loading
    await waitFor(() => {
      expect(getByText("Notas")).toBeTruthy();
    });

    // Fill in content
    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-content"),
        "Nueva tarea de prueba para el calendario",
      );
    });

    // Save
    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-entry"));
    });

    // Modal should close and active view should navigate to calendar (#87)
    await waitFor(() => {
      expect(queryByTestId("entry-form-container")).toBeNull();
      expect(getByTestId("calendar-month-view")).toBeTruthy();
    });
  });

  it("navigates to calendar tab and automatically opens the entry's day detail panel (#105)", async () => {
    const { getByText, getByTestId, findByTestId, queryByTestId } =
      await render(<App />);

    const manualBtn = await findByTestId("btn-mobile-manual-entry");
    await act(async () => {
      fireEvent.press(manualBtn);
    });

    expect(await findByTestId("entry-form-container")).toBeTruthy();

    await waitFor(() => {
      expect(getByText("Notas")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-content"),
        "Cita con el dentista en el calendario",
      );
      fireEvent.press(getByTestId("preset-now"));
    });

    await act(async () => {
      fireEvent.press(getByTestId("btn-submit-entry"));
    });

    await waitFor(() => {
      expect(queryByTestId("entry-form-container")).toBeNull();
      expect(getByTestId("calendar-month-view")).toBeTruthy();
      expect(getByTestId("day-detail-panel")).toBeTruthy();
      expect(getByText(/Cita con el dentista en el calendario/)).toBeTruthy();
    });
  });

  it("renders AuthScreen when unauthenticated and backend connection is healthy", async () => {
    authStorage.clearSession();
    jest.spyOn(webApi, "checkBackendHealth").mockResolvedValueOnce(true);

    const { getByTestId, queryByTestId } = await render(<App />);

    await waitFor(() => {
      expect(getByTestId("auth-screen")).toBeTruthy();
      expect(queryByTestId("offline-notice-modal")).toBeNull();
    });
  });

  it("renders AuthScreen without bypassing to guest mode when backend health fails but device is online (#131)", async () => {
    authStorage.clearSession();
    jest.spyOn(webApi, "checkBackendHealth").mockResolvedValueOnce(false);

    const { getByTestId, queryByTestId } = await render(<App />);

    await waitFor(() => {
      expect(getByTestId("auth-screen")).toBeTruthy();
      expect(queryByTestId("offline-notice-modal")).toBeNull();
    });
  });

  it("automatically enters offline mode and displays OfflineNoticeModal when device has no internet connection (navigator.onLine = false) (#131)", async () => {
    authStorage.clearSession();
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    try {
      jest.spyOn(webApi, "checkBackendHealth").mockResolvedValueOnce(false);

      const { findByTestId, getByTestId } = await render(<App />);

      expect(await findByTestId("offline-notice-modal")).toBeTruthy();
      expect(getByTestId("banner-offline-mode")).toBeTruthy();
    } finally {
      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        value: originalOnLine,
      });
    }
  });

  it("renders mobile main layout immediately with local data during cold start without blocking on loading screen (#154)", async () => {
    let resolveHealth: (val: boolean) => void = () => {};
    const healthPromise = new Promise<boolean>((res) => {
      resolveHealth = res;
    });
    jest
      .spyOn(webApi, "checkBackendHealth")
      .mockImplementation(() => healthPromise);

    const { getByTestId, queryByTestId, getByText } = await render(<App />);

    // Fast-forward past the 1300ms (previous cold timer threshold)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1300));
    });

    // Invariante Offline-First: la app NO debe quedarse bloqueada en la pantalla de carga
    expect(queryByTestId("loading-screen")).toBeNull();
    expect(getByTestId("mobile-main-layout")).toBeTruthy();
    expect(getByTestId("mobile-voice-capture-container")).toBeTruthy();

    // Navegar a la pestaña de calendario para confirmar que las vistas locales están operativas
    await act(async () => {
      fireEvent.press(getByTestId("mobile-tab-calendar"));
    });
    expect(getByTestId("calendar-month-view")).toBeTruthy();

    // Estado no bloqueante: mientras no responda, muestra "Conectando..." o chip correspondiente
    expect(getByText(/Conectando...|Offline/)).toBeTruthy();

    // Cuando el backend despierta en segundo plano
    await act(async () => {
      resolveHealth(true);
    });

    await waitFor(() => {
      expect(getByText("Online")).toBeTruthy();
    });
  });

  it("allows bypassing cold-start loading screen via bypass button if cold-start loader is active (#154)", async () => {
    authStorage.clearSession();
    let resolveHealth: (val: boolean) => void = () => {};
    const healthPromise = new Promise<boolean>((res) => {
      resolveHealth = res;
    });
    jest
      .spyOn(webApi, "checkBackendHealth")
      .mockImplementationOnce(() => healthPromise);

    const { getByTestId, queryByTestId, findByTestId } = await render(<App />);

    // Avanzar más allá de los 1200ms para que aparezca la pantalla con aviso de arranque en frío
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1300));
    });

    const bypassBtn = await findByTestId("btn-bypass-cold-start");
    expect(bypassBtn).toBeTruthy();

    // Pulsar el botón de bypass para continuar en local
    await act(async () => {
      fireEvent.press(bypassBtn);
    });

    // Pantalla de carga desmontada y vista principal accesible de inmediato
    await waitFor(() => {
      expect(queryByTestId("loading-screen")).toBeNull();
      expect(getByTestId("mobile-main-layout")).toBeTruthy();
    });
  });

  it("triggers silent background sync and updates connection status to online when backend wakes up (#154)", async () => {
    let resolveHealth: (val: boolean) => void = () => {};
    const healthPromise = new Promise<boolean>((res) => {
      resolveHealth = res;
    });
    jest
      .spyOn(webApi, "checkBackendHealth")
      .mockImplementation(() => healthPromise);

    const syncSpy = jest
      .spyOn(syncEngineModule, "performSync")
      .mockResolvedValueOnce({
        success: true,
        pushed_applied: 0,
        pushed_conflicts: 0,
        pushed_errors: 0,
        pulled_changes: 0,
        pulled_tombstones: 0,
      });

    const { getByTestId, getByText } = await render(<App />);

    expect(getByTestId("mobile-main-layout")).toBeTruthy();

    // Backend despierta y resuelve la promesa de salud
    await act(async () => {
      resolveHealth(true);
    });

    await waitFor(() => {
      expect(getByText("Online")).toBeTruthy();
      expect(syncSpy).toHaveBeenCalled();
    });
  });

  it("does not disrupt active form when backend wakes up and triggers background sync (#154)", async () => {
    let resolveHealth: (val: boolean) => void = () => {};
    const healthPromise = new Promise<boolean>((res) => {
      resolveHealth = res;
    });
    jest
      .spyOn(webApi, "checkBackendHealth")
      .mockImplementation(() => healthPromise);

    const { getByTestId, findByTestId, queryByTestId, getByText } =
      await render(<App />);

    // Abrir formulario manual de entrada
    const manualBtn = await findByTestId("btn-mobile-manual-entry");
    await act(async () => {
      fireEvent.press(manualBtn);
    });

    expect(await findByTestId("entry-form-container")).toBeTruthy();

    // Escribir borrador en el input
    await act(async () => {
      fireEvent.changeText(
        getByTestId("input-content"),
        "Borrador en edición que no debe perderse",
      );
    });

    // Despertar el servidor en segundo plano
    await act(async () => {
      resolveHealth(true);
    });

    // El formulario no debe cerrarse ni limpiarse el contenido editado
    await waitFor(() => {
      expect(getByTestId("entry-form-container")).toBeTruthy();
      expect(queryByTestId("entry-form-container")).not.toBeNull();
      expect(getByTestId("input-content").props.value).toBe(
        "Borrador en edición que no debe perderse",
      );
    });
  });
});
