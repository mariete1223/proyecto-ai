import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { createLocalCategory, listCategories } from "../db/categories";
import { DatabaseAdapter } from "../db/database";
import { listLocalEntries } from "../db/entries";
import { createLocalTag, getTagUsageCount, listTags } from "../db/tags";
import { Category, CategoryKind, Entry, Tag } from "../types/domain";

export interface ClassificationExplorerProps {
  db: DatabaseAdapter;
  userId: string;
  onSelectEntry?: (entryId: string) => void;
  pageSize?: number;
  onCatalogUpdated?: () => void;
}

const PRESET_COLORS = [
  "#38BDF8", // Sky Blue
  "#3B82F6", // Royal Blue
  "#6366F1", // Indigo
  "#8B5CF6", // Purple
  "#A855F7", // Violet
  "#D946EF", // Fuchsia
  "#EC4899", // Pink
  "#F43F5E", // Rose
  "#EF4444", // Red
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#EAB308", // Yellow / Gold
  "#84CC16", // Lime
  "#10B981", // Emerald
  "#14B8A6", // Teal
  "#06B6D4", // Cyan
];

export function ClassificationExplorer({
  db,
  userId,
  onSelectEntry,
  pageSize = 5,
  onCatalogUpdated,
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
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"NEWEST" | "OLDEST" | "ALPHA">(
    "NEWEST",
  );
  const [categoryCounts, setCategoryCounts] = useState<{
    [catId: string]: number;
  }>({});

  // Creation forms state
  const [showAddCatForm, setShowAddCatForm] = useState(false);
  const [showAddTagForm, setShowAddTagForm] = useState(false);

  const [newCatName, setNewCatName] = useState("");
  const [newCatVoice, setNewCatVoice] = useState("");
  const [newCatColor, setNewCatColor] = useState("#38BDF8");
  const [newCatKind, setNewCatKind] = useState<CategoryKind>("STANDARD");

  const [newTagName, setNewTagName] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const loadCatalogs = async () => {
    try {
      const cats = await listCategories(db, userId);
      const tgs = await listTags(db, userId);
      const allEntries = await listLocalEntries(db, userId);
      const counts: { [catId: string]: number } = {};
      cats.forEach((c) => {
        counts[c.id] = allEntries.filter((e) => e.category_id === c.id).length;
      });

      const tgsUsage = await Promise.all(
        tgs.map(async (tag) => {
          const count = await getTagUsageCount(db, userId, tag.id);
          return { tag, count };
        }),
      );

      setCategories(cats);
      setCategoryCounts(counts);
      setTagsWithUsage(tgsUsage);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    let mounted = true;
    async function fetchCatalogs() {
      try {
        const cats = await listCategories(db, userId);
        const tgs = await listTags(db, userId);
        const allEntries = await listLocalEntries(db, userId);
        const counts: { [catId: string]: number } = {};
        cats.forEach((c) => {
          counts[c.id] = allEntries.filter(
            (e) => e.category_id === c.id,
          ).length;
        });

        const tgsUsage = await Promise.all(
          tgs.map(async (tag) => {
            const count = await getTagUsageCount(db, userId, tag.id);
            return { tag, count };
          }),
        );

        if (mounted) {
          setCategories(cats);
          setCategoryCounts(counts);
          setTagsWithUsage(tgsUsage);

          if (
            cats.length > 0 &&
            (selectedCatId === null ||
              !cats.some((c) => c.id === selectedCatId))
          ) {
            setSelectedCatId(cats[0].id);
          }
          if (
            tgs.length > 0 &&
            (selectedTagId === null || !tgs.some((t) => t.id === selectedTagId))
          ) {
            setSelectedTagId(tgs[0].id);
          }
        }
      } catch {
        // Fallback
      }
    }
    fetchCatalogs();
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

  const handleCreateCategory = async () => {
    setFormError(null);
    setFormSuccess(null);

    if (!newCatName.trim() || !newCatVoice.trim()) {
      setFormError("El nombre y el comando de voz son obligatorios.");
      return;
    }

    setFormLoading(true);
    try {
      const created = await createLocalCategory(db, userId, {
        name: newCatName.trim(),
        voice_command: newCatVoice.trim().toLowerCase(),
        color: newCatColor,
        kind: newCatKind,
      });

      setFormSuccess(`¡Categoría "${created.name}" creada con éxito!`);
      setNewCatName("");
      setNewCatVoice("");
      setNewCatColor("#38BDF8");
      setNewCatKind("STANDARD");
      setShowAddCatForm(false);

      setSelectedCatId(created.id);
      await loadCatalogs();
      onCatalogUpdated?.();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleCreateTag = async () => {
    setFormError(null);
    setFormSuccess(null);

    if (!newTagName.trim()) {
      setFormError("El nombre de la etiqueta no puede estar vacío.");
      return;
    }

    setFormLoading(true);
    try {
      const created = await createLocalTag(db, userId, {
        name: newTagName.trim(),
      });

      setFormSuccess(`¡Etiqueta #${created.name} creada con éxito!`);
      setNewTagName("");
      setShowAddTagForm(false);

      setSelectedTagId(created.id);
      await loadCatalogs();
      onCatalogUpdated?.();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setFormLoading(false);
    }
  };

  const activeCategory = categories.find((c) => c.id === selectedCatId);

  const filteredAndSortedEntries = associatedEntries
    .filter((e) => e.content.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === "NEWEST") {
        const timeA = a.occurred_at || a.created_at;
        const timeB = b.occurred_at || b.created_at;
        return timeB.localeCompare(timeA);
      }
      if (sortOrder === "OLDEST") {
        const timeA = a.occurred_at || a.created_at;
        const timeB = b.occurred_at || b.created_at;
        return timeA.localeCompare(timeB);
      }
      return a.content.localeCompare(b.content);
    });

  const visibleEntries = filteredAndSortedEntries.slice(0, visibleCount);
  const hasMore = visibleCount < filteredAndSortedEntries.length;

  return (
    <View style={styles.card} testID="classification-explorer">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Navegación por Clasificación</Text>
        {activeTab === "CATEGORIES" ? (
          <Pressable
            testID="btn-open-add-category"
            style={styles.addActionButton}
            onPress={() => {
              setShowAddCatForm((prev) => !prev);
              setFormError(null);
              setFormSuccess(null);
            }}
          >
            <Text style={styles.addActionButtonText}>
              {showAddCatForm ? "✕ Cerrar" : "➕ Nueva Categoría"}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            testID="btn-open-add-tag"
            style={styles.addActionButton}
            onPress={() => {
              setShowAddTagForm((prev) => !prev);
              setFormError(null);
              setFormSuccess(null);
            }}
          >
            <Text style={styles.addActionButtonText}>
              {showAddTagForm ? "✕ Cerrar" : "➕ Nueva Etiqueta"}
            </Text>
          </Pressable>
        )}
      </View>

      {formError && (
        <View style={styles.errorBox} testID="explorer-form-error">
          <Text style={styles.errorText}>{formError}</Text>
        </View>
      )}

      {formSuccess && (
        <View style={styles.successBox} testID="explorer-form-success">
          <Text style={styles.successText}>{formSuccess}</Text>
        </View>
      )}

      {/* Inline Form for New Category */}
      {activeTab === "CATEGORIES" && showAddCatForm && (
        <View style={styles.creationFormCard} testID="explorer-category-form">
          <Text style={styles.formCardTitle}>Crear Nueva Categoría</Text>

          <Text style={styles.inputLabel}>Nombre de Categoría *</Text>
          <TextInput
            testID="input-new-cat-name"
            style={styles.input}
            placeholder="Ej. Finanzas, Viajes, Proyectos"
            placeholderTextColor="#64748B"
            value={newCatName}
            onChangeText={setNewCatName}
          />

          <Text style={styles.inputLabel}>Comando de Voz *</Text>
          <TextInput
            testID="input-new-cat-voice"
            style={styles.input}
            placeholder="Ej. finanzas"
            placeholderTextColor="#64748B"
            value={newCatVoice}
            onChangeText={setNewCatVoice}
          />

          <Text style={styles.inputLabel}>
            Color de Categoría (Selecciona o escribe Hex)
          </Text>
          <View style={styles.colorInputRow}>
            <View
              style={[
                styles.colorPreviewDot,
                { backgroundColor: newCatColor || "#38BDF8" },
              ]}
            />
            <TextInput
              testID="input-new-cat-color"
              style={[styles.input, { flex: 1 }]}
              placeholder="#38BDF8"
              placeholderTextColor="#64748B"
              value={newCatColor}
              onChangeText={setNewCatColor}
            />
          </View>
          <View style={styles.colorRow}>
            {PRESET_COLORS.map((c) => (
              <Pressable
                key={c}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  newCatColor.toUpperCase() === c && styles.colorDotActive,
                ]}
                onPress={() => setNewCatColor(c)}
              />
            ))}
          </View>

          <Text style={styles.inputLabel}>Tipo de Categoría</Text>
          <View style={styles.kindRow}>
            {(["STANDARD", "TASK"] as CategoryKind[]).map((k) => (
              <Pressable
                key={k}
                style={[
                  styles.kindChip,
                  newCatKind === k && styles.kindChipActive,
                ]}
                onPress={() => setNewCatKind(k)}
              >
                <Text
                  style={[
                    styles.kindChipText,
                    newCatKind === k && styles.kindChipTextActive,
                  ]}
                >
                  {k === "STANDARD" ? "Estándar" : "Tarea"}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.formActionsRow}>
            <Pressable
              testID="btn-save-new-category"
              style={[styles.saveBtn, formLoading && styles.btnDisabled]}
              disabled={formLoading}
              onPress={handleCreateCategory}
            >
              <Text style={styles.saveBtnText}>
                {formLoading ? "Guardando..." : "💾 Guardar Categoría"}
              </Text>
            </Pressable>
            <Pressable
              testID="btn-cancel-new-category"
              style={styles.cancelBtn}
              onPress={() => setShowAddCatForm(false)}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Inline Form for New Tag */}
      {activeTab === "TAGS" && showAddTagForm && (
        <View style={styles.creationFormCard} testID="explorer-tag-form">
          <Text style={styles.formCardTitle}>Crear Nueva Etiqueta</Text>

          <Text style={styles.inputLabel}>Nombre de la Etiqueta *</Text>
          <TextInput
            testID="input-new-tag-name"
            style={styles.input}
            placeholder="Ej. urgente, importante, compras"
            placeholderTextColor="#64748B"
            value={newTagName}
            onChangeText={setNewTagName}
          />

          <View style={styles.formActionsRow}>
            <Pressable
              testID="btn-save-new-tag"
              style={[styles.saveBtn, formLoading && styles.btnDisabled]}
              disabled={formLoading}
              onPress={handleCreateTag}
            >
              <Text style={styles.saveBtnText}>
                {formLoading ? "Guardando..." : "💾 Guardar Etiqueta"}
              </Text>
            </Pressable>
            <Pressable
              testID="btn-cancel-new-tag"
              style={styles.cancelBtn}
              onPress={() => setShowAddTagForm(false)}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <Pressable
          testID="tab-categories"
          style={[
            styles.tabButton,
            activeTab === "CATEGORIES" && styles.tabButtonActive,
          ]}
          onPress={() => {
            setActiveTab("CATEGORIES");
            setShowAddCatForm(false);
            setShowAddTagForm(false);
          }}
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
          onPress={() => {
            setActiveTab("TAGS");
            setShowAddCatForm(false);
            setShowAddTagForm(false);
          }}
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
                <Text>{cat.name}</Text>
                <Text style={styles.chipCountText}>
                  {` (${categoryCounts[cat.id] ?? 0})`}
                </Text>
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

      {/* Search & Sort Bar */}
      <View style={styles.filterControlsRow}>
        <TextInput
          testID="input-search-explorer"
          style={styles.searchInputExplorer}
          placeholder="🔍 Buscar entradas en esta categoría..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <View style={styles.sortButtonsRow}>
          <Pressable
            testID="btn-sort-newest"
            style={[
              styles.sortBtn,
              sortOrder === "NEWEST" && styles.sortBtnActive,
            ]}
            onPress={() => setSortOrder("NEWEST")}
          >
            <Text
              style={[
                styles.sortBtnText,
                sortOrder === "NEWEST" && styles.sortBtnTextActive,
              ]}
            >
              Recientes
            </Text>
          </Pressable>
          <Pressable
            testID="btn-sort-oldest"
            style={[
              styles.sortBtn,
              sortOrder === "OLDEST" && styles.sortBtnActive,
            ]}
            onPress={() => setSortOrder("OLDEST")}
          >
            <Text
              style={[
                styles.sortBtnText,
                sortOrder === "OLDEST" && styles.sortBtnTextActive,
              ]}
            >
              Antiguas
            </Text>
          </Pressable>
          <Pressable
            testID="btn-sort-alpha"
            style={[
              styles.sortBtn,
              sortOrder === "ALPHA" && styles.sortBtnActive,
            ]}
            onPress={() => setSortOrder("ALPHA")}
          >
            <Text
              style={[
                styles.sortBtnText,
                sortOrder === "ALPHA" && styles.sortBtnTextActive,
              ]}
            >
              A-Z
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Associated Entries List */}
      <Text style={styles.sectionTitle}>
        {activeTab === "CATEGORIES" && activeCategory
          ? `Entradas en "${activeCategory.name}" (${filteredAndSortedEntries.length})`
          : `Entradas Asociadas (${filteredAndSortedEntries.length})`}
      </Text>

      <View style={styles.entriesList} testID="associated-entries-list">
        {filteredAndSortedEntries.length === 0 ? (
          <Text style={styles.emptyText} testID="empty-entries-text">
            {searchQuery
              ? `No se encontraron entradas para "${searchQuery}".`
              : activeTab === "CATEGORIES"
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
              <View style={styles.entryCardHeaderRow}>
                {activeTab === "CATEGORIES" && activeCategory && (
                  <View style={styles.catBadgeContainer}>
                    <View
                      style={[
                        styles.catColorBadge,
                        { backgroundColor: activeCategory.color || "#38BDF8" },
                      ]}
                    />
                    <Text style={styles.catBadgeName}>
                      {`📁 ${activeCategory.name}`}
                    </Text>
                  </View>
                )}
                {entry.occurred_at ? (
                  <Text style={styles.entryDate}>
                    {`📅 ${new Date(entry.occurred_at).toLocaleDateString(
                      "es-ES",
                      {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}`}
                  </Text>
                ) : (
                  <Text style={styles.entryDate}>
                    {`Creado: ${entry.created_at.substring(0, 10)}`}
                  </Text>
                )}
              </View>
              <Text style={styles.entryContent}>{entry.content}</Text>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    flexWrap: "wrap",
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#F8FAFC",
  },
  addActionButton: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    borderColor: "#38BDF8",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addActionButtonText: {
    color: "#38BDF8",
    fontWeight: "700",
    fontSize: 13,
  },
  creationFormCard: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  formCardTitle: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  inputLabel: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 6,
    color: "#F8FAFC",
    padding: 10,
    fontSize: 14,
  },
  colorInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  colorPreviewDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#334155",
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginVertical: 4,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  colorDotActive: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  kindRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 4,
  },
  kindChip: {
    backgroundColor: "#1E293B",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  kindChipActive: {
    backgroundColor: "#38BDF8",
    borderColor: "#38BDF8",
  },
  kindChipText: {
    color: "#94A3B8",
    fontSize: 13,
  },
  kindChipTextActive: {
    color: "#0F172A",
    fontWeight: "bold",
  },
  formActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    justifyContent: "flex-end",
  },
  saveBtn: {
    backgroundColor: "#10B981",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 13,
  },
  cancelBtn: {
    backgroundColor: "#334155",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: "#94A3B8",
    fontWeight: "600",
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  errorBox: {
    backgroundColor: "#7F1D1D",
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: "#FECACA",
    fontSize: 14,
  },
  successBox: {
    backgroundColor: "#064E3B",
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  successText: {
    color: "#A7F3D0",
    fontSize: 14,
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
  chipCountText: {
    fontSize: 11,
    opacity: 0.8,
  },
  filterControlsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
    alignItems: "center",
  },
  searchInputExplorer: {
    flex: 1,
    minWidth: 200,
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    color: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  sortButtonsRow: {
    flexDirection: "row",
    gap: 6,
  },
  sortBtn: {
    backgroundColor: "#0F172A",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sortBtnActive: {
    backgroundColor: "#38BDF8",
    borderColor: "#38BDF8",
  },
  sortBtnText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  sortBtnTextActive: {
    color: "#0F172A",
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
  entryCardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  catBadgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  catColorBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  catBadgeName: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "700",
  },
  entryContent: {
    color: "#F8FAFC",
    fontSize: 14,
  },
  entryDate: {
    color: "#64748B",
    fontSize: 11,
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
