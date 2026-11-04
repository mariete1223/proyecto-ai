/**
 * @jest-environment jsdom
 */
import {
  exportUserData,
  downloadBackupFile,
  UserBackupPayload,
} from "./backupService";
import { DatabaseAdapter } from "../db/database";
import * as entriesDb from "../db/entries";
import * as categoriesDb from "../db/categories";
import * as tagsDb from "../db/tags";
import { Category, Entry, Tag } from "../types/domain";

// @ts-ignore
const { TextEncoder, TextDecoder } = require("util");
(globalThis as any).TextEncoder = TextEncoder;
(globalThis as any).TextDecoder = TextDecoder;

jest.mock("../db/entries");
jest.mock("../db/categories");
jest.mock("../db/tags");

describe("backupService", () => {
  const mockDb = {} as DatabaseAdapter;
  const userId = "user-123";
  const userEmail = "test@example.com";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("exports all entries, categories, and tags with proper stats", async () => {
    const fakeEntries: Entry[] = [
      {
        id: "entry-1",
        user_id: userId,
        category_id: "cat-1",
        content: "Nota de prueba",
        created_at: "2026-11-04T12:00:00Z",
        updated_at: "2026-11-04T12:00:00Z",
        version: 1,
      } as Entry,
    ];

    const fakeCategories: Category[] = [
      {
        id: "cat-1",
        user_id: userId,
        name: "Notas",
        name_normalized: "notas",
        color: "#3B82F6",
        icon: "note",
        created_at: "2026-11-04T10:00:00Z",
        updated_at: "2026-11-04T10:00:00Z",
        version: 1,
      } as Category,
    ];

    const fakeTags: Tag[] = [
      {
        id: "tag-1",
        user_id: userId,
        name: "Importante",
        name_normalized: "importante",
        color: "#EF4444",
        created_at: "2026-11-04T10:00:00Z",
        updated_at: "2026-11-04T10:00:00Z",
        version: 1,
      } as Tag,
    ];

    (entriesDb.listLocalEntries as jest.Mock).mockResolvedValue(fakeEntries);
    (categoriesDb.listCategories as jest.Mock).mockResolvedValue(
      fakeCategories,
    );
    (tagsDb.listTags as jest.Mock).mockResolvedValue(fakeTags);

    const backup = await exportUserData(mockDb, userId, userEmail);

    expect(backup.app).toBe("VoxDaily");
    expect(backup.version).toBe("1.0");
    expect(backup.user.id).toBe(userId);
    expect(backup.user.email).toBe(userEmail);
    expect(backup.stats.entriesCount).toBe(1);
    expect(backup.stats.categoriesCount).toBe(1);
    expect(backup.stats.tagsCount).toBe(1);
    expect(backup.data.entries).toEqual(fakeEntries);
    expect(backup.data.categories).toEqual(fakeCategories);
    expect(backup.data.tags).toEqual(fakeTags);
  });

  it("triggers download in web environment", () => {
    const backup: UserBackupPayload = {
      app: "VoxDaily",
      version: "1.0",
      exportedAt: "2026-11-04T12:00:00Z",
      user: { id: "u1", email: "test@example.com" },
      stats: { entriesCount: 0, categoriesCount: 0, tagsCount: 0 },
      data: { entries: [], categories: [], tags: [] },
    };

    const createElementSpy = jest.spyOn(document, "createElement");
    const appendChildSpy = jest.spyOn(document.body, "appendChild");
    const removeChildSpy = jest.spyOn(document.body, "removeChild");

    // Mock Object URL
    const originalCreate = window.URL.createObjectURL;
    const originalRevoke = window.URL.revokeObjectURL;
    window.URL.createObjectURL = jest.fn(() => "blob:mock-url");
    window.URL.revokeObjectURL = jest.fn();

    const success = downloadBackupFile(backup, "custom-backup.json");
    expect(success).toBe(true);
    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");

    window.URL.createObjectURL = originalCreate;
    window.URL.revokeObjectURL = originalRevoke;
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});
