export type CategoryKind = "STANDARD" | "TASK" | "EVENT" | "CAPTURE";

export type TaskStatus = "PENDING" | "IN_PROGRESS" | "DONE";

export type TaskRecurrence = "ONCE" | "RECURRING";

export type SaveMode = "FAST_FORWARD" | "PREVIEW_BEFORE_SAVE";

export type SyncStatus = "SYNCED" | "PENDING_PUSH";

export interface Category {
  id: string;
  user_id: string;
  kind: CategoryKind;
  name: string;
  name_normalized: string;
  voice_command: string;
  voice_command_normalized: string;
  description: string;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
  version: number;
  sync_status: SyncStatus;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  name_normalized: string;
  created_at: string;
  updated_at: string;
  version: number;
  sync_status: SyncStatus;
}

export function normalizeTextKey(text: string): string {
  return text.trim().toLowerCase();
}

export function normalizeTagName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[_\-\s]+/g, " ");
}
