import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  createLocalCategory,
  listCategories,
  updateLocalCategory,
} from "../db/categories";
import { DatabaseAdapter } from "../db/database";
import { Category, CategoryKind } from "../types/domain";

export interface CategoryManagerProps {
  db: DatabaseAdapter;
  userId: string;
  onCategoryChanged?: () => void;
}

const PRESET_COLORS = [
  "#38BDF8",
  "#818CF8",
  "#F59E0B",
  "#EF4444",
  "#10B981",
  "#EC4899",
];

export function CategoryManager({
  db,
  userId,
  onCategoryChanged,
}: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [name, setName] = useState<string>("");
  const [voiceCommand, setVoiceCommand] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [color, setColor] = useState<string>("#38BDF8");
  const [icon, setIcon] = useState<string>("folder");
  const [kind, setKind] = useState<CategoryKind>("STANDARD");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    async function fetchCategories() {
      try {
        const cats = await listCategories(db, userId);
        if (mounted) {
          setCategories(cats);
        }
      } catch (err) {
        if (mounted) {
          setErrorMessage((err as Error).message);
        }
      }
    }
    fetchCategories();
    return () => {
      mounted = false;
    };
  }, [db, userId]);

  const resetForm = () => {
    setEditingCategory(null);
    setName("");
    setVoiceCommand("");
    setDescription("");
    setColor("#38BDF8");
    setIcon("folder");
    setKind("STANDARD");
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const startEdit = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setVoiceCommand(cat.voice_command);
    setDescription(cat.description || "");
    setColor(cat.color || "#38BDF8");
    setIcon(cat.icon || "folder");
    setKind(cat.kind);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!name.trim() || !voiceCommand.trim()) {
      setErrorMessage("El nombre y el comando de voz son obligatorios.");
      return;
    }

    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      setErrorMessage("Formato de color hexadecimal inválido (ej. #38BDF8).");
      return;
    }

    setLoading(true);
    try {
      if (editingCategory) {
        await updateLocalCategory(db, userId, editingCategory.id, {
          name: name.trim(),
          voice_command: voiceCommand.trim(),
          description: description.trim(),
          color: color.toUpperCase(),
          icon: icon.trim(),
        });
      } else {
        await createLocalCategory(db, userId, {
          name: name.trim(),
          voice_command: voiceCommand.trim(),
          description: description.trim(),
          color: color.toUpperCase(),
          icon: icon.trim(),
          kind,
        });
      }

      const wasEditing = Boolean(editingCategory);
      resetForm();
      if (wasEditing) {
        setSuccessMessage("¡Categoría actualizada correctamente!");
      } else {
        setSuccessMessage("¡Categoría creada correctamente!");
      }

      const cats = await listCategories(db, userId);
      setCategories(cats);
      if (onCategoryChanged) {
        onCategoryChanged();
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container} testID="category-manager">
      <Text style={styles.headerTitle}>Gestión de Categorías</Text>

      {errorMessage && (
        <View style={styles.errorBox} testID="category-manager-error">
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {successMessage && (
        <View style={styles.successBox} testID="category-manager-success">
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}

      {/* Category List */}
      <Text style={styles.sectionTitle}>Categorías Existentes</Text>
      <View style={styles.listContainer} testID="category-list">
        {categories.length === 0 ? (
          <Text style={styles.emptyText}>No hay categorías creadas.</Text>
        ) : (
          categories.map((cat) => (
            <View
              key={cat.id}
              style={styles.categoryCard}
              testID={`cat-item-${cat.id}`}
            >
              <View style={styles.catHeader}>
                <View
                  style={[styles.colorBadge, { backgroundColor: cat.color }]}
                />
                <Text style={styles.catName}>{cat.name}</Text>
                <Text style={styles.catKindBadge}>{cat.kind}</Text>
              </View>
              <Text style={styles.catDetail}>
                {`Comando: "${cat.voice_command}"`}
              </Text>
              {cat.description ? (
                <Text style={styles.catDetail}>Desc: {cat.description}</Text>
              ) : null}
              <Pressable
                testID={`btn-edit-cat-${cat.id}`}
                style={styles.editButton}
                onPress={() => startEdit(cat)}
              >
                <Text style={styles.editButtonText}>Editar</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      {/* Category Form */}
      <View style={styles.formContainer} testID="category-form">
        <Text style={styles.formTitle}>
          {editingCategory ? "Editar Categoría" : "Nueva Categoría"}
        </Text>

        <Text style={styles.label}>Nombre *</Text>
        <TextInput
          testID="input-cat-name"
          style={styles.input}
          placeholder="Ej. Finanzas"
          placeholderTextColor="#64748B"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Comando de Voz *</Text>
        <TextInput
          testID="input-cat-voice"
          style={styles.input}
          placeholder="Ej. gasto"
          placeholderTextColor="#64748B"
          value={voiceCommand}
          onChangeText={setVoiceCommand}
        />

        <Text style={styles.label}>Descripción</Text>
        <TextInput
          testID="input-cat-desc"
          style={styles.input}
          placeholder="Descripción opcional"
          placeholderTextColor="#64748B"
          value={description}
          onChangeText={setDescription}
        />

        <Text style={styles.label}>Color Hexadecimal</Text>
        <View style={styles.colorRow}>
          <TextInput
            testID="input-cat-color"
            style={[styles.input, { flex: 1 }]}
            placeholder="#38BDF8"
            placeholderTextColor="#64748B"
            value={color}
            onChangeText={setColor}
          />
          {PRESET_COLORS.map((c) => (
            <Pressable
              key={c}
              testID={`color-preset-${c.replace("#", "")}`}
              style={[
                styles.colorDot,
                { backgroundColor: c },
                color.toUpperCase() === c && styles.colorDotActive,
              ]}
              onPress={() => setColor(c)}
            />
          ))}
        </View>

        <Text style={styles.label}>Icono</Text>
        <TextInput
          testID="input-cat-icon"
          style={styles.input}
          placeholder="Ej. folder, star, bookmark"
          placeholderTextColor="#64748B"
          value={icon}
          onChangeText={setIcon}
        />

        {!editingCategory && (
          <>
            <Text style={styles.label}>Tipo de Categoría</Text>
            <View style={styles.kindRow}>
              {(["STANDARD", "TASK"] as CategoryKind[]).map((k) => (
                <Pressable
                  key={k}
                  testID={`kind-chip-${k}`}
                  style={[styles.kindChip, kind === k && styles.kindChipActive]}
                  onPress={() => setKind(k)}
                >
                  <Text
                    style={[
                      styles.kindChipText,
                      kind === k && styles.kindChipTextActive,
                    ]}
                  >
                    {k === "STANDARD" ? "Estándar" : "Tarea"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <View style={styles.buttonRow}>
          {editingCategory && (
            <Pressable
              testID="btn-cancel-edit"
              style={styles.cancelButton}
              onPress={resetForm}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
          )}

          <Pressable
            testID="btn-submit-cat"
            style={[styles.submitButton, loading && styles.buttonDisabled]}
            disabled={loading}
            onPress={handleSubmit}
          >
            <Text style={styles.submitButtonText}>
              {loading
                ? "Guardando..."
                : editingCategory
                  ? "Actualizar Categoría"
                  : "Crear Categoría"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 600,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#F8FAFC",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#94A3B8",
    marginBottom: 10,
  },
  listContainer: {
    gap: 10,
    marginBottom: 20,
  },
  emptyText: {
    color: "#64748B",
    fontStyle: "italic",
  },
  categoryCard: {
    backgroundColor: "#0F172A",
    borderRadius: 8,
    padding: 12,
    borderColor: "#334155",
    borderWidth: 1,
  },
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  colorBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  catName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#F8FAFC",
    flex: 1,
  },
  catKindBadge: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#38BDF8",
    backgroundColor: "#1E293B",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  catDetail: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 2,
  },
  editButton: {
    alignSelf: "flex-end",
    backgroundColor: "#334155",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  editButtonText: {
    color: "#F8FAFC",
    fontSize: 12,
  },
  formContainer: {
    backgroundColor: "#0F172A",
    borderRadius: 8,
    padding: 16,
    borderColor: "#334155",
    borderWidth: 1,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#F8FAFC",
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94A3B8",
    marginTop: 10,
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
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    justifyContent: "flex-end",
  },
  cancelButton: {
    backgroundColor: "#334155",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: "#94A3B8",
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: "#38BDF8",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#0F172A",
    fontWeight: "bold",
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
});
