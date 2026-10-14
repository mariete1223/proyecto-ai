"""allow multiple task categories by restricting special kind index to EVENT and CAPTURE

Revision ID: 0003_allow_multiple_task_categories
Revises: 0002_add_tag_color
Create Date: 2026-10-14 22:45:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_allow_multiple_task_categories"
down_revision: str | Sequence[str] | None = "0002_add_tag_color"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index("uq_categories_user_id_special_kind", table_name="categories")
    op.create_index(
        "uq_categories_user_id_special_kind",
        "categories",
        ["user_id", "kind"],
        unique=True,
        postgresql_where=sa.text("kind IN ('EVENT', 'CAPTURE')"),
    )


def downgrade() -> None:
    op.drop_index("uq_categories_user_id_special_kind", table_name="categories")
    op.create_index(
        "uq_categories_user_id_special_kind",
        "categories",
        ["user_id", "kind"],
        unique=True,
        postgresql_where=sa.text("kind <> 'STANDARD'"),
    )
