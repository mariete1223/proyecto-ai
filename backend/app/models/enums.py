from enum import StrEnum


class CategoryKind(StrEnum):
    STANDARD = "STANDARD"
    TASK = "TASK"
    EVENT = "EVENT"
    CAPTURE = "CAPTURE"


class TaskStatus(StrEnum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"


class TaskRecurrence(StrEnum):
    ONCE = "ONCE"
    RECURRING = "RECURRING"


class SaveMode(StrEnum):
    FAST_FORWARD = "FAST_FORWARD"
    PREVIEW_BEFORE_SAVE = "PREVIEW_BEFORE_SAVE"


class CorrectionField(StrEnum):
    CATEGORY_ID = "CATEGORY_ID"
    OCCURRED_AT = "OCCURRED_AT"
    CONTENT = "CONTENT"
    TAG_IDS = "TAG_IDS"


class TombstoneEntity(StrEnum):
    CATEGORY = "CATEGORY"
    TAG = "TAG"
    ENTRY = "ENTRY"
    ENTRY_TAG = "ENTRY_TAG"
    SAVE_PREFERENCE = "SAVE_PREFERENCE"
    CAPTURE_CORRECTION = "CAPTURE_CORRECTION"
