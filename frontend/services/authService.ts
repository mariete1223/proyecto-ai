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
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } catch (err) {
        console.warn("[Auth] Failed to write localStorage:", err);
      }
    }
  },

  loadSession(): AuthSession | null {
    if (memorySession) return memorySession;
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
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
    if (Platform.OS === "web" && typeof window !== "undefined" && window.localStorage) {
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
}

export async function loginUser(
  baseUrl: string,
  email: string,
  password: string,
  fetchFn?: typeof fetch,
): Promise<AuthResult> {
  const fetchImpl = fetchFn || (globalThis.fetch ? globalThis.fetch.bind(globalThis) : fetch);
  try {
    const res = await fetchImpl(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      const detail = errorData?.detail || `Error de autenticación (HTTP ${res.status})`;
      return { success: false, error: detail };
    }

    const tokenData = (await res.json()) as { access_token: string; token_type: string };

    // Obtain user profile to get userId and email
    const meRes = await fetchImpl(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    let userId = "user-" + email.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
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
    return { success: false, error: `No se pudo conectar con el servidor: ${msg}` };
  }
}

export async function registerUser(
  baseUrl: string,
  email: string,
  password: string,
  fetchFn?: typeof fetch,
): Promise<AuthResult> {
  const fetchImpl = fetchFn || (globalThis.fetch ? globalThis.fetch.bind(globalThis) : fetch);
  try {
    const res = await fetchImpl(`${baseUrl}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      const detail = errorData?.detail || `Error al crear cuenta (HTTP ${res.status})`;
      return { success: false, error: detail };
    }

    const tokenData = (await res.json()) as { access_token: string; token_type: string };

    const meRes = await fetchImpl(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    let userId = "user-" + email.trim().toLowerCase().replace(/[^a-z0-9]/g, "-");
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
    return { success: false, error: `No se pudo conectar con el servidor: ${msg}` };
  }
}
