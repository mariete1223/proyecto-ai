import { DatabaseAdapter } from "../db/database";
import { listLocalEntries } from "../db/entries";
import { listCategories } from "../db/categories";
import { listTags } from "../db/tags";
import { Category, Entry, Tag } from "../types/domain";

export interface UserBackupPayload {
  app: string;
  version: string;
  exportedAt: string;
  user: {
    id: string;
    email?: string;
  };
  stats: {
    entriesCount: number;
    categoriesCount: number;
    tagsCount: number;
  };
  data: {
    entries: Entry[];
    categories: Category[];
    tags: Tag[];
  };
}

export async function exportUserData(
  db: DatabaseAdapter,
  userId: string,
  userEmail?: string,
): Promise<UserBackupPayload> {
  const [entries, categories, tags] = await Promise.all([
    listLocalEntries(db, userId),
    listCategories(db, userId),
    listTags(db, userId),
  ]);

  return {
    app: "VoxDaily",
    version: "1.0",
    exportedAt: new Date().toISOString(),
    user: {
      id: userId,
      email: userEmail || undefined,
    },
    stats: {
      entriesCount: entries.length,
      categoriesCount: categories.length,
      tagsCount: tags.length,
    },
    data: {
      entries,
      categories,
      tags,
    },
  };
}

export function downloadBackupFile(
  backup: UserBackupPayload,
  filenameOverride?: string,
): boolean {
  try {
    const jsonString = JSON.stringify(backup, null, 2);
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const blob = new Blob([jsonString], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const datePart = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = filenameOverride || `voxdaily-backup-${datePart}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    }
  } catch (err) {
    console.error("[BackupService] Failed to trigger download:", err);
  }
  return false;
}
