import { Platform } from "react-native";
import { Category, Entry, Tag } from "../types/domain";

export interface WebApiConfig {
  baseUrl: string;
  token?: string;
  fetchFn?: typeof fetch;
}

export function isWebPlatform(): boolean {
  return Platform.OS === "web";
}

export async function checkBackendHealth(
  config: WebApiConfig,
): Promise<boolean> {
  const fetchImpl = config.fetchFn ?? fetch;
  try {
    const res = await fetchImpl(`${config.baseUrl}/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchWebEntries(
  config: WebApiConfig,
): Promise<{ success: boolean; data?: Entry[]; error?: string }> {
  const fetchImpl = config.fetchFn ?? fetch;
  try {
    const res = await fetchImpl(`${config.baseUrl}/api/v1/entries/`, {
      headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
    });
    if (!res.ok) {
      return {
        success: false,
        error: `Error al cargar entradas: HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as Entry[];
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? `Servidor backend privado no disponible: ${err.message}`
          : "Servidor backend privado no disponible. En la versión web, las operaciones requieren conexión directa al backend FastAPI.",
    };
  }
}

export async function fetchWebCategories(
  config: WebApiConfig,
): Promise<{ success: boolean; data?: Category[]; error?: string }> {
  const fetchImpl = config.fetchFn ?? fetch;
  try {
    const res = await fetchImpl(`${config.baseUrl}/api/v1/categories/`, {
      headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
    });
    if (!res.ok) {
      return {
        success: false,
        error: `Error al cargar categorías: HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as Category[];
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Servidor backend privado no disponible.",
    };
  }
}

export async function fetchWebTags(
  config: WebApiConfig,
): Promise<{ success: boolean; data?: Tag[]; error?: string }> {
  const fetchImpl = config.fetchFn ?? fetch;
  try {
    const res = await fetchImpl(`${config.baseUrl}/api/v1/tags/`, {
      headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
    });
    if (!res.ok) {
      return { success: false, error: `Error HTTP ${res.status}` };
    }
    const data = (await res.json()) as Tag[];
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Servidor backend privado no disponible.",
    };
  }
}
