import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DatabaseAdapter } from "../db/database";

export interface ConflictRecord {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  server_entity: string;
  error_message?: string;
  created_at: string;
}

export interface ConflictResolverProps {
  db: DatabaseAdapter;
  userId: string;
  onResolved?: () => void;
}

export function ConflictResolver({
  db,
  userId,
  onResolved,
}: ConflictResolverProps) {
  const [conflicts, setConflicts] = useState<ConflictRecord[]>([]);
  const [localEntities, setLocalEntities] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadConflicts = async () => {
    try {
      setLoading(true);
      const rows = await db.getAllAsync<ConflictRecord>(
        `SELECT * FROM sync_conflicts WHERE user_id = ? ORDER BY created_at DESC;`,
        [userId],
      );
      setConflicts(rows);

      const localMap: Record<string, Record<string, unknown>> = {};
      for (const row of rows) {
        let table = "entries";
        if (row.entity_type === "CATEGORY") table = "categories";
        if (row.entity_type === "TAG") table = "tags";

        const localRow = await db.getFirstAsync<Record<string, unknown>>(
          `SELECT * FROM ${table} WHERE id = ? AND user_id = ?;`,
          [row.entity_id, userId],
        );
        if (localRow) {
          localMap[row.id] = localRow;
        }
      }
      setLocalEntities(localMap);
      setError(null);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error al cargar los conflictos.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        setLoading(true);
        const rows = await db.getAllAsync<ConflictRecord>(
          `SELECT * FROM sync_conflicts WHERE user_id = ? ORDER BY created_at DESC;`,
          [userId],
        );
        const localMap: Record<string, Record<string, unknown>> = {};
        for (const row of rows) {
          let table = "entries";
          if (row.entity_type === "CATEGORY") table = "categories";
          if (row.entity_type === "TAG") table = "tags";

          const localRow = await db.getFirstAsync<Record<string, unknown>>(
            `SELECT * FROM ${table} WHERE id = ? AND user_id = ?;`,
            [row.entity_id, userId],
          );
          if (localRow) {
            localMap[row.id] = localRow;
          }
        }
        if (mounted) {
          setConflicts(rows);
          setLocalEntities(localMap);
          setError(null);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Error al cargar los conflictos.",
          );
          setLoading(false);
        }
      }
    }
    init();
    return () => {
      mounted = false;
    };
  }, [db, userId]);

  const resolveConflict = async (
    conflict: ConflictRecord,
    choice: "LOCAL" | "REMOTE",
  ) => {
    try {
      const serverPayload = JSON.parse(
        conflict.server_entity || "{}",
      ) as Record<string, unknown>;
      const localPayload = localEntities[conflict.id] || {};

      const localVersion =
        typeof localPayload.version === "number" ? localPayload.version : 1;
      const serverVersion =
        typeof serverPayload.version === "number" ? serverPayload.version : 1;
      const newVersion = Math.max(localVersion, serverVersion) + 1;
      const now = new Date().toISOString();

      let table = "entries";
      if (conflict.entity_type === "CATEGORY") table = "categories";
      if (conflict.entity_type === "TAG") table = "tags";

      if (choice === "REMOTE") {
        if (table === "entries") {
          await db.runAsync(
            `UPDATE entries SET category_id = ?, occurred_at = ?, content = ?, task_status = ?, task_recurrence = ?, updated_at = ?, version = ?, sync_status = 'PENDING_PUSH' WHERE id = ? AND user_id = ?;`,
            [
              serverPayload.category_id ?? localPayload.category_id,
              serverPayload.occurred_at ?? null,
              serverPayload.content ?? localPayload.content,
              serverPayload.task_status ?? null,
              serverPayload.task_recurrence ?? null,
              now,
              newVersion,
              conflict.entity_id,
              userId,
            ],
          );
        } else if (table === "categories") {
          await db.runAsync(
            `UPDATE categories SET name = ?, voice_command = ?, description = ?, color = ?, icon = ?, updated_at = ?, version = ?, sync_status = 'PENDING_PUSH' WHERE id = ? AND user_id = ?;`,
            [
              serverPayload.name ?? localPayload.name,
              serverPayload.voice_command ?? localPayload.voice_command,
              serverPayload.description ?? localPayload.description,
              serverPayload.color ?? localPayload.color,
              serverPayload.icon ?? localPayload.icon,
              now,
              newVersion,
              conflict.entity_id,
              userId,
            ],
          );
        } else if (table === "tags") {
          await db.runAsync(
            `UPDATE tags SET name = ?, name_normalized = ?, updated_at = ?, version = ?, sync_status = 'PENDING_PUSH' WHERE id = ? AND user_id = ?;`,
            [
              serverPayload.name ?? localPayload.name,
              serverPayload.name_normalized ?? localPayload.name_normalized,
              now,
              newVersion,
              conflict.entity_id,
              userId,
            ],
          );
        }
      } else {
        // Choice LOCAL: bump version and set sync_status = 'PENDING_PUSH'
        await db.runAsync(
          `UPDATE ${table} SET version = ?, updated_at = ?, sync_status = 'PENDING_PUSH' WHERE id = ? AND user_id = ?;`,
          [newVersion, now, conflict.entity_id, userId],
        );
      }

      // Delete resolved conflict from sync_conflicts table
      await db.runAsync(
        `DELETE FROM sync_conflicts WHERE id = ? AND user_id = ?;`,
        [conflict.id, userId],
      );

      await loadConflicts();
      onResolved?.();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Error al resolver conflicto.",
      );
    }
  };

  return (
    <View style={styles.container} testID="conflict-resolver">
      <Text style={styles.title}>
        Resolución de Conflictos de Sincronización
      </Text>

      {error && (
        <View style={styles.errorContainer} testID="conflict-error-container">
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading && (
        <View style={styles.centerContainer} testID="loading-container">
          <Text style={styles.infoText}>Cargando conflictos...</Text>
        </View>
      )}

      {!loading && !error && conflicts.length === 0 && (
        <View style={styles.centerContainer} testID="no-conflicts">
          <Text style={styles.infoText}>
            No hay conflictos pendientes de resolución
          </Text>
        </View>
      )}

      {!loading && !error && conflicts.length > 0 && (
        <ScrollView style={styles.conflictList}>
          {conflicts.map((conflict) => {
            const localData = localEntities[conflict.id] || {};
            const serverData = JSON.parse(
              conflict.server_entity || "{}",
            ) as Record<string, unknown>;

            return (
              <View
                key={conflict.id}
                style={styles.conflictCard}
                testID={`conflict-card-${conflict.id}`}
              >
                <Text style={styles.entityTitle}>
                  Conflicto en {conflict.entity_type} #{conflict.entity_id}
                </Text>
                <Text style={styles.errorSubtext}>
                  Motivo: {conflict.error_message || "Cambios divergentes"}
                </Text>

                <View style={styles.variantsRow}>
                  {/* Local Variant */}
                  <View
                    style={styles.variantBox}
                    testID={`local-variant-${conflict.id}`}
                  >
                    <Text style={styles.variantHeader}>Versión Local</Text>
                    <Text style={styles.fieldLabel}>Contenido / Nombre:</Text>
                    <Text style={styles.fieldValue}>
                      {String(
                        localData.content ??
                          localData.name ??
                          "(Sin contenido)",
                      )}
                    </Text>
                    <Text style={styles.fieldLabel}>Versión:</Text>
                    <Text style={styles.fieldValue}>
                      v{String(localData.version ?? 1)}
                    </Text>
                  </View>

                  {/* Remote Variant */}
                  <View
                    style={styles.variantBox}
                    testID={`remote-variant-${conflict.id}`}
                  >
                    <Text style={styles.variantHeader}>Versión Remota</Text>
                    <Text style={styles.fieldLabel}>Contenido / Nombre:</Text>
                    <Text style={styles.fieldValue}>
                      {String(
                        serverData.content ??
                          serverData.name ??
                          "(Sin contenido)",
                      )}
                    </Text>
                    <Text style={styles.fieldLabel}>Versión:</Text>
                    <Text style={styles.fieldValue}>
                      v{String(serverData.version ?? 1)}
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.actionsRow}>
                  <Pressable
                    style={styles.btnLocal}
                    onPress={() => resolveConflict(conflict, "LOCAL")}
                    testID={`btn-keep-local-${conflict.id}`}
                  >
                    <Text style={styles.btnText}>Conservar Local</Text>
                  </Pressable>

                  <Pressable
                    style={styles.btnRemote}
                    onPress={() => resolveConflict(conflict, "REMOTE")}
                    testID={`btn-keep-remote-${conflict.id}`}
                  >
                    <Text style={styles.btnText}>Conservar Remota</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f4f6f8",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#2c3e50",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  infoText: {
    fontSize: 16,
    color: "#7f8c8d",
    textAlign: "center",
  },
  errorContainer: {
    padding: 12,
    backgroundColor: "#f8d7da",
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: "#721c24",
    fontSize: 14,
  },
  conflictList: {
    flex: 1,
  },
  conflictCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e1e8ed",
  },
  entityTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#34495e",
  },
  errorSubtext: {
    fontSize: 13,
    color: "#e74c3c",
    marginBottom: 12,
  },
  variantsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  variantBox: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bdc3c7",
    backgroundColor: "#f9fafb",
  },
  variantHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    color: "#7f8c8d",
    marginTop: 4,
  },
  fieldValue: {
    fontSize: 14,
    color: "#2c3e50",
    fontWeight: "500",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  btnLocal: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: "#27ae60",
    borderRadius: 6,
    alignItems: "center",
  },
  btnRemote: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: "#2980b9",
    borderRadius: 6,
    alignItems: "center",
  },
  btnText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 14,
  },
});
