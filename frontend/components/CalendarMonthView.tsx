import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { listCategories } from "../db/categories";
import { DatabaseAdapter } from "../db/database";
import { listLocalEntries } from "../db/entries";
import { Category, Entry } from "../types/domain";

export interface CalendarMonthViewProps {
  db: DatabaseAdapter;
  userId: string;
  initialDate?: Date;
  onSelectEntry?: (entryId: string) => void;
  selectedCategoryIds?: string[];
}

export function CalendarMonthView({
  db,
  userId,
  initialDate = new Date(),
  onSelectEntry,
  selectedCategoryIds,
}: CalendarMonthViewProps) {
  const [currentDate, setCurrentDate] = useState<Date>(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedDayEntries, setSelectedDayEntries] = useState<{
    dateStr: string;
    items: Entry[];
  } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      try {
        const cats = await listCategories(db, userId);
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
  }, [db, userId, year, month, selectedCategoryIds]);

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
              return (
                <Pressable
                  key={ent.id}
                  testID={`entry-item-${ent.id}`}
                  style={styles.entryRow}
                  onPress={() => onSelectEntry && onSelectEntry(ent.id)}
                >
                  <View
                    style={[
                      styles.catIndicator,
                      { backgroundColor: cat?.color || "#38BDF8" },
                    ]}
                  />
                  <Text style={styles.entryText} numberOfLines={2}>
                    {ent.content}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
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
    maxWidth: 600,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    borderBottomColor: "#1E293B",
    borderBottomWidth: 1,
  },
  catIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  entryText: {
    color: "#F8FAFC",
    fontSize: 13,
    flex: 1,
  },
});
