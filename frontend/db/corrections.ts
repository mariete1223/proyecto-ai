import { DatabaseAdapter } from "./database";

export interface CaptureCorrection {
  id: string;
  user_id: string;
  entry_id: string;
  capture_session_id: string;
  field: string;
  interpreted_value: string | null;
  accepted_value: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  sync_status: string;
}

export interface CreateCorrectionData {
  entry_id: string;
  capture_session_id: string;
  field: string;
  interpreted_value: string | null;
  accepted_value: string | null;
}

export async function createLocalCorrection(
  db: DatabaseAdapter,
  userId: string,
  data: CreateCorrectionData,
): Promise<CaptureCorrection> {
  const id = Math.random().toString(36).substring(2, 15);
  const now = new Date().toISOString();

  const correction: CaptureCorrection = {
    id,
    user_id: userId,
    entry_id: data.entry_id,
    capture_session_id: data.capture_session_id,
    field: data.field,
    interpreted_value: data.interpreted_value,
    accepted_value: data.accepted_value,
    created_at: now,
    updated_at: now,
    version: 1,
    sync_status: "PENDING_PUSH",
  };

  await db.runAsync(
    `INSERT INTO capture_corrections (id, user_id, entry_id, capture_session_id, field, interpreted_value, accepted_value, created_at, updated_at, version, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      correction.id,
      correction.user_id,
      correction.entry_id,
      correction.capture_session_id,
      correction.field,
      correction.interpreted_value,
      correction.accepted_value,
      correction.created_at,
      correction.updated_at,
      correction.version,
      correction.sync_status,
    ],
  );

  return correction;
}

export async function listLocalCorrectionsForEntry(
  db: DatabaseAdapter,
  userId: string,
  entryId: string,
): Promise<CaptureCorrection[]> {
  return db.getAllAsync<CaptureCorrection>(
    `SELECT * FROM capture_corrections WHERE entry_id = ? AND user_id = ? ORDER BY created_at ASC;`,
    [entryId, userId],
  );
}
