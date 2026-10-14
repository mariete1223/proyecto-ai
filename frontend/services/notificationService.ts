import { Platform } from "react-native";
import { DatabaseAdapter } from "../db/database";
import { listLocalEntries } from "../db/entries";
import { Entry, formatOffsetLabel, normalizeUtcIso, ReminderRecurrence } from "../types/domain";

export type { ReminderRecurrence };

export interface NotificationScheduleOptions {
  entryId: string;
  title: string;
  body: string;
  triggerTime: Date;
  recurrence?: ReminderRecurrence | null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const atobFn =
    typeof window !== "undefined" && window.atob
      ? window.atob.bind(window)
      : typeof atob !== "undefined"
        ? atob
        : (b: string) => Buffer.from(b, "base64").toString("binary");
  const rawData = atobFn(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

class NotificationService {
  private activeTimers: Map<string, number[]> = new Map();
  private isInitialized = false;
  private swRegistration: any = null;
  private lastApiBaseUrl: string | null = null;
  private lastToken: string | null = null;
  private notifiedEntryIds: Set<string> = new Set();

  public clearNotifiedHistory(): void {
    this.notifiedEntryIds.clear();
  }

  public setAuth(apiBaseUrl?: string | null, token?: string | null): void {
    if (apiBaseUrl) this.lastApiBaseUrl = apiBaseUrl;
    if (token) this.lastToken = token;
  }

  public async initServiceWorker(): Promise<any> {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        this.swRegistration = reg;
        return reg;
      } catch (err) {
        console.warn("[NotificationService] No se pudo registrar Service Worker:", err);
      }
    }
    return null;
  }

  public isSupported(): boolean {
    if (Platform.OS === "web") {
      return typeof window !== "undefined" && "Notification" in window;
    }
    return false;
  }

  public getPermissionStatus(): "granted" | "denied" | "default" | "unsupported" {
    if (!this.isSupported()) return "unsupported";
    return (Notification.permission as "granted" | "denied" | "default") || "default";
  }

  public async requestPermissions(): Promise<"granted" | "denied" | "default" | "unsupported"> {
    if (!this.isSupported()) return "unsupported";
    try {
      if (typeof Notification.requestPermission === "function") {
        let perm: NotificationPermission = Notification.permission;
        try {
          // Llamada moderna a la Promise nativa de Notification.requestPermission()
          const p = Notification.requestPermission();
          if (p && typeof p.then === "function") {
            perm = await p;
          }
        } catch {
          // Fallback legacy (Safari antiguo basado en callback)
          try {
            perm = await new Promise<NotificationPermission>((resolve) => {
              Notification.requestPermission((result) => resolve(result));
            });
          } catch {
            // ignore
          }
        }
        const status = (perm as "granted" | "denied" | "default") || this.getPermissionStatus();
        if (status === "granted") {
          this.initServiceWorker()
            .then(() => {
              if (this.lastApiBaseUrl && this.lastToken) {
                this.subscribeToWebPush(this.lastApiBaseUrl, this.lastToken).catch(() => {});
              }
            })
            .catch(() => {});
        }
        return status;
      }
    } catch (e) {
      console.warn("[NotificationService] Error solicitando permisos:", e);
    }
    return this.getPermissionStatus();
  }

  public async subscribeToWebPush(apiBaseUrl?: string, token?: string): Promise<boolean> {
    const targetBaseUrl = apiBaseUrl || this.lastApiBaseUrl;
    const targetToken = token || this.lastToken;

    if (!targetBaseUrl || !targetToken) {
      return false;
    }

    if (Platform.OS !== "web" || typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return false;
    }

    try {
      const reg = this.swRegistration || (await this.initServiceWorker());
      if (!reg || !reg.pushManager) {
        console.warn("[NotificationService] pushManager no disponible en este navegador");
        return false;
      }

      // 1. Obtener clave pública VAPID del backend
      const vapidRes = await fetch(`${targetBaseUrl}/api/v1/push/vapid-public-key`);
      if (!vapidRes.ok) {
        console.warn("[NotificationService] Error al obtener vapid-public-key:", vapidRes.status);
        return false;
      }
      const { public_key: vapidPublicKey } = await vapidRes.json();
      if (!vapidPublicKey) {
        return false;
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // 2. Obtener o crear la suscripción push
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      }

      if (!subscription) {
        console.warn("[NotificationService] No se pudo crear la suscripción push");
        return false;
      }

      // 3. Enviar la suscripción al backend
      const subJson = subscription.toJSON();
      const endpoint = subJson.endpoint;
      const keys = subJson.keys;

      if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
        console.warn("[NotificationService] Datos de suscripción push incompletos");
        return false;
      }

      const res = await fetch(`${targetBaseUrl}/api/v1/push/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${targetToken}`,
        },
        body: JSON.stringify({
          endpoint,
          keys: {
            p256dh: keys.p256dh,
            auth: keys.auth,
          },
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        }),
      });

      if (!res.ok) {
        console.warn("[NotificationService] Error registrando suscripción push en el backend:", res.status);
        return false;
      }

      console.info("[NotificationService] Suscripción Web Push registrada con éxito");
      return true;
    } catch (err) {
      console.warn("[NotificationService] Excepción al registrar Web Push:", err);
      return false;
    }
  }

  public playChimeSound(): void {
    try {
      if (typeof window === "undefined") return;

      // Haptic vibration for mobile devices
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try {
          navigator.vibrate([200, 100, 200]);
        } catch {
          // ignore
        }
      }

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      // Harmonie bell chime: E5 (659.25 Hz) -> A5 (880 Hz) -> C#6 (1108.73 Hz)
      const notes = [
        { freq: 659.25, time: now, duration: 0.35, gain: 0.2 },
        { freq: 880.0, time: now + 0.1, duration: 0.45, gain: 0.25 },
        { freq: 1108.73, time: now + 0.22, duration: 0.65, gain: 0.3 },
      ];

      for (const note of notes) {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(note.freq, note.time);

        gainNode.gain.setValueAtTime(0.001, note.time);
        gainNode.gain.exponentialRampToValueAtTime(note.gain, note.time + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, note.time + note.duration);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(note.time);
        osc.stop(note.time + note.duration + 0.05);
      }

      setTimeout(() => {
        try {
          ctx.close();
        } catch {}
      }, 1200);
    } catch (e) {
      console.warn("[NotificationService] Error al reproducir timbre sonoro:", e);
    }
  }

  public sendNotification(title: string, body: string, icon?: string, playSound: boolean = true): boolean {
    if (playSound) {
      this.playChimeSound();
    }

    if (!this.isSupported() || Notification.permission !== "granted") {
      return false;
    }

    try {
      // 1. Prefer Service Worker registration (critical for mobile PWA & Android/iOS)
      if (this.swRegistration && typeof this.swRegistration.showNotification === "function") {
        this.swRegistration.showNotification(title, {
          body,
          icon: icon || "/favicon.ico",
          badge: "/favicon.ico",
          vibrate: [200, 100, 200],
          tag: "agenda-reminder",
          renotify: true,
        });
        return true;
      }

      // 2. Fallback to standard Notification
      const notif = new Notification(title, {
        body,
        icon: icon || "/favicon.ico",
        badge: "/favicon.ico",
      });

      // Optional: focus window on click
      notif.onclick = () => {
        if (typeof window !== "undefined") {
          window.focus();
        }
        notif.close();
      };
      return true;
    } catch (e) {
      console.warn("[NotificationService] Error enviando notificación:", e);
      return false;
    }
  }

  public cancelNotification(entryId: string): void {
    const timerIds = this.activeTimers.get(entryId);
    if (timerIds !== undefined) {
      for (const tid of timerIds) {
        clearTimeout(tid);
      }
      this.activeTimers.delete(entryId);
    }
  }

  public scheduleForEntry(entry: Entry): void {
    this.cancelNotification(entry.id);

    if (!entry.reminder_enabled) {
      return;
    }

    const offsets: number[] =
      entry.reminder_offsets_minutes && entry.reminder_offsets_minutes.length > 0
        ? entry.reminder_offsets_minutes
        : entry.reminder_offset_minutes !== null && entry.reminder_offset_minutes !== undefined
          ? [entry.reminder_offset_minutes]
          : [0];

    const scheduledTimers: number[] = [];

    for (const offsetMins of offsets) {
      let targetDate: Date | null = null;

      if (offsetMins > 0) {
        // Si hay antelación configurada, se calcula restando el offset a la hora del evento
        const baseIso = entry.occurred_at || entry.reminder_time;
        if (baseIso) {
          const norm = normalizeUtcIso(baseIso) || baseIso;
          const baseDate = new Date(norm);
          if (!isNaN(baseDate.getTime())) {
            targetDate = new Date(baseDate.getTime() - offsetMins * 60 * 1000);
          }
        }
      } else {
        // Sin offset: hora exacta programada en reminder_time o a la hora del evento
        const targetIso = entry.reminder_time || entry.occurred_at;
        if (targetIso) {
          const norm = normalizeUtcIso(targetIso) || targetIso;
          const parsed = new Date(norm);
          if (!isNaN(parsed.getTime())) {
            targetDate = parsed;
          }
        }
      }

      if (!targetDate || isNaN(targetDate.getTime())) {
        continue;
      }

      const now = new Date();
      const diffMs = targetDate.getTime() - now.getTime();

      const reminderKey = `${entry.id}-${offsetMins}-${targetDate.toISOString()}`;
      if (this.notifiedEntryIds.has(reminderKey)) {
        continue;
      }

      if (diffMs > 0) {
        // Programar para el futuro
        const notifTitle = entry.title?.trim() || "Recordatorio de Agenda AI";
        const offsetLabel = formatOffsetLabel(offsetMins);
        const prefix = offsetMins > 0 ? `[Aviso: ${offsetLabel}] ` : "";
        const notifBody = `${prefix}${entry.content.trim().substring(0, 120)}`;

        const timerId = window.setTimeout(() => {
          if (this.notifiedEntryIds.has(reminderKey)) {
            return;
          }
          this.notifiedEntryIds.add(reminderKey);

          this.sendNotification(`🔔 ${notifTitle}`, notifBody);

          // Si es recurrente, re-programar para el próximo ciclo
          if (entry.reminder_recurrence && entry.reminder_recurrence !== "NONE") {
            this.scheduleNextRecurrence(entry, targetDate!);
          }
        }, diffMs);

        scheduledTimers.push(timerId);
      } else {
        // Si la hora ya venció (en el pasado o recién transcurrida), NO reproducir notificación local
        // para evitar duplicar alertas que ya fueron entregadas en segundo plano vía Web Push.
        if (entry.reminder_recurrence && entry.reminder_recurrence !== "NONE") {
          this.scheduleNextRecurrence(entry, targetDate);
        }
      }
    }

    if (scheduledTimers.length > 0) {
      this.activeTimers.set(entry.id, scheduledTimers);
    }
  }

  private scheduleNextRecurrence(entry: Entry, lastTargetDate: Date) {
    const offsetMs = (entry.reminder_offset_minutes || 0) * 60 * 1000;
    const baseDate = new Date(lastTargetDate.getTime() + offsetMs);

    const rec = entry.reminder_recurrence || "NONE";
    const hourMatch = rec.match(/^EVERY_(\d+)_HOURS?$/);
    if (hourMatch) {
      const hours = parseInt(hourMatch[1], 10);
      baseDate.setTime(baseDate.getTime() + hours * 3600 * 1000);
    } else if (rec === "DAILY") {
      baseDate.setDate(baseDate.getDate() + 1);
    } else if (rec === "WEEKLY") {
      baseDate.setDate(baseDate.getDate() + 7);
    } else if (rec === "MONTHLY") {
      baseDate.setMonth(baseDate.getMonth() + 1);
    } else {
      this.activeTimers.delete(entry.id);
      return;
    }

    // Cutoff if beyond reminder_end_time
    if (entry.reminder_end_time) {
      const endD = new Date(entry.reminder_end_time);
      if (!isNaN(endD.getTime()) && baseDate.getTime() > endD.getTime()) {
        this.activeTimers.delete(entry.id);
        return;
      }
    }

    const updatedEntry: Entry = {
      ...entry,
      occurred_at: entry.occurred_at ? baseDate.toISOString() : entry.occurred_at,
      reminder_time: baseDate.toISOString(),
    };
    this.scheduleForEntry(updatedEntry);
  }

  public async syncAllReminders(
    db: DatabaseAdapter,
    userId: string,
    apiBaseUrl?: string,
    token?: string,
  ): Promise<void> {
    if (apiBaseUrl) this.lastApiBaseUrl = apiBaseUrl;
    if (token) this.lastToken = token;

    try {
      await this.initServiceWorker();

      if (this.getPermissionStatus() === "granted" && this.lastApiBaseUrl && this.lastToken) {
        this.subscribeToWebPush(this.lastApiBaseUrl, this.lastToken).catch(() => {});
      }

      const entries = await listLocalEntries(db, userId);
      // Cancelar todos y volver a sincronizar
      this.activeTimers.forEach((timers) => timers.forEach((t) => clearTimeout(t)));
      this.activeTimers.clear();

      for (const entry of entries) {
        if (entry.reminder_enabled) {
          this.scheduleForEntry(entry);
        }
      }
      this.isInitialized = true;
    } catch (e) {
      console.warn("[NotificationService] Fallo al sincronizar recordatorios:", e);
    }
  }
}

export const notificationService = new NotificationService();
