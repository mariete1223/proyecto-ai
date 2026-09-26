import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { listCategories } from "../db/categories";
import { DatabaseAdapter } from "../db/database";
import { listLocalEntries } from "../db/entries";
import { getTagUsageCount, listTags } from "../db/tags";
import { Category, Entry, Tag } from "../types/domain";

export interface ClassificationExplorerProps {
  db: DatabaseAdapter;
  userId: string;
  onSelectEntry?: (entryId: string) => void;
  pageSize?: number;
}

export function ClassificationExplorer({
  db,
  userId,
  onSelectEntry,
  pageSize = 5,
}: ClassificationExplorerProps) {
  const [activeTab, setActiveTab] = useState<"CATEGORIES" | "TAGS">(
    "CATEGORIES",
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [tagsWithUsage, setTagsWithUsage] = useState<
    { tag: Tag; count: number }[]
  >([]);

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);

  const [associatedEntries, setAssociatedEntries] = useState<Entry[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(pageSize);

  useEffect(() => {
    let mounted = true;
    async function loadCatalogs() {
      try {
        const cats = await listCategories(db, userId);
        const tgs = await listTags(db, userId);
        const tgsUsage = await Promise.all(
          tgs.map(async (tag) => {
            const count = await getTagUsageCount(db, userId, tag.id);
            return { tag, count };
          }),
        );

        if (mounted) {
          setCategories(cats);
          setTagsWithUsage(tgsUsage);
          if (cats.length > 0 && selectedCatId === null) {
            setSelectedCatId(cats[0].id);
          }
          if (tgs.length > 0 && selectedTagId === null) {
            setSelectedTagId(tgs[0].id);
          }
        }
      } catch {
        // Fallback
      }
    }
    loadCatalogs();
    return () => {
      mounted = false;
    };
  }, [db, userId, selectedCatId, selectedTagId]);

  useEffect(() => {
    let mounted = true;
    async function fetchEntries() {
      try {
        let items: Entry[] = [];
        if (activeTab === "CATEGORIES" && selectedCatId) {
          items = await listLocalEntries(db, userId, {
            category_ids: [selectedCatId],
          });
        } else if (activeTab === "TAGS" && selectedTagId) {
          items = await listLocalEntries(db, userId, {
            tag_ids: [selectedTagId],
          });
        }
        if (mounted) {
          setAssociatedEntries(items);
          setVisibleCount(pageSize);
        }
      } catch {
        if (mounted) {
          setAssociatedEntries([]);
        }
      }
    }
    fetchEntries();
    return () => {
      mounted = false;
    };
  }, [db, userId, activeTab, selectedCatId, selectedTagId, pageSize]);

  const handleSelectCategory = (catId: string) => {
    setSelectedCatId(catId);
  };

  const handleSelectTag = (tagId: string) => {
    setSelectedTagId(tagId);
  };

  const loadMore = () => {
    setVisibleCount((prev) => prev + pageSize);
  };

  const visibleEntries = associatedEntries.slice(0, visibleCount);
  const hasMore = visibleCount < associatedEntries.length;

  return (
    <View style={styles.card} testID="classification-explorer">
      <Text style={styles.title}>Navegación por Clasificación</Text>

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <Pressable
          testID="tab-categories"
          style={[
            styles.tabButton,
            activeTab === "CATEGORIES" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("CATEGORIES")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "CATEGORIES" && styles.tabTextActive,
            ]}
          >
            Por Categorías
          </Text>
        </Pressable>

        <Pressable
          testID="tab-tags"
          style={[
            styles.tabButton,
            activeTab === "TAGS" && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab("TAGS")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "TAGS" && styles.tabTextActive,
            ]}
          >
            Por Etiquetas
          </Text>
        </Pressable>
      </View>

      {/* Catalog Selector */}
      {activeTab === "CATEGORIES" ? (
        <View style={styles.chipsRow} testID="explorer-cat-list">
          {categories.map((cat) => (
            <Pressable
              key={cat.id}
              testID={`explore-cat-${cat.id}`}
              style={[
                styles.chip,
                selectedCatId === cat.id && {
                  backgroundColor: cat.color,
                  borderColor: cat.color,
                },
              ]}
              onPress={() => handleSelectCategory(cat.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedCatId === cat.id && styles.chipTextSelected,
                ]}
              >
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.chipsRow} testID="explorer-tag-list">
          {tagsWithUsage.map(({ tag, count }) => (
            <Pressable
              key={tag.id}
              testID={`explore-tag-${tag.id}`}
              style={[
                styles.chip,
                selectedTagId === tag.id && styles.chipActive,
              ]}
              onPress={() => handleSelectTag(tag.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedTagId === tag.id && styles.chipTextActive,
                ]}
              >
                {`#${tag.name} (${count})`}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Associated Entries List */}
      <Text style={styles.sectionTitle}>Entradas Asociadas</Text>
      <View style={styles.entriesList} testID="associated-entries-list">
        {associatedEntries.length === 0 ? (
          <Text style={styles.emptyText} testID="empty-entries-text">
            {activeTab === "CATEGORIES"
              ? "No hay entradas asociadas a esta categoría."
              : "No hay entradas asociadas a esta etiqueta."}
          </Text>
        ) : (
          visibleEntries.map((entry) => (
            <Pressable
              key={entry.id}
              testID={`entry-card-${entry.id}`}
              style={styles.entryCard}
              onPress={() => onSelectEntry && onSelectEntry(entry.id)}
            >
              <Text style={styles.entryContent}>{entry.content}</Text>
              {entry.occurred_at && (
                <Text style={styles.entryDate}>
                  {`Fecha: ${entry.occurred_at.substring(0, 10)}`}
                </Text>
              )}
            </Pressable>
          ))
        )}

        {hasMore && (
          <Pressable
            testID="btn-load-more-explorer"
            style={styles.loadMoreButton}
            onPress={loadMore}
          >
            <Text style={styles.loadMoreText}>Cargar más entradas</Text>
          </Pressable>
        )}
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
    maxWidth: 600,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#F8FAFC",
    marginBottom: 14,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#0F172A",
    borderRadius: 8,
    padding: 4,
    marginBottom: 14,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  tabButtonActive: {
    backgroundColor: "#38BDF8",
  },
  tabText: {
    color: "#94A3B8",
    fontWeight: "600",
    fontSize: 14,
  },
  tabTextActive: {
    color: "#0F172A",
    fontWeight: "bold",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: "#38BDF8",
    borderColor: "#38BDF8",
  },
  chipText: {
    color: "#94A3B8",
    fontSize: 13,
  },
  chipTextActive: {
    color: "#0F172A",
    fontWeight: "bold",
  },
  chipTextSelected: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#94A3B8",
    marginBottom: 10,
  },
  entriesList: {
    gap: 8,
  },
  emptyText: {
    color: "#64748B",
    fontStyle: "italic",
  },
  entryCard: {
    backgroundColor: "#0F172A",
    borderRadius: 8,
    padding: 12,
    borderColor: "#334155",
    borderWidth: 1,
  },
  entryContent: {
    color: "#F8FAFC",
    fontSize: 14,
  },
  entryDate: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 4,
  },
  loadMoreButton: {
    backgroundColor: "#334155",
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10,
  },
  loadMoreText: {
    color: "#38BDF8",
    fontWeight: "bold",
    fontSize: 13,
  },
});
