import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { listCategories } from "../db/categories";
import { DatabaseAdapter } from "../db/database";
import { listLocalEntries, updateLocalEntry } from "../db/entries";
import { listTags } from "../db/tags";
import { Category, Entry, Tag, formatDateTime, getEntryDisplayTitle } from "../types/domain";

export interface CalendarMonthViewProps {
  db: DatabaseAdapter;
  userId: string;
  initialDate?: Date;
  onSelectEntry?: (entryId: string) => void;
  selectedCategoryIds?: string[];
  refreshSignal?: number;
  onEntryUpdated?: () => void;
}

export function CalendarMonthView({
  db,
  userId,
  initialDate = new Date(),
  onSelectEntry,
  selectedCategoryIds,
  refreshSignal,
  onEntryUpdated,
}: CalendarMonthViewProps) {
  const [currentDate, setCurrentDate] = useState<Date>(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedDayEntries, setSelectedDayEntries] = useState<{
    dateStr: string;
    items: Entry[];
  } | null>(null);
  const [editingTitleEntryId, setEditingTitleEntryId] = useState<string | null>(
    null,
  );
  const [quickTitleText, setQuickTitleText] = useState<string>("");

  const handleSaveQuickTitle = async (entryId: string) => {
    if (!quickTitleText.trim()) return;
    try {
      const updated = await updateLocalEntry(db, userId, entryId, {
        title: quickTitleText.trim(),
      });
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, title: updated.title } : e)),
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
          category_ids:
            selectedCategoryIds && selectedCategoryIds.length > 0
              ? selectedCategoryIds
              : undefined,
        });

        if (mounted) {
          setCategories(cats);
          setTags(tagList);
          setEntries(fetchedEntries);
        }
      } catch {
        // Offline fallback handling
      }
    }
    fetchData();
    return () => {
      mounted = false;
    };
  }, [db, userId, year, month, selectedCategoryIds, refreshSignal]);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDayEntries(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDayEntries(null);
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
      const dateKey = entry.occurred_at.substring(0, 10);
      const existing = entriesByDayMap.get(dateKey) || [];
      existing.push(entry);
      entriesByDayMap.set(dateKey, existing);
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

        <Text style={styles.monthTitle} testID="calendar-month-title">
          {`${MONTH_NAMES[month]} ${year}`}
        </Text>

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
          const visibleEntries = dayEntries.slice(0, 3);
          const extraCount = dayEntries.length - 3;

          return (
            <Pressable
              key={cell.dateStr}
              testID={`day-cell-${cell.dateStr}`}
              style={styles.dayCell}
              onPress={() =>
                setSelectedDayEntries({
                  dateStr: cell.dateStr,
                  items: dayEntries,
                })
              }
            >
              <Text style={styles.dayNumber}>{cell.dayNumber}</Text>

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
                  <Text style={styles.extraCountText}>{`+${extraCount}`}</Text>
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
            <Text style={styles.detailTitle}>
              {`Entradas del ${selectedDayEntries.dateStr}`}
            </Text>
            <Pressable
              testID="btn-close-day-detail"
              style={styles.closeButton}
              onPress={() => setSelectedDayEntries(null)}
            >
              <Text style={styles.closeButtonText}>Cerrar</Text>
            </Pressable>
          </View>

          {selectedDayEntries.items.length === 0 ? (
            <Text style={styles.noEntriesText}>
              No hay entradas fechadas en este día.
            </Text>
          ) : (
            selectedDayEntries.items.map((ent) => {
              const cat = categoryMap.get(ent.category_id);
              const timeStr = ent.occurred_at
                ? new Date(ent.occurred_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Sin hora";

              return editingTitleEntryId === ent.id ? (
                <View key={ent.id} style={styles.quickTitleForm}>
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
                      testID={`btn-cancel-quick-title-${ent.id}`}
                      style={styles.quickTitleCancelBtn}
                      onPress={() => setEditingTitleEntryId(null)}
                    >
                      <Text style={styles.quickTitleCancelText}>Cancelar</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  key={ent.id}
                  testID={`entry-item-${ent.id}`}
                  style={styles.entryRow}
                  onPress={() => onSelectEntry?.(ent.id)}
                >
                  <View style={styles.entryRowHeader}>
                    <View style={styles.entryBadgesRow}>
                      <View
                        style={[
                          styles.catBadge,
                          { backgroundColor: cat?.color || "#38BDF8" },
                        ]}
                      >
                        <Text style={styles.catBadgeText}>
                          {cat?.name || "General"}
                        </Text>
                      </View>

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
                    <Text style={styles.entryTimeText}>
                      📅 {timeStr} {ent.reminder_enabled ? "• 🔔 Aviso activo " : ""}• 🕒 Creado: {formatDateTime(ent.created_at)}
                    </Text>
                  </View>

                  {ent.title ? (
                    <>
                      <Text style={styles.entryCardTitle}>📌 {ent.title}</Text>
                      <Text style={styles.entryContentPreview} numberOfLines={2}>
                        {ent.content}
                      </Text>
                    </>
                  ) : (
                    <View style={styles.noTitleContainer}>
                      <Text style={styles.entryContentPreview} numberOfLines={2}>
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
                        <Text style={styles.addTitleBtnText}>✏️ Añadir Título</Text>
                      </Pressable>
                    </View>
                  )}

                  <View style={styles.editHintRow}>
                    <Text style={styles.editHintText}>
                      👁️ Ver detalles / Editar
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      )}

      {/* Month Summary Sidebar / Panel */}
      <View style={styles.monthSummaryCard} testID="calendar-month-summary">
        <Text style={styles.monthSummaryTitle}>
          {`📊 Resumen de ${MONTH_NAMES[month]}`}
        </Text>

        <View style={styles.summaryStatsRow}>
          <View style={styles.summaryStatBadge}>
            <Text style={styles.summaryStatValue}>{entries.length}</Text>
            <Text style={styles.summaryStatLabel}>Entradas Fechadas</Text>
          </View>
          <View style={styles.summaryStatBadge}>
            <Text style={[styles.summaryStatValue, { color: "#F59E0B" }]}>
              {categories.length}
            </Text>
            <Text style={styles.summaryStatLabel}>Categorías Activas</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    maxWidth: 900,
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
    height: 54,
  },
  dayCell: {
    width: "14.28%",
    height: 54,
    borderColor: "#334155",
    borderWidth: 0.5,
    padding: 4,
    alignItems: "center",
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: "600",
    color: "#F8FAFC",
  },
  badgesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
    marginTop: 4,
    justifyContent: "center",
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
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
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
  editHintRow: {
    alignItems: "flex-end",
  },
  editHintText: {
    color: "#38BDF8",
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
});
