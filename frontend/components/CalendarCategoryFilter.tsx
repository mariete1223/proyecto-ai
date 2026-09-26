import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { listCategories } from "../db/categories";
import { DatabaseAdapter } from "../db/database";
import { Category } from "../types/domain";

export interface CalendarCategoryFilterProps {
  db: DatabaseAdapter;
  userId: string;
  onFilterChange: (selectedCategoryIds: string[]) => void;
}

export function CalendarCategoryFilter({
  db,
  userId,
  onFilterChange,
}: CalendarCategoryFilterProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    async function loadCats() {
      try {
        const cats = await listCategories(db, userId);
        if (mounted) {
          setCategories(cats);
          // By default, show all categories (empty selectedIds means all)
          setSelectedIds([]);
        }
      } catch {
        // Fallback
      }
    }
    loadCats();
    return () => {
      mounted = false;
    };
  }, [db, userId]);

  const toggleCategory = (catId: string) => {
    let updated: string[];
    if (selectedIds.includes(catId)) {
      updated = selectedIds.filter((id) => id !== catId);
    } else {
      updated = [...selectedIds, catId];
    }
    setSelectedIds(updated);
    onFilterChange(updated);
  };

  const selectAll = () => {
    setSelectedIds([]);
    onFilterChange([]);
  };

  const isAllSelected = selectedIds.length === 0;

  return (
    <View style={styles.container} testID="calendar-category-filter">
      <View style={styles.headerRow}>
        <Text style={styles.label}>Filtro de Categorías</Text>
        <Pressable
          testID="btn-reset-cat-filter"
          style={styles.resetButton}
          onPress={selectAll}
        >
          <Text style={styles.resetText}>Restablecer Filtro</Text>
        </Pressable>
      </View>

      <View style={styles.chipsRow} testID="filter-chips-container">
        <Pressable
          testID="chip-all-categories"
          style={[styles.chip, isAllSelected && styles.chipActive]}
          onPress={selectAll}
        >
          <Text
            style={[styles.chipText, isAllSelected && styles.chipTextActive]}
          >
            Todas las Categorías
          </Text>
        </Pressable>

        {categories.map((cat) => {
          const isSelected = selectedIds.includes(cat.id);
          return (
            <Pressable
              key={cat.id}
              testID={`filter-chip-${cat.id}`}
              style={[
                styles.chip,
                isSelected && {
                  backgroundColor: cat.color,
                  borderColor: cat.color,
                },
              ]}
              onPress={() => toggleCategory(cat.id)}
            >
              <Text
                style={[styles.chipText, isSelected && styles.chipTextSelected]}
              >
                {cat.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1E293B",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    width: "100%",
    maxWidth: 600,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#F8FAFC",
  },
  resetButton: {
    backgroundColor: "#334155",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  resetText: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "600",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipActive: {
    backgroundColor: "#38BDF8",
    borderColor: "#38BDF8",
  },
  chipText: {
    color: "#94A3B8",
    fontSize: 12,
  },
  chipTextActive: {
    color: "#0F172A",
    fontWeight: "bold",
  },
  chipTextSelected: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});
