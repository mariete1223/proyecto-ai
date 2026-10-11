import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { listCategories } from "../db/categories";
import { DatabaseAdapter } from "../db/database";
import { listTags } from "../db/tags";
import { Category, Tag } from "../types/domain";

export interface CalendarCategoryFilterProps {
  db: DatabaseAdapter;
  userId: string;
  refreshSignal?: number;
  onFilterChange: (selectedCategoryIds: string[]) => void;
  onTagFilterChange?: (selectedTagIds: string[]) => void;
}

export function CalendarCategoryFilter({
  db,
  userId,
  refreshSignal,
  onFilterChange,
  onTagFilterChange,
}: CalendarCategoryFilterProps) {
  const [activeTab, setActiveTab] = useState<"CATEGORIES" | "TAGS">("CATEGORIES");
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedCatIds, setSelectedCatIds] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [cats, tagList] = await Promise.all([
          listCategories(db, userId),
          listTags(db, userId),
        ]);
        if (mounted) {
          setCategories(cats);
          setTags(tagList);
          setSelectedCatIds([]);
          setSelectedTagIds([]);
        }
      } catch {
        // Fallback
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [db, userId, refreshSignal]);

  const toggleCategory = (catId: string) => {
    let updated: string[];
    if (selectedCatIds.includes(catId)) {
      updated = selectedCatIds.filter((id) => id !== catId);
    } else {
      updated = [...selectedCatIds, catId];
    }
    setSelectedCatIds(updated);
    onFilterChange(updated);
  };

  const toggleTag = (tagId: string) => {
    let updated: string[];
    if (selectedTagIds.includes(tagId)) {
      updated = selectedTagIds.filter((id) => id !== tagId);
    } else {
      updated = [...selectedTagIds, tagId];
    }
    setSelectedTagIds(updated);
    onTagFilterChange?.(updated);
  };

  const selectAllCategories = () => {
    setSelectedCatIds([]);
    onFilterChange([]);
  };

  const selectAllTags = () => {
    setSelectedTagIds([]);
    onTagFilterChange?.([]);
  };

  const resetAllFilters = () => {
    setSelectedCatIds([]);
    setSelectedTagIds([]);
    setTagSearch("");
    onFilterChange([]);
    onTagFilterChange?.([]);
  };

  const isAllCategoriesSelected = selectedCatIds.length === 0;
  const isAllTagsSelected = selectedTagIds.length === 0;

  const filteredTags = tags.filter((t) =>
    t.name.toLowerCase().includes(tagSearch.trim().toLowerCase()),
  );

  return (
    <View style={styles.container} testID="calendar-category-filter">
      {/* Header with Title and Reset */}
      <View style={styles.headerRow}>
        <Text style={styles.label}>Filtros del Calendario</Text>
        <Pressable
          testID="btn-reset-cat-filter"
          style={styles.resetButton}
          onPress={resetAllFilters}
        >
          <Text style={styles.resetText}>Restablecer Filtros</Text>
        </Pressable>
      </View>

      {/* Tabs Row: Por Categorías / Por Etiquetas */}
      <View style={styles.tabsRow}>
        <Pressable
          testID="filter-tab-categories"
          style={[
            styles.tabButton,
            activeTab === "CATEGORIES" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("CATEGORIES")}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "CATEGORIES" && styles.tabButtonTextActive,
            ]}
          >
            {`Por Categorías${selectedCatIds.length > 0 ? ` (${selectedCatIds.length})` : ""}`}
          </Text>
        </Pressable>

        <Pressable
          testID="filter-tab-tags"
          style={[
            styles.tabButton,
            activeTab === "TAGS" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("TAGS")}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "TAGS" && styles.tabButtonTextActive,
            ]}
          >
            {`Por Etiquetas${selectedTagIds.length > 0 ? ` (${selectedTagIds.length})` : ""}`}
          </Text>
        </Pressable>
      </View>

      {/* Content depending on Active Tab */}
      {activeTab === "CATEGORIES" ? (
        <View style={styles.chipsRow} testID="filter-chips-container">
          <Pressable
            testID="chip-all-categories"
            style={[styles.chip, isAllCategoriesSelected && styles.chipActive]}
            onPress={selectAllCategories}
          >
            <Text
              style={[
                styles.chipText,
                isAllCategoriesSelected && styles.chipTextActive,
              ]}
            >
              Todas las Categorías
            </Text>
          </Pressable>

          {categories.map((cat) => {
            const isSelected = selectedCatIds.includes(cat.id);
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
      ) : (
        <View style={styles.tagsSectionContainer}>
          {/* Tag search input */}
          <TextInput
            testID="input-search-calendar-tags"
            style={styles.searchInput}
            placeholder="🔍 Buscar etiquetas..."
            placeholderTextColor="#64748B"
            value={tagSearch}
            onChangeText={setTagSearch}
          />

          <View style={styles.chipsRow} testID="filter-tag-chips-container">
            <Pressable
              testID="chip-all-tags"
              style={[styles.chip, isAllTagsSelected && styles.chipActive]}
              onPress={selectAllTags}
            >
              <Text
                style={[
                  styles.chipText,
                  isAllTagsSelected && styles.chipTextActive,
                ]}
              >
                Todas las Etiquetas
              </Text>
            </Pressable>

            {filteredTags.map((tag) => {
              const isSelected = selectedTagIds.includes(tag.id);
              const tagColor = tag.color || "#38BDF8";
              return (
                <Pressable
                  key={tag.id}
                  testID={`filter-tag-chip-${tag.id}`}
                  style={[
                    styles.chip,
                    isSelected
                      ? {
                          backgroundColor: tagColor,
                          borderColor: tagColor,
                        }
                      : {
                          borderColor: `${tagColor}88`,
                        },
                  ]}
                  onPress={() => toggleTag(tag.id)}
                >
                  <View style={styles.chipInnerRow}>
                    {!isSelected && (
                      <View
                        style={[
                          styles.colorDotTiny,
                          { backgroundColor: tagColor },
                        ]}
                      />
                    )}
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextSelected,
                      ]}
                    >
                      {`#${tag.name}`}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
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
    marginBottom: 10,
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
  tabsRow: {
    flexDirection: "row",
    backgroundColor: "#0F172A",
    borderRadius: 6,
    padding: 3,
    marginBottom: 10,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 4,
  },
  tabButtonActive: {
    backgroundColor: "#38BDF8",
  },
  tabButtonText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  tabButtonTextActive: {
    color: "#0F172A",
    fontWeight: "700",
  },
  tagsSectionContainer: {
    gap: 8,
  },
  searchInput: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 6,
    color: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
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
  chipInnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  colorDotTiny: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
