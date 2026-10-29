import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { listCategories } from "../db/categories";
import { DatabaseAdapter } from "../db/database";
import {
  createLocalEntry,
  deleteLocalEntry,
  listLocalEntries,
  updateLocalEntry,
  UpdateEntryData,
} from "../db/entries";
import { listTags } from "../db/tags";
import {
  Category,
  Entry,
  ReminderRecurrence,
  Tag,
  TaskPriority,
  TaskStatus,
  formatDateTime,
  formatReminderSummary,
  getEntryDisplayTitle,
  normalizeUtcIso,
  toLocalDateString,
} from "../types/domain";
import { notificationService } from "../services/notificationService";
import { VoiceCaptureFlow } from "./VoiceCaptureFlow";

export interface CalendarMonthViewProps {
  db: DatabaseAdapter;
  userId: string;
  initialDate?: Date;
  initialSelectedDateStr?: string;
  onSelectEntry?: (entryId: string) => void;
  selectedCategoryIds?: string[];
  selectedTagIds?: string[];
  refreshSignal?: number;
  onEntryUpdated?: () => void;
}

function getEntryDateKey(iso?: string | null): string {
  if (!iso) return "";
  const norm = normalizeUtcIso(iso) || iso;
  const d = new Date(norm);
  if (isNaN(d.getTime())) return iso.substring(0, 10);
  return toLocalDateString(d);
}

function matchesCalendarDate(
  entry: Entry,
  targetDateStr: string,
  _currentYear: number,
): boolean {
  if (!entry.occurred_at) return false;
  const origKey = getEntryDateKey(entry.occurred_at);
  if (entry.reminder_recurrence === "YEARLY") {
    return origKey.substring(5) === targetDateStr.substring(5);
  }
  return origKey === targetDateStr;
}

function isCategoryAlert(cat?: Category | null): boolean {
  if (!cat) return false;
  return (
    cat.id === "c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9" ||
    cat.name_normalized === "alerta" ||
    cat.voice_command_normalized === "alerta" ||
    cat.name?.toLowerCase() === "alerta"
  );
}

export function isEntryReminderPending(
  entry: Entry,
  now: Date = new Date(),
  category?: Category | null,
): boolean {
  const isAlert =
    isCategoryAlert(category) ||
    entry.category_id === "c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9";
  const hasReminder = Boolean(entry.reminder_enabled || isAlert);
  if (!hasReminder) return false;

  // Si tiene recurrencia activa (ej. YEARLY, DAILY, etc.)
  if (entry.reminder_recurrence && entry.reminder_recurrence !== "NONE") {
    // Si tiene reminder_end_time y ya venció en el pasado, la recurrencia ya cesó
    if (entry.reminder_end_time) {
      const endD = new Date(entry.reminder_end_time);
      if (!isNaN(endD.getTime()) && endD.getTime() < now.getTime()) {
        return false;
      }
    }
    return true;
  }

  // Recordatorio puntual (sin recurrencia): calcular fecha y hora efectiva del disparo
  const baseIso = entry.reminder_time || entry.occurred_at;
  if (!baseIso) return false;

  const norm = normalizeUtcIso(baseIso) || baseIso;
  const targetDate = new Date(norm);
  if (isNaN(targetDate.getTime())) return false;

  const offsetMins = entry.reminder_offset_minutes ?? 0;
  // La hora de disparo es targetDate menos offset (si offsetMins > 0 y baseIso fue occurred_at)
  let triggerTime = targetDate.getTime();
  if (offsetMins > 0 && entry.occurred_at && baseIso === entry.occurred_at) {
    triggerTime -= offsetMins * 60 * 1000;
  }

  // Si el momento del disparo ya ocurrió en el pasado, no está pendiente
  return triggerTime >= now.getTime();
}

export const MAX_VISIBLE_CALENDAR_DOTS = 2;

export function CalendarMonthView({
  db,
  userId,
  initialDate = new Date(),
  initialSelectedDateStr,
  onSelectEntry,
  selectedCategoryIds,
  selectedTagIds,
  refreshSignal,
  onEntryUpdated,
}: CalendarMonthViewProps) {
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    if (
      initialSelectedDateStr &&
      /^\d{4}-\d{2}-\d{2}$/.test(initialSelectedDateStr)
    ) {
      const [y, m] = initialSelectedDateStr.split("-").map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedDayEntries, setSelectedDayEntries] = useState<{
    dateStr: string;
    items: Entry[];
  } | null>(null);
  const hasAutoSelectedToday = useRef(false);
  const hasAutoSelectedInitialDate = useRef<string | null>(null);
  const lastSelectedDateStrRef = useRef<string | undefined>(
    initialSelectedDateStr,
  );

  useEffect(() => {
    if (
      initialSelectedDateStr &&
      /^\d{4}-\d{2}-\d{2}$/.test(initialSelectedDateStr) &&
      initialSelectedDateStr !== lastSelectedDateStrRef.current
    ) {
      lastSelectedDateStrRef.current = initialSelectedDateStr;
      hasAutoSelectedInitialDate.current = null;
      const [y, m] = initialSelectedDateStr.split("-").map(Number);
      setCurrentDate(new Date(y, m - 1, 1));
    }
  }, [initialSelectedDateStr]);

  const [editingTitleEntryId, setEditingTitleEntryId] = useState<string | null>(
    null,
  );
  const [quickTitleText, setQuickTitleText] = useState<string>("");
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Quick reminder editor states
  const [editingReminderEntryId, setEditingReminderEntryId] = useState<
    string | null
  >(null);
  const [selectedReminderOffset, setSelectedReminderOffset] =
    useState<number>(0);
  const [selectedReminderRecurrence, setSelectedReminderRecurrence] =
    useState<ReminderRecurrence>("NONE");

  // Inline Quick Add form for selected day
  const [showQuickAddForm, setShowQuickAddForm] = useState<boolean>(false);
  const [showQuickVoice, setShowQuickVoice] = useState<boolean>(false);
  const [quickAddCatId, setQuickAddCatId] = useState<string>("");
  const [quickAddTitle, setQuickAddTitle] = useState<string>("");
  const [quickAddContent, setQuickAddContent] = useState<string>("");
  const [quickAddTime, setQuickAddTime] = useState<string>("12:00");
  const [quickAddReminderEnabled, setQuickAddReminderEnabled] =
    useState<boolean>(false);
  const [quickAddReminderOffset, setQuickAddReminderOffset] =
    useState<number>(0);
  const [quickAddPriority, setQuickAddPriority] =
    useState<TaskPriority>("MEDIUM");
  const [isCreatingQuickEntry, setIsCreatingQuickEntry] =
    useState<boolean>(false);
  // Day detail view mode (Google Calendar timeline vs compact list #133)
  const [dayDetailViewMode, setDayDetailViewMode] = useState<
    "timeline" | "list"
  >("timeline");

  // Month & Year picker state (#117)
  const [showMonthYearPicker, setShowMonthYearPicker] =
    useState<boolean>(false);
  const [pickerYear, setPickerYear] = useState<number>(() =>
    currentDate.getFullYear(),
  );
  const [yearlyCounts, setYearlyCounts] = useState<
    Record<
      number,
      {
        total: number;
        categoryBreakdown: { name: string; color: string; count: number }[];
      }
    >
  >({});

  // Toast message feedback
  const [reminderToastMessage, setReminderToastMessage] = useState<
    string | null
  >(null);
  const toastTimerRef = React.useRef<any>(null);
  const isMountedRef = React.useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (msg: string, durationMs: number = 3500) => {
    if (!isMountedRef.current) return;
    setReminderToastMessage(msg);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
      return;
    }
    toastTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setReminderToastMessage((curr) => (curr === msg ? null : curr));
      }
    }, durationMs);
  };

  const handleToggleTaskStatus = async (entry: Entry) => {
    const cat = categoryMap.get(entry.category_id);
    if (!cat || cat.kind !== "TASK" || isCategoryAlert(cat)) {
      return;
    }
    const nextStatus: TaskStatus =
      entry.task_status === "DONE" ? "PENDING" : "DONE";
    try {
      await updateLocalEntry(db, userId, entry.id, {
        task_status: nextStatus,
      });
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id ? { ...e, task_status: nextStatus } : e,
        ),
      );
      setSelectedDayEntries((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((e) =>
                e.id === entry.id ? { ...e, task_status: nextStatus } : e,
              ),
            }
          : null,
      );
      showToast(
        nextStatus === "DONE"
          ? "✅ Tarea completada"
          : "⏳ Tarea marcada como pendiente",
      );
      onEntryUpdated?.();
    } catch (err) {
      console.error("Error al cambiar estado de tarea:", err);
    }
  };

  const handleQuickSaveReminder = async (
    entry: Entry,
    enabled: boolean,
    offsetMinutes: number = 0,
    recurrence: ReminderRecurrence = "NONE",
  ) => {
    try {
      if (enabled && recurrence === "NONE") {
        const baseIso = entry.occurred_at || entry.reminder_time;
        if (baseIso) {
          const baseNorm = normalizeUtcIso(baseIso) || baseIso;
          const d = new Date(baseNorm);
          if (!isNaN(d.getTime())) {
            const triggerTime = d.getTime() - offsetMinutes * 60000;
            if (triggerTime < Date.now()) {
              showToast(
                "⚠️ La hora de este aviso ya ha pasado hoy. Elige repetición o edita la hora.",
              );
              return;
            }
          }
        }
      }

      const updateData: UpdateEntryData = {
        reminder_enabled: enabled,
        reminder_offset_minutes: offsetMinutes,
        reminder_recurrence: recurrence,
      };

      const updated = await updateLocalEntry(db, userId, entry.id, updateData);

      if (enabled) {
        if (notificationService.getPermissionStatus() !== "granted") {
          await notificationService.requestPermissions();
        }
        notificationService.scheduleForEntry(updated);
      } else {
        notificationService.cancelNotification(entry.id);
      }

      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, ...updateData } : e)),
      );
      setSelectedDayEntries((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((e) =>
                e.id === entry.id ? { ...e, ...updateData } : e,
              ),
            }
          : null,
      );
      setEditingReminderEntryId(null);
      showToast(
        enabled
          ? `🔔 ¡Aviso configurado: ${formatReminderSummary(updated)}!`
          : "🔕 Recordatorio desactivado.",
      );
      onEntryUpdated?.();
    } catch (err) {
      console.error("Error al guardar recordatorio:", err);
    }
  };

  const handleQuickCreateEntry = async () => {
    if (!selectedDayEntries || !quickAddContent.trim()) return;
    try {
      setIsCreatingQuickEntry(true);
      const catId =
        quickAddCatId || (categories.length > 0 ? categories[0].id : "");
      const selectedCategory = categories.find((c) => c.id === catId);
      const isTask =
        selectedCategory?.kind === "TASK" && !isCategoryAlert(selectedCategory);

      const [y, m, d] = selectedDayEntries.dateStr.split("-").map(Number);
      const [hh, mm] = (quickAddTime || "12:00").split(":").map(Number);
      const localDate = new Date(y, m - 1, d, hh || 12, mm || 0, 0);
      const occurredAtIso = localDate.toISOString();

      const created = await createLocalEntry(db, userId, {
        category_id: catId,
        title: quickAddTitle.trim() ? quickAddTitle.trim() : null,
        content: quickAddContent.trim(),
        occurred_at: occurredAtIso,
        task_status: isTask ? "PENDING" : null,
        task_recurrence: isTask ? "ONCE" : null,
        task_priority: isTask ? quickAddPriority : null,
        reminder_enabled: quickAddReminderEnabled,
        reminder_offset_minutes: quickAddReminderOffset,
        reminder_recurrence: "NONE",
      });

      if (quickAddReminderEnabled) {
        if (notificationService.getPermissionStatus() !== "granted") {
          await notificationService.requestPermissions();
        }
        notificationService.scheduleForEntry(created);
      }

      setEntries((prev) => [...prev, created]);
      setSelectedDayEntries((prev) =>
        prev
          ? {
              ...prev,
              items: [...prev.items, created],
            }
          : null,
      );

      setShowQuickAddForm(false);
      setQuickAddTitle("");
      setQuickAddContent("");
      setQuickAddTime("12:00");
      setQuickAddPriority("MEDIUM");
      setQuickAddReminderEnabled(false);
      setQuickAddReminderOffset(0);
      setIsCreatingQuickEntry(false);
      showToast("✨ ¡Nueva entrada creada en este día!");
      onEntryUpdated?.();
    } catch (err) {
      console.error("Error al crear entrada en el calendario:", err);
      if (isMountedRef.current) {
        setIsCreatingQuickEntry(false);
      }
    }
  };

  const handleTestNotification = async () => {
    if (notificationService.getPermissionStatus() !== "granted") {
      const perm = await notificationService.requestPermissions();
      if (perm !== "granted") {
        showToast("⚠️ Activa los permisos del navegador para recibir avisos.");
        return;
      }
    }
    const ok = notificationService.sendNotification(
      "🔔 Agenda AI",
      "¡Las notificaciones están funcionando perfectamente en tu navegador!",
    );
    if (ok) {
      showToast("🎉 ¡Notificación de prueba enviada con éxito!");
    } else {
      showToast("⚠️ No se pudo enviar el aviso. Revisa los permisos.");
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      setIsDeleting(true);
      await deleteLocalEntry(db, userId, entryId);
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      setSelectedDayEntries((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((e) => e.id !== entryId),
            }
          : null,
      );
      setDeletingEntryId(null);
      onEntryUpdated?.();
    } catch (err) {
      console.error("Error al eliminar entrada desde el calendario:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveQuickTitle = async (entryId: string) => {
    if (!quickTitleText.trim()) return;
    try {
      const updated = await updateLocalEntry(db, userId, entryId, {
        title: quickTitleText.trim(),
      });
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId ? { ...e, title: updated.title } : e,
        ),
      );
      setSelectedDayEntries((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((e) =>
                e.id === entryId ? { ...e, title: updated.title } : e,
              ),
            }
          : null,
      );
      setEditingTitleEntryId(null);
      setQuickTitleText("");
      onEntryUpdated?.();
    } catch {
      // Fallback
    }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      try {
        const [cats, tagList] = await Promise.all([
          listCategories(db, userId),
          listTags(db, userId),
        ]);
        const startOfMonth = new Date(year, month, 1).toISOString();
        const endOfMonth = new Date(
          year,
          month + 1,
          0,
          23,
          59,
          59,
          999,
        ).toISOString();

        const fetchedEntries = await listLocalEntries(db, userId, {
          start_at: startOfMonth,
          end_at: endOfMonth,
          include_yearly: true,
          category_ids:
            selectedCategoryIds && selectedCategoryIds.length > 0
              ? selectedCategoryIds
              : undefined,
          tag_ids:
            selectedTagIds && selectedTagIds.length > 0
              ? selectedTagIds
              : undefined,
        });

        if (mounted) {
          setCategories(cats);
          setTags(tagList);
          setEntries(fetchedEntries);

          const shouldAutoSelectToday = !hasAutoSelectedToday.current;
          if (shouldAutoSelectToday) {
            hasAutoSelectedToday.current = true;
          }

          const todayStr = toLocalDateString();
          const curMonthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

          setSelectedDayEntries((prev) => {
            if (
              initialSelectedDateStr &&
              initialSelectedDateStr.startsWith(curMonthPrefix) &&
              (!prev ||
                (prev.dateStr !== initialSelectedDateStr &&
                  hasAutoSelectedInitialDate.current !==
                    initialSelectedDateStr))
            ) {
              hasAutoSelectedInitialDate.current = initialSelectedDateStr;
              const matchingItems = fetchedEntries.filter((e) => {
                if (!e.occurred_at) return false;
                return matchesCalendarDate(e, initialSelectedDateStr, year);
              });
              return { dateStr: initialSelectedDateStr, items: matchingItems };
            }

            if (!prev) {
              if (
                shouldAutoSelectToday &&
                todayStr.startsWith(curMonthPrefix)
              ) {
                const todayItems = fetchedEntries.filter((e) => {
                  if (!e.occurred_at) return false;
                  return matchesCalendarDate(e, todayStr, year);
                });
                return { dateStr: todayStr, items: todayItems };
              }
              return null;
            }
            const updatedItems = fetchedEntries.filter((e) => {
              if (!e.occurred_at) return false;
              return matchesCalendarDate(e, prev.dateStr, year);
            });
            return { ...prev, items: updatedItems };
          });
        }
      } catch {
        // Offline fallback handling
      }
    }
    fetchData();
    return () => {
      mounted = false;
    };
  }, [
    db,
    userId,
    year,
    month,
    selectedCategoryIds,
    selectedTagIds,
    refreshSignal,
    initialSelectedDateStr,
  ]);

  useEffect(() => {
    let mounted = true;
    if (!showMonthYearPicker) return;

    async function fetchYearlyData() {
      try {
        const startOfYear = `${pickerYear}-01-01T00:00:00.000Z`;
        const endOfYear = `${pickerYear}-12-31T23:59:59.999Z`;
        const yearEntries = await listLocalEntries(db, userId, {
          start_at: startOfYear,
          end_at: endOfYear,
          include_yearly: true,
        });

        if (!mounted) return;

        const catMap = new Map<string, Category>();
        categories.forEach((c) => catMap.set(c.id, c));

        const counts: Record<
          number,
          {
            total: number;
            categoryBreakdown: { name: string; color: string; count: number }[];
          }
        > = {};
        for (let m = 0; m < 12; m++) {
          counts[m] = { total: 0, categoryBreakdown: [] };
        }

        yearEntries.forEach((entry) => {
          if (entry.occurred_at) {
            const origDateKey = getEntryDateKey(entry.occurred_at);
            const targetDateKey =
              entry.reminder_recurrence === "YEARLY"
                ? `${pickerYear}-${origDateKey.substring(5)}`
                : origDateKey;

            const entryYear = parseInt(targetDateKey.substring(0, 4), 10);
            if (entryYear === pickerYear) {
              const entryMonth =
                parseInt(targetDateKey.substring(5, 7), 10) - 1;
              if (counts[entryMonth]) {
                counts[entryMonth].total += 1;
                const cat = catMap.get(entry.category_id);
                const catName = cat?.name || "Sin categoría";
                const catColor = cat?.color || "#94A3B8";
                const existing = counts[entryMonth].categoryBreakdown.find(
                  (c) => c.name === catName,
                );
                if (existing) {
                  existing.count += 1;
                } else {
                  counts[entryMonth].categoryBreakdown.push({
                    name: catName,
                    color: catColor,
                    count: 1,
                  });
                }
              }
            }
          }
        });

        setYearlyCounts(counts);
      } catch {
        // Fallback
      }
    }

    fetchYearlyData();
    return () => {
      mounted = false;
    };
  }, [db, userId, showMonthYearPicker, pickerYear, categories, refreshSignal]);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDayEntries(null);
    setShowQuickAddForm(false);
    setShowQuickVoice(false);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDayEntries(null);
    setShowQuickAddForm(false);
    setShowQuickVoice(false);
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayWeekday = new Date(year, month, 1).getDay(); // 0 is Sunday
  // Convert Sunday (0) to index 6, Monday (1) to index 0
  const startingOffset = (firstDayWeekday + 6) % 7;

  // Map category ID to Category object
  const categoryMap = new Map<string, Category>();
  categories.forEach((c) => categoryMap.set(c.id, c));

  // Map tag ID to Tag object
  const tagMap = new Map<string, Tag>();
  tags.forEach((t) => tagMap.set(t.id, t));

  // Group entries by date string YYYY-MM-DD
  const entriesByDayMap = new Map<string, Entry[]>();
  entries.forEach((entry) => {
    if (entry.occurred_at) {
      const origDateKey = getEntryDateKey(entry.occurred_at);
      const targetDateKey =
        entry.reminder_recurrence === "YEARLY"
          ? `${year}-${origDateKey.substring(5)}`
          : origDateKey;
      const existing = entriesByDayMap.get(targetDateKey) || [];
      existing.push(entry);
      entriesByDayMap.set(targetDateKey, existing);
    }
  });

  const MONTH_NAMES = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Build grid items
  const gridCells: ({ dayNumber: number; dateStr: string } | null)[] = [];
  for (let i = 0; i < startingOffset; i++) {
    gridCells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    gridCells.push({
      dayNumber: day,
      dateStr: `${year}-${mm}-${dd}`,
    });
  }

  return (
    <View style={styles.card} testID="calendar-month-view">
      {/* Month Navigation Header */}
      <View style={styles.headerRow}>
        <Pressable
          testID="btn-prev-month"
          style={styles.navButton}
          onPress={prevMonth}
        >
          <Text style={styles.navButtonText}>{"<"}</Text>
        </Pressable>

        <Pressable
          testID="btn-open-month-year-picker"
          style={styles.monthTitleButton}
          onPress={() => {
            setPickerYear(year);
            setShowMonthYearPicker(true);
          }}
        >
          <Text style={styles.monthTitle} testID="calendar-month-title">
            {`${MONTH_NAMES[month]} ${year}`}
          </Text>
          <Text style={styles.monthTitleDropdownIcon}> ▾</Text>
        </Pressable>

        <Pressable
          testID="btn-next-month"
          style={styles.navButton}
          onPress={nextMonth}
        >
          <Text style={styles.navButtonText}>{">"}</Text>
        </Pressable>
      </View>

      {/* Weekday headers */}
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((wd) => (
          <Text key={wd} style={styles.weekdayText}>
            {wd}
          </Text>
        ))}
      </View>

      {/* Days Grid */}
      <View style={styles.gridContainer} testID="calendar-grid">
        {gridCells.map((cell, idx) => {
          if (!cell) {
            return <View key={`empty-${idx}`} style={styles.emptyDayCell} />;
          }

          const dayEntries = entriesByDayMap.get(cell.dateStr) || [];
          const visibleEntries = dayEntries.slice(0, MAX_VISIBLE_CALENDAR_DOTS);
          const extraCount = Math.max(
            0,
            dayEntries.length - MAX_VISIBLE_CALENDAR_DOTS,
          );
          const hasReminders = dayEntries.some((e) =>
            isEntryReminderPending(
              e,
              undefined,
              categoryMap.get(e.category_id),
            ),
          );
          const isSelected = selectedDayEntries?.dateStr === cell.dateStr;
          const isToday = toLocalDateString() === cell.dateStr;

          return (
            <Pressable
              key={cell.dateStr}
              testID={`day-cell-${cell.dateStr}`}
              style={[
                styles.dayCell,
                isSelected && styles.dayCellSelected,
                isToday && styles.dayCellToday,
              ]}
              onPress={() => {
                setSelectedDayEntries({
                  dateStr: cell.dateStr,
                  items: dayEntries,
                });
                setShowQuickAddForm(false);
                setShowQuickVoice(false);
                setEditingReminderEntryId(null);
              }}
            >
              {hasReminders && (
                <Text
                  style={[
                    styles.dayReminderBell,
                    isToday && styles.dayReminderBellToday,
                  ]}
                  testID={`day-has-reminder-${cell.dateStr}`}
                >
                  🔔
                </Text>
              )}
              <View style={styles.dayCellHeaderRow}>
                <Text
                  style={[
                    styles.dayNumber,
                    isSelected && styles.dayNumberSelected,
                    isToday && styles.dayNumberToday,
                  ]}
                >
                  {cell.dayNumber}
                </Text>
                {isToday && (
                  <View style={styles.todayPill}>
                    <Text style={styles.todayPillText}>HOY</Text>
                  </View>
                )}
              </View>

              <View style={styles.badgesContainer}>
                {visibleEntries.map((ent) => {
                  const cat = categoryMap.get(ent.category_id);
                  const color = cat?.color || "#38BDF8";
                  return (
                    <View
                      key={ent.id}
                      testID={`entry-dot-${ent.id}`}
                      style={[styles.entryDot, { backgroundColor: color }]}
                    />
                  );
                })}

                {extraCount > 0 && (
                  <Text
                    style={styles.extraCountText}
                    testID={`day-extra-count-${cell.dateStr}`}
                  >
                    {`+${extraCount}`}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Day Detail Modal/Panel */}
      {selectedDayEntries && (
        <View style={styles.dayDetailBox} testID="day-detail-panel">
          <View style={styles.detailHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>
                {`Entradas del ${selectedDayEntries.dateStr}`}
              </Text>
              <Text style={styles.detailSubtitle}>
                {selectedDayEntries.items.length === 1
                  ? "1 entrada fechada"
                  : `${selectedDayEntries.items.length} entradas fechadas`}
              </Text>
            </View>

            <View style={styles.detailHeaderActions}>
              <Pressable
                testID="btn-open-quick-add"
                style={[
                  styles.quickAddEntryBtn,
                  showQuickAddForm && styles.quickAddEntryBtnActive,
                ]}
                onPress={() => {
                  setShowQuickVoice(false);
                  const nextShow = !showQuickAddForm;
                  setShowQuickAddForm(nextShow);
                  const targetCatId =
                    quickAddCatId ||
                    (categories.length > 0 ? categories[0].id : "");
                  if (!quickAddCatId && categories.length > 0) {
                    setQuickAddCatId(categories[0].id);
                  }
                  if (nextShow) {
                    const selCat = categories.find((c) => c.id === targetCatId);
                    if (isCategoryAlert(selCat)) {
                      setQuickAddReminderEnabled(true);
                      setQuickAddReminderOffset(0);
                    }
                  }
                }}
              >
                <Text style={styles.quickAddEntryBtnText}>✍️ Manual</Text>
              </Pressable>

              <Pressable
                testID="btn-quick-voice-add"
                style={[
                  styles.quickAddVoiceBtn,
                  showQuickVoice && styles.quickAddVoiceBtnActive,
                ]}
                onPress={() => {
                  setShowQuickAddForm(false);
                  setShowQuickVoice((prev) => !prev);
                }}
              >
                <Text style={styles.quickAddVoiceBtnText}>🎙️ Dictar</Text>
              </Pressable>

              <Pressable
                testID="btn-close-day-detail"
                style={styles.closeButton}
                onPress={() => {
                  setSelectedDayEntries(null);
                  setShowQuickAddForm(false);
                  setShowQuickVoice(false);
                  setEditingReminderEntryId(null);
                }}
              >
                <Text style={styles.closeButtonText}>✕ Cerrar</Text>
              </Pressable>
            </View>
          </View>

          {/* Mode Toggle: Timeline vs List (#133) */}
          <View style={styles.viewModeToggleRow} testID="day-view-mode-toggle">
            <Pressable
              testID="btn-view-mode-timeline"
              style={[
                styles.viewModeToggleBtn,
                dayDetailViewMode === "timeline" &&
                  styles.viewModeToggleBtnActive,
              ]}
              onPress={() => setDayDetailViewMode("timeline")}
            >
              <Text
                style={[
                  styles.viewModeToggleBtnText,
                  dayDetailViewMode === "timeline" &&
                    styles.viewModeToggleBtnTextActive,
                ]}
              >
                ⏱️ Horas
              </Text>
            </Pressable>

            <Pressable
              testID="btn-view-mode-list"
              style={[
                styles.viewModeToggleBtn,
                dayDetailViewMode === "list" && styles.viewModeToggleBtnActive,
              ]}
              onPress={() => setDayDetailViewMode("list")}
            >
              <Text
                style={[
                  styles.viewModeToggleBtnText,
                  dayDetailViewMode === "list" &&
                    styles.viewModeToggleBtnTextActive,
                ]}
              >
                📋 Lista
              </Text>
            </Pressable>
          </View>

          {/* Toast feedback banner */}
          {reminderToastMessage && (
            <View style={styles.toastBanner} testID="calendar-toast-banner">
              <Text style={styles.toastBannerText}>{reminderToastMessage}</Text>
            </View>
          )}

          {/* Quick Voice Entry for Selected Day */}
          {showQuickVoice && (
            <View style={styles.quickVoiceCard} testID="quick-voice-card">
              <View style={styles.quickVoiceHeader}>
                <Text style={styles.quickVoiceTitle}>
                  🎙️ Dictar para el {selectedDayEntries.dateStr}
                </Text>
              </View>
              <VoiceCaptureFlow
                db={db}
                userId={userId}
                defaultDate={new Date(selectedDayEntries.dateStr + "T12:00:00")}
                saveMode="PREVIEW_BEFORE_SAVE"
                onEntryCreated={async () => {
                  setShowQuickVoice(false);
                  const updatedEntries = await listLocalEntries(db, userId, {
                    include_yearly: true,
                  });
                  setEntries(updatedEntries);
                  if (selectedDayEntries) {
                    const dayItems = updatedEntries.filter((e) =>
                      matchesCalendarDate(e, selectedDayEntries.dateStr, year),
                    );
                    setSelectedDayEntries({
                      dateStr: selectedDayEntries.dateStr,
                      items: dayItems,
                    });
                  }
                  showToast("✨ ¡Entrada por voz guardada en este día!");
                  onEntryUpdated?.();
                }}
                onClose={() => setShowQuickVoice(false)}
              />
            </View>
          )}

          {/* Inline Quick Add Form */}
          {showQuickAddForm && (
            <View style={styles.quickAddFormCard} testID="quick-add-form-card">
              <Text style={styles.quickAddFormTitle}>
                ➕ Nueva entrada para el {selectedDayEntries.dateStr}
              </Text>

              <Text style={styles.quickAddSublabel}>Categoría</Text>
              <View style={styles.quickAddChipsRow}>
                {categories.map((c) => {
                  const isSelected =
                    quickAddCatId === c.id ||
                    (!quickAddCatId && categories[0]?.id === c.id);
                  return (
                    <Pressable
                      key={c.id}
                      testID={`quick-add-cat-${c.id}`}
                      style={[
                        styles.quickAddCatChip,
                        isSelected && {
                          backgroundColor: c.color || "#38BDF8",
                          borderColor: c.color || "#38BDF8",
                        },
                      ]}
                      onPress={() => {
                        const prevCat = categories.find(
                          (cat) =>
                            cat.id === (quickAddCatId || categories[0]?.id),
                        );
                        setQuickAddCatId(c.id);
                        if (isCategoryAlert(c)) {
                          setQuickAddReminderEnabled(true);
                          setQuickAddReminderOffset(0);
                        } else if (isCategoryAlert(prevCat)) {
                          setQuickAddReminderEnabled(false);
                        }
                        if (c.kind === "TASK" && !isCategoryAlert(c)) {
                          setQuickAddPriority("MEDIUM");
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.quickAddCatChipText,
                          isSelected && { color: "#FFFFFF", fontWeight: "700" },
                        ]}
                      >
                        {c.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {(() => {
                const activeCat = categories.find(
                  (c) => c.id === (quickAddCatId || categories[0]?.id),
                );
                const isQuickCatTask =
                  activeCat?.kind === "TASK" && !isCategoryAlert(activeCat);
                if (!isQuickCatTask) return null;
                return (
                  <View style={styles.quickAddPriorityRow}>
                    <Text style={styles.quickAddSublabel}>Prioridad:</Text>
                    <View style={styles.quickAddPriorityChips}>
                      {[
                        { id: "HIGH", label: "🔴 Alta", color: "#EF4444" },
                        { id: "MEDIUM", label: "🟡 Media", color: "#F59E0B" },
                        { id: "LOW", label: "🔵 Baja", color: "#3B82F6" },
                      ].map((p) => {
                        const isSel = quickAddPriority === p.id;
                        return (
                          <Pressable
                            key={p.id}
                            testID={`quick-add-priority-${p.id}`}
                            style={[
                              styles.quickPriorityChip,
                              isSel && {
                                borderColor: p.color,
                                backgroundColor: `${p.color}25`,
                              },
                            ]}
                            onPress={() =>
                              setQuickAddPriority(p.id as TaskPriority)
                            }
                          >
                            <Text
                              style={[
                                styles.quickPriorityChipText,
                                isSel && { color: p.color, fontWeight: "700" },
                              ]}
                            >
                              {p.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })()}

              <TextInput
                testID="input-quick-add-title"
                style={styles.quickAddInput}
                placeholder="Título opcional (ej: Reunión de proyecto)..."
                placeholderTextColor="#64748B"
                value={quickAddTitle}
                onChangeText={setQuickAddTitle}
              />

              <TextInput
                testID="input-quick-add-content"
                style={[styles.quickAddInput, { minHeight: 55 }]}
                placeholder="¿Qué tienes planeado? (Contenido requerido)..."
                placeholderTextColor="#64748B"
                multiline
                value={quickAddContent}
                onChangeText={setQuickAddContent}
              />

              <View style={styles.quickAddTimeRow}>
                <Text style={styles.quickAddSublabel}>⏰ Hora del evento:</Text>
                {Platform.OS === "web" ? (
                  React.createElement("input", {
                    type: "time",
                    "data-testid": "input-quick-add-time",
                    value: quickAddTime,
                    onChange: (e: any) => setQuickAddTime(e.target.value),
                    style: {
                      backgroundColor: "#0F172A",
                      color: "#FFFFFF",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      borderRadius: "6px",
                      padding: "6px 10px",
                      fontSize: "14px",
                      outline: "none",
                      colorScheme: "dark",
                    },
                  })
                ) : (
                  <TextInput
                    testID="input-quick-add-time"
                    style={styles.quickAddTimeInputNative}
                    value={quickAddTime}
                    onChangeText={setQuickAddTime}
                    placeholder="12:00"
                    placeholderTextColor="#64748B"
                  />
                )}
              </View>

              {/* Quick Reminder toggle on create */}
              <Pressable
                testID="btn-toggle-quick-add-reminder"
                style={styles.quickAddReminderToggleRow}
                onPress={() => setQuickAddReminderEnabled((prev) => !prev)}
              >
                <View
                  testID="checkbox-quick-add-reminder"
                  style={[
                    styles.quickCheckbox,
                    quickAddReminderEnabled && styles.quickCheckboxChecked,
                  ]}
                >
                  <Text style={styles.quickCheckboxText}>
                    {quickAddReminderEnabled ? "✓" : ""}
                  </Text>
                </View>
                <Text style={styles.quickAddReminderLabel}>
                  🔔 Programar recordatorio para esta entrada
                </Text>
              </Pressable>

              {quickAddReminderEnabled && (
                <View style={styles.quickAddPresetsRow}>
                  {[
                    { label: "⚡ Exacta", offset: 0 },
                    { label: "⏱️ 15m antes", offset: 15 },
                    { label: "⏰ 1h antes", offset: 60 },
                  ].map((p) => {
                    let isPast = false;
                    if (selectedDayEntries?.dateStr && p.offset > 0) {
                      const d = new Date(
                        `${selectedDayEntries.dateStr}T12:00:00`,
                      );
                      if (!isNaN(d.getTime())) {
                        isPast = d.getTime() - p.offset * 60000 < Date.now();
                      }
                    }
                    return (
                      <Pressable
                        key={p.offset}
                        disabled={isPast}
                        style={[
                          styles.quickPresetChip,
                          quickAddReminderOffset === p.offset &&
                            styles.quickPresetChipActive,
                          isPast && styles.quickPresetChipDisabled,
                        ]}
                        onPress={() => {
                          if (isPast) return;
                          setQuickAddReminderOffset(p.offset);
                        }}
                      >
                        <Text
                          style={[
                            styles.quickPresetChipText,
                            quickAddReminderOffset === p.offset &&
                              styles.quickPresetChipTextActive,
                            isPast && styles.quickPresetChipTextDisabled,
                          ]}
                        >
                          {p.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <View style={styles.quickAddSubmitRow}>
                <Pressable
                  testID="btn-submit-quick-add"
                  style={[
                    styles.quickAddSubmitBtn,
                    (!quickAddContent.trim() || isCreatingQuickEntry) &&
                      styles.buttonDisabled,
                  ]}
                  onPress={() => {
                    if (!quickAddContent.trim() || isCreatingQuickEntry) return;
                    return handleQuickCreateEntry();
                  }}
                >
                  <Text style={styles.quickAddSubmitBtnText}>
                    {isCreatingQuickEntry
                      ? "Guardando..."
                      : "💾 Guardar en este día"}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.quickAddCancelBtn}
                  onPress={() => setShowQuickAddForm(false)}
                >
                  <Text style={styles.quickAddCancelBtnText}>Cancelar</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Timeline groupings & calculations (#133) */}
          {(() => {
            const untimedEntries: Entry[] = [];
            const hourlyEntriesMap = new Map<number, Entry[]>();

            selectedDayEntries.items.forEach((ent) => {
              if (!ent.occurred_at || ent.occurred_at.length <= 10) {
                untimedEntries.push(ent);
                return;
              }
              const norm = normalizeUtcIso(ent.occurred_at) || ent.occurred_at;
              const d = new Date(norm);
              if (isNaN(d.getTime())) {
                untimedEntries.push(ent);
              } else {
                const h = d.getHours();
                const list = hourlyEntriesMap.get(h) || [];
                list.push(ent);
                hourlyEntriesMap.set(h, list);
              }
            });

            const busyHoursCount = hourlyEntriesMap.size;
            const freeHoursCount = 24 - busyHoursCount;

            const renderEntryCard = (
              ent: Entry,
              isTimeline: boolean = false,
              exactTimeLabel?: string,
            ) => {
              const cat = categoryMap.get(ent.category_id);
              const isTask = cat?.kind === "TASK" && !isCategoryAlert(cat);
              const isCompleted = isTask && ent.task_status === "DONE";
              const catColor = cat?.color || "#38BDF8";
              const timeNorm =
                normalizeUtcIso(ent.occurred_at) || ent.occurred_at;
              const timeStr = timeNorm
                ? new Date(timeNorm).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Sin hora";

              const displayTime = exactTimeLabel || timeStr;
              const isEditingReminder = editingReminderEntryId === ent.id;

              return (
                <View
                  key={ent.id}
                  testID={`entry-item-${ent.id}`}
                  style={[
                    styles.entryRow,
                    isTimeline && styles.timelineEventCard,
                    isTimeline && { borderLeftColor: catColor },
                    isCompleted && styles.entryRowCompleted,
                  ]}
                >
                  <View style={styles.entryRowHeader}>
                    {isTask && (
                      <Pressable
                        testID={`btn-toggle-task-${ent.id}`}
                        style={[
                          styles.taskCheckbox,
                          isCompleted && styles.taskCheckboxCompleted,
                        ]}
                        onPress={() => handleToggleTaskStatus(ent)}
                      >
                        <Text style={styles.taskCheckboxCheck}>
                          {isCompleted ? "✓" : ""}
                        </Text>
                      </Pressable>
                    )}

                    <View style={styles.entryBadgesRow}>
                      {isTimeline && (
                        <Text
                          style={[
                            styles.timelineEventTimeBadge,
                            { color: catColor },
                          ]}
                        >
                          {displayTime}
                        </Text>
                      )}

                      <View
                        style={[styles.catBadge, { backgroundColor: catColor }]}
                      >
                        <Text style={styles.catBadgeText}>
                          {cat?.name || "General"}
                        </Text>
                      </View>

                      {ent.reminder_enabled || isCategoryAlert(cat) ? (
                        <View
                          style={styles.reminderBadge}
                          testID={`entry-reminder-badge-${ent.id}`}
                        >
                          <Text style={styles.reminderBadgeText}>
                            🔔{" "}
                            {formatReminderSummary(
                              ent.reminder_enabled
                                ? ent
                                : {
                                    ...ent,
                                    reminder_enabled: true,
                                    reminder_offset_minutes:
                                      ent.reminder_offset_minutes ?? 0,
                                  },
                            )}
                          </Text>
                        </View>
                      ) : null}

                      {ent.tag_ids && ent.tag_ids.length > 0 && (
                        <View
                          style={styles.tagsContainer}
                          testID={`entry-tags-${ent.id}`}
                        >
                          {ent.tag_ids.map((tagId) => {
                            const tagObj = tagMap.get(tagId);
                            if (!tagObj) return null;
                            const tagColor = tagObj.color || "#38BDF8";
                            return (
                              <View
                                key={tagId}
                                testID={`entry-tag-badge-${tagId}`}
                                style={[
                                  styles.tagBadge,
                                  {
                                    backgroundColor: `${tagColor}22`,
                                    borderColor: tagColor,
                                  },
                                ]}
                              >
                                <View
                                  style={[
                                    styles.tagDot,
                                    { backgroundColor: tagColor },
                                  ]}
                                />
                                <Text
                                  style={[
                                    styles.tagBadgeText,
                                    { color: tagColor },
                                  ]}
                                >
                                  {`#${tagObj.name}`}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>

                    {!isTimeline && (
                      <Text style={styles.entryTimeText}>📅 {timeStr}</Text>
                    )}
                  </View>

                  {/* Title & Content */}
                  {ent.title ? (
                    <>
                      <Text
                        style={[
                          styles.entryCardTitle,
                          isCompleted && styles.textCompletedStrikethrough,
                        ]}
                      >
                        {`📌 ${ent.title}`}
                      </Text>
                      <Text
                        style={[
                          styles.entryContentPreview,
                          isCompleted && styles.textCompletedStrikethrough,
                        ]}
                        numberOfLines={2}
                      >
                        {ent.content}
                      </Text>
                    </>
                  ) : (
                    <View style={styles.noTitleContainer}>
                      <Text
                        style={[
                          styles.entryContentPreview,
                          isCompleted && styles.textCompletedStrikethrough,
                        ]}
                        numberOfLines={2}
                      >
                        {getEntryDisplayTitle(ent, 50)}
                      </Text>
                      <Pressable
                        testID={`btn-add-title-${ent.id}`}
                        style={styles.addTitleBtn}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          setEditingTitleEntryId(ent.id);
                          setQuickTitleText("");
                        }}
                      >
                        <Text style={styles.addTitleBtnText}>
                          ✏️ Añadir Título
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Inline Title Editor (#89) */}
                  {editingTitleEntryId === ent.id && (
                    <View
                      style={styles.quickTitleForm}
                      testID={`quick-title-editor-${ent.id}`}
                    >
                      <TextInput
                        testID={`input-quick-title-${ent.id}`}
                        style={styles.quickTitleInput}
                        placeholder="Escribe un título..."
                        placeholderTextColor="#64748B"
                        value={quickTitleText}
                        onChangeText={setQuickTitleText}
                        autoFocus
                      />
                      <View style={styles.quickTitleActions}>
                        <Pressable
                          testID={`btn-save-quick-title-${ent.id}`}
                          style={styles.quickTitleSaveBtn}
                          onPress={() => handleSaveQuickTitle(ent.id)}
                        >
                          <Text style={styles.quickTitleSaveText}>Guardar</Text>
                        </Pressable>
                        <Pressable
                          style={styles.quickTitleCancelBtn}
                          onPress={() => setEditingTitleEntryId(null)}
                        >
                          <Text style={styles.quickTitleCancelText}>
                            Cancelar
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {/* QUICK REMINDER DRAWER */}
                  {isEditingReminder ? (
                    <View
                      style={styles.quickReminderDrawer}
                      testID={`quick-reminder-drawer-${ent.id}`}
                    >
                      <Text style={styles.quickReminderDrawerTitle}>
                        🔔 Ajuste Rápido de Notificación
                      </Text>

                      <Text style={styles.quickReminderSubhead}>
                        ¿Cuándo quieres recibir el aviso?
                      </Text>
                      <View style={styles.quickReminderPresetsGrid}>
                        {[
                          { label: "⚡ A la hora exacta", offset: 0 },
                          { label: "⏱️ 15 min antes", offset: 15 },
                          { label: "⏰ 1 hora antes", offset: 60 },
                          { label: "📅 1 día antes", offset: 1440 },
                        ].map((preset) => {
                          const baseIso = ent.occurred_at || ent.reminder_time;
                          let isPast = false;
                          if (baseIso) {
                            const baseNorm =
                              normalizeUtcIso(baseIso) || baseIso;
                            const d = new Date(baseNorm);
                            if (!isNaN(d.getTime())) {
                              const isRecurring =
                                selectedReminderRecurrence &&
                                selectedReminderRecurrence !== "NONE";
                              if (!isRecurring) {
                                isPast =
                                  d.getTime() - preset.offset * 60000 <
                                  Date.now();
                              }
                            }
                          }
                          return (
                            <Pressable
                              key={preset.offset}
                              testID={`preset-offset-${preset.offset}-${ent.id}`}
                              disabled={isPast}
                              style={[
                                styles.reminderPresetButton,
                                selectedReminderOffset === preset.offset &&
                                  styles.reminderPresetButtonActive,
                                isPast && styles.reminderPresetButtonDisabled,
                              ]}
                              onPress={() => {
                                if (isPast) return;
                                setSelectedReminderOffset(preset.offset);
                              }}
                            >
                              <Text
                                style={[
                                  styles.reminderPresetButtonText,
                                  selectedReminderOffset === preset.offset &&
                                    styles.reminderPresetButtonTextActive,
                                  isPast &&
                                    styles.reminderPresetButtonTextDisabled,
                                ]}
                              >
                                {preset.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {/* Recurrence chips */}
                      <Text
                        style={[styles.quickReminderSubhead, { marginTop: 10 }]}
                      >
                        Repetición del aviso
                      </Text>
                      <View
                        style={styles.quickReminderRecurrenceRow}
                        testID="quick-reminder-recurrence-row"
                      >
                        {[
                          { label: "Una vez", val: "NONE" },
                          { label: "Diario", val: "DAILY" },
                          { label: "Semanal", val: "WEEKLY" },
                          { label: "Mensual", val: "MONTHLY" },
                          { label: "Anual", val: "YEARLY" },
                        ].map((rec) => (
                          <Pressable
                            key={rec.val}
                            testID={`preset-rec-${rec.val}-${ent.id}`}
                            style={[
                              styles.reminderRecurrenceChip,
                              selectedReminderRecurrence === rec.val &&
                                styles.reminderRecurrenceChipActive,
                            ]}
                            onPress={() =>
                              setSelectedReminderRecurrence(
                                rec.val as ReminderRecurrence,
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.reminderRecurrenceChipText,
                                selectedReminderRecurrence === rec.val &&
                                  styles.reminderRecurrenceChipTextActive,
                              ]}
                            >
                              {rec.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      {(() => {
                        const baseIso = ent.occurred_at || ent.reminder_time;
                        let isSelectedConfigPast = false;
                        if (baseIso && selectedReminderRecurrence === "NONE") {
                          const baseNorm = normalizeUtcIso(baseIso) || baseIso;
                          const d = new Date(baseNorm);
                          if (!isNaN(d.getTime())) {
                            isSelectedConfigPast =
                              d.getTime() - selectedReminderOffset * 60000 <
                              Date.now();
                          }
                        }
                        return (
                          <View
                            style={{
                              marginTop: 6,
                              marginBottom: 8,
                              padding: 6,
                              backgroundColor: isSelectedConfigPast
                                ? "#7F1D1D33"
                                : "#1E293B",
                              borderRadius: 6,
                            }}
                          >
                            <Text
                              style={{
                                color: isSelectedConfigPast
                                  ? "#FCA5A5"
                                  : "#94A3B8",
                                fontSize: 11,
                              }}
                            >
                              {isSelectedConfigPast
                                ? "⚠️ Aviso en el pasado: "
                                : "🕒 Resumen: "}
                              <Text
                                style={{
                                  fontWeight: "600",
                                  color: isSelectedConfigPast
                                    ? "#F87171"
                                    : "#E2E8F0",
                                }}
                              >
                                {formatReminderSummary({
                                  ...ent,
                                  reminder_enabled: true,
                                  reminder_offset_minutes:
                                    selectedReminderOffset,
                                  reminder_recurrence:
                                    selectedReminderRecurrence,
                                })}
                              </Text>
                            </Text>
                            {isSelectedConfigPast && (
                              <Text
                                style={{
                                  color: "#FCA5A5",
                                  fontSize: 10,
                                  marginTop: 3,
                                }}
                              >
                                La hora programada ya ocurrió hoy. Elige una
                                frecuencia periódica o edita la fecha/hora.
                              </Text>
                            )}
                          </View>
                        );
                      })()}

                      {/* Drawer Actions */}
                      <View style={styles.quickReminderDrawerActions}>
                        <Pressable
                          testID={`btn-save-reminder-${ent.id}`}
                          style={styles.saveReminderActionBtn}
                          onPress={() =>
                            handleQuickSaveReminder(
                              ent,
                              true,
                              selectedReminderOffset,
                              selectedReminderRecurrence,
                            )
                          }
                        >
                          <Text style={styles.saveReminderActionBtnText}>
                            💾 Guardar
                          </Text>
                        </Pressable>

                        {ent.reminder_enabled ? (
                          <Pressable
                            testID={`btn-disable-reminder-${ent.id}`}
                            style={styles.disableReminderActionBtn}
                            onPress={() => handleQuickSaveReminder(ent, false)}
                          >
                            <Text style={styles.disableReminderActionBtnText}>
                              🔕 Desactivar
                            </Text>
                          </Pressable>
                        ) : null}

                        <Pressable
                          testID={`btn-advanced-reminder-${ent.id}`}
                          style={styles.advancedReminderBtn}
                          onPress={() => {
                            setEditingReminderEntryId(null);
                            onSelectEntry?.(ent.id);
                          }}
                        >
                          <Text style={styles.advancedReminderBtnText}>
                            ⚙️ Pantalla Completa
                          </Text>
                        </Pressable>

                        <Pressable
                          style={styles.cancelReminderActionBtn}
                          onPress={() => setEditingReminderEntryId(null)}
                        >
                          <Text style={styles.cancelReminderActionBtnText}>
                            ✕ Cerrar
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}

                  {/* Delete confirmation or Card Footer Actions */}
                  {deletingEntryId === ent.id ? (
                    <View
                      style={styles.deleteConfirmBox}
                      testID={`delete-confirm-box-${ent.id}`}
                    >
                      <Text style={styles.deleteConfirmText}>
                        ⚠️ ¿Seguro que quieres borrar esta entrada?
                      </Text>
                      <View style={styles.deleteConfirmActions}>
                        <Pressable
                          testID={`btn-confirm-delete-${ent.id}`}
                          style={styles.deleteConfirmBtn}
                          disabled={isDeleting}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            handleDeleteEntry(ent.id);
                          }}
                        >
                          <Text style={styles.deleteConfirmBtnText}>
                            {isDeleting ? "Borrando..." : "Sí, borrar"}
                          </Text>
                        </Pressable>
                        <Pressable
                          testID={`btn-cancel-delete-${ent.id}`}
                          style={styles.deleteCancelBtn}
                          disabled={isDeleting}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            setDeletingEntryId(null);
                          }}
                        >
                          <Text style={styles.deleteCancelBtnText}>
                            Cancelar
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.entryCardFooterRow}>
                      <View style={styles.footerLeftButtons}>
                        {/* Quick Reminder button */}
                        <Pressable
                          testID={`btn-open-quick-reminder-${ent.id}`}
                          style={[
                            styles.quickReminderToggleBtn,
                            ent.reminder_enabled &&
                              styles.quickReminderToggleBtnActive,
                          ]}
                          onPress={() => {
                            if (isEditingReminder) {
                              setEditingReminderEntryId(null);
                            } else {
                              setEditingReminderEntryId(ent.id);
                              let initialOffset =
                                ent.reminder_offset_minutes || 0;
                              const baseIso =
                                ent.occurred_at || ent.reminder_time;
                              if (baseIso && initialOffset > 0) {
                                const baseNorm =
                                  normalizeUtcIso(baseIso) || baseIso;
                                const d = new Date(baseNorm);
                                if (
                                  !isNaN(d.getTime()) &&
                                  d.getTime() - initialOffset * 60000 <
                                    Date.now()
                                ) {
                                  initialOffset = 0;
                                }
                              }
                              setSelectedReminderOffset(initialOffset);
                              setSelectedReminderRecurrence(
                                (ent.reminder_recurrence as ReminderRecurrence) ||
                                  "NONE",
                              );
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.quickReminderToggleBtnText,
                              ent.reminder_enabled &&
                                styles.quickReminderToggleBtnTextActive,
                            ]}
                          >
                            {ent.reminder_enabled
                              ? "🔔 Ajustar Aviso"
                              : "🔔 Añadir Aviso"}
                          </Text>
                        </Pressable>

                        <Pressable
                          testID={`btn-view-detail-${ent.id}`}
                          style={styles.viewDetailBtn}
                          onPress={() => onSelectEntry?.(ent.id)}
                        >
                          <Text style={styles.viewDetailBtnText}>
                            👁️ Detalle / Editar
                          </Text>
                        </Pressable>
                      </View>

                      <Pressable
                        testID={`btn-open-delete-${ent.id}`}
                        style={styles.deleteEntryBtn}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          setDeletingEntryId(ent.id);
                        }}
                      >
                        <Text style={styles.deleteEntryBtnText}>🗑️</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            };

            if (dayDetailViewMode === "timeline") {
              return (
                <View
                  style={styles.timelineContainer}
                  testID="day-timeline-view"
                >
                  {/* Summary Bar */}
                  <View style={styles.timelineSummaryBar}>
                    <Text style={styles.timelineSummaryText}>
                      {busyHoursCount > 0
                        ? `⏱️ ${busyHoursCount}h con actividad • ${freeHoursCount}h libres`
                        : "⏱️ Todo el día libre (24h disponibles)"}
                    </Text>
                    <Text style={styles.timelineFreeHint}>
                      Toca en un hueco libre para programar
                    </Text>
                  </View>

                  {/* All-Day / Untimed entries section */}
                  {untimedEntries.length > 0 && (
                    <View
                      style={styles.timelineAllDayBox}
                      testID="timeline-all-day-section"
                    >
                      <Text style={styles.timelineAllDayTitle}>
                        📌 Todo el día / Sin hora ({untimedEntries.length})
                      </Text>
                      <View style={styles.timelineAllDayItems}>
                        {untimedEntries.map((ent) =>
                          renderEntryCard(ent, true, "Todo el día"),
                        )}
                      </View>
                    </View>
                  )}

                  {/* 24-Hour Timeline Grid */}
                  <ScrollView
                    style={styles.timelineScrollView}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                  >
                    {Array.from({ length: 24 }, (_, hour) => {
                      const hourEntries = hourlyEntriesMap.get(hour) || [];
                      const hasEvents = hourEntries.length > 0;
                      const hourLabel = `${String(hour).padStart(2, "0")}:00`;

                      return (
                        <View
                          key={hour}
                          style={styles.timelineHourRow}
                          testID={`timeline-hour-row-${hour}`}
                        >
                          {/* Hour gutter */}
                          <View style={styles.timelineGutter}>
                            <Text style={styles.timelineGutterText}>
                              {hourLabel}
                            </Text>
                          </View>

                          {/* Slot Content */}
                          <View style={styles.timelineSlotContent}>
                            {hasEvents ? (
                              <View style={styles.timelineEventsList}>
                                {hourEntries.map((ent) =>
                                  renderEntryCard(ent, true),
                                )}
                              </View>
                            ) : (
                              <Pressable
                                testID={`timeline-slot-${hour}`}
                                style={styles.timelineFreeSlot}
                                onPress={() => {
                                  const hh = String(hour).padStart(2, "0");
                                  setQuickAddTime(`${hh}:00`);
                                  setShowQuickAddForm(true);
                                  setShowQuickVoice(false);
                                  if (!quickAddCatId && categories.length > 0) {
                                    setQuickAddCatId(categories[0].id);
                                  }
                                }}
                              >
                                <Text style={styles.timelineFreeSlotText}>
                                  + Hueco libre
                                </Text>
                              </Pressable>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              );
            }

            return (
              <View testID="day-list-view">
                {selectedDayEntries.items.length === 0 ? (
                  <Text style={styles.noEntriesText}>
                    No hay entradas fechadas en este día.
                  </Text>
                ) : (
                  selectedDayEntries.items.map((ent) =>
                    renderEntryCard(ent, false),
                  )
                )}
              </View>
            );
          })()}
        </View>
      )}

      {/* Month Summary Sidebar / Panel */}
      <View style={styles.monthSummaryCard} testID="calendar-month-summary">
        <View style={styles.summaryTopRow}>
          <Text style={styles.monthSummaryTitle}>
            {`📊 Resumen de ${MONTH_NAMES[month]}`}
          </Text>

          {/* Test notifications button */}
          <Pressable
            testID="btn-test-notification"
            style={styles.testNotificationBtn}
            onPress={handleTestNotification}
          >
            <Text style={styles.testNotificationBtnText}>🔔 Probar Avisos</Text>
          </Pressable>
        </View>

        <View style={styles.summaryStatsRow}>
          <View style={styles.summaryStatBadge}>
            <Text style={styles.summaryStatValue}>{entries.length}</Text>
            <Text style={styles.summaryStatLabel}>Entradas Fechadas</Text>
          </View>
          <View style={styles.summaryStatBadge}>
            <Text style={[styles.summaryStatValue, { color: "#F59E0B" }]}>
              {entries.filter((e) => !!e.reminder_enabled).length}
            </Text>
            <Text style={styles.summaryStatLabel}>Avisos Activos</Text>
          </View>
          <View style={styles.summaryStatBadge}>
            <Text style={[styles.summaryStatValue, { color: "#10B981" }]}>
              {categories.length}
            </Text>
            <Text style={styles.summaryStatLabel}>Categorías Activas</Text>
          </View>
        </View>
      </View>

      {/* Month & Year Picker Modal (#117) */}
      {showMonthYearPicker && (
        <Modal
          visible={showMonthYearPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowMonthYearPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={styles.pickerModalContent}
              testID="month-year-picker-modal"
            >
              <View style={styles.pickerModalHeader}>
                <Text style={styles.pickerModalTitle}>
                  📅 Navegar por Diario / Calendario
                </Text>
                <Pressable
                  testID="btn-close-month-year-picker"
                  style={styles.pickerCloseBtn}
                  onPress={() => setShowMonthYearPicker(false)}
                >
                  <Text style={styles.pickerCloseBtnText}>✕</Text>
                </Pressable>
              </View>

              {/* Year Selector Row */}
              <View style={styles.pickerYearRow}>
                <Pressable
                  testID="btn-picker-prev-year"
                  style={styles.pickerYearBtn}
                  onPress={() => setPickerYear((prev) => prev - 1)}
                >
                  <Text style={styles.pickerYearBtnText}>◀</Text>
                </Pressable>
                <Text
                  style={styles.pickerYearText}
                  testID="picker-current-year"
                >
                  {pickerYear}
                </Text>
                <Pressable
                  testID="btn-picker-next-year"
                  style={styles.pickerYearBtn}
                  onPress={() => setPickerYear((prev) => prev + 1)}
                >
                  <Text style={styles.pickerYearBtnText}>▶</Text>
                </Pressable>
              </View>

              <ScrollView
                style={styles.pickerMonthsScrollView}
                contentContainerStyle={styles.pickerMonthsGrid}
              >
                {MONTH_NAMES.map((mName, mIdx) => {
                  const mData = yearlyCounts[mIdx] || {
                    total: 0,
                    categoryBreakdown: [],
                  };
                  const isCurrent = year === pickerYear && month === mIdx;
                  return (
                    <Pressable
                      key={mName}
                      testID={`btn-pick-month-${mIdx}`}
                      style={[
                        styles.pickerMonthCard,
                        isCurrent && styles.pickerMonthCardActive,
                      ]}
                      onPress={() => {
                        setCurrentDate(new Date(pickerYear, mIdx, 1));
                        setSelectedDayEntries(null);
                        setShowQuickAddForm(false);
                        setShowQuickVoice(false);
                        setShowMonthYearPicker(false);
                      }}
                    >
                      <View style={styles.pickerMonthCardHeader}>
                        <Text
                          style={[
                            styles.pickerMonthName,
                            isCurrent && styles.pickerMonthNameActive,
                          ]}
                        >
                          {mName}
                        </Text>
                        <Text style={styles.pickerMonthBadge}>
                          {mData.total > 0 ? `${mData.total}` : "0"}
                        </Text>
                      </View>
                      {mData.categoryBreakdown.length > 0 ? (
                        <View style={styles.pickerCatBreakdownWrap}>
                          {mData.categoryBreakdown.slice(0, 3).map((cb) => (
                            <View key={cb.name} style={styles.pickerCatPill}>
                              <View
                                style={[
                                  styles.pickerCatPillDot,
                                  { backgroundColor: cb.color },
                                ]}
                              />
                              <Text style={styles.pickerCatPillText}>
                                {cb.name}: {cb.count}
                              </Text>
                            </View>
                          ))}
                          {mData.categoryBreakdown.length > 3 && (
                            <Text style={styles.pickerCatMoreText}>
                              +{mData.categoryBreakdown.length - 3} más
                            </Text>
                          )}
                        </View>
                      ) : (
                        <Text style={styles.pickerNoEntriesText}>
                          Sin registros
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    maxWidth: 1000,
    alignSelf: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#F8FAFC",
  },
  monthTitleButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  monthTitleDropdownIcon: {
    color: "#38BDF8",
    fontSize: 14,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  pickerModalContent: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    borderColor: "#334155",
    borderWidth: 1,
    width: "100%",
    maxWidth: 580,
    maxHeight: "85%",
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  pickerModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  pickerModalTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "bold",
  },
  pickerCloseBtn: {
    padding: 6,
  },
  pickerCloseBtnText: {
    color: "#94A3B8",
    fontSize: 16,
    fontWeight: "bold",
  },
  pickerYearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: "#0F172A",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 14,
    borderColor: "#334155",
    borderWidth: 1,
  },
  pickerYearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#1E293B",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#334155",
  },
  pickerYearBtnText: {
    color: "#38BDF8",
    fontSize: 14,
    fontWeight: "bold",
  },
  pickerYearText: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "bold",
  },
  pickerMonthsScrollView: {
    maxHeight: 400,
  },
  pickerMonthsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
    paddingBottom: 12,
  },
  pickerMonthCard: {
    width: "48%",
    backgroundColor: "#0F172A",
    borderRadius: 10,
    borderColor: "#334155",
    borderWidth: 1,
    padding: 10,
    minHeight: 80,
  },
  pickerMonthCardActive: {
    borderColor: "#38BDF8",
    backgroundColor: "rgba(56, 189, 248, 0.08)",
  },
  pickerMonthCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  pickerMonthName: {
    color: "#F8FAFC",
    fontWeight: "bold",
    fontSize: 14,
  },
  pickerMonthNameActive: {
    color: "#38BDF8",
  },
  pickerMonthBadge: {
    backgroundColor: "#1E293B",
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  pickerCatBreakdownWrap: {
    gap: 3,
  },
  pickerCatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pickerCatPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pickerCatPillText: {
    color: "#94A3B8",
    fontSize: 11,
  },
  pickerCatMoreText: {
    color: "#64748B",
    fontSize: 10,
    fontStyle: "italic",
    marginTop: 1,
  },
  pickerNoEntriesText: {
    color: "#475569",
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 4,
  },
  navButton: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  navButtonText: {
    color: "#38BDF8",
    fontWeight: "bold",
    fontSize: 16,
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekdayText: {
    flex: 1,
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  emptyDayCell: {
    width: "14.28%",
    height: 56,
  },
  dayCell: {
    width: "14.28%",
    height: 56,
    borderColor: "#334155",
    borderWidth: 0.5,
    paddingHorizontal: 3,
    paddingVertical: 3,
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: "600",
    color: "#F8FAFC",
  },
  badgesContainer: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    marginTop: 4,
    maxWidth: "100%",
  },
  entryDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  extraCountText: {
    fontSize: 9,
    color: "#38BDF8",
    fontWeight: "bold",
    lineHeight: 11,
  },
  dayDetailBox: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  detailTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#F8FAFC",
  },
  closeButton: {
    backgroundColor: "#334155",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closeButtonText: {
    color: "#94A3B8",
    fontSize: 12,
  },
  noEntriesText: {
    color: "#64748B",
    fontStyle: "italic",
    fontSize: 13,
  },
  entryRow: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  entryRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    flexWrap: "wrap",
    gap: 6,
  },
  entryBadgesRow: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
  },
  tagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  catBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  reminderBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.16)",
    borderColor: "rgba(245, 158, 11, 0.45)",
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    maxWidth: "100%",
    flexShrink: 1,
  },
  reminderBadgeText: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "700",
    flexWrap: "wrap",
    lineHeight: 15,
  },
  reminderScheduleBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.10)",
    borderColor: "rgba(245, 158, 11, 0.30)",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
  },
  reminderScheduleBannerText: {
    color: "#FEF3C7",
    fontSize: 11,
    lineHeight: 16,
  },
  reminderScheduleBannerBold: {
    fontWeight: "700",
    color: "#F59E0B",
  },
  entryTimeText: {
    color: "#94A3B8",
    fontSize: 11,
  },
  entryContentPreview: {
    color: "#F8FAFC",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  entryCardFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    flexWrap: "wrap",
    gap: 6,
  },
  deleteEntryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.35)",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deleteEntryBtnText: {
    color: "#F87171",
    fontSize: 11,
    fontWeight: "700",
  },
  editHintRow: {
    alignItems: "flex-end",
  },
  editHintText: {
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "600",
  },
  deleteConfirmBox: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "#EF4444",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    gap: 8,
  },
  deleteConfirmText: {
    color: "#FECACA",
    fontSize: 12,
    fontWeight: "600",
  },
  deleteConfirmActions: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  deleteConfirmBtn: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteConfirmBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
  },
  deleteCancelBtn: {
    backgroundColor: "#334155",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteCancelBtnText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  monthSummaryCard: {
    marginTop: 16,
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  monthSummaryTitle: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  summaryStatsRow: {
    flexDirection: "row",
    gap: 12,
  },
  summaryStatBadge: {
    flex: 1,
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    alignItems: "center",
  },
  summaryStatValue: {
    color: "#38BDF8",
    fontSize: 18,
    fontWeight: "800",
  },
  summaryStatLabel: {
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 2,
  },
  entryCardTitle: {
    color: "#38BDF8",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  noTitleContainer: {
    gap: 6,
    marginBottom: 6,
  },
  addTitleBtn: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "#38BDF8",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 2,
  },
  addTitleBtnText: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "600",
  },
  quickTitleForm: {
    backgroundColor: "#1E293B",
    borderColor: "#38BDF8",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    gap: 8,
  },
  quickTitleInput: {
    backgroundColor: "#0F172A",
    borderColor: "#38BDF8",
    borderWidth: 1,
    borderRadius: 6,
    color: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
  },
  quickTitleActions: {
    flexDirection: "row",
    gap: 8,
  },
  quickTitleSaveBtn: {
    backgroundColor: "#10B981",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickTitleSaveText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  quickTitleCancelBtn: {
    backgroundColor: "#334155",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickTitleCancelText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  // Day Grid Cell highlights
  dayCellSelected: {
    borderColor: "#38BDF8",
    borderWidth: 1.5,
    backgroundColor: "rgba(56, 189, 248, 0.08)",
  },
  dayCellToday: {
    borderColor: "#10B981",
  },
  dayCellHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    maxWidth: "100%",
  },
  dayNumberSelected: {
    color: "#38BDF8",
    fontWeight: "800",
  },
  dayNumberToday: {
    color: "#10B981",
    fontWeight: "800",
  },
  dayReminderBell: {
    position: "absolute",
    top: 2,
    right: 2,
    fontSize: 8,
    lineHeight: 10,
    zIndex: 2,
  },
  dayReminderBellToday: {
    right: undefined,
    left: 2,
  },
  todayPill: {
    backgroundColor: "#10B981",
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  todayPillText: {
    color: "#FFFFFF",
    fontSize: 7,
    fontWeight: "900",
  },
  // Day detail header
  detailSubtitle: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 2,
  },
  detailHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickAddEntryBtn: {
    backgroundColor: "#0284C7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quickAddEntryBtnActive: {
    backgroundColor: "#0369A1",
    borderColor: "#38BDF8",
    borderWidth: 1,
  },
  quickAddEntryBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  quickAddVoiceBtn: {
    backgroundColor: "#6366F1",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quickAddVoiceBtnActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#818CF8",
    borderWidth: 1,
  },
  quickAddVoiceBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  quickVoiceCard: {
    backgroundColor: "#1E293B",
    borderColor: "#818CF8",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  quickVoiceHeader: {
    marginBottom: 8,
  },
  quickVoiceTitle: {
    color: "#818CF8",
    fontSize: 14,
    fontWeight: "700",
  },
  toastBanner: {
    backgroundColor: "rgba(16, 185, 129, 0.16)",
    borderColor: "rgba(16, 185, 129, 0.45)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  toastBannerText: {
    color: "#6EE7B7",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  // Quick Add Form
  quickAddFormCard: {
    backgroundColor: "#1E293B",
    borderColor: "#38BDF8",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  quickAddFormTitle: {
    color: "#38BDF8",
    fontSize: 14,
    fontWeight: "700",
  },
  quickAddSublabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  quickAddChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  quickAddCatChip: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  quickAddCatChipText: {
    color: "#94A3B8",
    fontSize: 12,
  },
  quickAddPriorityRow: {
    gap: 6,
  },
  quickAddPriorityChips: {
    flexDirection: "row",
    gap: 6,
  },
  quickPriorityChip: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  quickPriorityChipText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  quickAddInput: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 6,
    color: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  quickAddTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  quickAddTimeInputNative: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 6,
    color: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    width: 90,
  },
  quickAddReminderToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  quickCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#64748B",
    alignItems: "center",
    justifyContent: "center",
  },
  quickCheckboxChecked: {
    backgroundColor: "#F59E0B",
    borderColor: "#F59E0B",
  },
  quickCheckboxText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
  },
  quickAddReminderLabel: {
    color: "#E2E8F0",
    fontSize: 12,
    fontWeight: "600",
  },
  quickAddPresetsRow: {
    flexDirection: "row",
    gap: 6,
  },
  quickPresetChip: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quickPresetChipDisabled: {
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    borderColor: "rgba(255, 255, 255, 0.05)",
    opacity: 0.35,
  },
  quickPresetChipActive: {
    backgroundColor: "rgba(245, 158, 11, 0.25)",
    borderColor: "#F59E0B",
  },
  quickPresetChipText: {
    color: "#94A3B8",
    fontSize: 11,
  },
  quickPresetChipTextActive: {
    color: "#F59E0B",
    fontWeight: "bold",
  },
  quickPresetChipTextDisabled: {
    color: "#475569",
    textDecorationLine: "line-through",
  },
  quickAddSubmitRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  quickAddSubmitBtn: {
    backgroundColor: "#10B981",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flex: 1,
    alignItems: "center",
  },
  quickAddSubmitBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "bold",
  },
  quickAddCancelBtn: {
    backgroundColor: "#334155",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  quickAddCancelBtnText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Task completion toggles
  entryRowCompleted: {
    opacity: 0.65,
  },
  taskCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#64748B",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  taskCheckboxCompleted: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  taskCheckboxCheck: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  textCompletedStrikethrough: {
    textDecorationLine: "line-through",
    color: "#94A3B8",
  },
  // Quick Reminder Drawer
  quickReminderDrawer: {
    backgroundColor: "#0B132B",
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  quickReminderDrawerTitle: {
    color: "#F59E0B",
    fontSize: 13,
    fontWeight: "700",
  },
  quickReminderSubhead: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: "600",
  },
  quickReminderPresetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  quickReminderLivePreviewBox: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.35)",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 2,
    marginBottom: 2,
  },
  quickReminderLivePreviewText: {
    color: "#CBD5E1",
    fontSize: 11,
  },
  quickReminderLivePreviewHighlight: {
    color: "#F59E0B",
    fontWeight: "700",
  },
  reminderPresetButton: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  reminderPresetButtonActive: {
    backgroundColor: "rgba(245, 158, 11, 0.25)",
    borderColor: "#F59E0B",
  },
  reminderPresetButtonDisabled: {
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    borderColor: "rgba(255, 255, 255, 0.05)",
    opacity: 0.35,
  },
  reminderPresetButtonText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  reminderPresetButtonTextActive: {
    color: "#F59E0B",
    fontWeight: "bold",
  },
  reminderPresetButtonTextDisabled: {
    color: "#475569",
    textDecorationLine: "line-through",
  },
  quickReminderRecurrenceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  reminderRecurrenceChip: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  reminderRecurrenceChipActive: {
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    borderColor: "#38BDF8",
  },
  reminderRecurrenceChipText: {
    color: "#94A3B8",
    fontSize: 11,
  },
  reminderRecurrenceChipTextActive: {
    color: "#38BDF8",
    fontWeight: "bold",
  },
  quickReminderDrawerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  saveReminderActionBtn: {
    backgroundColor: "#F59E0B",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  saveReminderActionBtnText: {
    color: "#0F172A",
    fontSize: 11,
    fontWeight: "bold",
  },
  disableReminderActionBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  disableReminderActionBtnText: {
    color: "#F87171",
    fontSize: 11,
    fontWeight: "600",
  },
  advancedReminderBtn: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "#38BDF8",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  advancedReminderBtnText: {
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "600",
  },
  cancelReminderActionBtn: {
    backgroundColor: "#334155",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  cancelReminderActionBtnText: {
    color: "#94A3B8",
    fontSize: 11,
  },
  footerLeftButtons: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    flex: 1,
  },
  quickReminderToggleBtn: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quickReminderToggleBtnActive: {
    backgroundColor: "rgba(245, 158, 11, 0.28)",
    borderColor: "#F59E0B",
  },
  quickReminderToggleBtnText: {
    color: "#FBBF24",
    fontSize: 11,
    fontWeight: "700",
  },
  quickReminderToggleBtnTextActive: {
    color: "#F59E0B",
    fontWeight: "bold",
  },
  viewDetailBtn: {
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.35)",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewDetailBtnText: {
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "600",
  },
  // Summary Top Row
  summaryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "wrap",
    gap: 8,
  },
  testNotificationBtn: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderColor: "#38BDF8",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  testNotificationBtnText: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "700",
  },
  // Day detail view mode toggle & Google Calendar timeline (#133)
  viewModeToggleRow: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    borderRadius: 6,
    padding: 3,
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  viewModeToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
  },
  viewModeToggleBtnActive: {
    backgroundColor: "#0284C7",
  },
  viewModeToggleBtnText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  viewModeToggleBtnTextActive: {
    color: "#FFFFFF",
  },
  timelineContainer: {
    marginTop: 4,
  },
  timelineSummaryBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1E293B",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 8,
    flexWrap: "wrap",
    gap: 4,
  },
  timelineSummaryText: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "bold",
  },
  timelineFreeHint: {
    color: "#64748B",
    fontSize: 11,
    fontStyle: "italic",
  },
  timelineAllDayBox: {
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
  },
  timelineAllDayTitle: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 6,
  },
  timelineAllDayItems: {
    flexDirection: "column",
    gap: 6,
  },
  timelineScrollView: {
    maxHeight: 480,
  },
  timelineHourRow: {
    flexDirection: "row",
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
    alignItems: "stretch",
  },
  timelineGutter: {
    width: 48,
    paddingTop: 6,
    paddingRight: 6,
    alignItems: "flex-end",
  },
  timelineGutterText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  timelineSlotContent: {
    flex: 1,
    paddingLeft: 8,
    paddingVertical: 4,
    borderLeftWidth: 1,
    borderLeftColor: "rgba(51, 65, 85, 0.35)",
  },
  timelineFreeSlot: {
    flex: 1,
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(51, 65, 85, 0.35)",
    borderStyle: "dashed",
  },
  timelineFreeSlotText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "500",
  },
  timelineEventsList: {
    flexDirection: "column",
    gap: 6,
  },
  timelineEventCard: {
    borderLeftWidth: 4,
  },
  timelineEventTimeBadge: {
    fontSize: 11,
    fontWeight: "bold",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
  },
});
