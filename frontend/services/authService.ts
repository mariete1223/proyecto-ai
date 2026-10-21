import { Platform } from "react-native";

export interface AuthSession {
  token: string;
  email: string;
  userId: string;
}

const STORAGE_KEY = "proyecto_ai_auth_session";

// Fallback in-memory session for test / native environments without persistent storage
let memorySession: AuthSession | null = null;

export const authStorage = {
  saveSession(session: AuthSession): void {
    memorySession = session;
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      window.localStorage
    ) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } catch (err) {
        console.warn("[Auth] Failed to write localStorage:", err);
      }
    }
  },

  loadSession(): AuthSession | null {
    if (memorySession) return memorySession;
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      window.localStorage
    ) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.token && parsed?.email) {
            memorySession = parsed;
            return parsed;
          }
        }
      } catch (err) {
        console.warn("[Auth] Failed to read localStorage:", err);
      }
    }
    return null;
  },

  clearSession(): void {
    memorySession = null;
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      window.localStorage
    ) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        console.warn("[Auth] Failed to clear localStorage:", err);
      }
    }
  },
};

export interface AuthResult {
  success: boolean;
  session?: AuthSession;
  error?: string;
  isUnverified?: boolean;
  message?: string;
}

export async function loginUser(
  baseUrl: string,
  email: string,
  password: string,
  fetchFn?: typeof fetch,
): Promise<AuthResult> {
  const fetchImpl =
    fetchFn || (globalThis.fetch ? globalThis.fetch.bind(globalThis) : fetch);
  try {
    const res = await fetchImpl(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      const detail =
        errorData?.detail || `Error de autenticación (HTTP ${res.status})`;
      const isUnverified =
        res.status === 403 ||
        detail.toLowerCase().includes("not verified") ||
        detail.toLowerCase().includes("no verificado");
      return { success: false, error: detail, isUnverified };
    }

    const tokenData = (await res.json()) as {
      access_token: string;
      token_type: string;
    };

    // Obtain user profile to get userId and email
    const meRes = await fetchImpl(`${baseUrl}/api/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "ngrok-skip-browser-warning": "true",
      },
    });

    let userId =
      "user-" +
      email
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-");
    let verifiedEmail = email.trim();

    if (meRes.ok) {
      const meData = (await meRes.json()) as { id: string; email: string };
      userId = meData.id;
      verifiedEmail = meData.email;
    }

    const session: AuthSession = {
      token: tokenData.access_token,
      email: verifiedEmail,
      userId,
    };

    authStorage.saveSession(session);
    return { success: true, session };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `No se pudo conectar con el servidor: ${msg}`,
    };
  }
}

export async function registerUser(
  baseUrl: string,
  email: string,
  password: string,
  fetchFn?: typeof fetch,
): Promise<AuthResult> {
  const fetchImpl =
    fetchFn || (globalThis.fetch ? globalThis.fetch.bind(globalThis) : fetch);
  try {
    const res = await fetchImpl(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      const detail =
        errorData?.detail || `Error al crear cuenta (HTTP ${res.status})`;
      return { success: false, error: detail };
    }

    const data = (await res.json()) as {
      message?: string;
      email?: string;
    };

    return {
      success: true,
      message:
        data.message ||
        "Cuenta creada con éxito. Por favor, revisa tu correo electrónico para verificar tu cuenta antes de iniciar sesión.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `No se pudo conectar con el servidor: ${msg}`,
    };
  }
}

export async function verifyEmail(
  baseUrl: string,
  token: string,
  fetchFn?: typeof fetch,
): Promise<{ success: boolean; message?: string; error?: string }> {
  const fetchImpl =
    fetchFn || (globalThis.fetch ? globalThis.fetch.bind(globalThis) : fetch);
  try {
    const res = await fetchImpl(`${baseUrl}/api/v1/auth/verify-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({ token: token.trim() }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail =
        data?.detail || `Error al verificar cuenta (HTTP ${res.status})`;
      return { success: false, error: detail };
    }

    return {
      success: true,
      message:
        data?.message ||
        "Correo verificado correctamente. Ya puedes iniciar sesión.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `No se pudo conectar con el servidor: ${msg}`,
    };
  }
}

export async function resendVerification(
  baseUrl: string,
  email: string,
  fetchFn?: typeof fetch,
): Promise<{ success: boolean; message?: string; error?: string }> {
  const fetchImpl =
    fetchFn || (globalThis.fetch ? globalThis.fetch.bind(globalThis) : fetch);
  try {
    const res = await fetchImpl(`${baseUrl}/api/v1/auth/resend-verification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({ email: email.trim() }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail =
        data?.detail || `Error al reenviar correo (HTTP ${res.status})`;
      return { success: false, error: detail };
    }

    return {
      success: true,
      message:
        data?.message ||
        "Correo de confirmación enviado. Revisa tu bandeja de entrada.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `No se pudo conectar con el servidor: ${msg}`,
    };
  }
}
